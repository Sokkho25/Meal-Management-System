const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    household: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', required: true },
    month: { type: mongoose.Schema.Types.ObjectId, ref: 'Month', default: null },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: String,
    action: { type: String, enum: ['create', 'update', 'delete', 'restore', 'close', 'reopen', 'bulk'], required: true },
    entity: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    summary: { type: String, required: true },
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
auditLogSchema.index({ household: 1, month: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
