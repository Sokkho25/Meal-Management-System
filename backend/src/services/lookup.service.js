const { Category, Member } = require('../models');
const ApiError = require('../utils/ApiError');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Resolves a category name to its canonical name and expense type. */
async function resolveCategory(req, name) {
  const cat = await Category.findOne({ household: req.household._id, name: new RegExp(`^${escapeRegex(name.trim())}$`, 'i') }).lean();
  if (!cat) throw ApiError.badRequest(`Unknown category "${name}". Add it under Settings → Categories first.`);
  return { category: cat.name, expenseType: cat.expenseType };
}

/** Ensures every id is a live member of this month. */
async function assertMembers(req, ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return [];
  const found = await Member.find({ _id: { $in: unique }, month: req.month._id, deletedAt: null }).lean();
  if (found.length !== unique.length) throw ApiError.badRequest('One or more selected members do not belong to this month');
  return found;
}

module.exports = { resolveCategory, assertMembers, escapeRegex };
