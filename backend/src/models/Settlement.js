const mongoose = require('mongoose');
const softDelete = require('./softDelete');
const { PAYMENT_METHODS } = require('./constants');

// Money that changes hands to settle a month: 'received' = member paid their due into the fund,
// 'paid' = fund refunded money to the member.
const settlementSchema = new mongoose.Schema(
  {
    month: { type: mongoose.Schema.Types.ObjectId, ref: 'Month', required: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    date: { type: String, required: true },
    direction: { type: String, enum: ['received', 'paid'], required: true },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'cash' },
    note: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);
settlementSchema.plugin(softDelete);
settlementSchema.index({ month: 1, deletedAt: 1 });

module.exports = mongoose.model('Settlement', settlementSchema);
