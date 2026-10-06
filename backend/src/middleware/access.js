const mongoose = require('mongoose');
const { Household, Month, Member } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const assertId = (v, what = 'id') => {
  if (!mongoose.isValidObjectId(v)) throw ApiError.badRequest(`Invalid ${what}`);
};

/** Loads :householdId and the caller's role in it. */
const loadHousehold = asyncHandler(async (req, _res, next) => {
  assertId(req.params.householdId, 'household id');
  const household = await Household.findById(req.params.householdId);
  if (!household) throw ApiError.notFound('Household not found');
  const role = household.roleOf(req.user._id);
  if (!role) throw ApiError.forbidden('You are not part of this household');
  req.household = household;
  req.role = role;
  next();
});

/** Loads :monthId, its household, the caller's role and their own member record (if any). */
const loadMonth = asyncHandler(async (req, _res, next) => {
  assertId(req.params.monthId, 'month id');
  const month = await Month.findById(req.params.monthId);
  if (!month) throw ApiError.notFound('Month not found');
  const household = await Household.findById(month.household);
  const role = household && household.roleOf(req.user._id);
  if (!role) throw ApiError.forbidden('You are not part of this household');
  req.month = month;
  req.household = household;
  req.role = role;
  req.selfMember = await Member.findOne({ month: month._id, user: req.user._id, deletedAt: null });
  next();
});

const requireAdmin = (req, _res, next) => {
  if (req.role !== 'admin') return next(ApiError.forbidden('Only an admin/manager can do this'));
  next();
};

/** Closed months are read-only until an admin reopens them. */
const requireOpen = (req, _res, next) => {
  if (req.month && req.month.status === 'closed') return next(new ApiError(423, 'This month is closed. An admin must reopen it before making changes.'));
  next();
};

const isAdmin = (req) => req.role === 'admin';

/**
 * Whether the caller can edit or delete an existing record. Admins always can; members only when
 * the month's permission settings allow it and the record is their own.
 */
function canChange(req, record, kind /* 'edit' | 'delete' */) {
  if (isAdmin(req)) return true;
  const p = req.month.settings.permissions || {};
  const allowed = kind === 'delete' ? p.memberCanDelete : p.memberCanEdit;
  if (!allowed) return false;
  return String(record.createdBy) === String(req.user._id);
}

module.exports = { loadHousehold, loadMonth, requireAdmin, requireOpen, isAdmin, canChange, assertId };
