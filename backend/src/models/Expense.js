const mongoose = require('mongoose');
const softDelete = require('./softDelete');
const { EXPENSE_TYPES, PAYMENT_METHODS } = require('./constants');

const expenseSchema = new mongoose.Schema(
  {
    month: { type: mongoose.Schema.Types.ObjectId, ref: 'Month', required: true },
    date: { type: String, required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, required: true, trim: true },
    expenseType: { type: String, enum: EXPENSE_TYPES, required: true },
    amount: { type: Number, required: true, min: 0 },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null },
    paidFrom: { type: String, enum: ['fund', 'personal'], default: 'fund' },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'cash' },
    description: { type: String, trim: true, default: '' },
    receiptUrl: { type: String, default: '' },
    recurring: { type: Boolean, default: false },
    isRefund: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'cancelled'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);
expenseSchema.plugin(softDelete);
expenseSchema.index({ month: 1, deletedAt: 1, date: -1 });
expenseSchema.index({ month: 1, recurring: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
