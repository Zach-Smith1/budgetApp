import React, { useMemo, useState, useEffect } from 'react';
import { money, formatDate, plural } from '../lib/format.js';
import { Eye, EyeOff, Chevron } from './Icons.js';

const PAGE = 25;
const NEW_CATEGORY = '__new__';

function useSort(initialKey, initialDir = 'desc') {
  const [sort, setSort] = useState({ key: initialKey, dir: initialDir });
  const toggle = (key, defaultDir = 'asc') =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: defaultDir }));
  return [sort, toggle];
}

function SortHeader({ label, k, sort, onSort, defaultDir, className = '' }) {
  const active = sort.key === k;
  return (
    <th className={className} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button className={`th-btn ${active ? 'active' : ''}`} onClick={() => onSort(k, defaultDir)}>
        {label}
        <span className={`sort-arrow ${active ? sort.dir : ''}`}>
          <Chevron size={13} />
        </span>
      </button>
    </th>
  );
}

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function TransactionsTable({ rows, categories, colorFor, onRecategorize, onToggleExclude, onNewCategory, emptyText }) {
  const [sort, onSort] = useSort('date', 'desc');
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => setLimit(PAGE), [rows.length, sort]);

  const sorted = useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const primary = compare(a[sort.key] ?? '', b[sort.key] ?? '');
      return dir * (primary || compare(a.id, b.id));
    });
  }, [rows, sort]);

  if (!rows.length) return <div className="empty-table">{emptyText}</div>;

  return (
    <>
      <div className="table-scroll">
        <table className="data-table tx-table">
          <thead>
            <tr>
              <SortHeader label="Date" k="date" sort={sort} onSort={onSort} defaultDir="desc" className="col-date" />
              <SortHeader label="Merchant" k="merchant" sort={sort} onSort={onSort} />
              <SortHeader label="Category" k="category" sort={sort} onSort={onSort} className="col-cat" />
              <SortHeader label="Amount" k="amount" sort={sort} onSort={onSort} defaultDir="desc" className="num" />
              <th className="col-action">
                <span className="sr-only">Include in totals</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, limit).map((t) => (
              <tr key={t.id} className={t.excluded ? 'excluded' : ''}>
                <td className="col-date muted">{formatDate(t.date)}</td>
                <td className="merchant-cell">
                  <div className="merchant">{t.merchant}</div>
                  <div className="raw" title={t.description}>
                    {t.description}
                  </div>
                </td>
                <td className="col-cat">
                  <label className="cat-select">
                    <span className="dot" style={{ background: colorFor(t.category) }} />
                    <select
                      value={t.category}
                      aria-label={`Category for ${t.merchant}`}
                      onChange={(e) => (e.target.value === NEW_CATEGORY ? onNewCategory(t) : onRecategorize(t, e.target.value))}
                    >
                      {categories.includes(t.category) ? null : <option value={t.category}>{t.category}</option>}
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value={NEW_CATEGORY}>+ New category…</option>
                    </select>
                    <Chevron size={14} />
                  </label>
                </td>
                <td className={`num amount ${t.amount < 0 ? 'credit' : ''}`}>{t.amount < 0 ? `+${money(-t.amount)}` : money(t.amount)}</td>
                <td className="col-action">
                  <button
                    className="icon-btn"
                    title={t.excluded ? 'Include in totals' : 'Exclude from totals'}
                    aria-label={t.excluded ? `Include ${t.merchant} in totals` : `Exclude ${t.merchant} from totals`}
                    onClick={() => onToggleExclude(t)}
                  >
                    {t.excluded ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span className="muted">
          Showing {Math.min(limit, rows.length).toLocaleString()} of {plural(rows.length, 'transaction')}
        </span>
        {limit < rows.length ? (
          <button className="btn btn-ghost" onClick={() => setLimit(limit + PAGE * 4)}>
            Show more
          </button>
        ) : null}
      </div>
    </>
  );
}

export function MerchantsTable({ rows, colorFor, onPick }) {
  const [sort, onSort] = useSort('total', 'desc');

  const merchants = useMemo(() => {
    const map = new Map();
    for (const t of rows) {
      if (t.excluded) continue;
      const m = map.get(t.merchant) || { merchant: t.merchant, total: 0, count: 0, cats: {}, last: null };
      m.total += t.amount;
      if (t.amount > 0) m.count += 1;
      m.cats[t.category] = (m.cats[t.category] || 0) + 1;
      if (t.date && (!m.last || t.date > m.last)) m.last = t.date;
      map.set(t.merchant, m);
    }
    const list = [...map.values()].map((m) => ({
      ...m,
      category: Object.entries(m.cats).sort((a, b) => b[1] - a[1])[0][0],
      average: m.count ? m.total / m.count : 0,
    }));
    const dir = sort.dir === 'asc' ? 1 : -1;
    return list.sort((a, b) => dir * (compare(a[sort.key], b[sort.key]) || compare(b.total, a.total)));
  }, [rows, sort]);

  if (!merchants.length) return <div className="empty-table">No merchants match these filters.</div>;
  const max = Math.max(...merchants.map((m) => m.total), 1);

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <SortHeader label="Merchant" k="merchant" sort={sort} onSort={onSort} />
            <SortHeader label="Category" k="category" sort={sort} onSort={onSort} className="col-cat" />
            <SortHeader label="Visits" k="count" sort={sort} onSort={onSort} defaultDir="desc" className="num col-visits" />
            <SortHeader label="Average" k="average" sort={sort} onSort={onSort} defaultDir="desc" className="num col-avg" />
            <SortHeader label="Total" k="total" sort={sort} onSort={onSort} defaultDir="desc" className="num" />
          </tr>
        </thead>
        <tbody>
          {merchants.map((m) => (
            <tr key={m.merchant} className="clickable" onClick={() => onPick(m.merchant)} title={`Show ${m.merchant} transactions`}>
              <td>
                <div className="merchant">{m.merchant}</div>
                <div className="spark">
                  <span style={{ width: `${Math.max(2, (m.total / max) * 100)}%`, background: colorFor(m.category) }} />
                </div>
              </td>
              <td className="col-cat">
                <span className="cat-tag">
                  <span className="dot" style={{ background: colorFor(m.category) }} />
                  {m.category}
                </span>
              </td>
              <td className="num col-visits muted">{m.count}</td>
              <td className="num col-avg muted">{money(m.average)}</td>
              <td className="num amount">{money(m.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
