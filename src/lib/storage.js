import Papa from 'papaparse';

const KEY = 'wealth-watch:v1';

export function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && Array.isArray(saved.transactions)) return saved;
  } catch (e) {
    // storage blocked or corrupt, start fresh
  }
  return null;
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    // quota exceeded or storage blocked; the app still works for this visit
  }
}

export function downloadCSV(rows, filename) {
  const blob = new Blob([Papa.unparse(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
