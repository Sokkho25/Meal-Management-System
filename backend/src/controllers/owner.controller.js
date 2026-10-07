const { User, Household, Month, Member } = require('../models');

const DAY = 24 * 60 * 60 * 1000;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Site-wide numbers for the owner page: sign-ups, activity, households. */
exports.stats = async (_req, res) => {
  const now = Date.now();
  const since = (days) => new Date(now - days * DAY);
  const [users, households, months, members, signups7, signups30, active1, active7, active30, daily] = await Promise.all([
    User.countDocuments(),
    Household.countDocuments(),
    Month.countDocuments(),
    // People, not monthly rows: a member copied into a new month keeps the same personKey.
    Member.aggregate([{ $match: { deletedAt: null } }, { $group: { _id: { $ifNull: ['$personKey', '$_id'] } } }, { $count: 'n' }]).then((r) => r[0]?.n || 0),
    User.countDocuments({ createdAt: { $gte: since(7) } }),
    User.countDocuments({ createdAt: { $gte: since(30) } }),
    User.countDocuments({ lastSeenAt: { $gte: since(1) } }),
    User.countDocuments({ lastSeenAt: { $gte: since(7) } }),
    User.countDocuments({ lastSeenAt: { $gte: since(30) } }),
    User.aggregate([
      { $match: { createdAt: { $gte: since(29) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+06:00' } }, count: { $sum: 1 } } },
    ]),
  ]);
  // Fill every day of the last 30 so the chart has no gaps (dates in Bangladesh time).
  const counts = Object.fromEntries(daily.map((d) => [d._id, d.count]));
  const signupsByDay = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(now + 6 * 60 * 60 * 1000 - (29 - i) * DAY).toISOString().slice(0, 10);
    return { date, count: counts[date] || 0 };
  });
  res.json({
    totals: { users, households, months, members },
    signups: { last7: signups7, last30: signups30 },
    active: { last24h: active1, last7: active7, last30: active30 },
    signupsByDay,
  });
};

/** All accounts, newest first, with the households each one belongs to. */
exports.users = async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const q = String(req.query.q || '').trim().slice(0, 100);
  const filter = q ? { $or: [{ name: new RegExp(escapeRegex(q), 'i') }, { email: new RegExp(escapeRegex(q), 'i') }] } : {};
  const sort = req.query.sort === 'active' ? { lastSeenAt: -1, createdAt: -1 } : { createdAt: -1 };
  const [total, list] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter, { name: 1, email: 1, phone: 1, createdAt: 1, lastSeenAt: 1, loginCount: 1 })
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);
  const hh = await Household.find({ 'users.user': { $in: list.map((u) => u._id) } }, { name: 1, users: 1 }).lean();
  const items = list.map((u) => ({
    ...u,
    households: hh
      .filter((h) => h.users.some((x) => String(x.user) === String(u._id)))
      .map((h) => ({ _id: h._id, name: h.name, role: h.users.find((x) => String(x.user) === String(u._id)).role })),
  }));
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
};

/** All households with their owner, size and latest month. */
exports.households = async (_req, res) => {
  const list = await Household.find({}, { name: 1, type: 1, owner: 1, users: 1, createdAt: 1 })
    .sort({ createdAt: -1 })
    .limit(500)
    .populate('owner', 'name email')
    .lean();
  const ids = list.map((h) => h._id);
  const [monthAgg, memberAgg] = await Promise.all([
    Month.aggregate([
      { $match: { household: { $in: ids } } },
      { $sort: { year: -1, month: -1 } },
      { $group: { _id: '$household', count: { $sum: 1 }, latestYear: { $first: '$year' }, latestMonth: { $first: '$month' }, lastActivity: { $max: '$updatedAt' } } },
    ]),
    Member.aggregate([{ $match: { deletedAt: null } }, { $lookup: { from: 'months', localField: 'month', foreignField: '_id', as: 'm' } }, { $unwind: '$m' }, { $match: { 'm.household': { $in: ids } } }, { $group: { _id: { h: '$m.household', p: { $ifNull: ['$personKey', '$_id'] } } } }, { $group: { _id: '$_id.h', count: { $sum: 1 } } }]),
  ]);
  const byId = (arr) => Object.fromEntries(arr.map((x) => [String(x._id), x]));
  const m = byId(monthAgg);
  const mem = byId(memberAgg);
  res.json({
    items: list.map((h) => ({
      _id: h._id,
      name: h.name,
      type: h.type,
      createdAt: h.createdAt,
      owner: h.owner ? { name: h.owner.name, email: h.owner.email } : null,
      logins: h.users.length,
      members: mem[String(h._id)]?.count || 0,
      months: m[String(h._id)]?.count || 0,
      latest: m[String(h._id)] ? { year: m[String(h._id)].latestYear, month: m[String(h._id)].latestMonth } : null,
      lastActivity: m[String(h._id)]?.lastActivity || h.createdAt,
    })),
  });
};
