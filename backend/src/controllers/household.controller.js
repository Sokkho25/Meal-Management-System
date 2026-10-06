const { Household, Category, Month, User, Member, AuditLog } = require('../models');
const { DEFAULT_CATEGORIES } = require('../models/constants');
const ApiError = require('../utils/ApiError');
const { audit } = require('../services/audit.service');
const { monthSummary } = require('../services/month.service');

exports.list = async (req, res) => {
  const households = await Household.find({ 'users.user': req.user._id }).sort({ createdAt: 1 }).lean();
  const out = await Promise.all(
    households.map(async (h) => {
      const latest = await Month.findOne({ household: h._id }).sort({ year: -1, month: -1 }).select('year month name status').lean();
      return { _id: h._id, name: h.name, type: h.type, address: h.address, currency: h.currency, role: h.users.find((u) => String(u.user) === String(req.user._id)).role, latestMonth: latest };
    })
  );
  res.json({ households: out, lastHousehold: req.user.lastHousehold });
};

exports.create = async (req, res) => {
  const household = await Household.create({ ...req.body, owner: req.user._id, users: [{ user: req.user._id, role: 'admin' }] });
  await Category.insertMany(DEFAULT_CATEGORIES.map((c) => ({ ...c, household: household._id, isDefault: true })));
  req.user.lastHousehold = household._id;
  await req.user.save();
  req.household = household;
  await audit(req, { action: 'create', entity: 'Household', entityId: household._id, summary: `${req.user.name} created household "${household.name}"` });
  res.status(201).json({ household });
};

exports.get = async (req, res) => {
  if (String(req.user.lastHousehold) !== String(req.household._id)) {
    req.user.lastHousehold = req.household._id;
    await req.user.save();
  }
  res.json({ household: req.household, role: req.role });
};

exports.update = async (req, res) => {
  Object.assign(req.household, req.body);
  await req.household.save();
  await audit(req, { action: 'update', entity: 'Household', entityId: req.household._id, summary: `${req.user.name} updated household details` });
  res.json({ household: req.household });
};

exports.users = async (req, res) => {
  const ids = req.household.users.map((u) => u.user);
  const users = await User.find({ _id: { $in: ids } }).select('name email phone avatarUrl').lean();
  res.json({
    users: req.household.users.map((u) => ({ ...users.find((x) => String(x._id) === String(u.user)), role: u.role, isOwner: String(u.user) === String(req.household.owner) })),
    invites: req.household.invites,
  });
};

exports.invite = async (req, res) => {
  const { email, role } = req.body;
  const user = await User.findOne({ email });
  if (user) {
    const existing = req.household.users.find((u) => String(u.user) === String(user._id));
    if (existing) existing.role = role;
    else req.household.users.push({ user: user._id, role });
    await Member.updateMany({ household: req.household._id, email, user: null }, { $set: { user: user._id } });
  } else if (!req.household.invites.some((i) => i.email === email)) {
    req.household.invites.push({ email, role });
  }
  await req.household.save();
  await audit(req, { action: 'create', entity: 'Access', summary: `${req.user.name} gave ${email} ${role} access` });
  res.status(201).json({ added: Boolean(user), invited: !user });
};

exports.setRole = async (req, res) => {
  const entry = req.household.users.find((u) => String(u.user) === req.params.userId);
  if (!entry) throw ApiError.notFound('User is not part of this household');
  if (String(req.household.owner) === req.params.userId && req.body.role !== 'admin') throw ApiError.badRequest('The owner must stay an admin');
  entry.role = req.body.role;
  await req.household.save();
  await audit(req, { action: 'update', entity: 'Access', summary: `${req.user.name} changed a user's role to ${req.body.role}` });
  res.json({ ok: true });
};

exports.removeUser = async (req, res) => {
  if (String(req.household.owner) === req.params.userId) throw ApiError.badRequest('The owner cannot be removed');
  req.household.users = req.household.users.filter((u) => String(u.user) !== req.params.userId);
  req.household.invites = req.household.invites.filter((i) => i.email !== req.query.email);
  await req.household.save();
  await audit(req, { action: 'delete', entity: 'Access', summary: `${req.user.name} removed a user's access` });
  res.json({ ok: true });
};

exports.cancelInvite = async (req, res) => {
  req.household.invites = req.household.invites.filter((i) => i.email !== String(req.query.email || '').toLowerCase());
  await req.household.save();
  res.json({ ok: true });
};

exports.categories = async (req, res) => {
  const categories = await Category.find({ household: req.household._id }).sort({ expenseType: 1, name: 1 }).lean();
  res.json({ categories });
};

exports.createCategory = async (req, res) => {
  const category = await Category.create({ ...req.body, household: req.household._id });
  await audit(req, { action: 'create', entity: 'Category', entityId: category._id, summary: `${req.user.name} added category "${category.name}"` });
  res.status(201).json({ category });
};

exports.updateCategory = async (req, res) => {
  const category = await Category.findOne({ _id: req.params.categoryId, household: req.household._id });
  if (!category) throw ApiError.notFound('Category not found');
  // Existing records keep the name and type they were saved with, so history is never rewritten.
  Object.assign(category, req.body);
  await category.save();
  await audit(req, { action: 'update', entity: 'Category', entityId: category._id, summary: `${req.user.name} updated category "${category.name}"` });
  res.json({ category });
};

exports.months = async (req, res) => {
  const months = await Month.find({ household: req.household._id }).sort({ year: -1, month: -1 }).select('year month name status closedAt createdAt').lean();
  res.json({ months });
};

exports.history = async (req, res) => {
  const months = await Month.find({ household: req.household._id }).sort({ year: -1, month: -1 });
  const rows = [];
  for (const m of months) rows.push(await monthSummary(m));
  res.json({ history: rows });
};

exports.audit = async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 30);
  const filter = { household: req.household._id };
  if (req.query.month) filter.month = String(req.query.month);
  const [items, total] = await Promise.all([
    AuditLog.find(filter).select('-before -after').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
};
