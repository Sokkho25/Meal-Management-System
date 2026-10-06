const mongoose = require('mongoose');
const { EXPENSE_TYPES } = require('./constants');

const categorySchema = new mongoose.Schema(
  {
    household: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    expenseType: { type: String, enum: EXPENSE_TYPES, required: true },
    scope: { type: String, enum: ['bazar', 'expense', 'both'], default: 'both' },
    isDefault: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

categorySchema.index({ household: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

module.exports = mongoose.model('Category', categorySchema);
