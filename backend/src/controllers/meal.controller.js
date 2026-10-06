const { MealEntry, Member } = require('../models');
const ApiError = require('../utils/ApiError');
const { audit } = require('../services/audit.service');
const { isAdmin, assertId } = require('../middleware/access');
const { inMonth, isValidDate } = require('../utils/dates');
const { isPresentOn } = require('../services/calculation.service');

function assertDate(req, date) {
  if (!isValidDate(date) || !inMonth(date, req.month.year, req.month.month)) throw ApiError.badRequest('Date is not in this month');
}

const canEditFor = (req, memberId) => {
  if (isAdmin(req)) return true;
  if (req.month.settings.permissions && req.month.settings.permissions.memberCanEditOthersMeals) return true;
  return req.selfMember && String(req.selfMember._id) === String(memberId);
};

const plain = (counts) => (counts instanceof Map ? Object.fromEntries(counts) : { ...(counts || {}) });
const total = (counts) => Object.values(plain(counts)).reduce((s, v) => s + (Number(v) || 0), 0);

/** Writes one member's counts for one day. Zero everywhere removes the entry. */
async function writeEntry(req, member, date, counts) {
  const keys = new Set(req.month.mealTypes.map((t) => t.key));
  for (const k of Object.keys(counts)) if (!keys.has(k)) throw ApiError.badRequest(`Unknown meal type "${k}"`);
  if (!canEditFor(req, member._id)) throw ApiError.forbidden('You can only record your own meals');
  if (!isPresentOn(member, date) && total(counts) > 0) {
    throw ApiError.badRequest(`${member.fullName} is not a member on ${date} (joined ${member.joinDate}${member.leaveDate ? `, left ${member.leaveDate}` : ''})`);
  }
  const clean = Object.fromEntries(Object.entries(counts).filter(([, v]) => Number(v) > 0));
  const existing = await MealEntry.findOne({ month: req.month._id, member: member._id, date });
  const before = existing ? plain(existing.counts) : {};
  if (!Object.keys(clean).length) {
    if (existing) await existing.deleteOne();
  } else {
    await MealEntry.findOneAndUpdate({ month: req.month._id, member: member._id, date }, { counts: clean, updatedBy: req.user._id }, { upsert: true, new: true, setDefaultsOnInsert: true });
  }
  const changed = JSON.stringify(before) !== JSON.stringify(clean);
  return changed ? { member: member.fullName, memberId: member._id, before, after: clean } : null;
}

async function loadMembers(req, ids) {
  const members = await Member.find({ _id: { $in: ids }, month: req.month._id, deletedAt: null }).lean();
  if (members.length !== new Set(ids.map(String)).size) throw ApiError.badRequest('One or more members do not belong to this month');
  return new Map(members.map((m) => [String(m._id), m]));
}

async function logChanges(req, date, changes, how) {
  const real = changes.filter(Boolean);
  if (!real.length) return;
  const names = real.map((c) => c.member);
  await audit(req, {
    action: 'update',
    entity: 'Meals',
    summary: `${req.user.name} ${how} meals for ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` and ${names.length - 3} more` : ''} on ${date}`,
    before: real.map((c) => ({ member: c.memberId, counts: c.before })),
    after: real.map((c) => ({ member: c.memberId, counts: c.after })),
  });
}

exports.list = async (req, res) => {
  const filter = { month: req.month._id };
  if (req.query.from || req.query.to) filter.date = { ...(req.query.from && { $gte: String(req.query.from) }), ...(req.query.to && { $lte: String(req.query.to) }) };
  if (req.query.member) {
    assertId(String(req.query.member), 'member');
    filter.member = String(req.query.member);
  }
  const items = await MealEntry.find(filter).select('member date counts').sort({ date: 1 }).lean();
  res.json({ items });
};

exports.day = async (req, res) => {
  const { date } = req.params;
  assertDate(req, date);
  const [members, entries] = await Promise.all([
    Member.find({ month: req.month._id, deletedAt: null }).sort({ fullName: 1 }).lean(),
    MealEntry.find({ month: req.month._id, date }).lean(),
  ]);
  const byMember = new Map(entries.map((e) => [String(e.member), e.counts]));
  res.json({
    date,
    mealTypes: req.month.mealTypes,
    rows: members
      .map((m) => ({ member: { _id: m._id, fullName: m.fullName, nickname: m.nickname, photoUrl: m.photoUrl }, present: isPresentOn(m, date), counts: byMember.get(String(m._id)) || {}, canEdit: canEditFor(req, m._id) }))
      .filter((r) => r.present || total(r.counts) > 0),
  });
};

exports.saveDay = async (req, res) => {
  const { date } = req.params;
  assertDate(req, date);
  const map = await loadMembers(req, req.body.entries.map((e) => e.member));
  const changes = [];
  for (const e of req.body.entries) changes.push(await writeEntry(req, map.get(String(e.member)), date, e.counts));
  await logChanges(req, date, changes, 'updated');
  res.json({ ok: true, changed: changes.filter(Boolean).length });
};

exports.quick = async (req, res) => {
  const { date, members, mealTypes, value } = req.body;
  assertDate(req, date);
  const map = await loadMembers(req, members);
  const existing = await MealEntry.find({ month: req.month._id, date, member: { $in: members } }).lean();
  const current = new Map(existing.map((e) => [String(e.member), plain(e.counts)]));
  const changes = [];
  for (const id of members) {
    const counts = { ...(current.get(String(id)) || {}) };
    for (const t of mealTypes) counts[t] = value;
    changes.push(await writeEntry(req, map.get(String(id)), date, counts));
  }
  await logChanges(req, date, changes, value ? 'marked' : 'cleared');
  res.json({ ok: true, changed: changes.filter(Boolean).length });
};

exports.copy = async (req, res) => {
  const { from, to } = req.body;
  assertDate(req, to);
  if (!isValidDate(from)) throw ApiError.badRequest('Invalid source date');
  const source = await MealEntry.find({ month: req.month._id, date: from }).lean();
  if (!source.length) throw ApiError.badRequest(`No meals recorded on ${from} to copy`);
  const wanted = req.body.members ? new Set(req.body.members.map(String)) : null;
  const map = await loadMembers(req, source.map((e) => e.member));
  const changes = [];
  const skipped = [];
  for (const e of source) {
    const m = map.get(String(e.member));
    if (wanted && !wanted.has(String(e.member))) continue;
    if (!canEditFor(req, m._id)) continue;
    if (!isPresentOn(m, to)) {
      skipped.push(m.fullName);
      continue;
    }
    changes.push(await writeEntry(req, m, to, plain(e.counts)));
  }
  await logChanges(req, to, changes, `copied ${from} →`);
  res.json({ ok: true, changed: changes.filter(Boolean).length, skipped });
};

exports.removeEntry = async (req, res) => {
  const { date, memberId } = req.params;
  assertDate(req, date);
  assertId(memberId, 'member');
  const map = await loadMembers(req, [memberId]);
  const change = await writeEntry(req, map.get(String(memberId)), date, {});
  await logChanges(req, date, [change], 'cleared');
  res.json({ ok: true });
};
