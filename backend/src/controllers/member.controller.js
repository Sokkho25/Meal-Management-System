const { Member, User, MealEntry, Contribution, BazarItem } = require('../models');
const ApiError = require('../utils/ApiError');
const { audit } = require('../services/audit.service');
const { isAdmin, assertId } = require('../middleware/access');
const { monthRange } = require('../utils/dates');

async function linkUser(req, member) {
  if (!member.email) return;
  const user = await User.findOne({ email: member.email });
  const h = req.household;
  if (user) {
    member.user = user._id;
    const entry = h.users.find((u) => String(u.user) === String(user._id));
    if (!entry) h.users.push({ user: user._id, role: member.role });
    else if (String(h.owner) !== String(user._id)) entry.role = member.role;
  } else {
    const inv = h.invites.find((i) => i.email === member.email);
    if (inv) inv.role = member.role;
    else h.invites.push({ email: member.email, role: member.role });
  }
  await h.save();
}

function checkDates(req, joinDate, leaveDate) {
  const { start, end } = monthRange(req.month.year, req.month.month);
  if (joinDate > end) throw ApiError.badRequest('Joining date is after this month ends');
  if (leaveDate && leaveDate < joinDate) throw ApiError.badRequest('Leaving date cannot be before the joining date');
  if (leaveDate && leaveDate < start) throw ApiError.badRequest('Leaving date is before this month starts');
}

exports.list = async (req, res) => {
  const members = await Member.find({ month: req.month._id, deletedAt: null }).sort({ role: 1, fullName: 1 }).lean();
  res.json({ items: members });
};

exports.create = async (req, res) => {
  const { start } = monthRange(req.month.year, req.month.month);
  const body = { ...req.body, joinDate: req.body.joinDate || start };
  checkDates(req, body.joinDate, body.leaveDate);
  if (body.email && (await Member.exists({ month: req.month._id, email: body.email, deletedAt: null }))) {
    throw ApiError.conflict('A member with this email already exists this month');
  }
  const member = new Member({ ...body, month: req.month._id, household: req.household._id, createdBy: req.user._id });
  member.personKey = String(member._id);
  await linkUser(req, member);
  await member.save();
  await audit(req, { action: 'create', entity: 'Member', entityId: member._id, summary: `${req.user.name} added member ${member.fullName}`, after: member });
  res.status(201).json({ item: member });
};

exports.update = async (req, res) => {
  assertId(req.params.id);
  const member = await Member.findOne({ _id: req.params.id, month: req.month._id, deletedAt: null });
  if (!member) throw ApiError.notFound('Member not found');
  const self = req.selfMember && String(req.selfMember._id) === String(member._id);
  let body = req.body;
  if (!isAdmin(req)) {
    if (!self) throw ApiError.forbidden('You can only edit your own profile');
    body = Object.fromEntries(Object.entries(body).filter(([k]) => ['nickname', 'mobile', 'photoUrl'].includes(k)));
  }
  const before = member.toObject();
  Object.assign(member, body);
  if (member.leaveDate === '') member.leaveDate = null;
  checkDates(req, member.joinDate, member.leaveDate);
  if (isAdmin(req) && (body.email !== undefined || body.role !== undefined)) await linkUser(req, member);
  await member.save();
  await audit(req, { action: 'update', entity: 'Member', entityId: member._id, summary: `${req.user.name} updated member ${member.fullName}`, before, after: member });
  res.json({ item: member });
};

exports.remove = async (req, res) => {
  assertId(req.params.id);
  const member = await Member.findOne({ _id: req.params.id, month: req.month._id, deletedAt: null });
  if (!member) throw ApiError.notFound('Member not found');
  const [meals, deposits, purchases] = await Promise.all([
    MealEntry.countDocuments({ member: member._id }),
    Contribution.countDocuments({ member: member._id, deletedAt: null }),
    BazarItem.countDocuments({ 'purchasers.member': member._id, deletedAt: null }),
  ]);
  if ((meals || deposits || purchases) && req.query.force !== 'true') {
    throw ApiError.conflict(
      `${member.fullName} has ${meals} meal days, ${deposits} deposits and ${purchases} purchases this month. Set a leaving date instead, or confirm removal (their records are kept and come back if the member is restored).`
    );
  }
  member.deletedAt = new Date();
  member.deletedBy = req.user._id;
  await member.save();
  await audit(req, { action: 'delete', entity: 'Member', entityId: member._id, summary: `${req.user.name} removed member ${member.fullName}`, before: member });
  res.json({ ok: true });
};

exports.restore = async (req, res) => {
  assertId(req.params.id);
  const member = await Member.findOne({ _id: req.params.id, month: req.month._id });
  if (!member) throw ApiError.notFound('Member not found');
  member.deletedAt = null;
  member.deletedBy = null;
  await member.save();
  await audit(req, { action: 'restore', entity: 'Member', entityId: member._id, summary: `${req.user.name} restored member ${member.fullName}` });
  res.json({ item: member });
};
