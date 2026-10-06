const mongoose = require('mongoose');

const mealPlanSchema = new mongoose.Schema(
  {
    month: { type: mongoose.Schema.Types.ObjectId, ref: 'Month', required: true },
    date: { type: String, required: true },
    mealType: { type: String, required: true },
    menu: { type: String, trim: true, maxlength: 300, default: '' },
    ingredients: [{ _id: false, item: String, quantity: Number, unit: String }],
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);
mealPlanSchema.index({ month: 1, date: 1, mealType: 1 }, { unique: true });

module.exports = mongoose.model('MealPlan', mealPlanSchema);
