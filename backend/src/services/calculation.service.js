/**
 * Monthly calculation engine.
 *
 * Pure function: takes plain records for one month and returns every figure the app shows,
 * together with the breakdown used to reach it, so nothing is a black box to users.
 * Nothing here is hard-coded: meal weights, distribution methods, guest rules and rounding
 * all come from month.settings.
 */
const { monthRange, monthDates, daysInMonth } = require('../utils/dates');

const EXPENSE_TYPES = ['food', 'household', 'utility', 'other'];
const EPS = 1e-9;

const id = (v) => (v == null ? null : String(v._id || v));
const plainMap = (m) => (m == null ? {} : m instanceof Map ? Object.fromEntries(m) : { ...m });

function roundTo(value, decimals = 2, mode = 'round') {
  const f = 10 ** decimals;
  const scaled = value * f;
  // Remove float noise (e.g. 2.0000000004) before ceil/floor.
  const clean = Math.round(scaled * 1e6) / 1e6;
  const fn = mode === 'ceil' ? Math.ceil : mode === 'floor' ? Math.floor : Math.round;
  const r = fn(clean) / f;
  return Object.is(r, -0) ? 0 : r;
}

const r2 = (v) => roundTo(v, 2);

function dayDiff(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/** Days of the month the member was part of the household (0 if none). */
function presenceDays(member, start, end) {
  if (member.active === false && !member.leaveDate) return 0;
  const from = member.joinDate && member.joinDate > start ? member.joinDate : start;
  const to = member.leaveDate && member.leaveDate < end ? member.leaveDate : end;
  return to < from ? 0 : dayDiff(from, to) + 1;
}

function isPresentOn(member, date) {
  if (member.active === false && !member.leaveDate) return false;
  if (member.joinDate && date < member.joinDate) return false;
  if (member.leaveDate && date > member.leaveDate) return false;
  return true;
}

function ruleFor(settings, expenseType, category) {
  const catRule = (settings.categoryRules || []).find((r) => r.category && category && r.category.toLowerCase() === category.toLowerCase());
  if (catRule && catRule.method) return { key: `category:${catRule.category}`, label: catRule.category, method: catRule.method, shares: plainMap(catRule.shares) };
  const rule = (settings.distribution && settings.distribution[expenseType]) || { method: expenseType === 'food' ? 'per_meal' : 'equal' };
  return { key: `type:${expenseType}`, label: expenseType, method: rule.method, shares: plainMap(rule.shares) };
}

function calculateMonth(input) {
  const { month } = input;
  const settings = month.settings || {};
  const rounding = { rateDecimals: 2, amountDecimals: 0, mode: 'round', ...(settings.rounding || {}) };
  const roundAmt = (v) => roundTo(v, rounding.amountDecimals, rounding.mode);
  const { start, end } = monthRange(month.year, month.month);
  const totalDays = daysInMonth(month.year, month.month);
  const dates = monthDates(month.year, month.month);
  const warnings = [];

  const mealTypes = [...(month.mealTypes || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  const weighted = settings.mealMode === 'weighted';
  const weightOf = (key) => {
    if (!weighted) return 1;
    const t = mealTypes.find((m) => m.key === key);
    return t ? Number(t.weight) : 1;
  };
  const chargeGuests = settings.guestMeals !== 'exclude';

  // ---- Members -------------------------------------------------------------
  const members = (input.members || []).map((m) => ({
    id: id(m),
    fullName: m.fullName,
    nickname: m.nickname || '',
    role: m.role,
    joinDate: m.joinDate,
    leaveDate: m.leaveDate || null,
    active: m.active !== false,
    openingBalance: Number(m.openingBalance) || 0,
    presenceDays: presenceDays(m, start, end),
  }));
  const byId = new Map(members.map((m) => [m.id, m]));
  const acc = new Map(
    members.map((m) => [
      m.id,
      {
        ownMeals: 0,
        ownRawMeals: 0,
        guestMeals: 0,
        guestRawMeals: 0,
        mealsByType: Object.fromEntries(mealTypes.map((t) => [t.key, 0])),
        deposits: 0,
        depositCount: 0,
        personalPurchases: 0,
        settlementsReceived: 0,
        settlementsPaid: 0,
        shares: {}, // poolKey -> amount
      },
    ])
  );

  // ---- Meals ---------------------------------------------------------------
  const daily = new Map(
    dates.map((d) => [
      d,
      {
        date: d,
        mealsByType: Object.fromEntries(mealTypes.map((t) => [t.key, 0])),
        rawMeals: 0,
        weightedMeals: 0,
        guestMeals: 0,
        bazar: 0,
        bazarCount: 0,
        expense: 0,
        deposits: 0,
        activeMembers: members.filter((m) => isPresentOn(m, d)).length,
        membersWithMeals: 0,
      },
    ])
  );
  const mealTypeTotals = Object.fromEntries(mealTypes.map((t) => [t.key, { label: t.label, weight: weightOf(t.key), count: 0, weighted: 0 }]));
  const ensureType = (key) => {
    if (!mealTypeTotals[key]) mealTypeTotals[key] = { label: key, weight: weightOf(key), count: 0, weighted: 0 };
  };

  for (const e of input.mealEntries || []) {
    const a = acc.get(id(e.member));
    if (!a) continue;
    const day = daily.get(e.date);
    let dayHadMeal = false;
    for (const [key, raw] of Object.entries(plainMap(e.counts))) {
      const n = Number(raw) || 0;
      if (n <= 0) continue;
      ensureType(key);
      const w = n * weightOf(key);
      a.ownRawMeals += n;
      a.ownMeals += w;
      a.mealsByType[key] = (a.mealsByType[key] || 0) + n;
      mealTypeTotals[key].count += n;
      mealTypeTotals[key].weighted += w;
      if (day) {
        day.mealsByType[key] = (day.mealsByType[key] || 0) + n;
        day.rawMeals += n;
        day.weightedMeals += w;
        dayHadMeal = true;
      }
    }
    if (day && dayHadMeal) day.membersWithMeals += 1;
  }

  let guestRawTotal = 0;
  let guestWeightedTotal = 0;
  for (const g of input.guestMeals || []) {
    const n = Number(g.count) || 0;
    if (n <= 0) continue;
    const w = n * weightOf(g.mealType);
    guestRawTotal += n;
    guestWeightedTotal += w;
    const day = daily.get(g.date);
    if (day) day.guestMeals += n;
    if (!chargeGuests) continue;
    const a = acc.get(id(g.host));
    if (!a) continue;
    a.guestRawMeals += n;
    a.guestMeals += w;
    ensureType(g.mealType);
    mealTypeTotals[g.mealType].count += n;
    mealTypeTotals[g.mealType].weighted += w;
    if (day) {
      day.mealsByType[g.mealType] = (day.mealsByType[g.mealType] || 0) + n;
      day.rawMeals += n;
      day.weightedMeals += w;
    }
  }

  let totalMeals = 0;
  let totalRawMeals = 0;
  for (const a of acc.values()) {
    totalMeals += a.ownMeals + a.guestMeals;
    totalRawMeals += a.ownRawMeals + a.guestRawMeals;
  }

  // ---- Costs ---------------------------------------------------------------
  const costItems = [];
  for (const b of input.bazarItems || []) {
    if (b.status === 'cancelled') continue;
    const sign = b.isRefund ? -1 : 1;
    const amount = sign * (Number(b.totalPrice) || 0);
    costItems.push({ source: 'bazar', id: id(b), date: b.date, title: b.itemName, category: b.category, expenseType: b.expenseType || 'food', amount, paidFrom: b.paidFrom || 'personal' });
    if ((b.paidFrom || 'personal') === 'personal') {
      const purchasers = (b.purchasers || []).filter((p) => p.member);
      const assigned = purchasers.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      purchasers.forEach((p, i) => {
        const a = acc.get(id(p.member));
        // A single purchaser without an amount paid the whole item.
        const amt = purchasers.length === 1 && !p.amount ? Number(b.totalPrice) : Number(p.amount) || 0;
        if (a) a.personalPurchases += sign * amt;
        if (i === purchasers.length - 1 && purchasers.length > 1 && Math.abs(assigned - b.totalPrice) > 0.01) {
          warnings.push({ code: 'purchase_split_mismatch', message: `Bazar "${b.itemName}" on ${b.date}: purchaser amounts (${r2(assigned)}) do not add up to the total (${b.totalPrice}).` });
        }
      });
      if (!purchasers.length) warnings.push({ code: 'purchase_no_purchaser', message: `Bazar "${b.itemName}" on ${b.date} is marked as personally paid but has no purchaser, so nobody is credited.` });
    }
    const day = daily.get(b.date);
    if (day) {
      day.bazar += amount;
      day.bazarCount += 1;
    }
  }
  for (const e of input.expenses || []) {
    if (e.status === 'cancelled') continue;
    const sign = e.isRefund ? -1 : 1;
    const amount = sign * (Number(e.amount) || 0);
    const paidFrom = e.paidFrom || (e.paidBy ? 'personal' : 'fund');
    costItems.push({ source: 'expense', id: id(e), date: e.date, title: e.title, category: e.category, expenseType: e.expenseType, amount, paidFrom });
    if (paidFrom === 'personal') {
      const a = acc.get(id(e.paidBy));
      if (a) a.personalPurchases += amount;
      else warnings.push({ code: 'expense_no_payer', message: `Expense "${e.title}" on ${e.date} is marked as personally paid but has no payer.` });
    }
    const day = daily.get(e.date);
    if (day) day.expense += amount;
  }

  const typeTotals = Object.fromEntries(EXPENSE_TYPES.map((t) => [t, 0]));
  const categoryTotals = {};
  const bazarCategoryTotals = {};
  let bazarTotal = 0;
  let fundPaidCosts = 0;
  for (const c of costItems) {
    typeTotals[c.expenseType] = (typeTotals[c.expenseType] || 0) + c.amount;
    const ck = `${c.expenseType}|${c.category}`;
    categoryTotals[ck] = categoryTotals[ck] || { category: c.category, expenseType: c.expenseType, amount: 0, count: 0 };
    categoryTotals[ck].amount += c.amount;
    categoryTotals[ck].count += 1;
    if (c.source === 'bazar') {
      bazarTotal += c.amount;
      bazarCategoryTotals[c.category] = bazarCategoryTotals[c.category] || { category: c.category, expenseType: c.expenseType, amount: 0, count: 0 };
      bazarCategoryTotals[c.category].amount += c.amount;
      bazarCategoryTotals[c.category].count += 1;
    }
    if (c.paidFrom === 'fund') fundPaidCosts += c.amount;
  }
  const totalExpense = Object.values(typeTotals).reduce((s, v) => s + v, 0);

  // ---- Distribution pools -------------------------------------------------
  const pools = new Map();
  for (const c of costItems) {
    const rule = ruleFor(settings, c.expenseType, c.category);
    if (!pools.has(rule.key)) pools.set(rule.key, { ...rule, expenseType: c.expenseType, total: 0, items: 0 });
    const p = pools.get(rule.key);
    p.total += c.amount;
    p.items += 1;
  }

  const equalWeights = () => {
    const prorated = settings.equalSplitMode === 'prorated';
    return members
      .map((m) => ({ id: m.id, w: prorated ? m.presenceDays / totalDays : m.presenceDays > 0 ? 1 : 0 }))
      .filter((x) => x.w > 0);
  };

  const distributeEqual = (pool, amount, note) => {
    const ws = equalWeights();
    const sum = ws.reduce((s, x) => s + x.w, 0);
    if (!ws.length || sum <= 0) {
      warnings.push({ code: 'no_eligible_members', message: `No active members to share "${pool.label}" (${r2(amount)}).` });
      return [];
    }
    return ws.map((x) => ({ id: x.id, amount: (amount * x.w) / sum, basis: settings.equalSplitMode === 'prorated' ? `${byId.get(x.id).presenceDays}/${totalDays} days` : `1/${ws.length}`, note }));
  };

  let perMealTotal = 0;
  const poolSummaries = [];
  for (const pool of pools.values()) {
    let allocations = [];
    if (pool.method === 'per_meal') {
      perMealTotal += pool.total;
      poolSummaries.push({ key: pool.key, label: pool.label, expenseType: pool.expenseType, method: 'per_meal', total: r2(pool.total), items: pool.items });
      continue;
    }
    if (pool.method === 'percentage') {
      const entries = Object.entries(pool.shares).filter(([mid, v]) => byId.has(mid) && Number(v) > 0);
      const sum = entries.reduce((s, [, v]) => s + Number(v), 0);
      if (!entries.length || sum <= 0) {
        warnings.push({ code: 'percentage_missing', message: `"${pool.label}" uses percentage split but no percentages are set; split equally instead.` });
        allocations = distributeEqual(pool, pool.total, 'fallback: equal');
      } else {
        if (Math.abs(sum - 100) > 0.01) warnings.push({ code: 'percentage_not_100', message: `"${pool.label}" percentages add up to ${r2(sum)}%, scaled to 100%.` });
        allocations = entries.map(([mid, v]) => ({ id: mid, amount: (pool.total * Number(v)) / sum, basis: `${r2((Number(v) / sum) * 100)}%` }));
      }
    } else if (pool.method === 'custom') {
      const entries = Object.entries(pool.shares).filter(([mid, v]) => byId.has(mid) && Number(v) >= 0);
      const assigned = entries.reduce((s, [, v]) => s + Number(v), 0);
      allocations = entries.map(([mid, v]) => ({ id: mid, amount: Number(v), basis: 'fixed amount' }));
      const remainder = pool.total - assigned;
      if (Math.abs(remainder) > 0.01) {
        warnings.push({ code: 'custom_split_mismatch', message: `"${pool.label}" custom amounts total ${r2(assigned)} but the cost is ${r2(pool.total)}; the difference (${r2(remainder)}) is split equally.` });
        allocations = allocations.concat(distributeEqual(pool, remainder, 'remainder'));
      }
    } else {
      allocations = distributeEqual(pool, pool.total);
    }
    for (const al of allocations) {
      const a = acc.get(al.id);
      if (!a) continue;
      a.shares[pool.key] = a.shares[pool.key] || { label: pool.label, expenseType: pool.expenseType, method: pool.method, amount: 0, basis: [] };
      a.shares[pool.key].amount += al.amount;
      a.shares[pool.key].basis.push(al.note ? `${al.basis} (${al.note})` : al.basis);
    }
    poolSummaries.push({ key: pool.key, label: pool.label, expenseType: pool.expenseType, method: pool.method, total: r2(pool.total), items: pool.items });
  }

  // ---- Meal rate -----------------------------------------------------------
  let rawRate = 0;
  let mealRate = 0;
  if (perMealTotal !== 0 && totalMeals > 0) {
    rawRate = perMealTotal / totalMeals;
    mealRate = roundTo(rawRate, rounding.rateDecimals, rounding.mode);
  } else if (perMealTotal !== 0 && totalMeals === 0) {
    warnings.push({ code: 'no_meals', message: `Meal-based cost of ${r2(perMealTotal)} exists but no meals are recorded, so it is split equally among active members.` });
    const pseudo = { label: 'Meal cost (no meals recorded)', key: 'type:per_meal_fallback' };
    for (const al of distributeEqual(pseudo, perMealTotal, 'no meals recorded')) {
      const a = acc.get(al.id);
      a.shares[pseudo.key] = { label: pseudo.label, expenseType: 'food', method: 'equal', amount: al.amount, basis: [al.basis] };
    }
  }

  // ---- Settlements & deposits --------------------------------------------
  let totalDeposits = 0;
  for (const c of input.contributions || []) {
    const amt = Number(c.amount) || 0;
    totalDeposits += amt;
    const a = acc.get(id(c.member));
    if (a) {
      a.deposits += amt;
      a.depositCount += 1;
    }
    const day = daily.get(c.date);
    if (day) day.deposits += amt;
  }
  let settlementsReceived = 0;
  let settlementsPaid = 0;
  for (const s of input.settlements || []) {
    const amt = Number(s.amount) || 0;
    const a = acc.get(id(s.member));
    if (s.direction === 'received') {
      settlementsReceived += amt;
      if (a) a.settlementsReceived += amt;
    } else {
      settlementsPaid += amt;
      if (a) a.settlementsPaid += amt;
    }
  }

  // ---- Per-member results --------------------------------------------------
  const memberResults = members.map((m) => {
    const a = acc.get(m.id);
    const meals = a.ownMeals + a.guestMeals;
    const mealCost = roundAmt(meals * mealRate);
    const shared = Object.values(a.shares).map((s) => ({ ...s, amount: roundAmt(s.amount), basis: [...new Set(s.basis)].join(', ') }));
    const sharedTotal = shared.reduce((s, x) => s + x.amount, 0);
    const sharedByType = Object.fromEntries(EXPENSE_TYPES.map((t) => [t, 0]));
    shared.forEach((s) => {
      sharedByType[s.expenseType] = (sharedByType[s.expenseType] || 0) + s.amount;
    });
    const payable = roundAmt(mealCost + sharedTotal);
    const credits = m.openingBalance + a.deposits + a.personalPurchases + a.settlementsReceived - a.settlementsPaid;
    const balance = roundAmt(credits - payable);
    const settledThreshold = 0.5 / 10 ** rounding.amountDecimals;
    const status = Math.abs(balance) < settledThreshold ? 'settled' : balance > 0 ? 'refund' : 'due';

    const breakdown = [
      { label: 'Own meals', value: r2(a.ownMeals), detail: weighted ? `${a.ownRawMeals} meals, weighted` : `${a.ownRawMeals} meals` },
    ];
    if (a.guestRawMeals) breakdown.push({ label: 'Guest meals (hosted)', value: r2(a.guestMeals), detail: `${a.guestRawMeals} guest meals` });
    breakdown.push({ label: 'Meal rate', value: mealRate, money: true });
    breakdown.push({ label: 'Meal cost', value: mealCost, money: true, detail: `${r2(meals)} × ${mealRate}` });
    shared.forEach((s) => breakdown.push({ label: `Shared: ${s.label}`, value: s.amount, money: true, detail: `${s.method.replace('_', ' ')} · ${s.basis}` }));
    breakdown.push({ label: 'Total payable', value: payable, money: true, emphasis: true });
    if (m.openingBalance) breakdown.push({ label: 'Carried from previous month', value: r2(m.openingBalance), money: true });
    breakdown.push({ label: 'Deposited', value: r2(a.deposits), money: true });
    if (a.personalPurchases) breakdown.push({ label: 'Paid for purchases/expenses', value: r2(a.personalPurchases), money: true });
    if (a.settlementsReceived) breakdown.push({ label: 'Settlement paid in', value: r2(a.settlementsReceived), money: true });
    if (a.settlementsPaid) breakdown.push({ label: 'Refund received', value: -r2(a.settlementsPaid), money: true });
    breakdown.push({ label: status === 'due' ? 'Due' : status === 'refund' ? 'Refund' : 'Settled', value: Math.abs(balance), money: true, emphasis: true });

    return {
      id: m.id,
      fullName: m.fullName,
      nickname: m.nickname,
      role: m.role,
      joinDate: m.joinDate,
      leaveDate: m.leaveDate,
      active: m.active,
      presenceDays: m.presenceDays,
      meals: r2(meals),
      rawMeals: a.ownRawMeals + a.guestRawMeals,
      ownMeals: r2(a.ownMeals),
      guestMeals: r2(a.guestMeals),
      mealsByType: a.mealsByType,
      mealPercent: totalMeals > 0 ? r2((meals / totalMeals) * 100) : 0,
      mealCost,
      shared,
      sharedByType,
      sharedTotal: roundAmt(sharedTotal),
      payable,
      openingBalance: r2(m.openingBalance),
      deposited: r2(a.deposits),
      depositCount: a.depositCount,
      personalPurchases: r2(a.personalPurchases),
      settlementsReceived: r2(a.settlementsReceived),
      settlementsPaid: r2(a.settlementsPaid),
      totalCredit: r2(credits),
      balance,
      due: balance < 0 ? -balance : 0,
      refund: balance > 0 ? balance : 0,
      status,
      breakdown,
    };
  });

  const totalPayable = memberResults.reduce((s, m) => s + m.payable, 0);
  const roundingDifference = r2(totalPayable - totalExpense);
  const fundIn = (Number(month.startingBalance) || 0) + (Number(month.carryBalance) || 0) + totalDeposits + settlementsReceived;
  const fundOut = fundPaidCosts + settlementsPaid;
  const cashInHand = r2(fundIn - fundOut);

  // ---- Budget --------------------------------------------------------------
  const budget = month.budget || {};
  const thresholds = [...(budget.thresholds && budget.thresholds.length ? budget.thresholds : [75, 90, 100])].sort((x, y) => x - y);
  const budgetLine = (label, limit, used) => {
    const lim = Number(limit) || 0;
    if (!lim) return null;
    const percent = r2((used / lim) * 100);
    const crossed = thresholds.filter((t) => percent >= t);
    return { label, budget: lim, used: r2(used), remaining: r2(lim - used), percent, level: crossed.length ? crossed[crossed.length - 1] : 0 };
  };
  const budgetStatus = [
    budgetLine('Total', budget.total, totalExpense),
    budgetLine('Food', budget.food, typeTotals.food),
    budgetLine('Grocery (bazar)', budget.grocery, bazarTotal),
    budgetLine('Household', budget.household, typeTotals.household),
    budgetLine('Utilities', budget.utility, typeTotals.utility),
    budgetLine('Other', budget.other, typeTotals.other),
  ].filter(Boolean);

  const dailyList = [...daily.values()].map((d) => ({ ...d, bazar: r2(d.bazar), expense: r2(d.expense), weightedMeals: r2(d.weightedMeals), total: r2(d.bazar + d.expense) }));

  return {
    period: { year: month.year, month: month.month, start, end, days: totalDays },
    mealTypes: mealTypes.map((t) => ({ key: t.key, label: t.label, weight: weightOf(t.key) })),
    settings: { mealMode: weighted ? 'weighted' : 'standard', guestMeals: chargeGuests ? 'charge_host' : 'exclude', equalSplitMode: settings.equalSplitMode || 'full', rounding },
    totals: {
      members: members.length,
      activeMembers: members.filter((m) => m.presenceDays > 0).length,
      totalMeals: r2(totalMeals),
      rawMeals: totalRawMeals,
      guestMeals: guestRawTotal,
      guestMealsWeighted: r2(guestWeightedTotal),
      food: r2(typeTotals.food),
      household: r2(typeTotals.household),
      utility: r2(typeTotals.utility),
      other: r2(typeTotals.other),
      nonFood: r2(typeTotals.household + typeTotals.utility + typeTotals.other),
      bazar: r2(bazarTotal),
      totalExpense: r2(totalExpense),
      mealRateExpense: r2(perMealTotal),
      mealRate,
      rawMealRate: rawRate,
      deposits: r2(totalDeposits),
      personalPurchases: r2(memberResults.reduce((s, m) => s + m.personalPurchases, 0)),
      settlementsReceived: r2(settlementsReceived),
      settlementsPaid: r2(settlementsPaid),
      startingBalance: Number(month.startingBalance) || 0,
      carryBalance: Number(month.carryBalance) || 0,
      fundPaidCosts: r2(fundPaidCosts),
      cashInHand,
      totalPayable: r2(totalPayable),
      totalDue: r2(memberResults.reduce((s, m) => s + m.due, 0)),
      totalRefund: r2(memberResults.reduce((s, m) => s + m.refund, 0)),
      roundingDifference,
    },
    mealTypeTotals,
    mealRateBreakdown: {
      formula: 'Meal rate = meal-based expenses ÷ total meals',
      mealBasedExpense: r2(perMealTotal),
      totalMeals: r2(totalMeals),
      rawRate,
      mealRate,
      pools: poolSummaries.filter((p) => p.method === 'per_meal'),
    },
    cashBreakdown: {
      formula: 'Cash in hand = starting + carried + deposits + dues collected − fund-paid costs − refunds paid',
      startingBalance: Number(month.startingBalance) || 0,
      carryBalance: Number(month.carryBalance) || 0,
      deposits: r2(totalDeposits),
      settlementsReceived: r2(settlementsReceived),
      fundPaidCosts: r2(fundPaidCosts),
      settlementsPaid: r2(settlementsPaid),
      cashInHand,
    },
    pools: poolSummaries,
    categoryTotals: Object.values(categoryTotals)
      .map((c) => ({ ...c, amount: r2(c.amount) }))
      .sort((x, y) => y.amount - x.amount),
    bazarCategoryTotals: Object.values(bazarCategoryTotals)
      .map((c) => ({ ...c, amount: r2(c.amount) }))
      .sort((x, y) => y.amount - x.amount),
    members: memberResults,
    daily: dailyList,
    budget: budgetStatus,
    warnings,
  };
}

module.exports = { calculateMonth, roundTo, presenceDays, isPresentOn };
