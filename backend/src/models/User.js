const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    avatarUrl: { type: String, default: '' },
    passwordHash: { type: String, required: true, select: false },
    passwordChangedAt: { type: Date },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    lastSeenAt: { type: Date, index: true },
    loginCount: { type: Number, default: 0 },
    lastHousehold: { type: mongoose.Schema.Types.ObjectId, ref: 'Household' },
    notificationPrefs: {
      missingMeals: { type: Boolean, default: true },
      budget: { type: Boolean, default: true },
      recurring: { type: Boolean, default: true },
      dues: { type: Boolean, default: true },
      closing: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

userSchema.methods.toJSON = function toJSON() {
  const o = this.toObject();
  delete o.passwordHash;
  delete o.passwordResetTokenHash;
  delete o.passwordResetExpires;
  delete o.__v;
  return o;
};

module.exports = mongoose.model('User', userSchema);
