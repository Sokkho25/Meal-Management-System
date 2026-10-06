const EXPENSE_TYPES = ['food', 'household', 'utility', 'other'];
const PAYMENT_METHODS = ['cash', 'bkash', 'nagad', 'bank', 'card', 'other'];
const DISTRIBUTION_METHODS = ['per_meal', 'equal', 'custom', 'percentage'];
const ROLES = ['admin', 'member'];

const DEFAULT_MEAL_TYPES = [
  { key: 'breakfast', label: 'Breakfast', weight: 1, order: 0 },
  { key: 'lunch', label: 'Lunch', weight: 1, order: 1 },
  { key: 'dinner', label: 'Dinner', weight: 1, order: 2 },
];

const DEFAULT_CATEGORIES = [
  // Bazar (food)
  ...['Rice', 'Vegetables', 'Fish', 'Meat', 'Chicken', 'Eggs', 'Milk', 'Oil', 'Spices', 'Fruits', 'Snacks', 'Drinks', 'Grocery'].map((name) => ({ name, expenseType: 'food', scope: 'bazar' })),
  { name: 'Cleaning', expenseType: 'household', scope: 'both' },
  { name: 'Household', expenseType: 'household', scope: 'both' },
  // General expenses
  { name: 'Rent', expenseType: 'household', scope: 'expense' },
  { name: 'Cook / Maid', expenseType: 'household', scope: 'expense' },
  { name: 'Toiletries', expenseType: 'household', scope: 'expense' },
  { name: 'Gas', expenseType: 'utility', scope: 'expense' },
  { name: 'Electricity', expenseType: 'utility', scope: 'expense' },
  { name: 'Water', expenseType: 'utility', scope: 'expense' },
  { name: 'Internet', expenseType: 'utility', scope: 'expense' },
  { name: 'Delivery', expenseType: 'other', scope: 'expense' },
  { name: 'Transportation', expenseType: 'other', scope: 'expense' },
  { name: 'Repair', expenseType: 'other', scope: 'expense' },
  { name: 'Guest Food', expenseType: 'food', scope: 'expense' },
  { name: 'Emergency', expenseType: 'other', scope: 'expense' },
  { name: 'Other', expenseType: 'other', scope: 'both' },
];

const DEFAULT_SETTINGS = () => ({
  mealMode: 'standard',
  distribution: {
    food: { method: 'per_meal', shares: {} },
    household: { method: 'equal', shares: {} },
    utility: { method: 'equal', shares: {} },
    other: { method: 'equal', shares: {} },
  },
  categoryRules: [],
  equalSplitMode: 'full',
  guestMeals: 'charge_host',
  rounding: { rateDecimals: 2, amountDecimals: 0, mode: 'round' },
  carryForward: { fund: true, memberBalances: true },
  permissions: { memberCanEdit: false, memberCanDelete: false, memberCanEditOthersMeals: false },
});

module.exports = { EXPENSE_TYPES, PAYMENT_METHODS, DISTRIBUTION_METHODS, ROLES, DEFAULT_MEAL_TYPES, DEFAULT_CATEGORIES, DEFAULT_SETTINGS };
