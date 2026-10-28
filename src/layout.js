// Pure logic for the month tabs: names, dates and where the SAÍDAS / ENTRADAS tables are. No API calls, so it's easy to test.
import { normalize } from './parser.js';

const MONTHS = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

const colLetter = (i) => (i < 26 ? '' : colLetter(Math.floor(i / 26) - 1)) + String.fromCharCode(65 + (i % 26));
export const cellA1 = (row, col) => `${colLetter(col)}${row + 1}`;

const ABBR = MONTHS.map((m) => m.slice(0, 3).replace('Ç', 'C'));

// 2026, 11 -> 'NOV 2026'
export const monthTabName = (year, month) => `${ABBR[month - 1]} ${year}`;

// 'NOV 2026' -> { year: 2026, month: 11 }; any other tab name -> null
export function parseMonthTab(title) {
  const m = String(title).match(/^([A-Z]{3}) (\d{4})$/);
  const i = m ? ABBR.indexOf(m[1]) : -1;
  return i === -1 ? null : { year: +m[2], month: i + 1 };
}

// The latest month tab before year/month (a month without a tab is skipped), or null
export function previousMonthTab(titles, year, month) {
  const key = (p) => p.year * 12 + p.month;
  return titles
    .map((title) => ({ title, p: parseMonthTab(title) }))
    .filter(({ p }) => p && key(p) < key({ year, month }))
    .sort((a, b) => key(b.p) - key(a.p))[0]?.title ?? null;
}

// 2026, 11 -> 'CONTROLE DE FINANÇAS DE NOVEMBRO DE 2026'
export const monthTitle = (year, month) => `CONTROLE DE FINANÇAS DE ${MONTHS[month - 1]} DE ${year}`;

// Splits a total into n installments in cents; the last one takes the leftover cents: 100 / 3 -> [33.33, 33.33, 33.34]
export function splitInstallments(total, n) {
  const cents = Math.round(total * 100);
  const each = Math.floor(cents / n);
  return Array.from({ length: n }, (_, i) => (i < n - 1 ? each : cents - each * (n - 1)) / 100);
}

// The same day k months later, clamped to the month's length: 2026-01-31 + 1 month -> 2026-02-28
export function addMonths({ year, month, day }, k) {
  const index = year * 12 + (month - 1) + k;
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { year: y, month: m, day: Math.min(day, lastDay) };
}

// Calendar date -> Google Sheets date serial (days since 1899-12-30)
export const dateSerial = (year, month, day) => (Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86400000;

// Year/month/day/timestamp of a date in the given timezone
export function localParts(date, timeZone) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date).map((x) => [x.type, x.value]),
  );
  return { year: +p.year, month: +p.month, day: +p.day, stamp: `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}` };
}

// Header text -> field: DATA, VALOR, PAGAMENTO, TIPO, OBSERVAÇÕES / OBSERVAÇÃO
const fieldOf = (h) => {
  const v = normalize(h);
  return v.startsWith('observ') ? 'obs' : v;
};

// Finds the SAÍDAS and ENTRADAS tables: a cell with the section name and, up to 3 rows below,
// a header row (starting in the same column) with at least DATA and VALOR.
// Returns { saidas: { headerRow, cols: { data, valor, ... } }, entradas: {...} }.
export function findTables(grid) {
  const tables = {};
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < (grid[r] ?? []).length; c++) {
      const section = normalize(grid[r][c]);
      if ((section !== 'saidas' && section !== 'entradas') || tables[section]) continue;
      for (let h = r + 1; h <= r + 3 && h < grid.length; h++) {
        const cols = {};
        for (let k = c; normalize(grid[h]?.[k]); k++) cols[fieldOf(grid[h][k])] ??= k;
        if (cols.data !== undefined && cols.valor !== undefined) {
          tables[section] = { headerRow: h, cols };
          break;
        }
      }
    }
  }
  for (const [key, label] of [['saidas', 'SAÍDAS'], ['entradas', 'ENTRADAS']]) {
    if (!tables[key]) throw new Error(`Não encontrei a tabela "${label}" (com cabeçalho DATA e VALOR) na aba do mês`);
  }
  return tables;
}

const isEmpty = (v) => v === '' || v === undefined || v === null;

// First row below the header where every column of the table is empty
export function nextRow(grid, table) {
  const cols = Object.values(table.cols);
  for (let r = table.headerRow + 1; ; r++) {
    if (cols.every((c) => isEmpty(grid[r]?.[c]))) return r;
  }
}

// { data, valor, tipo, ... } -> { startCol, values } covering the table's columns left to right.
// Columns the table doesn't have are ignored; columns without a value are left empty.
export function buildRow(table, fields) {
  const cols = Object.values(table.cols);
  const startCol = Math.min(...cols);
  const values = Array.from({ length: Math.max(...cols) - startCol + 1 }, () => '');
  for (const [field, col] of Object.entries(table.cols)) values[col - startCol] = fields[field] ?? '';
  return { startCol, values };
}
