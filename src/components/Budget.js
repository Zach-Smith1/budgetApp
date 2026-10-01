import React from 'react';
import { money, moneyShort, percent } from '../lib/format.js';

// the guideline the original app charted as "Suggested Budget"
const GUIDELINE = [
  ['Housing', 0.3],
  ['Food', 0.15],
  ['Needs', 0.15],
  ['Insurance', 0.1],
  ['Savings', 0.1],
  ['Transportation', 0.1],
  ['Utilities', 0.05],
  ['Wants', 0.05],
];

function MoneyInput({ id, label, hint, value, onChange }) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <span className="money-input">
        <span>$</span>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          placeholder="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="suffix">/mo</span>
      </span>
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export default function Budget({ income, housing, onChange, monthlySpend, basis }) {
  const inc = Number(income) || 0;
  const rent = Number(housing) || 0;
  const leftover = inc - rent - monthlySpend;
  const outflow = rent + monthlySpend;
  const scale = Math.max(inc, outflow, 1);

  return (
    <section className="card budget">
      <div className="card-head">
        <div>
          <h2>Monthly budget</h2>
          <p className="muted small">Card spending {basis}</p>
        </div>
      </div>

      <div className="budget-fields">
        <MoneyInput id="income" label="Take-home income" value={income} onChange={(v) => onChange('income', v)} />
        <MoneyInput id="housing" label="Rent / mortgage" hint="Usually not on a card" value={housing} onChange={(v) => onChange('housing', v)} />
      </div>

      {inc > 0 ? (
        <>
          <div className="alloc-bar" role="img" aria-label="Income allocation">
            <span className="seg housing" style={{ width: `${(rent / scale) * 100}%` }} />
            <span className="seg spend" style={{ width: `${(monthlySpend / scale) * 100}%` }} />
            {leftover > 0 ? <span className="seg saved" style={{ width: `${(leftover / scale) * 100}%` }} /> : null}
          </div>
          <dl className="alloc-legend">
            <div>
              <dt>
                <i className="housing" />
                Housing
              </dt>
              <dd>{money(rent)}</dd>
            </div>
            <div>
              <dt>
                <i className="spend" />
                Card spending
              </dt>
              <dd>{money(monthlySpend)}</dd>
            </div>
            <div className={leftover >= 0 ? 'good' : 'bad'}>
              <dt>
                <i className={leftover >= 0 ? 'saved' : 'over'} />
                {leftover >= 0 ? 'Left to save' : 'Over budget'}
              </dt>
              <dd>
                {money(Math.abs(leftover))}
                <small>{leftover >= 0 ? ` · ${percent(leftover / inc)} of income` : ''}</small>
              </dd>
            </div>
          </dl>
          {rent / inc > 0.3 ? (
            <p className="note warn">Housing is {percent(rent / inc)} of income; the common guideline is 30% or less.</p>
          ) : null}
          {leftover >= 0 && leftover / inc < 0.1 ? (
            <p className="note warn">Aim to save at least 10% of take-home pay.</p>
          ) : null}
        </>
      ) : (
        <p className="muted small">Add your monthly income to see how much you're saving.</p>
      )}

      <details className="guideline">
        <summary>Suggested budget guideline</summary>
        <ul>
          {GUIDELINE.map(([name, share]) => (
            <li key={name}>
              <span>{name}</span>
              <span className="bar">
                <span style={{ width: `${share * 100 * 3}%` }} />
              </span>
              <span className="muted">{percent(share)}</span>
              <strong>{inc > 0 ? moneyShort(inc * share) : '—'}</strong>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
