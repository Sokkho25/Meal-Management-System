export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const monthLabel = (year, month) => `${MONTHS[month - 1]} ${year}`;
export const monthShort = (year, month) => `${MONTHS[month - 1].slice(0, 3)} ${year}`;

export function money(value, { decimals, sign = false } = {}) {
  const n = Number(value) || 0;
  const d = decimals ?? (Number.isInteger(n) ? 0 : 2);
  const s = Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
  const prefix = n < 0 ? '−' : sign && n > 0 ? '+' : '';
  return `${prefix}৳${s}`;
}

export const num = (value, d = 2) => {
  const n = Number(value) || 0;
  return n.toLocaleString('en-IN', { maximumFractionDigits: d });
};

const pad = (n) => String(n).padStart(2, '0');
export const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISODate(new Date());

export function fmtDate(iso, opts = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', opts);
}
export const fmtDay = (iso) => fmtDate(iso, { weekday: 'short', day: '2-digit', month: 'short' });

export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return toISODate(new Date(y, m - 1, d + n));
}

export function monthBounds(year, month) {
  const last = new Date(year, month, 0).getDate();
  return { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${pad(last)}`, days: last };
}

/** A sensible default date inside the month: today if it falls inside, otherwise the last/first day. */
export function defaultDate(year, month) {
  const t = todayISO();
  const { start, end } = monthBounds(year, month);
  if (t < start) return start;
  if (t > end) return end;
  return t;
}

export const timeAgo = (date) => {
  const s = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bkash', label: 'bKash' },
  { value: 'nagad', label: 'Nagad' },
  { value: 'bank', label: 'Bank' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];
export const methodLabel = (v) => (PAYMENT_METHODS.find((m) => m.value === v) || { label: v }).label;

export const EXPENSE_TYPES = [
  { value: 'food', label: 'Food' },
  { value: 'household', label: 'Household' },
  { value: 'utility', label: 'Utilities' },
  { value: 'other', label: 'Other' },
];
export const typeLabel = (v) => (EXPENSE_TYPES.find((m) => m.value === v) || { label: v }).label;

export const DISTRIBUTION_METHODS = [
  { value: 'per_meal', label: 'Per meal', hint: 'Shared by meal count (goes into the meal rate)' },
  { value: 'equal', label: 'Equal split', hint: 'Divided equally among active members' },
  { value: 'percentage', label: 'Percentage', hint: 'Each member bears a set percentage' },
  { value: 'custom', label: 'Custom amounts', hint: 'Set exactly how much each member bears' },
];

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('');

export const memberName = (m) => (m ? m.nickname || m.fullName : '');
