const { AuditLog, Month } = require('../models');

const strip = (doc) => {
  if (!doc) return undefined;
  const o = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  delete o.__v;
  return o;
};

/** Records who did what, and bumps the month version so cached calculations refresh. */
async function audit(req, { action, entity, entityId, summary, before, after, monthId }) {
  const month = monthId || (req.month && req.month._id) || null;
  await AuditLog.create({
    household: req.household._id,
    month,
    user: req.user._id,
    userName: req.user.name,
    action,
    entity,
    entityId,
    summary,
    before: strip(before),
    after: strip(after),
  });
  if (month) await Month.updateOne({ _id: month }, { $inc: { version: 1 } });
}

module.exports = { audit };
