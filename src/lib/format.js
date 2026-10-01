const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usdWhole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const money = (n) => usd.format(n || 0);

// whole dollars once amounts get large enough that cents are noise
export const moneyShort = (n) => (Math.abs(n) >= 1000 ? usdWhole.format(n) : usd.format(n || 0));

export const percent = (n) => {
  if (!isFinite(n)) return '—';
  const v = n * 100;
  return `${Math.abs(v) < 10 && v !== 0 ? v.toFixed(1) : Math.round(v)}%`;
};

export function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}`;
}

export const monthKey = (iso) => (iso ? iso.slice(0, 7) : null);

export function monthLabel(key, long = false) {
  if (!key) return 'Undated';
  const [y, m] = key.split('-');
  return long ? `${MONTHS_LONG[Number(m) - 1]} ${y}` : `${MONTHS[Number(m) - 1]} ${y.slice(2)}`;
}

export const plural = (n, word) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;
