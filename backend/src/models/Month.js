const mongoose = require('mongoose');
const { EXPENSE_TYPES, DISTRIBUTION_METHODS } = require('./constants');

const ruleSchema = new mongoose.Schema(
  {
    method: { type: String, enum: DISTRIBUTION_METHODS, default: 'equal' },
    // percentage: { memberId: percent }, custom: { memberId: amount }
    shares: { type: Map, of: Number, default: {} },
  },
  { _id: false }
);

const monthSchema = new mongoose.Schema(
  {
    household: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', required: true },
    year: { type: Number, required: true, min: 2000, max: 2100 },
    month: { type: Number, required: true, min: 1, max: 12 },
    name: { type: String, trim: true, required: true },
    address: { type: String, trim: true, default: '' },
    currency: { type: String, default: 'BDT' },
    startingBalance: { type: Number, default: 0 },
    carryBalance: { type: Number, default: 0 },
    previousMonth: { type: mongoose.Schema.Types.ObjectId, ref: 'Month', default: null },
    mealTypes: [
      {
        _id: false,
        key: { type: String, required: true },
        label: { type: String, required: true },
        weight: { type: Number, default: 1, min: 0 },
        order: { type: Number, default: 0 },
      },
    ],
    budget: {
      total: { type: Number, default: 0, min: 0 },
      food: { type: Number, default: 0, min: 0 },
      grocery: { type: Number, default: 0, min: 0 },
      household: { type: Number, default: 0, min: 0 },
      utility: { type: Number, default: 0, min: 0 },
      other: { type: Number, default: 0, min: 0 },
      thresholds: { type: [Number], default: [75, 90, 100] },
    },
    settings: {
      mealMode: { type: String, enum: ['standard', 'weighted'], default: 'standard' },
      distribution: {
        food: { type: ruleSchema, default: () => ({ method: 'per_meal' }) },
        household: { type: ruleSchema, default: () => ({ method: 'equal' }) },
        utility: { type: ruleSchema, default: () => ({ method: 'equal' }) },
        other: { type: ruleSchema, default: () => ({ method: 'equal' }) },
      },
      // Optional per-category override of the distribution rule.
      categoryRules: [{ _id: false, category: String, method: { type: String, enum: DISTRIBUTION_METHODS }, shares: { type: Map, of: Number, default: {} } }],
      equalSplitMode: { type: String, enum: ['full', 'prorated'], default: 'full' },
      guestMeals: { type: String, enum: ['charge_host', 'exclude'], default: 'charge_host' },
      rounding: {
        rateDecimals: { type: Number, default: 2, min: 0, max: 4 },
        amountDecimals: { type: Number, default: 0, min: 0, max: 2 },
        mode: { type: String, enum: ['round', 'ceil', 'floor'], default: 'round' },
      },
      carryForward: {
        fund: { type: Boolean, default: true },
        memberBalances: { type: Boolean, default: true },
      },
      permissions: {
        memberCanEdit: { type: Boolean, default: false },
        memberCanDelete: { type: Boolean, default: false },
        memberCanEditOthersMeals: { type: Boolean, default: false },
      },
    },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    closedAt: Date,
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reopenedAt: Date,
    // Incremented on every write so cached calculations can be invalidated.
    version: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

monthSchema.index({ household: 1, year: -1, month: -1 }, { unique: true });

monthSchema.statics.EXPENSE_TYPES = EXPENSE_TYPES;

module.exports = mongoose.model('Month', monthSchema);
