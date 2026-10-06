const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateMonth, roundTo } = require('../src/services/calculation.service');

const baseMonth = (over = {}) => ({
  year: 2026,
  month: 10,
  startingBalance: 0,
  carryBalance: 0,
  mealTypes: [
    { key: 'breakfast', label: 'Breakfast', weight: 0.5, order: 0 },
    { key: 'lunch', label: 'Lunch', weight: 1, order: 1 },
    { key: 'dinner', label: 'Dinner', weight: 1, order: 2 },
  ],
  settings: {
    mealMode: 'standard',
    distribution: { food: { method: 'per_meal' }, household: { method: 'equal' }, utility: { method: 'equal' }, other: { method: 'equal' } },
    rounding: { rateDecimals: 2, amountDecimals: 2, mode: 'round' },
    guestMeals: 'charge_host',
  },
  ...over,
});

const m = (id, extra = {}) => ({ _id: id, fullName: id, joinDate: '2026-10-01', active: true, ...extra });

test('spec example: meal rate 25, equal household share, refund and due', () => {
  // 5 members, 1000 meals, 25,000 food, 5,000 household.
  const members = ['rahim', 'karim', 'sakib', 'tanvir', 'nayeem'].map((x) => m(x));
  const mealEntries = [];
  const per = { rahim: 120, karim: 220, sakib: 220, tanvir: 220, nayeem: 220 };
  for (const [mid, n] of Object.entries(per)) mealEntries.push({ member: mid, date: '2026-10-05', counts: { lunch: n } });
  const res = calculateMonth({
    month: baseMonth(),
    members,
    mealEntries,
    bazarItems: [{ _id: 'b1', date: '2026-10-02', itemName: 'Rice', category: 'Rice', expenseType: 'food', totalPrice: 25000, paidFrom: 'fund' }],
    expenses: [{ _id: 'e1', date: '2026-10-03', title: 'Gas', category: 'Gas', expenseType: 'household', amount: 5000, paidFrom: 'fund' }],
    contributions: [
      { member: 'rahim', amount: 5000, date: '2026-10-01' },
      { member: 'karim', amount: 3000, date: '2026-10-01' },
    ],
  });
  assert.equal(res.totals.totalMeals, 1000);
  assert.equal(res.totals.mealRate, 25);
  assert.equal(res.totals.totalExpense, 30000);
  const rahim = res.members.find((x) => x.id === 'rahim');
  assert.equal(rahim.mealCost, 3000);
  assert.equal(rahim.sharedTotal, 1000);
  assert.equal(rahim.payable, 4000);
  assert.equal(rahim.balance, 1000);
  assert.equal(rahim.status, 'refund');
  const karim = res.members.find((x) => x.id === 'karim');
  assert.equal(karim.payable, 220 * 25 + 1000);
  assert.equal(karim.status, 'due');
  assert.equal(res.totals.cashInHand, 8000 - 30000);
});

test('weighted mode applies meal weights', () => {
  const res = calculateMonth({
    month: baseMonth({ settings: { ...baseMonth().settings, mealMode: 'weighted' } }),
    members: [m('a'), m('b')],
    mealEntries: [
      { member: 'a', date: '2026-10-01', counts: { breakfast: 1, lunch: 1, dinner: 1 } },
      { member: 'b', date: '2026-10-01', counts: { breakfast: 0, lunch: 1, dinner: 0 } },
    ],
    bazarItems: [{ date: '2026-10-01', itemName: 'Fish', category: 'Fish', expenseType: 'food', totalPrice: 350, paidFrom: 'personal', purchasers: [{ member: 'a' }] }],
  });
  assert.equal(res.totals.totalMeals, 3.5);
  assert.equal(res.totals.mealRate, 100);
  const a = res.members.find((x) => x.id === 'a');
  assert.equal(a.meals, 2.5);
  assert.equal(a.mealCost, 250);
  assert.equal(a.personalPurchases, 350);
  assert.equal(a.balance, 100);
  assert.equal(res.members.find((x) => x.id === 'b').balance, -100);
});

test('guest meals are charged to host, or excluded', () => {
  const input = {
    month: baseMonth(),
    members: [m('a'), m('b')],
    mealEntries: [
      { member: 'a', date: '2026-10-01', counts: { lunch: 1 } },
      { member: 'b', date: '2026-10-01', counts: { lunch: 1 } },
    ],
    guestMeals: [{ host: 'a', date: '2026-10-01', mealType: 'dinner', count: 2 }],
    bazarItems: [{ date: '2026-10-01', itemName: 'x', category: 'Rice', expenseType: 'food', totalPrice: 400, paidFrom: 'fund' }],
  };
  let res = calculateMonth(input);
  assert.equal(res.totals.totalMeals, 4);
  assert.equal(res.members.find((x) => x.id === 'a').mealCost, 300);
  res = calculateMonth({ ...input, month: baseMonth({ settings: { ...baseMonth().settings, guestMeals: 'exclude' } }) });
  assert.equal(res.totals.totalMeals, 2);
  assert.equal(res.members.find((x) => x.id === 'a').mealCost, 200);
});

test('prorated equal split for a member who joins mid-month', () => {
  const res = calculateMonth({
    month: baseMonth({ settings: { ...baseMonth().settings, equalSplitMode: 'prorated' } }),
    members: [m('a'), m('b', { joinDate: '2026-10-17' })], // b present 15 of 31 days
    expenses: [{ date: '2026-10-01', title: 'Internet', category: 'Internet', expenseType: 'utility', amount: 4600, paidFrom: 'fund' }],
  });
  const a = res.members.find((x) => x.id === 'a');
  const b = res.members.find((x) => x.id === 'b');
  assert.equal(b.presenceDays, 15);
  assert.equal(a.sharedTotal, 3100);
  assert.equal(b.sharedTotal, 1500);
});

test('member who left before the month is excluded from equal split; full mode splits equally', () => {
  const res = calculateMonth({
    month: baseMonth(),
    members: [m('a'), m('b'), m('c', { joinDate: '2026-09-01', leaveDate: '2026-09-30' })],
    expenses: [{ date: '2026-10-01', title: 'Rent', category: 'Rent', expenseType: 'household', amount: 1000, paidFrom: 'fund' }],
  });
  assert.equal(res.members.find((x) => x.id === 'c').sharedTotal, 0);
  assert.equal(res.members.find((x) => x.id === 'a').sharedTotal, 500);
});

test('percentage and custom splits, with category override', () => {
  const settings = {
    ...baseMonth().settings,
    distribution: { ...baseMonth().settings.distribution, utility: { method: 'percentage', shares: { a: 40, b: 30, c: 30 } } },
    categoryRules: [{ category: 'Rent', method: 'custom', shares: { a: 3000, b: 2000 } }],
  };
  const res = calculateMonth({
    month: baseMonth({ settings }),
    members: [m('a'), m('b'), m('c')],
    expenses: [
      { date: '2026-10-01', title: 'Electricity', category: 'Electricity', expenseType: 'utility', amount: 1000, paidFrom: 'fund' },
      { date: '2026-10-01', title: 'Rent', category: 'Rent', expenseType: 'household', amount: 6500, paidFrom: 'fund' },
    ],
  });
  const get = (k) => res.members.find((x) => x.id === k);
  assert.equal(get('a').sharedByType.utility, 400);
  assert.equal(get('c').sharedByType.utility, 300);
  // Rent: 3000 + 2000 fixed, remaining 1500 equally among 3.
  assert.equal(get('a').sharedByType.household, 3500);
  assert.equal(get('c').sharedByType.household, 500);
  assert.ok(res.warnings.some((w) => w.code === 'custom_split_mismatch'));
});

test('cancelled and refund items, split purchases, settlements, carry-forward', () => {
  const res = calculateMonth({
    month: baseMonth({ startingBalance: 100, carryBalance: 50 }),
    members: [m('a', { openingBalance: 200 }), m('b', { openingBalance: -100 })],
    mealEntries: [
      { member: 'a', date: '2026-10-01', counts: { lunch: 1 } },
      { member: 'b', date: '2026-10-01', counts: { lunch: 1 } },
    ],
    bazarItems: [
      { date: '2026-10-01', itemName: 'Chicken', category: 'Chicken', expenseType: 'food', totalPrice: 600, paidFrom: 'personal', purchasers: [{ member: 'a', amount: 400 }, { member: 'b', amount: 200 }] },
      { date: '2026-10-01', itemName: 'Bad eggs returned', category: 'Eggs', expenseType: 'food', totalPrice: 100, paidFrom: 'personal', isRefund: true, purchasers: [{ member: 'a' }] },
      { date: '2026-10-01', itemName: 'Cancelled', category: 'Fish', expenseType: 'food', totalPrice: 999, status: 'cancelled', paidFrom: 'fund' },
    ],
    settlements: [{ member: 'b', direction: 'received', amount: 50 }],
  });
  assert.equal(res.totals.food, 500);
  assert.equal(res.totals.mealRate, 250);
  const a = res.members.find((x) => x.id === 'a');
  const b = res.members.find((x) => x.id === 'b');
  assert.equal(a.personalPurchases, 300);
  assert.equal(a.balance, 200 + 300 - 250);
  assert.equal(b.balance, -100 + 200 + 50 - 250);
  assert.equal(res.totals.cashInHand, 100 + 50 + 50);
});

test('food cost with no meals falls back to equal split and warns', () => {
  const res = calculateMonth({
    month: baseMonth(),
    members: [m('a'), m('b')],
    bazarItems: [{ date: '2026-10-01', itemName: 'Oil', category: 'Oil', expenseType: 'food', totalPrice: 360, paidFrom: 'fund' }],
  });
  assert.equal(res.totals.mealRate, 0);
  assert.equal(res.members[0].payable, 180);
  assert.ok(res.warnings.some((w) => w.code === 'no_meals'));
});

test('rounding modes and budget thresholds', () => {
  assert.equal(roundTo(30.555, 2), 30.56);
  assert.equal(roundTo(30.551, 1, 'ceil'), 30.6);
  assert.equal(roundTo(30.559, 1, 'floor'), 30.5);
  const res = calculateMonth({
    month: baseMonth({ budget: { total: 1000, food: 500, thresholds: [75, 90, 100] } }),
    members: [m('a')],
    mealEntries: [{ member: 'a', date: '2026-10-01', counts: { lunch: 3 } }],
    bazarItems: [{ date: '2026-10-01', itemName: 'x', category: 'Rice', expenseType: 'food', totalPrice: 460, paidFrom: 'fund' }],
  });
  const food = res.budget.find((b) => b.label === 'Food');
  assert.equal(food.level, 90);
  assert.equal(food.remaining, 40);
  assert.equal(res.budget.find((b) => b.label === 'Total').level, 0);
  assert.equal(res.totals.mealRate, 153.33);
});

test('daily series counts meals and spending per day', () => {
  const res = calculateMonth({
    month: baseMonth(),
    members: [m('a'), m('b', { joinDate: '2026-10-10' })],
    mealEntries: [{ member: 'a', date: '2026-10-06', counts: { breakfast: 1, lunch: 1 } }],
    bazarItems: [{ date: '2026-10-06', itemName: 'x', category: 'Rice', expenseType: 'food', totalPrice: 1250, paidFrom: 'fund' }],
  });
  const d = res.daily.find((x) => x.date === '2026-10-06');
  assert.equal(d.rawMeals, 2);
  assert.equal(d.bazar, 1250);
  assert.equal(d.activeMembers, 1);
  assert.equal(res.daily.find((x) => x.date === '2026-10-12').activeMembers, 2);
  assert.equal(res.daily.length, 31);
});
