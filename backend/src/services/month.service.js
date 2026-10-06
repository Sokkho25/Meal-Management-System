const { Month, Member, MealEntry, GuestMeal, BazarItem, Expense, Contribution, Settlement, MonthlyReport } = require('../models');
const { calculateMonth } = require('./calculation.service');

// Small in-process cache keyed by month id + version. Every write bumps the version.
const cache = new Map();
const MAX_CACHE = 200;

async function loadMonthData(monthId) {
  const live = { month: monthId, deletedAt: null };
  const [members, mealEntries, guestMeals, bazarItems, expenses, contributions, settlements] = await Promise.all([
    Member.find(live).sort({ joinDate: 1, fullName: 1 }).lean(),
    MealEntry.find({ month: monthId }).lean(),
    GuestMeal.find(live).lean(),
    BazarItem.find(live).lean(),
    Expense.find(live).lean(),
    Contribution.find(live).lean(),
    Settlement.find(live).lean(),
  ]);
  const memberIds = new Set(members.map((m) => String(m._id)));
  // Records of deleted members are left out until the member is restored.
  return {
    members,
    mealEntries: mealEntries.filter((e) => memberIds.has(String(e.member))),
    guestMeals: guestMeals.filter((g) => memberIds.has(String(g.host))),
    bazarItems,
    expenses,
    contributions: contributions.filter((c) => memberIds.has(String(c.member))),
    settlements: settlements.filter((s) => memberIds.has(String(s.member))),
  };
}

async function getCalculation(monthDoc) {
  const month = monthDoc.toObject ? monthDoc.toObject({ flattenMaps: true }) : monthDoc;
  const key = String(month._id);
  const hit = cache.get(key);
  if (hit && hit.version === month.version) return hit.result;
  const data = await loadMonthData(month._id);
  const result = calculateMonth({ month, ...data });
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(key, { version: month.version, result });
  return result;
}

/** Summary row for history; closed months use their frozen report. */
async function monthSummary(month) {
  if (month.status === 'closed') {
    const report = await MonthlyReport.findOne({ month: month._id }).lean();
    if (report) return summaryFrom(month, report.totals);
  }
  const calc = await getCalculation(month);
  return summaryFrom(month, calc.totals);
}

function summaryFrom(month, t) {
  return {
    _id: month._id,
    year: month.year,
    month: month.month,
    name: month.name,
    status: month.status,
    members: t.members,
    totalMeals: t.totalMeals,
    food: t.food,
    nonFood: t.nonFood,
    totalExpense: t.totalExpense,
    deposits: t.deposits,
    mealRate: t.mealRate,
    cashInHand: t.cashInHand,
    totalDue: t.totalDue,
  };
}

async function previousMonths(householdId, year, month, limit = 6) {
  const list = await Month.find({ household: householdId, $or: [{ year: { $lt: year } }, { year, month: { $lte: month } }] })
    .sort({ year: -1, month: -1 })
    .limit(limit);
  const out = [];
  for (const m of list.reverse()) out.push(await monthSummary(m));
  return out;
}

module.exports = { getCalculation, loadMonthData, monthSummary, previousMonths };
