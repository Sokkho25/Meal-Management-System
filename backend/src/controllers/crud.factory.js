const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const { audit } = require('../services/audit.service');
const { canChange, isAdmin, assertId } = require('../middleware/access');
const { inMonth } = require('../utils/dates');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Builds list/create/update/remove/restore handlers for a month-scoped, soft-deletable record.
 * opts: Model, entity, amountField, memberField, searchFields, populate, prepare(req, body, existing),
 *       describe(doc), createGuard(req, body), dateField (default 'date')
 */
module.exports = function crud(opts) {
  const { Model, entity, amountField, memberField, searchFields = [], populate = [], dateField = 'date' } = opts;

  async function findOwned(req) {
    assertId(req.params.id);
    const doc = await Model.findOne({ _id: req.params.id, month: req.month._id });
    if (!doc) throw ApiError.notFound(`${entity} not found`);
    return doc;
  }

  function checkDate(req, body) {
    if (dateField && body[dateField] && !inMonth(body[dateField], req.month.year, req.month.month)) {
      throw ApiError.badRequest(`Date must be within this month (${req.month.year}-${String(req.month.month).padStart(2, '0')})`);
    }
  }

  async function list(req, res) {
    const q = req.validQuery || {};
    const filter = { month: req.month._id, deletedAt: null };
    if (q.q && searchFields.length) {
      const rx = new RegExp(escapeRegex(q.q), 'i');
      filter.$or = searchFields.map((f) => ({ [f]: rx }));
    }
    if (dateField && (q.from || q.to)) filter[dateField] = { ...(q.from && { $gte: q.from }), ...(q.to && { $lte: q.to }) };
    if (q.member && memberField) filter[memberField] = new mongoose.Types.ObjectId(q.member);
    if (q.category) filter.category = q.category;
    if (q.expenseType) filter.expenseType = q.expenseType;
    if (q.paymentMethod) filter.paymentMethod = q.paymentMethod;
    if (q.status) filter.status = q.status;
    if (amountField && (q.minAmount !== undefined || q.maxAmount !== undefined)) {
      filter[amountField] = { ...(q.minAmount !== undefined && { $gte: q.minAmount }), ...(q.maxAmount !== undefined && { $lte: q.maxAmount }) };
    }
    const sortMap = {
      newest: { [dateField || 'createdAt']: -1, createdAt: -1 },
      oldest: { [dateField || 'createdAt']: 1, createdAt: 1 },
      highest: { [amountField || 'createdAt']: -1, createdAt: -1 },
      lowest: { [amountField || 'createdAt']: 1, createdAt: -1 },
    };
    const page = q.page || 1;
    const limit = q.limit || 50;
    let query = Model.find(filter).sort(sortMap[q.sort || 'newest']).skip((page - 1) * limit).limit(limit);
    populate.forEach((p) => (query = query.populate(p[0], p[1])));
    const [items, total, sum] = await Promise.all([
      query.lean(),
      Model.countDocuments(filter),
      amountField
        ? Model.aggregate([{ $match: filter }, { $group: { _id: null, sum: { $sum: { $cond: [{ $eq: ['$isRefund', true] }, { $multiply: [`$${amountField}`, -1] }, `$${amountField}`] } } } }])
        : Promise.resolve([]),
    ]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)), sum: sum[0] ? sum[0].sum : 0 });
  }

  async function create(req, res) {
    let body = { ...req.body };
    checkDate(req, body);
    if (opts.createGuard) await opts.createGuard(req, body);
    if (opts.prepare) body = await opts.prepare(req, body, null);
    const doc = await Model.create({ ...body, month: req.month._id, createdBy: req.user._id });
    await audit(req, { action: 'create', entity, entityId: doc._id, summary: `${req.user.name} added ${opts.describe(doc)}`, after: doc });
    res.status(201).json({ item: doc });
  }

  async function update(req, res) {
    const doc = await findOwned(req);
    if (doc.deletedAt) throw ApiError.badRequest('Restore this record before editing it');
    if (!canChange(req, doc, 'edit')) throw ApiError.forbidden('You are not allowed to edit this record');
    let body = { ...req.body };
    checkDate(req, body);
    if (opts.createGuard && !isAdmin(req)) await opts.createGuard(req, { ...doc.toObject(), ...body });
    if (opts.prepare) body = await opts.prepare(req, body, doc);
    const before = doc.toObject();
    Object.assign(doc, body, { updatedBy: req.user._id });
    await doc.save();
    await audit(req, { action: 'update', entity, entityId: doc._id, summary: `${req.user.name} edited ${opts.describe(doc)}`, before, after: doc });
    res.json({ item: doc });
  }

  async function remove(req, res) {
    const doc = await findOwned(req);
    if (doc.deletedAt) return res.json({ ok: true });
    if (!canChange(req, doc, 'delete')) throw ApiError.forbidden('You are not allowed to delete this record');
    doc.deletedAt = new Date();
    doc.deletedBy = req.user._id;
    await doc.save();
    await audit(req, { action: 'delete', entity, entityId: doc._id, summary: `${req.user.name} deleted ${opts.describe(doc)}`, before: doc });
    res.json({ ok: true });
  }

  async function restore(req, res) {
    if (!isAdmin(req)) throw ApiError.forbidden('Only an admin can restore deleted records');
    const doc = await findOwned(req);
    doc.deletedAt = null;
    doc.deletedBy = null;
    await doc.save();
    await audit(req, { action: 'restore', entity, entityId: doc._id, summary: `${req.user.name} restored ${opts.describe(doc)}`, after: doc });
    res.json({ item: doc });
  }

  return { list, create, update, remove, restore, findOwned };
};
