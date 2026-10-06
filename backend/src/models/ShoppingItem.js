const mongoose = require('mongoose');
const softDelete = require('./softDelete');

const shoppingItemSchema = new mongoose.Schema(
  {
    month: { type: mongoose.Schema.Types.ObjectId, ref: 'Month', required: true },
    item: { type: String, required: true, trim: true, maxlength: 120 },
    quantity: { type: Number, min: 0, default: 1 },
    unit: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: 'Grocery' },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    estimatedPrice: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: ['pending', 'purchased'], default: 'pending' },
    bazarItem: { type: mongoose.Schema.Types.ObjectId, ref: 'BazarItem', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);
shoppingItemSchema.plugin(softDelete);
shoppingItemSchema.index({ month: 1, deletedAt: 1, status: 1 });

module.exports = mongoose.model('ShoppingItem', shoppingItemSchema);
