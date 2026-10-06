const mongoose = require('mongoose');
const softDelete = require('./softDelete');

const guestMealSchema = new mongoose.Schema(
  {
    month: { type: mongoose.Schema.Types.ObjectId, ref: 'Month', required: true },
    host: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    guestName: { type: String, trim: true, default: 'Guest' },
    date: { type: String, required: true },
    mealType: { type: String, required: true },
    count: { type: Number, required: true, min: 0 },
    note: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);
guestMealSchema.plugin(softDelete);
guestMealSchema.index({ month: 1, date: 1 });

module.exports = mongoose.model('GuestMeal', guestMealSchema);
