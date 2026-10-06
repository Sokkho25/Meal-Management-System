const mongoose = require('mongoose');

// One document per member per day. counts maps meal type key -> number of meals.
const mealEntrySchema = new mongoose.Schema(
  {
    month: { type: mongoose.Schema.Types.ObjectId, ref: 'Month', required: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    date: { type: String, required: true },
    counts: { type: Map, of: Number, default: {} },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Prevents duplicate entries for the same member and day.
mealEntrySchema.index({ month: 1, member: 1, date: 1 }, { unique: true });
mealEntrySchema.index({ month: 1, date: 1 });

module.exports = mongoose.model('MealEntry', mealEntrySchema);
