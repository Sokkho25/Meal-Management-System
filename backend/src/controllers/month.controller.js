const { Month, Member, MealEntry, GuestMeal, BazarItem, Expense, Contribution, Settlement, MonthlyReport, MealPlan } = require('../models');
const { DEFAULT_MEAL_TYPES, DEFAULT_SETTINGS } = require('../models/constants');
const ApiError = require('../utils/ApiError');
const { monthRange, monthLabel, inMonth, today, isValidDate } = require('../utils/dates');
const { audit } = require('../services/audit.service');
const { getCalculation, previousMonths } = require('../services/month.service');
const { buildNotifications } = require('../services/notification.service');

const toPlain = (doc) => doc.toObject({ flattenMaps: true });

exports.create = async (req, res) => {
  const b = req.body;
  if (await Month.exists({ household: req.household._id, year: b.year, month: b.month })) {
    throw ApiError.conflict(`${monthLabel(b.year, b.month)} already exists for this household`);
  }
  let source = null;
  if (b.copyFrom) {
    source = await Month.findOne({ _id: b.copyFrom, household: req.household._id });
    if (!source) throw ApiError.notFound('Month to copy from was not found');
  } else {
    source = await Month.findOne({
      household: req.household._id,
      $or: [{ year: { $lt: b.year } }, { year: b.year, month: { $lt: b.month } }],
    }).sort({ year: -1, month: -1 });
  }
  const sourcePlain = source && toPlain(source);
  const { start } = monthRange(b.year, b.month);

  let calc = null;
  if (source && b.carryForward) calc = await getCalculation(source);
  const carryFund = sourcePlain ? sourcePlain.settings.carryForward.fund !== false : false;
  const carryMembers = sourcePlain ? sourcePlain.settings.carryForward.memberBalances !== false : false;

  const month = await Month.create({
    household: req.household._id,
    year: b.year,
    month: b.month,
    name: b.name || req.household.name,
    address: b.address || req.household.address || '',
    currency: req.household.currency,
    startingBalance: b.startingBalance || 0,
    carryBalance: b.carryBalance !== undefined ? b.carryBalance : calc && carryFund ? calc.totals.cashInHand : 0,
    previousMonth: source ? source._id : null,
    mealTypes: b.mealTypes || (sourcePlain && b.copySettings ? sourcePlain.mealTypes : DEFAULT_MEAL_TYPES),
    budget: b.budget || (sourcePlain && b.copySettings ? sourcePlain.budget : undefined),
    settings: sourcePlain && b.copySettings ? stripShares(sourcePlain.settings) : DEFAULT_SETTINGS(),
    createdBy: req.user._id,
  });

  // Copy members who are still around. The previous month is only read, never changed.
  let created = 0;
  if (source && b.copyMembers) {
    const prevMembers = await Member.find({ month: source._id, deletedAt: null }).lean();
    const idMap = {};
    for (const pm of prevMembers) {
      if (pm.leaveDate && pm.leaveDate < start) continue;
      if (pm.active === false && !pm.leaveDate) continue;
      const result = calc && calc.members.find((x) => x.id === String(pm._id));
      const nm = await Member.create({
        month: month._id,
        household: req.household._id,
        user: pm.user,
        fullName: pm.fullName,
        nickname: pm.nickname,
        mobile: pm.mobile,
        email: pm.email,
        photoUrl: pm.photoUrl,
        role: pm.role,
        joinDate: pm.joinDate > start ? pm.joinDate : start,
        leaveDate: pm.leaveDate && inMonth(pm.leaveDate, b.year, b.month) ? pm.leaveDate : null,
        active: true,
        openingBalance: result && carryMembers ? result.balance : 0,
        personKey: pm.personKey || String(pm._id),
        createdBy: req.user._id,
      });
      idMap[String(pm._id)] = String(nm._id);
      created += 1;
    }
    // Re-map member-specific split shares to the new member ids.
    if (b.copySettings) remapShares(month, sourcePlain.settings, idMap);
    await month.save();
  }
  if (!created && req.role === 'admin') {
    await Member.create({
      month: month._id,
      household: req.household._id,
      user: req.user._id,
      fullName: req.user.name,
      email: req.user.email,
      mobile: req.user.phone,
      role: 'admin',
      joinDate: start,
      personKey: `user:${req.user._id}`,
      createdBy: req.user._id,
    });
  }
  req.month = month;
  await audit(req, { action: 'create', entity: 'Month', entityId: month._id, summary: `${req.user.name} created ${monthLabel(b.year, b.month)}` });
  res.status(201).json({ month });
};

function stripShares(settings) {
  const s = JSON.parse(JSON.stringify(settings));
  for (const t of Object.keys(s.distribution || {})) s.distribution[t].shares = {};
  (s.categoryRules || []).forEach((r) => (r.shares = {}));
  return s;
}

function remapShares(month, srcSettings, idMap) {
  const remap = (shares = {}) => Object.fromEntries(Object.entries(shares).filter(([k]) => idMap[k]).map(([k, v]) => [idMap[k], v]));
  for (const t of Object.keys(srcSettings.distribution || {})) {
    month.set(`settings.distribution.${t}.shares`, remap(srcSettings.distribution[t].shares));
  }
  month.set(
    'settings.categoryRules',
    (srcSettings.categoryRules || []).map((r) => ({ ...r, shares: remap(r.shares) }))
  );
}

exports.get = async (req, res) => {
  res.json({ month: req.month, role: req.role, selfMember: req.selfMember, household: { _id: req.household._id, name: req.household.name, type: req.household.type, currency: req.household.currency } });
};

exports.update = async (req, res) => {
  const before = toPlain(req.month);
  const { settings, budget, ...rest } = req.body;
  Object.assign(req.month, rest);
  if (budget) for (const [k, v] of Object.entries(budget)) req.month.set(`budget.${k}`, v);
  if (settings) {
    for (const k of ['mealMode', 'equalSplitMode', 'guestMeals']) if (settings[k] !== undefined) req.month.set(`settings.${k}`, settings[k]);
    for (const k of ['rounding', 'carryForward', 'permissions']) {
      if (settings[k]) for (const [kk, v] of Object.entries(settings[k])) req.month.set(`settings.${k}.${kk}`, v);
    }
    if (settings.distribution) for (const [t, rule] of Object.entries(settings.distribution)) req.month.set(`settings.distribution.${t}`, rule);
    if (settings.categoryRules) req.month.set('settings.categoryRules', settings.categoryRules);
  }
  await req.month.save();
  await audit(req, { action: 'update', entity: 'Month', entityId: req.month._id, summary: `${req.user.name} updated settings for ${monthLabel(req.month.year, req.month.month)}`, before, after: toPlain(req.month) });
  res.json({ month: req.month });
};

exports.calculation = async (req, res) => {
  res.json(await getCalculation(req.month));
};

exports.dashboard = async (req, res) => {
  const [calc, recentBazar, trend] = await Promise.all([
    getCalculation(req.month),
    BazarItem.find({ month: req.month._id, deletedAt: null, status: 'active' }).sort({ date: -1, createdAt: -1 }).limit(6).lean(),
    previousMonths(req.household._id, req.month.year, req.month.month, 6),
  ]);
  const notifications = await buildNotifications(req, calc);
  const t = today();
  res.json({ calculation: calc, recentBazar, trend, today: inMonth(t, req.month.year, req.month.month) ? t : null, notifications: notifications.slice(0, 5), notificationCount: notifications.length });
};

exports.daily = async (req, res) => {
  const { date } = req.params;
  if (!isValidDate(date) || !inMonth(date, req.month.year, req.month.month)) throw ApiError.badRequest('Date is not in this month');
  const q = { month: req.month._id, date };
  const [calc, members, entries, guests, bazar, expenses, contributions, plans] = await Promise.all([
    getCalculation(req.month),
    Member.find({ month: req.month._id, deletedAt: null }).sort({ fullName: 1 }).lean(),
    MealEntry.find(q).lean(),
    GuestMeal.find({ ...q, deletedAt: null }).populate('host', 'fullName').lean(),
    BazarItem.find({ ...q, deletedAt: null }).populate('purchasers.member', 'fullName nickname').sort({ createdAt: 1 }).lean(),
    Expense.find({ ...q, deletedAt: null }).populate('paidBy', 'fullName').sort({ createdAt: 1 }).lean(),
    Contribution.find({ ...q, deletedAt: null }).populate('member', 'fullName').lean(),
    MealPlan.find(q).lean(),
  ]);
  const day = calc.daily.find((d) => d.date === date);
  const byMember = new Map(entries.map((e) => [String(e.member), e.counts]));
  res.json({
    date,
    summary: day,
    mealRate: calc.totals.mealRate,
    mealTypes: calc.mealTypes,
    meals: members
      .filter((m) => byMember.has(String(m._id)) || ((!m.leaveDate || m.leaveDate >= date) && m.joinDate <= date && m.active))
      .map((m) => ({ member: { _id: m._id, fullName: m.fullName, nickname: m.nickname }, counts: byMember.get(String(m._id)) || {} })),
    guests,
    bazar,
    expenses,
    contributions,
    plans,
  });
};

exports.closePreview = async (req, res) => {
  const calc = await getCalculation(req.month);
  res.json({
    month: { _id: req.month._id, year: req.month.year, month: req.month.month, name: req.month.name, status: req.month.status },
    totals: calc.totals,
    members: calc.members.map(({ breakdown, shared, ...m }) => m),
    outstanding: calc.members.filter((m) => m.status === 'due').map((m) => ({ id: m.id, fullName: m.fullName, due: m.due })),
    warnings: calc.warnings,
  });
};

exports.close = async (req, res) => {
  if (req.month.status === 'closed') throw ApiError.conflict('Month is already closed');
  const calc = await getCalculation(req.month);
  await MonthlyReport.findOneAndUpdate(
    { month: req.month._id },
    { household: req.household._id, month: req.month._id, year: req.month.year, monthNumber: req.month.month, totals: calc.totals, members: calc.members, calculation: calc, generatedAt: new Date(), generatedBy: req.user._id },
    { upsert: true, new: true }
  );
  req.month.status = 'closed';
  req.month.closedAt = new Date();
  req.month.closedBy = req.user._id;
  await req.month.save();
  await audit(req, { action: 'close', entity: 'Month', entityId: req.month._id, summary: `${req.user.name} closed ${monthLabel(req.month.year, req.month.month)}` });
  res.json({ month: req.month });
};

exports.reopen = async (req, res) => {
  if (req.month.status !== 'closed') throw ApiError.conflict('Month is not closed');
  req.month.status = 'open';
  req.month.reopenedAt = new Date();
  await req.month.save();
  await audit(req, { action: 'reopen', entity: 'Month', entityId: req.month._id, summary: `${req.user.name} reopened ${monthLabel(req.month.year, req.month.month)}` });
  res.json({ month: req.month });
};

exports.trash = async (req, res) => {
  const q = { month: req.month._id, deletedAt: { $ne: null } };
  const pick = 'deletedAt deletedBy';
  const [members, bazar, expenses, contributions, settlements, guests] = await Promise.all([
    Member.find(q).select(`fullName ${pick}`).lean(),
    BazarItem.find(q).select(`date itemName totalPrice ${pick}`).lean(),
    Expense.find(q).select(`date title amount ${pick}`).lean(),
    Contribution.find(q).populate('member', 'fullName').select(`date amount member ${pick}`).lean(),
    Settlement.find(q).populate('member', 'fullName').select(`date amount direction member ${pick}`).lean(),
    GuestMeal.find(q).populate('host', 'fullName').select(`date guestName count host ${pick}`).lean(),
  ]);
  const rows = [
    ...members.map((x) => ({ kind: 'members', id: x._id, label: `Member: ${x.fullName}`, deletedAt: x.deletedAt })),
    ...bazar.map((x) => ({ kind: 'bazar', id: x._id, label: `Bazar: ${x.itemName} (${x.totalPrice}) on ${x.date}`, deletedAt: x.deletedAt })),
    ...expenses.map((x) => ({ kind: 'expenses', id: x._id, label: `Expense: ${x.title} (${x.amount}) on ${x.date}`, deletedAt: x.deletedAt })),
    ...contributions.map((x) => ({ kind: 'contributions', id: x._id, label: `Deposit: ${x.member ? x.member.fullName : ''} ${x.amount} on ${x.date}`, deletedAt: x.deletedAt })),
    ...settlements.map((x) => ({ kind: 'settlements', id: x._id, label: `Settlement: ${x.member ? x.member.fullName : ''} ${x.direction} ${x.amount}`, deletedAt: x.deletedAt })),
    ...guests.map((x) => ({ kind: 'guests', id: x._id, label: `Guest meals: ${x.count} for ${x.host ? x.host.fullName : ''} on ${x.date}`, deletedAt: x.deletedAt })),
  ].sort((a, b) => b.deletedAt - a.deletedAt);
  res.json({ items: rows });
};
