const mongoose = require('mongoose');

// Frozen copy of a month's calculation taken when the month is closed.
const monthlyReportSchema = new mongoose.Schema(
  {
    household: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', required: true },
    month: { type: mongoose.Schema.Types.ObjectId, ref: 'Month', required: true, unique: true },
    year: Number,
    monthNumber: Number,
    totals: mongoose.Schema.Types.Mixed,
    members: mongoose.Schema.Types.Mixed,
    calculation: mongoose.Schema.Types.Mixed,
    generatedAt: { type: Date, default: Date.now },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);
monthlyReportSchema.index({ household: 1, year: -1, monthNumber: -1 });

module.exports = mongoose.model('MonthlyReport', monthlyReportSchema);
