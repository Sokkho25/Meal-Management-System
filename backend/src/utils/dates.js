// All business dates are stored as 'YYYY-MM-DD' strings so they never shift with time zones.
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function isValidDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const pad = (n) => String(n).padStart(2, '0');

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthRange(year, month) {
  return { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${pad(daysInMonth(year, month))}` };
}

function monthDates(year, month) {
  const n = daysInMonth(year, month);
  return Array.from({ length: n }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`);
}

function inMonth(date, year, month) {
  return isValidDate(date) && date.startsWith(`${year}-${pad(month)}-`);
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function prevMonth(year, month) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthLabel = (year, month) => `${MONTH_NAMES[month - 1]} ${year}`;

module.exports = { isValidDate, daysInMonth, monthRange, monthDates, inMonth, today, prevMonth, monthLabel, MONTH_NAMES };
