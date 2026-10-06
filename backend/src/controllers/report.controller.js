const { BazarItem, Expense, Contribution, MonthlyReport } = require('../models');
const { getCalculation } = require('../services/month.service');
const { monthLabel } = require('../utils/dates');

const r2 = (n) => Math.round(n * 100) / 100;

async function buildReport(month) {
  // Closed months report from their frozen snapshot.
  let calc;
  if (month.status === 'closed') {
    const snap = await MonthlyReport.findOne({ month: month._id }).lean();
    calc = snap ? snap.calculation : null;
  }
  if (!calc) calc = await getCalculation(month);

  const [bazar, expenses, contributions] = await Promise.all([
    BazarItem.find({ month: month._id, deletedAt: null, status: 'active' }).populate('purchasers.member', 'fullName').lean(),
    Expense.find({ month: month._id, deletedAt: null, status: 'active' }).populate('paidBy', 'fullName').sort({ date: 1 }).lean(),
    Contribution.find({ month: month._id, deletedAt: null }).populate('member', 'fullName').sort({ date: 1 }).lean(),
  ]);

  const byPurchaser = {};
  for (const b of bazar) {
    const sign = b.isRefund ? -1 : 1;
    if (!b.purchasers.length) {
      byPurchaser.Fund = (byPurchaser.Fund || 0) + sign * b.totalPrice;
    }
    for (const p of b.purchasers) {
      const name = p.member ? p.member.fullName : 'Unknown';
      byPurchaser[name] = (byPurchaser[name] || 0) + sign * (p.amount || 0);
    }
  }
  const t = calc.totals;
  return {
    title: `${month.name} · ${monthLabel(month.year, month.month)}`,
    month: { _id: month._id, year: month.year, month: month.month, name: month.name, status: month.status, currency: month.currency },
    generatedAt: new Date(),
    financial: {
      deposits: t.deposits,
      personalPurchases: t.personalPurchases,
      food: t.food,
      household: t.household,
      utility: t.utility,
      other: t.other,
      totalExpense: t.totalExpense,
      cashInHand: t.cashInHand,
      startingBalance: t.startingBalance,
      carryBalance: t.carryBalance,
    },
    meals: {
      totalMeals: t.totalMeals,
      guestMeals: t.guestMeals,
      mealRate: t.mealRate,
      mealRateExpense: t.mealRateExpense,
      byType: calc.mealTypeTotals,
      members: calc.members.map((m) => ({ id: m.id, fullName: m.fullName, meals: m.meals, mealPercent: m.mealPercent, mealsByType: m.mealsByType })),
    },
    bazar: {
      total: t.bazar,
      byCategory: calc.bazarCategoryTotals || calc.categoryTotals,
      allCategories: calc.categoryTotals,
      byPurchaser: Object.entries(byPurchaser).map(([name, amount]) => ({ name, amount: r2(amount) })).sort((a, b) => b.amount - a.amount),
      topItems: [...bazar].sort((a, b) => b.totalPrice - a.totalPrice).slice(0, 10).map((b) => ({ date: b.date, itemName: b.itemName, category: b.category, quantity: b.quantity, unit: b.unit, totalPrice: b.totalPrice })),
      items: bazar.sort((a, b) => (a.date < b.date ? -1 : 1)).map((b) => ({ date: b.date, itemName: b.itemName, category: b.category, quantity: b.quantity, unit: b.unit, unitPrice: b.unitPrice, totalPrice: b.isRefund ? -b.totalPrice : b.totalPrice, purchasedBy: b.purchasers.map((p) => (p.member ? p.member.fullName : '')).join(' + ') || 'Fund' })),
    },
    expenses: expenses.map((e) => ({ date: e.date, title: e.title, category: e.category, expenseType: e.expenseType, amount: e.isRefund ? -e.amount : e.amount, paidBy: e.paidBy ? e.paidBy.fullName : 'Fund' })),
    contributions: contributions.map((c) => ({ date: c.date, member: c.member ? c.member.fullName : '', amount: c.amount, paymentMethod: c.paymentMethod, reference: c.reference })),
    settlement: {
      members: calc.members.map(({ breakdown, ...m }) => m),
      owes: calc.members.filter((m) => m.status === 'due').map((m) => ({ fullName: m.fullName, amount: m.due })),
      getsBack: calc.members.filter((m) => m.status === 'refund').map((m) => ({ fullName: m.fullName, amount: m.refund })),
      settled: calc.members.filter((m) => m.status === 'settled').map((m) => m.fullName),
    },
    warnings: calc.warnings,
  };
}

exports.get = async (req, res) => res.json(await buildReport(req.month));

const csvCell = (v) => {
  let s = v == null ? '' : String(v);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n');

exports.csv = async (req, res) => {
  const rep = await buildReport(req.month);
  const section = String(req.query.section || 'settlement');
  let rows;
  if (section === 'bazar') {
    rows = [['Date', 'Item', 'Category', 'Quantity', 'Unit', 'Unit price', 'Total', 'Purchased by'], ...rep.bazar.items.map((b) => [b.date, b.itemName, b.category, b.quantity, b.unit, b.unitPrice, b.totalPrice, b.purchasedBy])];
  } else if (section === 'expenses') {
    rows = [['Date', 'Title', 'Category', 'Type', 'Amount', 'Paid by'], ...rep.expenses.map((e) => [e.date, e.title, e.category, e.expenseType, e.amount, e.paidBy])];
  } else if (section === 'contributions') {
    rows = [['Date', 'Member', 'Amount', 'Method', 'Reference'], ...rep.contributions.map((c) => [c.date, c.member, c.amount, c.paymentMethod, c.reference])];
  } else if (section === 'meals') {
    const types = Object.keys(rep.meals.byType);
    rows = [['Member', ...types.map((k) => rep.meals.byType[k].label), 'Weighted meals', 'Share %'], ...rep.meals.members.map((m) => [m.fullName, ...types.map((k) => m.mealsByType[k] || 0), m.meals, m.mealPercent])];
    rows.push([], ['Total meals', rep.meals.totalMeals], ['Meal rate', rep.meals.mealRate]);
  } else {
    rows = [
      ['Member', 'Meals', 'Meal cost', 'Shared expenses', 'Total payable', 'Carried in', 'Deposited', 'Purchases paid', 'Balance', 'Status'],
      ...rep.settlement.members.map((m) => [m.fullName, m.meals, m.mealCost, m.sharedTotal, m.payable, m.openingBalance, m.deposited, m.personalPurchases, m.balance, m.status]),
      [],
      ['Total expense', rep.financial.totalExpense],
      ['Meal rate', rep.meals.mealRate],
      ['Cash in hand', rep.financial.cashInHand],
    ];
  }
  const file = `${rep.month.year}-${String(rep.month.month).padStart(2, '0')}-${section}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
  res.send(`﻿${toCsv(rows)}`);
};

exports.buildReport = buildReport;
