const mongoose = require('mongoose');
const { ROLES } = require('./constants');

const householdSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, enum: ['mess', 'family'], default: 'mess' },
    address: { type: String, trim: true, default: '' },
    currency: { type: String, default: 'BDT' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    users: [
      {
        _id: false,
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        role: { type: String, enum: ROLES, default: 'member' },
      },
    ],
    // Pending invitations by email; resolved when that person registers or logs in.
    invites: [{ _id: false, email: { type: String, lowercase: true, trim: true }, role: { type: String, enum: ROLES, default: 'member' } }],
  },
  { timestamps: true }
);

householdSchema.index({ 'users.user': 1 });
householdSchema.index({ 'invites.email': 1 });

householdSchema.methods.roleOf = function roleOf(userId) {
  const entry = this.users.find((u) => String(u.user) === String(userId));
  return entry ? entry.role : null;
};

module.exports = mongoose.model('Household', householdSchema);
