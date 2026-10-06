const { z } = require('zod');
const { isValidDate } = require('./dates');
const { EXPENSE_TYPES, PAYMENT_METHODS, DISTRIBUTION_METHODS, ROLES } = require('../models/constants');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const date = z.string().refine(isValidDate, 'Invalid date (use YYYY-MM-DD)');
const money = z.coerce.number({ invalid_type_error: 'Must be a number' }).min(0, 'Cannot be negative').max(1e9);
const signedMoney = z.coerce.number().min(-1e9).max(1e9);
const text = (max = 200) => z.string().trim().max(max);
const optText = (max = 200) => text(max).optional().default('');
const paymentMethod = z.enum(PAYMENT_METHODS);
const sharesMap = z.record(objectId, z.coerce.number().min(0)).optional().default({});

const auth = {
  register: z.object({
    name: text(100).min(2, 'Name is too short'),
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    phone: optText(30),
  }),
  login: z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(128) }),
  forgot: z.object({ email: z.string().trim().toLowerCase().email() }),
  reset: z.object({ token: z.string().min(20).max(200), password: z.string().min(8).max(128) }),
  changePassword: z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(128) }),
  profile: z.object({
    name: text(100).min(2).optional(),
    phone: text(30).optional(),
    avatarUrl: text(500).optional(),
    notificationPrefs: z
      .object({ missingMeals: z.boolean(), budget: z.boolean(), recurring: z.boolean(), dues: z.boolean(), closing: z.boolean() })
      .partial()
      .optional(),
  }),
};

const mealType = z.object({
  key: z.string().trim().min(1).max(30).regex(/^[a-z0-9_]+$/, 'Meal type key must be lowercase letters, digits or _'),
  label: text(40).min(1),
  weight: z.coerce.number().min(0).max(10),
  order: z.coerce.number().int().optional().default(0),
});

const rule = z.object({ method: z.enum(DISTRIBUTION_METHODS), shares: sharesMap });

const budget = z
  .object({
    total: money,
    food: money,
    grocery: money,
    household: money,
    utility: money,
    other: money,
    thresholds: z.array(z.coerce.number().min(1).max(200)).max(5),
  })
  .partial();

const settings = z
  .object({
    mealMode: z.enum(['standard', 'weighted']),
    distribution: z.object({ food: rule, household: rule, utility: rule, other: rule }).partial(),
    categoryRules: z.array(z.object({ category: text(60).min(1), method: z.enum(DISTRIBUTION_METHODS), shares: sharesMap })).max(50),
    equalSplitMode: z.enum(['full', 'prorated']),
    guestMeals: z.enum(['charge_host', 'exclude']),
    rounding: z.object({ rateDecimals: z.coerce.number().int().min(0).max(4), amountDecimals: z.coerce.number().int().min(0).max(2), mode: z.enum(['round', 'ceil', 'floor']) }).partial(),
    carryForward: z.object({ fund: z.boolean(), memberBalances: z.boolean() }).partial(),
    permissions: z.object({ memberCanEdit: z.boolean(), memberCanDelete: z.boolean(), memberCanEditOthersMeals: z.boolean() }).partial(),
  })
  .partial();

const household = {
  create: z.object({ name: text(120).min(2), type: z.enum(['mess', 'family']).default('mess'), address: optText(300) }),
  update: z.object({ name: text(120).min(2), type: z.enum(['mess', 'family']), address: text(300) }).partial(),
  invite: z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(ROLES).default('member') }),
  role: z.object({ role: z.enum(ROLES) }),
  category: z.object({ name: text(60).min(1), expenseType: z.enum(EXPENSE_TYPES), scope: z.enum(['bazar', 'expense', 'both']).default('both') }),
  categoryUpdate: z.object({ name: text(60).min(1), expenseType: z.enum(EXPENSE_TYPES), scope: z.enum(['bazar', 'expense', 'both']), archived: z.boolean() }).partial(),
};

const month = {
  create: z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
    name: text(120).optional(),
    address: optText(300),
    startingBalance: signedMoney.optional().default(0),
    carryBalance: signedMoney.optional(),
    budget: budget.optional(),
    mealTypes: z.array(mealType).min(1).max(10).optional(),
    copyFrom: objectId.optional(),
    copyMembers: z.boolean().optional().default(true),
    copySettings: z.boolean().optional().default(true),
    carryForward: z.boolean().optional().default(true),
  }),
  update: z
    .object({
      name: text(120).min(1),
      address: text(300),
      startingBalance: signedMoney,
      carryBalance: signedMoney,
      budget,
      mealTypes: z.array(mealType).min(1).max(10),
      settings,
    })
    .partial(),
};

const member = {
  create: z.object({
    fullName: text(100).min(1, 'Name is required'),
    nickname: optText(40),
    mobile: optText(30),
    email: z.union([z.literal(''), z.string().trim().toLowerCase().email()]).optional().default(''),
    photoUrl: optText(500),
    role: z.enum(ROLES).default('member'),
    joinDate: date.optional(),
    leaveDate: date.nullable().optional(),
    active: z.boolean().optional().default(true),
    openingBalance: signedMoney.optional().default(0),
  }),
};
member.update = member.create.partial();

const counts = z.record(z.string().max(30), z.coerce.number().min(0, 'Meal count cannot be negative').max(20));

const meals = {
  day: z.object({ entries: z.array(z.object({ member: objectId, counts })).max(200) }),
  quick: z.object({
    date,
    members: z.array(objectId).min(1).max(200),
    mealTypes: z.array(z.string().max(30)).min(1),
    value: z.coerce.number().min(0).max(20).default(1),
  }),
  copy: z.object({ from: date, to: date, members: z.array(objectId).optional() }),
  guest: z.object({
    host: objectId,
    guestName: optText(80),
    date,
    mealType: z.string().max(30),
    count: z.coerce.number().int().min(1).max(50),
    note: optText(200),
  }),
};

const purchaser = z.object({ member: objectId, amount: money.optional() });

const bazar = {
  create: z.object({
    date,
    itemName: text(120).min(1, 'Item name is required'),
    category: text(60).min(1),
    quantity: money.optional().default(1),
    unit: optText(20),
    unitPrice: money.optional().default(0),
    totalPrice: money.optional(),
    purchasers: z.array(purchaser).max(20).optional().default([]),
    paidFrom: z.enum(['fund', 'personal']).default('personal'),
    paymentMethod: paymentMethod.default('cash'),
    vendor: optText(120),
    receiptUrl: optText(500),
    notes: optText(500),
    isRefund: z.boolean().optional().default(false),
    status: z.enum(['active', 'cancelled']).optional().default('active'),
  }),
};
bazar.update = bazar.create.partial();
// Several items bought in one trip.
bazar.bulk = z.object({ items: z.array(bazar.create).min(1).max(50) });

const expense = {
  create: z.object({
    date,
    title: text(120).min(1, 'Title is required'),
    category: text(60).min(1),
    amount: money,
    paidBy: objectId.nullable().optional(),
    paidFrom: z.enum(['fund', 'personal']).default('fund'),
    paymentMethod: paymentMethod.default('cash'),
    description: optText(500),
    receiptUrl: optText(500),
    recurring: z.boolean().optional().default(false),
    isRefund: z.boolean().optional().default(false),
    status: z.enum(['active', 'cancelled']).optional().default('active'),
  }),
};
expense.update = expense.create.partial();

const contribution = {
  create: z.object({
    date,
    member: objectId,
    amount: money.refine((v) => v > 0, 'Amount must be more than 0'),
    paymentMethod: paymentMethod.default('cash'),
    reference: optText(100),
    note: optText(300),
  }),
};
contribution.update = contribution.create.partial();

const settlement = {
  create: z.object({
    date,
    member: objectId,
    direction: z.enum(['received', 'paid']),
    amount: money.refine((v) => v > 0, 'Amount must be more than 0'),
    paymentMethod: paymentMethod.default('cash'),
    note: optText(300),
  }),
};
settlement.update = settlement.create.partial();

const shopping = {
  create: z.object({
    item: text(120).min(1),
    quantity: money.optional().default(1),
    unit: optText(20),
    category: optText(60),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
    estimatedPrice: money.optional().default(0),
    status: z.enum(['pending', 'purchased']).optional().default('pending'),
  }),
  convert: z.object({
    date,
    totalPrice: money,
    quantity: money.optional(),
    unitPrice: money.optional(),
    category: text(60).optional(),
    purchasers: z.array(purchaser).max(20).optional().default([]),
    paidFrom: z.enum(['fund', 'personal']).default('personal'),
    paymentMethod: paymentMethod.default('cash'),
    vendor: optText(120),
  }),
};
shopping.update = shopping.create.partial();

const mealPlan = z.object({
  date,
  mealType: z.string().max(30),
  menu: text(300),
  ingredients: z.array(z.object({ item: text(80), quantity: money.optional(), unit: optText(20) })).max(30).optional().default([]),
});

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  from: date.optional(),
  to: date.optional(),
  member: objectId.optional(),
  category: z.string().trim().max(60).optional(),
  expenseType: z.enum(EXPENSE_TYPES).optional(),
  paymentMethod: paymentMethod.optional(),
  status: z.string().max(20).optional(),
  minAmount: z.coerce.number().min(0).optional(),
  maxAmount: z.coerce.number().min(0).optional(),
  sort: z.enum(['newest', 'oldest', 'highest', 'lowest']).optional().default('newest'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

module.exports = { z, objectId, date, money, auth, household, month, member, meals, bazar, expense, contribution, settlement, shopping, mealPlan, listQuery, settings, budget };
