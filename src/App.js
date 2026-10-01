import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readTransactionFile } from './lib/parse.js';
import { sampleTransactions } from './lib/sample.js';
import { loadSaved, save, downloadCSV } from './lib/storage.js';
import { money, moneyShort, percent, formatDate, monthKey, monthLabel, plural, MONTHS } from './lib/format.js';
import { CategoryDonut, TrendChart } from './components/Charts.js';
import { TransactionsTable, MerchantsTable } from './components/Tables.js';
import Budget from './components/Budget.js';
import { NewCategoryModal, Toast } from './components/Overlays.js';
import * as Icon from './components/Icons.js';

const PALETTE = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#f97316', '#14b8a6', '#ef4444', '#84cc16', '#3b82f6', '#d946ef'];
const OTHER_COLOR = '#94a3b8';
const BANKS = ['Chase', 'American Express', 'Capital One', 'Discover', 'Citi', 'Bank of America', 'Wells Fargo'];

const uid = () => Math.random().toString(36).slice(2, 10);
const sum = (list) => list.reduce((acc, t) => acc + t.amount, 0);

function useDarkMode(theme) {
  const query = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const [systemDark, setSystemDark] = useState(() => (query ? query.matches : false));
  useEffect(() => {
    if (!query || !query.addEventListener) return undefined;
    const onChange = (e) => setSystemDark(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  const dark = theme ? theme === 'dark' : systemDark;
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [dark]);
  return dark;
}

function Stat({ label, value, sub, accent }) {
  return (
    <div className={`card stat ${accent ? 'accent' : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub ? <span className="stat-sub">{sub}</span> : null}
    </div>
  );
}

export default function App() {
  const saved = useMemo(loadSaved, []);
  const [files, setFiles] = useState((saved && saved.files) || []);
  const [transactions, setTransactions] = useState((saved && saved.transactions) || []);
  const [budget, setBudget] = useState((saved && saved.budget) || { income: '', housing: '' });
  const [theme, setTheme] = useState((saved && saved.theme) || null);

  const [month, setMonth] = useState('all');
  const [category, setCategory] = useState(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('transactions');
  const [showExcluded, setShowExcluded] = useState(false);
  const [toast, setToast] = useState(null);
  const [newCategoryFor, setNewCategoryFor] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const dark = useDarkMode(theme);

  useEffect(() => {
    save({ files, transactions, budget, theme });
  }, [files, transactions, budget, theme]);

  const dismissToast = useCallback(() => setToast(null), []);

  // ---------- loading data ----------

  const addFiles = useCallback(
    async (list) => {
      const incoming = Array.from(list || []);
      if (!incoming.length) return;
      setBusy(true);
      const loaded = [];
      const problems = [];
      for (const file of incoming) {
        if (files.some((f) => f.name === file.name && f.size === file.size)) {
          problems.push(`${file.name} is already loaded`);
          continue;
        }
        try {
          const id = uid();
          const txs = await readTransactionFile(file, id);
          loaded.push({ file: { id, name: file.name, size: file.size, count: txs.length }, txs });
        } catch (err) {
          problems.push(err.message);
        }
      }
      setBusy(false);
      if (loaded.length) {
        setFiles((prev) => [...prev, ...loaded.map((l) => l.file)]);
        setTransactions((prev) => [...prev, ...loaded.flatMap((l) => l.txs)]);
        setMonth('all');
        setCategory(null);
      }
      const added = loaded.reduce((n, l) => n + l.txs.length, 0);
      const skipped = loaded.reduce((n, l) => n + l.txs.filter((t) => t.excluded).length, 0);
      if (problems.length) {
        setToast({ tone: 'error', message: problems.join(' · ') });
      } else if (added) {
        setToast({
          message: `Imported ${plural(added, 'transaction')}${skipped ? `. ${skipped} card ${skipped === 1 ? 'payment/transfer was' : 'payments/transfers were'} left out of totals` : ''}.`,
        });
      }
    },
    [files]
  );

  const loadSample = () => {
    const id = 'sample';
    const txs = sampleTransactions(id);
    setFiles((prev) => [...prev.filter((f) => f.id !== id), { id, name: 'Sample data', size: 0, count: txs.length, sample: true }]);
    setTransactions((prev) => [...prev.filter((t) => t.fileId !== id), ...txs]);
    setMonth('all');
    setCategory(null);
  };

  const removeFile = (id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setTransactions((prev) => prev.filter((t) => t.fileId !== id));
    setCategory(null);
  };

  const clearAll = () => {
    if (!window.confirm('Remove all imported transactions from this browser?')) return;
    setFiles([]);
    setTransactions([]);
    setMonth('all');
    setCategory(null);
    setSearch('');
  };

  // drop files anywhere on the page
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    const enter = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth += 1;
      setDragging(true);
    };
    const leave = (e) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const over = (e) => hasFiles(e) && e.preventDefault();
    const drop = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      addFiles(e.dataTransfer.files);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, [addFiles]);

  // ---------- editing ----------

  const recategorize = (tx, name) => {
    setTransactions((prev) => prev.map((t) => (t.id === tx.id ? { ...t, category: name } : t)));
    const similar = transactions.filter((t) => t.merchant === tx.merchant && t.id !== tx.id && t.category !== name && !t.excluded);
    if (similar.length) {
      const ids = new Set(similar.map((t) => t.id));
      setToast({
        message: `Moved to ${name}.`,
        action: {
          label: `Apply to ${plural(similar.length, 'other')} from ${tx.merchant}`,
          run: () => setTransactions((prev) => prev.map((t) => (ids.has(t.id) ? { ...t, category: name } : t))),
        },
      });
    } else {
      setToast({ message: `Moved ${tx.merchant} to ${name}.` });
    }
  };

  const toggleExclude = (tx) => {
    const flip = (prev) => prev.map((t) => (t.id === tx.id ? { ...t, excluded: !t.excluded } : t));
    setTransactions(flip);
    setToast({
      message: tx.excluded ? `${tx.merchant} counted in totals again.` : `${tx.merchant} left out of totals.`,
      action: { label: 'Undo', run: () => setTransactions(flip) },
    });
  };

  // ---------- derived data ----------

  const active = useMemo(() => transactions.filter((t) => !t.excluded), [transactions]);

  const months = useMemo(() => [...new Set(active.map((t) => monthKey(t.date)).filter(Boolean))].sort(), [active]);

  useEffect(() => {
    if (month !== 'all' && !months.includes(month)) setMonth('all');
  }, [months, month]);

  const inMonth = useCallback((t) => month === 'all' || monthKey(t.date) === month, [month]);

  const monthScoped = useMemo(() => active.filter(inMonth), [active, inMonth]);

  const colorMap = useMemo(() => {
    const totals = {};
    for (const t of active) totals[t.category] = (totals[t.category] || 0) + t.amount;
    const ranked = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
    const map = {};
    ranked.forEach((name, i) => {
      map[name] = PALETTE[i] || OTHER_COLOR;
    });
    return map;
  }, [active]);
  const colorFor = useCallback((name) => colorMap[name] || OTHER_COLOR, [colorMap]);

  const categoryTotals = useMemo(() => {
    const totals = {};
    const counts = {};
    for (const t of monthScoped) {
      totals[t.category] = (totals[t.category] || 0) + t.amount;
      counts[t.category] = (counts[t.category] || 0) + 1;
    }
    return Object.keys(totals)
      .map((name) => ({ name, total: totals[name], count: counts[name], color: colorFor(name) }))
      .sort((a, b) => b.total - a.total);
  }, [monthScoped, colorFor]);

  const monthTotal = useMemo(() => sum(monthScoped), [monthScoped]);
  const scoped = useMemo(() => (category ? monthScoped.filter((t) => t.category === category) : monthScoped), [monthScoped, category]);

  const allCategories = useMemo(() => [...new Set(transactions.map((t) => t.category))].sort((a, b) => a.localeCompare(b)), [transactions]);

  useEffect(() => {
    if (category && !allCategories.includes(category)) setCategory(null);
  }, [allCategories, category]);

  const tableRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter(
      (t) =>
        (showExcluded || !t.excluded) &&
        inMonth(t) &&
        (!category || t.category === category) &&
        (!q || t.merchant.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
    );
  }, [transactions, showExcluded, inMonth, category, search]);

  const excludedCount = useMemo(() => transactions.filter((t) => t.excluded && inMonth(t) && (!category || t.category === category)).length, [transactions, inMonth, category]);

  const monthCount = month === 'all' ? Math.max(months.length, 1) : 1;

  const stats = useMemo(() => {
    const total = sum(scoped);
    const purchases = scoped.filter((t) => t.amount > 0);
    const refunds = -sum(scoped.filter((t) => t.amount < 0));
    const biggest = purchases.reduce((best, t) => (!best || t.amount > best.amount ? t : best), null);
    const byMerchant = {};
    for (const t of scoped) byMerchant[t.merchant] = (byMerchant[t.merchant] || 0) + t.amount;
    const topMerchant = Object.entries(byMerchant).sort((a, b) => b[1] - a[1])[0];
    const dates = scoped.map((t) => t.date).filter(Boolean).sort();
    let days = 1;
    if (dates.length) days = Math.round((Date.parse(dates[dates.length - 1]) - Date.parse(dates[0])) / 86400000) + 1;
    return { total, purchases: purchases.length, refunds, biggest, topMerchant, days, first: dates[0], last: dates[dates.length - 1] };
  }, [scoped]);

  const trend = useMemo(() => {
    const source = category ? active.filter((t) => t.category === category) : active;
    if (month === 'all' && months.length > 1) {
      const totals = {};
      for (const t of source) {
        const key = monthKey(t.date);
        if (key) totals[key] = (totals[key] || 0) + t.amount;
      }
      const points = [];
      let [y, m] = months[0].split('-').map(Number);
      const [endY, endM] = months[months.length - 1].split('-').map(Number);
      while (y < endY || (y === endY && m <= endM)) {
        const key = `${y}-${String(m).padStart(2, '0')}`;
        points.push({ label: monthLabel(key), tooltip: monthLabel(key, true), value: Math.max(0, totals[key] || 0) });
        m += 1;
        if (m > 12) {
          m = 1;
          y += 1;
        }
      }
      return { title: 'Spending by month', points };
    }
    const key = month !== 'all' ? month : months[0];
    if (!key) return { title: 'Spending over time', points: [] };
    const [y, m] = key.split('-').map(Number);
    const days = new Date(y, m, 0).getDate();
    const totals = Array(days).fill(0);
    for (const t of source) if (monthKey(t.date) === key) totals[Number(t.date.slice(8, 10)) - 1] += t.amount;
    return {
      title: `Daily spending · ${monthLabel(key, true)}`,
      points: totals.map((v, i) => ({ label: String(i + 1), tooltip: `${MONTHS[m - 1]} ${i + 1}`, value: Math.max(0, v) })),
    };
  }, [active, category, month, months]);

  // ---------- export ----------

  const exportTransactions = () => {
    downloadCSV(
      tableRows.map((t) => ({
        Date: t.date || '',
        Merchant: t.merchant,
        Description: t.description,
        Category: t.category,
        Amount: t.amount.toFixed(2),
        Counted: t.excluded ? 'No' : 'Yes',
      })),
      `wealth-watch-transactions${month !== 'all' ? '-' + month : ''}${category ? '-' + category.replace(/\W+/g, '-').toLowerCase() : ''}.csv`
    );
  };

  const exportSummary = () => {
    downloadCSV(
      categoryTotals.map((c) => ({
        Category: c.name,
        Transactions: c.count,
        Spent: c.total.toFixed(2),
        Share: monthTotal ? ((c.total / monthTotal) * 100).toFixed(1) + '%' : '',
      })),
      `wealth-watch-summary${month !== 'all' ? '-' + month : ''}.csv`
    );
  };

  // ---------- render ----------

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept=".csv,.xlsx,.xls,text/csv"
      multiple
      hidden
      onChange={(e) => {
        addFiles(e.target.files);
        e.target.value = '';
      }}
    />
  );

  const themeButton = (
    <button className="icon-btn" onClick={() => setTheme(dark ? 'light' : 'dark')} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'}>
      {dark ? <Icon.Sun /> : <Icon.Moon />}
    </button>
  );

  const header = (
    <header className="topbar">
      <div className="brand">
        <Icon.Logo />
        <div>
          <span className="brand-name">Wealth Watch</span>
          <span className="brand-tag">Spending tracker</span>
        </div>
      </div>
      <div className="topbar-actions">
        {transactions.length ? (
          <button className="btn btn-primary" onClick={() => inputRef.current.click()} disabled={busy}>
            <Icon.Upload size={16} />
            <span className="hide-sm">{busy ? 'Reading…' : 'Add statements'}</span>
          </button>
        ) : null}
        {themeButton}
      </div>
    </header>
  );

  const dropOverlay = dragging ? (
    <div className="drop-overlay">
      <div>
        <Icon.Upload size={40} />
        <p>Drop to add statements</p>
      </div>
    </div>
  ) : null;

  if (!transactions.length) {
    return (
      <div className="app">
        {header}
        {fileInput}
        <main className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <Icon.Lock size={14} /> Private by design
            </span>
            <h1>See exactly where your money goes.</h1>
            <p className="lead">
              Drop in your credit card or bank statements and get an instant breakdown by category, merchant and month. Files are read in your browser and never uploaded.
            </p>
          </div>
          <button className={`dropzone ${dragging ? 'active' : ''}`} onClick={() => inputRef.current.click()} disabled={busy}>
            <span className="dropzone-icon">
              <Icon.Upload size={28} />
            </span>
            <strong>{busy ? 'Reading your files…' : 'Drop statements here or click to browse'}</strong>
            <span className="muted">CSV or Excel (.xlsx) · multiple files and cards welcome</span>
          </button>
          <div className="hero-alt">
            <span className="muted">No statement handy?</span>
            <button className="btn btn-ghost" onClick={loadSample}>
              <Icon.Sparkle size={16} /> Try it with sample data
            </button>
          </div>
          <div className="banks">
            <span className="muted small">Works with exports from</span>
            <ul>
              {BANKS.map((b) => (
                <li key={b}>{b}</li>
              ))}
              <li>and most other CSVs</li>
            </ul>
          </div>
          <ol className="how">
            <li>
              <b>1</b>
              <span>
                Download your transactions as <strong>CSV</strong> or <strong>Excel</strong> from your bank's website.
              </span>
            </li>
            <li>
              <b>2</b>
              <span>Drop one or more files above. Card payments and transfers are detected and left out automatically.</span>
            </li>
            <li>
              <b>3</b>
              <span>Explore by category, merchant and month, fix categories, and export a clean CSV.</span>
            </li>
          </ol>
        </main>
        {dropOverlay}
        <Toast toast={toast} onDismiss={dismissToast} />
      </div>
    );
  }

  const periodLabel = month === 'all' ? (stats.first ? `${formatDate(stats.first)} – ${formatDate(stats.last)}` : 'All time') : monthLabel(month, true);
  const top = categoryTotals[0];
  const monthlyAverage = stats.total / monthCount;
  const dailyAverage = stats.total / Math.max(stats.days, 1);

  return (
    <div className="app">
      {header}
      {fileInput}
      <main className="dashboard">
        <div className="toolbar">
          <div className="files">
            {files.map((f) => (
              <span className="file-chip" key={f.id} title={`${f.name} · ${plural(f.count, 'row')}`}>
                {f.sample ? <Icon.Sparkle size={14} /> : <Icon.FileIcon size={14} />}
                <span className="file-name">{f.name}</span>
                <button className="chip-x" onClick={() => removeFile(f.id)} aria-label={`Remove ${f.name}`}>
                  <Icon.Close size={13} />
                </button>
              </span>
            ))}
            <button className="link-btn" onClick={clearAll}>
              Clear all
            </button>
          </div>
          <div className="filters">
            {category ? (
              <span className="filter-chip" style={{ '--chip': colorFor(category) }}>
                <span className="dot" />
                {category}
                <button className="chip-x" onClick={() => setCategory(null)} aria-label="Clear category filter">
                  <Icon.Close size={13} />
                </button>
              </span>
            ) : null}
            <label className="select">
              <span className="sr-only">Period</span>
              <select value={month} onChange={(e) => setMonth(e.target.value)}>
                <option value="all">All months</option>
                {[...months].reverse().map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m, true)}
                  </option>
                ))}
              </select>
              <Icon.Chevron size={14} />
            </label>
          </div>
        </div>

        <div className="period">
          <h1>{category || 'Overview'}</h1>
          <span className="muted">{periodLabel}</span>
        </div>

        <section className="stats">
          <Stat accent label={category ? `Spent on ${category}` : 'Total spent'} value={money(stats.total)} sub={`${plural(stats.purchases, 'purchase')}${stats.refunds > 0 ? ` · ${money(stats.refunds)} refunded` : ''}`} />
          {monthCount > 1 ? (
            <Stat label="Monthly average" value={money(monthlyAverage)} sub={`across ${monthCount} months`} />
          ) : (
            <Stat label="Daily average" value={money(dailyAverage)} sub={`over ${plural(stats.days, 'day')}`} />
          )}
          {category ? (
            <Stat
              label="Share of spending"
              value={monthTotal > 0 ? percent(stats.total / monthTotal) : '—'}
              sub={`of ${money(monthTotal)} total`}
            />
          ) : (
            <Stat label="Top category" value={top ? top.name : '—'} sub={top && monthTotal > 0 ? `${money(top.total)} · ${percent(top.total / monthTotal)}` : ''} />
          )}
          <Stat
            label={category ? 'Top merchant' : 'Largest purchase'}
            value={category ? (stats.topMerchant ? stats.topMerchant[0] : '—') : stats.biggest ? money(stats.biggest.amount) : '—'}
            sub={
              category
                ? stats.topMerchant
                  ? money(stats.topMerchant[1])
                  : ''
                : stats.biggest
                ? `${stats.biggest.merchant} · ${formatDate(stats.biggest.date)}`
                : ''
            }
          />
        </section>

        <div className="grid">
          <section className="card categories">
            <div className="card-head">
              <div>
                <h2>Spending by category</h2>
                <p className="muted small">Select a category to drill in</p>
              </div>
              <button className="icon-btn" onClick={exportSummary} title="Download category summary" aria-label="Download category summary">
                <Icon.Download size={17} />
              </button>
            </div>
            <div className="categories-body">
              <CategoryDonut categories={categoryTotals} total={monthTotal} selected={category} onSelect={(name) => setCategory((c) => (c === name ? null : name))} dark={dark} />
              <ul className="cat-list">
                {categoryTotals.map((c) => (
                  <li key={c.name}>
                    <button className={`cat-row ${category === c.name ? 'selected' : ''} ${category && category !== c.name ? 'dim' : ''}`} onClick={() => setCategory(category === c.name ? null : c.name)}>
                      <span className="dot" style={{ background: c.color }} />
                      <span className="cat-name">{c.name}</span>
                      <span className="cat-amount">{money(c.total)}</span>
                      <span className="cat-share">{monthTotal > 0 ? percent(Math.max(c.total, 0) / monthTotal) : ''}</span>
                      <span className="cat-bar">
                        <span style={{ width: `${monthTotal > 0 ? Math.max(0, (c.total / categoryTotals[0].total) * 100) : 0}%`, background: c.color }} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <Budget
            income={budget.income}
            housing={budget.housing}
            onChange={(field, value) => setBudget((b) => ({ ...b, [field]: value }))}
            monthlySpend={monthTotal / monthCount}
            basis={month === 'all' ? (monthCount > 1 ? `averaged over ${monthCount} months` : 'for this period') : `for ${monthLabel(month, true)}`}
          />

          <section className="card trend-card">
            <div className="card-head">
              <div>
                <h2>{trend.title}</h2>
                <p className="muted small">{category ? `${category} only` : 'All categories'}</p>
              </div>
            </div>
            {trend.points.length ? <TrendChart points={trend.points} dark={dark} color={category ? colorFor(category) : '#10b981'} /> : <div className="empty-table">No dated transactions.</div>}
          </section>

          <section className="card activity">
            <div className="card-head activity-head">
              <div className="tabs" role="tablist">
                <button role="tab" aria-selected={view === 'transactions'} className={view === 'transactions' ? 'active' : ''} onClick={() => setView('transactions')}>
                  Transactions
                </button>
                <button role="tab" aria-selected={view === 'merchants'} className={view === 'merchants' ? 'active' : ''} onClick={() => setView('merchants')}>
                  Merchants
                </button>
              </div>
              <div className="activity-tools">
                <label className="search">
                  <Icon.Search size={16} />
                  <input type="search" placeholder="Search transactions" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search transactions" />
                </label>
                <button className="btn btn-ghost" onClick={exportTransactions} title="Download these transactions as CSV">
                  <Icon.Download size={16} />
                  <span className="hide-sm">Export</span>
                </button>
              </div>
            </div>
            {view === 'transactions' ? (
              <>
                {excludedCount ? (
                  <label className="toggle">
                    <input type="checkbox" checked={showExcluded} onChange={(e) => setShowExcluded(e.target.checked)} />
                    <span>Show {plural(excludedCount, 'excluded item')} (card payments, transfers, hidden rows)</span>
                  </label>
                ) : null}
                <TransactionsTable
                  rows={tableRows}
                  categories={allCategories}
                  colorFor={colorFor}
                  onRecategorize={recategorize}
                  onToggleExclude={toggleExclude}
                  onNewCategory={setNewCategoryFor}
                  emptyText={search ? `No transactions match “${search}”.` : 'No transactions for this selection.'}
                />
              </>
            ) : (
              <MerchantsTable
                rows={tableRows}
                colorFor={colorFor}
                onPick={(name) => {
                  setSearch(name);
                  setView('transactions');
                }}
              />
            )}
          </section>
        </div>

        <footer className="footnote">
          <Icon.Lock size={14} /> Your statements are processed on this device and saved only in this browser.
        </footer>
      </main>

      {newCategoryFor ? (
        <NewCategoryModal
          transaction={newCategoryFor}
          existing={allCategories}
          onClose={() => setNewCategoryFor(null)}
          onSave={(tx, name) => {
            setNewCategoryFor(null);
            recategorize(tx, name);
          }}
        />
      ) : null}
      {dropOverlay}
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
