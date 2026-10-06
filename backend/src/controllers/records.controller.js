const { BazarItem, Expense, Contribution, Settlement, GuestMeal, ShoppingItem, MealPlan, Member } = require('../models');
const crud = require('./crud.factory');
const ApiError = require('../utils/ApiError');
const { isAdmin } = require('../middleware/access');
const { resolveCategory, assertMembers } = require('../services/lookup.service');
const { audit } = require('../services/audit.service');
const { inMonth } = require('../utils/dates');

const tk = (n) => `৳${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const r2 = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------- Bazar
async function prepareBazar(req, body, existing) {
  const merged = { ...(existing ? existing.toObject() : {}), ...body };
  if (body.category !== undefined) Object.assign(body, await resolveCategory(req, body.category));
  const qty = Number(merged.quantity) || 0;
  if (body.totalPrice === undefined && (body.unitPrice !== undefined || body.quantity !== undefined)) {
    body.totalPrice = r2(qty * (Number(merged.unitPrice) || 0));
  }
  if (!existing && body.totalPrice === undefined) throw ApiError.badRequest('Enter a total price or a unit price');
  const total = body.totalPrice !== undefined ? body.totalPrice : merged.totalPrice;
  if ((!merged.unitPrice || body.totalPrice !== undefined) && qty > 0 && body.unitPrice === undefined) body.unitPrice = r2(total / qty);

  if (body.purchasers !== undefined || !existing) {
    let purchasers = body.purchasers || [];
    if (!purchasers.length && req.selfMember && merged.paidFrom !== 'fund') purchasers = [{ member: String(req.selfMember._id) }];
    await assertMembers(req, purchasers.map((p) => p.member));
    if (purchasers.length === 1 && purchasers[0].amount === undefined) purchasers[0].amount = total;
    if (purchasers.length > 1) {
      const sum = purchasers.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      if (Math.abs(sum - total) > 0.01) throw ApiError.badRequest(`Split amounts (${sum}) must add up to the total (${total})`);
    }
    if (merged.paidFrom === 'personal' && !purchasers.length) throw ApiError.badRequest('Select who paid for this purchase');
    body.purchasers = purchasers;
  } else if (body.totalPrice !== undefined && existing.purchasers.length === 1) {
    body.purchasers = [{ member: existing.purchasers[0].member, amount: body.totalPrice }];
  }
  return body;
}

const bazar = crud({
  Model: BazarItem,
  entity: 'Bazar',
  amountField: 'totalPrice',
  memberField: 'purchasers.member',
  searchFields: ['itemName', 'category', 'vendor', 'notes'],
  populate: [['purchasers.member', 'fullName nickname']],
  prepare: prepareBazar,
  describe: (d) => `bazar "${d.itemName}" ${tk(d.totalPrice)} on ${d.date}`,
});

bazar.bulkCreate = async (req, res) => {
  const created = [];
  for (const raw of req.body.items) {
    if (!inMonth(raw.date, req.month.year, req.month.month)) throw ApiError.badRequest(`Date ${raw.date} is not in this month`);
    created.push(await prepareBazar(req, { ...raw }, null));
  }
  const docs = await BazarItem.insertMany(created.map((b) => ({ ...b, month: req.month._id, createdBy: req.user._id })));
  const total = docs.reduce((s, d) => s + d.totalPrice, 0);
  await audit(req, { action: 'bulk', entity: 'Bazar', summary: `${req.user.name} added ${docs.length} bazar items (${tk(total)})` });
  res.status(201).json({ items: docs });
};

// ---------------------------------------------------------------- Expenses
async function prepareExpense(req, body, existing) {
  const merged = { ...(existing ? existing.toObject() : {}), ...body };
  if (body.category !== undefined) Object.assign(body, await resolveCategory(req, body.category));
  if (merged.paidBy) await assertMembers(req, [merged.paidBy]);
  if (merged.paidFrom === 'personal' && !merged.paidBy) throw ApiError.badRequest('Select who paid for this expense');
  if (merged.paidFrom === 'fund' && body.paidBy === undefined && !existing) body.paidBy = null;
  return body;
}

const expenses = crud({
  Model: Expense,
  entity: 'Expense',
  amountField: 'amount',
  memberField: 'paidBy',
  searchFields: ['title', 'category', 'description'],
  populate: [['paidBy', 'fullName nickname']],
  prepare: prepareExpense,
  describe: (d) => `${d.expenseType} expense "${d.title}" ${tk(d.amount)} on ${d.date}`,
});

/** Recurring expenses from the previous month that have not been added this month yet. */
expenses.recurringSuggestions = async (req, res) => {
  res.json({ items: await recurringDue(req.month) });
};

async function recurringDue(month) {
  if (!month.previousMonth) return [];
  const [prev, current] = await Promise.all([
    Expense.find({ month: month.previousMonth, recurring: true, deletedAt: null, status: 'active' }).lean(),
    Expense.find({ month: month._id, deletedAt: null }).select('title category').lean(),
  ]);
  const have = new Set(current.map((e) => `${e.category}|${e.title}`.toLowerCase()));
  return prev
    .filter((e) => !have.has(`${e.category}|${e.title}`.toLowerCase()))
    .map(({ title, category, expenseType, amount, paymentMethod, paidFrom }) => ({ title, category, expenseType, amount, paymentMethod, paidFrom, recurring: true }));
}
expenses.recurringDue = recurringDue;

// ---------------------------------------------------------------- Contributions
const contributions = crud({
  Model: Contribution,
  entity: 'Deposit',
  amountField: 'amount',
  memberField: 'member',
  searchFields: ['reference', 'note'],
  populate: [['member', 'fullName nickname']],
  createGuard: async (req, body) => {
    await assertMembers(req, [body.member]);
    if (!isAdmin(req) && (!req.selfMember || String(body.member) !== String(req.selfMember._id))) {
      throw ApiError.forbidden('Members can only record their own deposits');
    }
  },
  describe: (d) => `deposit ${tk(d.amount)} via ${d.paymentMethod} on ${d.date}`,
});

// ---------------------------------------------------------------- Settlements
const settlements = crud({
  Model: Settlement,
  entity: 'Settlement',
  amountField: 'amount',
  memberField: 'member',
  searchFields: ['note'],
  populate: [['member', 'fullName nickname']],
  createGuard: async (req, body) => {
    await assertMembers(req, [body.member]);
  },
  describe: (d) => `settlement ${d.direction === 'received' ? 'collected' : 'refunded'} ${tk(d.amount)} on ${d.date}`,
});

// ---------------------------------------------------------------- Guests
const guests = crud({
  Model: GuestMeal,
  entity: 'Guest meal',
  amountField: 'count',
  memberField: 'host',
  searchFields: ['guestName', 'note'],
  populate: [['host', 'fullName nickname']],
  createGuard: async (req, body) => {
    await assertMembers(req, [body.host]);
    if (!req.month.mealTypes.some((t) => t.key === body.mealType)) throw ApiError.badRequest('Unknown meal type');
    const p = req.month.settings.permissions || {};
    if (!isAdmin(req) && !p.memberCanEditOthersMeals && (!req.selfMember || String(body.host) !== String(req.selfMember._id))) {
      throw ApiError.forbidden('Members can only add guests they are hosting');
    }
  },
  describe: (d) => `${d.count} guest meal(s) for ${d.guestName || 'guest'} on ${d.date}`,
});

// ---------------------------------------------------------------- Shopping list
const shopping = crud({
  Model: ShoppingItem,
  entity: 'Shopping item',
  amountField: 'estimatedPrice',
  searchFields: ['item', 'category'],
  dateField: null,
  describe: (d) => `shopping item "${d.item}"`,
});

// Shopping items are collaborative: anyone can tick them off or edit them.
shopping.update = async (req, res) => {
  const item = await shopping.findOwned(req);
  if (item.deletedAt) throw ApiError.badRequest('Restore this item before editing it');
  Object.assign(item, req.body);
  await item.save();
  await audit(req, { action: 'update', entity: 'Shopping item', entityId: item._id, summary: `${req.user.name} updated shopping item "${item.item}"` });
  res.json({ item });
};
shopping.convert = async (req, res) => {
  const item = await shopping.findOwned(req);
  if (item.status === 'purchased' && item.bazarItem) throw ApiError.conflict('This item has already been converted');
  if (!inMonth(req.body.date, req.month.year, req.month.month)) throw ApiError.badRequest('Date is not in this month');
  const body = await prepareBazar(
    req,
    {
      date: req.body.date,
      itemName: item.item,
      category: req.body.category || item.category || 'Grocery',
      quantity: req.body.quantity !== undefined ? req.body.quantity : item.quantity,
      unit: item.unit,
      unitPrice: req.body.unitPrice,
      totalPrice: req.body.totalPrice,
      purchasers: req.body.purchasers,
      paidFrom: req.body.paidFrom,
      paymentMethod: req.body.paymentMethod,
      vendor: req.body.vendor,
      notes: 'From shopping list',
    },
    null
  );
  if (body.unitPrice === undefined) delete body.unitPrice;
  const bazarItem = await BazarItem.create({ ...body, month: req.month._id, createdBy: req.user._id, fromShoppingItem: item._id });
  item.status = 'purchased';
  item.bazarItem = bazarItem._id;
  await item.save();
  await audit(req, { action: 'create', entity: 'Bazar', entityId: bazarItem._id, summary: `${req.user.name} bought "${item.item}" from the shopping list for ${tk(bazarItem.totalPrice)}` });
  res.status(201).json({ item, bazarItem });
};

// ---------------------------------------------------------------- Meal plans (optional module)
const mealPlans = {
  list: async (req, res) => {
    const filter = { month: req.month._id };
    if (req.query.from || req.query.to) filter.date = { ...(req.query.from && { $gte: String(req.query.from) }), ...(req.query.to && { $lte: String(req.query.to) }) };
    res.json({ items: await MealPlan.find(filter).sort({ date: 1 }).lean() });
  },
  upsert: async (req, res) => {
    const { date, mealType, menu, ingredients } = req.body;
    if (!inMonth(date, req.month.year, req.month.month)) throw ApiError.badRequest('Date is not in this month');
    if (!menu) {
      await MealPlan.deleteOne({ month: req.month._id, date, mealType });
      return res.json({ item: null });
    }
    const item = await MealPlan.findOneAndUpdate({ month: req.month._id, date, mealType }, { menu, ingredients, updatedBy: req.user._id }, { upsert: true, new: true, runValidators: true });
    res.json({ item });
  },
};

module.exports = { bazar, expenses, contributions, settlements, guests, shopping, mealPlans, Member };
