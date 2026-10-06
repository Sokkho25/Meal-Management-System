const { Notification } = require('../models');
const { getCalculation } = require('../services/month.service');
const { buildNotifications } = require('../services/notification.service');

exports.list = async (req, res) => {
  const calc = await getCalculation(req.month);
  res.json({ items: await buildNotifications(req, calc), prefs: req.user.notificationPrefs });
};

exports.dismiss = async (req, res) => {
  const keys = Array.isArray(req.body.keys) ? req.body.keys.slice(0, 50).map(String) : [];
  await Promise.all(keys.map((key) => Notification.updateOne({ user: req.user._id, month: req.month._id, key }, { $setOnInsert: { dismissedAt: new Date() } }, { upsert: true })));
  res.json({ ok: true });
};
