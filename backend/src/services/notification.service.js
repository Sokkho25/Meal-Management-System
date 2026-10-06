const { MealEntry, Member, Notification } = require('../models');
const { today, inMonth, monthLabel, daysInMonth, monthRange } = require('../utils/dates');
const { isPresentOn } = require('./calculation.service');

const tk = (n) => `৳${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

/**
 * Builds the alerts for one user and month from live data. Each alert has a stable key that
 * includes the state it describes, so a dismissed alert only comes back when something changes.
 */
async function buildNotifications(req, calc, { includeDismissed = false } = {}) {
  const prefs = req.user.notificationPrefs || {};
  const month = req.month;
  const admin = req.role === 'admin';
  const self = req.selfMember ? String(req.selfMember._id) : null;
  const t = today();
  const isCurrent = inMonth(t, month.year, month.month);
  const { end } = monthRange(month.year, month.month);
  const out = [];
  const label = monthLabel(month.year, month.month);

  if (month.status === 'open' && prefs.missingMeals !== false && isCurrent) {
    const [members, entries] = await Promise.all([
      Member.find({ month: month._id, deletedAt: null }).lean(),
      MealEntry.find({ month: month._id, date: t }).select('member').lean(),
    ]);
    const has = new Set(entries.map((e) => String(e.member)));
    const missing = members.filter((m) => isPresentOn(m, t) && !has.has(String(m._id)));
    if (admin && missing.length) {
      const names = missing.map((m) => m.nickname || m.fullName);
      out.push({
        key: `meals:${t}:${missing.length}`,
        type: 'meals',
        level: 'info',
        title: missing.length === 1 ? `${names[0]} has not added today's meal.` : `${missing.length} members have not added today's meals.`,
        body: missing.length > 1 ? names.slice(0, 5).join(', ') + (names.length > 5 ? '…' : '') : '',
        link: '/meals',
      });
    } else if (!admin && self && missing.some((m) => String(m._id) === self)) {
      out.push({ key: `meals:${t}:self`, type: 'meals', level: 'info', title: "You haven't added today's meals yet.", link: '/meals' });
    }
  }

  if (prefs.budget !== false) {
    for (const b of calc.budget) {
      if (!b.level) continue;
      out.push({
        key: `budget:${b.label}:${b.level}`,
        type: 'budget',
        level: b.level >= 100 ? 'danger' : 'warning',
        title: b.level >= 100 ? `${b.label} budget exceeded (${b.percent}% used).` : `${b.label} budget is ${b.percent}% used.`,
        body: b.remaining < 0 ? `${tk(b.used)} of ${tk(b.budget)} spent, over by ${tk(-b.remaining)}.` : `${tk(b.used)} of ${tk(b.budget)} spent, ${tk(b.remaining)} left.`,
        link: '/settings?tab=budget',
      });
    }
  }

  if (prefs.recurring !== false && month.status === 'open' && admin) {
    const { expenses } = require('../controllers/records.controller');
    const due = await expenses.recurringDue(month);
    for (const e of due) {
      out.push({ key: `recurring:${e.category}:${e.title}`, type: 'recurring', level: 'warning', title: `${e.title} bill is due.`, body: `Last month: ${tk(e.amount)}`, link: '/expenses?recurring=1' });
    }
  }

  // Dues are only worth flagging near or after month end, when deposits should be in.
  const dayOfMonth = isCurrent ? Number(t.slice(8)) : t > end ? 99 : 0;
  if (prefs.dues !== false && dayOfMonth >= daysInMonth(month.year, month.month) - 4) {
    for (const m of calc.members) {
      if (m.status !== 'due') continue;
      if (!admin && m.id !== self) continue;
      out.push({
        key: `due:${m.id}:${m.due}`,
        type: 'due',
        level: 'warning',
        title: m.id === self ? `You have an outstanding balance of ${tk(m.due)}.` : `${m.nickname || m.fullName} has an outstanding balance of ${tk(m.due)}.`,
        link: `/members?member=${m.id}`,
      });
    }
  }

  if (prefs.closing !== false && admin && month.status === 'open' && t > end) {
    out.push({ key: `close:${month._id}`, type: 'closing', level: 'info', title: `${label} is ready to close.`, body: 'Review balances and close the month to lock it.', link: '/close' });
  }

  if (admin && calc.warnings.length) {
    calc.warnings.slice(0, 3).forEach((w) => out.push({ key: `warn:${w.code}:${w.message}`, type: 'calculation', level: 'warning', title: 'Calculation check', body: w.message, link: '/reports' }));
  }

  if (includeDismissed) return out;
  const dismissed = await Notification.find({ user: req.user._id, month: month._id }).select('key').lean();
  const set = new Set(dismissed.map((d) => d.key));
  return out.filter((n) => !set.has(n.key));
}

module.exports = { buildNotifications };
