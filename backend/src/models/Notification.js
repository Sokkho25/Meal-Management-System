const mongoose = require('mongoose');

// Alerts are computed from live data; this collection only remembers which ones a user dismissed.
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    month: { type: mongoose.Schema.Types.ObjectId, ref: 'Month', required: true },
    key: { type: String, required: true },
    dismissedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
notificationSchema.index({ user: 1, month: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('Notification', notificationSchema);
