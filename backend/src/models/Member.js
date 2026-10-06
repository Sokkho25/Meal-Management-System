const mongoose = require('mongoose');
const softDelete = require('./softDelete');
const { ROLES } = require('./constants');

const memberSchema = new mongoose.Schema(
  {
    month: { type: mongoose.Schema.Types.ObjectId, ref: 'Month', required: true },
    household: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    fullName: { type: String, required: true, trim: true, maxlength: 100 },
    nickname: { type: String, trim: true, default: '' },
    mobile: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    photoUrl: { type: String, default: '' },
    role: { type: String, enum: ROLES, default: 'member' },
    joinDate: { type: String, required: true },
    leaveDate: { type: String, default: null },
    active: { type: Boolean, default: true },
    // Credit (+) or due (-) carried in from the previous month.
    openingBalance: { type: Number, default: 0 },
    // Links the same person across months.
    personKey: { type: String, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);
memberSchema.plugin(softDelete);
memberSchema.index({ month: 1, deletedAt: 1 });
memberSchema.index({ month: 1, user: 1 });

module.exports = mongoose.model('Member', memberSchema);
