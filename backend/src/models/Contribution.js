const mongoose = require('mongoose');
const softDelete = require('./softDelete');
const { PAYMENT_METHODS } = require('./constants');

const contributionSchema = new mongoose.Schema(
  {
    month: { type: mongoose.Schema.Types.ObjectId, ref: 'Month', required: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    date: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'cash' },
    reference: { type: String, trim: true, default: '' },
    note: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);
contributionSchema.plugin(softDelete);
contributionSchema.index({ month: 1, deletedAt: 1, member: 1 });

module.exports = mongoose.model('Contribution', contributionSchema);
