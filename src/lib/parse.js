import Papa from 'papaparse';
import { merchantName } from './merchant.js';

// Converts bank / credit card exports (CSV or Excel) into one normalized shape:
// { id, fileId, date: 'YYYY-MM-DD' | null, description, merchant, category, amount, excluded, excludedReason }
// amount > 0 is money spent, amount < 0 is a refund or credit.

const clean = (v) =>
  (v == null ? '' : String(v))
    .replace(/^﻿/, '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^"(.*)"$/, '$1');

const norm = (v) => clean(v).toLowerCase();

// listed in order of preference, e.g. the transaction date wins over the posting date
const HEADERS = {
  date: ['transaction date', 'trans. date', 'trans date', 'txn date', 'date', 'transaction posted date', 'posted date', 'post date', 'posting date', 'date posted'],
  description: ['description', 'transaction description', 'payee', 'merchant', 'merchant name', 'name', 'details', 'original description'],
  category: ['category', 'transaction category', 'merchant category'],
  amount: ['amount', 'amount (usd)', 'transaction amount', 'amount usd'],
  debit: ['debit', 'debit amount', 'withdrawal', 'withdrawals', 'withdrawal amount', 'charge', 'charges'],
  credit: ['credit', 'credit amount', 'deposit', 'deposits', 'deposit amount'],
  type: ['type', 'transaction type'],
};

function findColumns(row) {
  const cells = row.map(norm);
  const cols = {};
  for (const key in HEADERS) {
    cols[key] = -1;
    for (const name of HEADERS[key]) {
      const i = cells.indexOf(name);
      if (i !== -1) {
        cols[key] = i;
        break;
      }
    }
  }
  return cols;
}

const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => (y > 1990 && y < 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : null);

export function parseDate(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    // Excel serial date
    if (value < 20000 || value > 80000) return null;
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
    return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  const s = clean(value);
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return iso(y, +m[1], +m[2]);
  }
  if (/^\d+(\.\d+)?$/.test(s)) return parseDate(Number(s));
  const t = Date.parse(s);
  if (!isNaN(t)) {
    const dt = new Date(t);
    return iso(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
  }
  return null;
}

export function parseAmount(value) {
  if (typeof value === 'number') return isFinite(value) ? value : null;
  let s = clean(value).replace(/−/g, '-');
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s) || /^-/.test(s) || /-$/.test(s) || /^\$-/.test(s);
  s = s.replace(/[$,()\s+-]/g, '');
  if (!s || isNaN(Number(s))) return null;
  const n = Number(s);
  return negative ? -n : n;
}

function detectHeader(rows) {
  const limit = Math.min(rows.length, 60);
  for (let i = 0; i < limit; i++) {
    if (!Array.isArray(rows[i])) continue;
    const cols = findColumns(rows[i]);
    if (cols.description >= 0 && (cols.amount >= 0 || cols.debit >= 0) && cols.date >= 0) return { index: i, cols };
  }
  for (let i = 0; i < limit; i++) {
    if (!Array.isArray(rows[i])) continue;
    const cols = findColumns(rows[i]);
    if (cols.description >= 0 && (cols.amount >= 0 || cols.debit >= 0)) return { index: i, cols };
  }
  // headerless exports such as Wells Fargo: "date","amount","*","","description"
  const first = rows.find((r) => Array.isArray(r) && r.some((c) => clean(c)));
  if (first && first.length >= 3 && parseDate(first[0]) && parseAmount(first[1]) !== null) {
    return { index: -1, cols: { date: 0, amount: 1, description: first.length - 1, category: -1, debit: -1, credit: -1, type: -1 } };
  }
  return null;
}

function cleanCategory(value) {
  const c = clean(value);
  if (!c) return '';
  // Amex uses "Restaurant-Bar & Café" style names, keep the top level
  return c.includes('-') && !/^payment/i.test(c) ? c.split('-')[0].trim() : c;
}

// card payments and account transfers aren't spending; counting them would double count
const CREDIT_TRANSFER = /payment|pymt|autopay|auto pay|thank you|transfer|xfer|deposit|payroll|direct dep|cashout|cash out|interest paid/i;
const DEBIT_TRANSFER = /autopay|auto pay|transfer to|online transfer|xfer to|credit crd|crd epay|card pmt|card payment|payment to/i;

const PAYMENT_WORDS = /payment|pymt|autopay|thank you|transfer|payroll|direct dep/i;

function isTransfer(tx) {
  if (/payment/i.test(tx.type) || /^payments?(\b|\/)/i.test(tx.category)) return true;
  return tx.amount < 0 ? CREDIT_TRANSFER.test(tx.description) : DEBIT_TRANSFER.test(tx.description);
}

export function rowsToTransactions(rows, fileId) {
  const header = detectHeader(rows);
  if (!header) {
    throw new Error("couldn't find Date, Description and Amount columns");
  }
  const { index, cols } = header;
  const raw = [];

  for (let i = index + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!Array.isArray(r) || r.every((c) => clean(c) === '')) continue;
    // a repeated header row from concatenated exports
    if (index >= 0 && norm(r[cols.description]) === norm(rows[index][cols.description])) continue;

    let amount = null;
    if (cols.amount >= 0) {
      amount = parseAmount(r[cols.amount]);
    } else {
      const debit = parseAmount(r[cols.debit]);
      const credit = cols.credit >= 0 ? parseAmount(r[cols.credit]) : null;
      if (debit) amount = Math.abs(debit);
      else if (credit) amount = -Math.abs(credit);
    }
    if (!amount) continue;

    const description = clean(r[cols.description]);
    if (!description) continue;

    raw.push({
      row: i,
      date: cols.date >= 0 ? parseDate(r[cols.date]) : null,
      description,
      category: cols.category >= 0 ? cleanCategory(r[cols.category]) : '',
      type: cols.type >= 0 ? norm(r[cols.type]) : '',
      amount,
    });
  }

  if (!raw.length) throw new Error('no transactions found');

  // Some banks report purchases as negative numbers (Chase, BofA), others as positive (Amex, Discover).
  // Spending should be positive, so flip when purchases are mostly negative.
  let flip = false;
  if (cols.amount >= 0) {
    const sales = raw.filter((t) => /^(sale|purchase|debit)$/.test(t.type));
    const purchases = raw.filter((t) => !PAYMENT_WORDS.test(t.description));
    const sample = sales.length ? sales : purchases.length ? purchases : raw;
    flip = sample.filter((t) => t.amount < 0).length > sample.length / 2;
  }

  return raw.map((t) => {
    const tx = { ...t, amount: Math.round((flip ? -t.amount : t.amount) * 100) / 100 };
    const transfer = isTransfer(tx);
    return {
      id: `${fileId}:${t.row}`,
      fileId,
      date: tx.date,
      description: tx.description,
      merchant: merchantName(tx.description),
      category: transfer ? 'Payments & Transfers' : tx.category || 'Uncategorized',
      amount: tx.amount,
      excluded: transfer,
      excludedReason: transfer ? 'transfer' : null,
    };
  });
}

async function readRows(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'xlsx' || ext === 'xls') {
    const mod = await import(/* webpackChunkName: "xlsx" */ 'xlsx');
    const XLSX = mod.read ? mod : mod.default;
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    let fallback = [];
    for (const name of workbook.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: '' });
      if (detectHeader(rows)) return rows;
      if (!fallback.length) fallback = rows;
    }
    return fallback;
  }
  if (ext === 'csv' || ext === 'txt') {
    const text = await file.text();
    return Papa.parse(text, { skipEmptyLines: 'greedy' }).data;
  }
  throw new Error('only CSV and Excel (.xlsx) files are supported');
}

export async function readTransactionFile(file, fileId) {
  try {
    return rowsToTransactions(await readRows(file), fileId);
  } catch (err) {
    throw new Error(`${file.name}: ${err.message}`);
  }
}
