# Wealth Watch

Drop in credit card or bank statements (CSV or Excel) and see where your money goes: spending by category, merchant and month, a monthly budget check, and a clean CSV export.

Everything runs in the browser. Files are never uploaded; imported transactions are saved only in the browser's local storage.

## Features

- Reads exports from Chase, American Express, Capital One, Discover, Citi, Bank of America, Wells Fargo and most other CSV/XLSX layouts (columns are detected automatically, and purchase signs are normalized).
- Card payments and account transfers are detected and left out of totals so nothing is double counted.
- Load several files and cards at once; remove any file later.
- Interactive category donut, monthly or daily trend chart, and merchant grouping.
- Recategorize any transaction (or every transaction from that merchant), create new categories, and exclude rows from totals with undo.
- Monthly budget panel with income, housing and savings rate.
- Light and dark themes, responsive down to phone widths.
- Sample data for a quick demo.

## Development

```sh
npm install
npm run dev     # development build, rebuilds on change
npm run build   # production build into dist/
npm start       # serve dist/ on http://localhost:3000
```

The production build writes `dist/bundle.js` plus `dist/xlsx.bundle.js`, which is loaded only when an Excel file is dropped. Both are git-ignored; copy them with `dist/index.html`, `dist/styles.css` and `dist/images/` when deploying elsewhere.

## Code layout

- `src/lib/parse.js` turns CSV/XLSX rows into normalized transactions
- `src/lib/merchant.js` cleans raw descriptions into merchant names
- `src/lib/sample.js` generates the demo data
- `src/components/` charts, tables, budget panel and overlays
- `src/App.js` state, filtering and layout
