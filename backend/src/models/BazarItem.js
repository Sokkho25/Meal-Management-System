const mongoose = require('mongoose');
const softDelete = require('./softDelete');
const { EXPENSE_TYPES, PAYMENT_METHODS } = require('./constants');

const bazarItemSchema = new mongoose.Schema(
  {
    month: { type: mongoose.Schema.Types.ObjectId, ref: 'Month', required: true },
    date: { type: String, required: true },
    itemName: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, required: true, trim: true },
    expenseType: { type: String, enum: EXPENSE_TYPES, default: 'food' },
    quantity: { type: Number, min: 0, default: 1 },
    unit: { type: String, trim: true, default: '' },
    unitPrice: { type: Number, min: 0, default: 0 },
    totalPrice: { type: Number, min: 0, required: true },
    // One or more members who paid. Amounts add up to totalPrice.
    purchasers: [{ _id: false, member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' }, amount: { type: Number, min: 0 } }],
    // 'fund' = paid from the shared mess fund; 'personal' = purchaser paid from own pocket and is credited.
    paidFrom: { type: String, enum: ['fund', 'personal'], default: 'personal' },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'cash' },
    vendor: { type: String, trim: true, default: '' },
    receiptUrl: { type: String, default: '' },
    notes: { type: String, trim: true, default: '' },
    // A refund/return reduces cost instead of adding to it.
    isRefund: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'cancelled'], default: 'active' },
    fromShoppingItem: { type: mongoose.Schema.Types.ObjectId, ref: 'ShoppingItem' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);
bazarItemSchema.plugin(softDelete);
bazarItemSchema.index({ month: 1, deletedAt: 1, date: -1 });
bazarItemSchema.index({ month: 1, category: 1 });
bazarItemSchema.index({ itemName: 'text', vendor: 'text', notes: 'text' });

module.exports = mongoose.model('BazarItem', bazarItemSchema);
