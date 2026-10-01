import { rowsToTransactions } from './parse.js';

// Three months of realistic card activity so visitors can try the app without a statement.

const MERCHANTS = [
  // description, category, min, max, visits per month (fractional = sometimes)
  ['WHOLEFDS MKT #10234 AUSTIN TX', 'Groceries', 42, 165, 5],
  ["TRADER JOE'S #552 AUSTIN TX", 'Groceries', 28, 92, 3],
  ['STARBUCKS STORE 08812', 'Food & Drink', 5.25, 11.5, 9],
  ['CHIPOTLE 1932', 'Food & Drink', 11.2, 18.9, 3],
  ['SQ *VERACRUZ ALL NATURAL', 'Food & Drink', 9, 24, 3],
  ['UBER *EATS PENDING', 'Food & Drink', 24, 52, 2],
  ['TST* ODD DUCK AUSTIN', 'Food & Drink', 64, 140, 1],
  ['SHELL OIL 57444212000', 'Gas', 34, 62, 3],
  ['UBER *TRIP HELP.UBER.COM', 'Travel', 11, 38, 3],
  ['AMAZON MKTPL*2K4L19PQ0', 'Shopping', 12, 145, 4],
  ['TARGET 00012345', 'Shopping', 18, 118, 2],
  ['AMC 0512 ONLINE', 'Entertainment', 18, 46, 0.7],
  ['AUSTIN ENERGY UTIL', 'Bills & Utilities', 88, 146, 1],
  ['CVS/PHARMACY #04512', 'Health & Wellness', 8, 46, 1],
];

const SUBSCRIPTIONS = [
  ['NETFLIX.COM', 'Entertainment', 15.49, 3],
  ['SPOTIFY USA', 'Entertainment', 11.99, 8],
  ['VERIZON WIRELESS', 'Bills & Utilities', 74.99, 12],
  ['PLANET FITNESS', 'Health & Wellness', 24.99, 17],
  ['GOOGLE *Google One', 'Bills & Utilities', 2.99, 21],
];

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fmt = (y, m, d) => `${String(m + 1).padStart(2, '0')}/${String(d).padStart(2, '0')}/${y}`;

export function sampleTransactions(fileId, today = new Date()) {
  const random = mulberry32(20240917);
  // Chase-style export: purchases negative, payments positive
  const rows = [['Transaction Date', 'Post Date', 'Description', 'Category', 'Type', 'Amount', 'Memo']];
  const add = (date, description, category, type, amount) =>
    rows.push([date, date, description, category, type, amount.toFixed(2), '']);

  for (let back = 3; back >= 1; back--) {
    const first = new Date(today.getFullYear(), today.getMonth() - back, 1);
    const y = first.getFullYear();
    const m = first.getMonth();
    const days = new Date(y, m + 1, 0).getDate();
    let monthTotal = 0;

    for (const [description, category, min, max, perMonth] of MERCHANTS) {
      let visits = Math.floor(perMonth) + (random() < perMonth % 1 ? 1 : 0);
      while (visits-- > 0) {
        const amount = min + random() * (max - min);
        monthTotal += amount;
        add(fmt(y, m, 1 + Math.floor(random() * days)), description, category, 'Sale', -amount);
      }
    }
    for (const [description, category, amount, day] of SUBSCRIPTIONS) {
      monthTotal += amount;
      add(fmt(y, m, Math.min(day, days)), description, category, 'Sale', -amount);
    }
    if (back === 2) {
      add(fmt(y, m, 14), 'DELTA AIR LINES 0062', 'Travel', 'Sale', -386.4);
      add(fmt(y, m, 19), 'AMAZON MKTPL*RETURN', 'Shopping', 'Return', 34.99);
      monthTotal += 386.4;
    }
    add(fmt(y, m, Math.min(27, days)), 'AUTOMATIC PAYMENT - THANK YOU', '', 'Payment', Math.round(monthTotal));
  }

  rows.splice(1, rows.length - 1, ...rows.slice(1).sort((a, b) => (a[0] < b[0] ? 1 : -1)));
  return rowsToTransactions(rows, fileId);
}
