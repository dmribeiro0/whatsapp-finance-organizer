import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findTables, nextRow, buildRow, monthTabName, monthTitle, dateSerial, localParts, cellA1, parseMonthTab, previousMonthTab, splitInstallments, addMonths,
} from '../src/layout.js';

// A month tab as the API returns it (trailing empty cells dropped): title, the two tables and a summary on the left
const row = (cells) => Object.assign([], cells);
const grid = [
  [],
  row({ 1: 'CONTROLE DE FINANÇAS DE NOVEMBRO DE 2026', 15: 'SAÍDAS', 21: 'ENTRADAS' }),
  row({ 15: 'DATA', 16: 'VALOR', 17: 'PAGAMENTO', 18: 'TIPO', 19: 'OBSERVAÇÕES', 21: 'DATA', 22: 'VALOR', 23: 'OBSERVAÇÃO' }),
  row({ 15: 46327, 16: 10.5, 17: 'PIX', 18: 'COMPRAS', 21: 46327, 22: 1201 }),
  row({ 15: 46328, 16: 7, 17: 'PIX', 18: 'OUTROS', 19: 'x' }),
  row({ 8: 'GASTOS TOTAIS:', 10: 17.5 }),
];
const tables = findTables(grid);

test('finds both tables by their headers', () => {
  assert.deepEqual(tables.saidas, { headerRow: 2, cols: { data: 15, valor: 16, pagamento: 17, tipo: 18, obs: 19 } });
  assert.deepEqual(tables.entradas, { headerRow: 2, cols: { data: 21, valor: 22, obs: 23 } });
});

test('next empty row of each table', () => {
  assert.equal(nextRow(grid, tables.saidas), 5);
  assert.equal(nextRow(grid, tables.entradas), 4);
  assert.equal(nextRow([...grid.slice(0, 3)], tables.saidas), 3);
});

test('rows filled only in some columns are not empty', () => {
  // The original FINANÇAS sheet kept its TIPO/PAGAMENTO lists inside the table
  const g = [...grid.slice(0, 3), row({ 17: 'CRÉDITO', 18: 'TRANSPORTE' })];
  assert.equal(nextRow(g, tables.saidas), 4);
});

test('builds the row in header order', () => {
  assert.deepEqual(buildRow(tables.saidas, { data: 1, valor: 2, pagamento: 'PIX', tipo: 'COMPRAS', obs: 'o' }),
    { startCol: 15, values: [1, 2, 'PIX', 'COMPRAS', 'o'] });
  assert.deepEqual(buildRow(tables.entradas, { data: 1, valor: 2, pagamento: 'PIX', tipo: undefined, obs: 'o' }),
    { startCol: 21, values: [1, 2, 'o'] });
});

test('fails without a table', () => {
  assert.throws(() => findTables(grid.map((r) => r.map((v) => (v === 'ENTRADAS' ? '' : v)))), /ENTRADAS/);
});

test('month names and dates', () => {
  assert.equal(monthTabName(2026, 11), 'NOV 2026');
  assert.equal(monthTabName(2027, 3), 'MAR 2027');
  assert.equal(monthTitle(2026, 3), 'CONTROLE DE FINANÇAS DE MARÇO DE 2026');
  assert.equal(dateSerial(2026, 9, 3), 46268); // 03-set. in the FINANÇAS sheet
  assert.equal(cellA1(3, 15), 'P4');
});

test('local date in the timezone', () => {
  // 02:30 UTC on Nov 1st is still Oct 31st in São Paulo
  const p = localParts(new Date('2026-11-01T02:30:00Z'), 'America/Sao_Paulo');
  assert.deepEqual([p.year, p.month, p.day, p.stamp], [2026, 10, 31, '2026-10-31 23:30']);
});

test('month tab names', () => {
  assert.deepEqual(parseMonthTab('MAR 2027'), { year: 2027, month: 3 });
  assert.equal(parseMonthTab('Config'), null);
  assert.equal(parseMonthTab('XYZ 2026'), null);
});

test('previous month tab, skipping months without a tab and other tabs', () => {
  const titles = ['SET 2026', 'OUT 2026', 'DEZ 2026', 'Config', 'Log', 'MODELO'];
  assert.equal(previousMonthTab(titles, 2026, 11), 'OUT 2026');
  assert.equal(previousMonthTab(titles, 2027, 2), 'DEZ 2026');
  assert.equal(previousMonthTab(titles, 2026, 9), null);
});

test('installments split in cents, the last one takes the rest', () => {
  assert.deepEqual(splitInstallments(100, 3), [33.33, 33.33, 33.34]);
  assert.deepEqual(splitInstallments(300, 3), [100, 100, 100]);
  assert.equal(splitInstallments(1234.56, 7).reduce((a, b) => a + b, 0).toFixed(2), '1234.56');
});

test('same day in later months, clamped and across years', () => {
  assert.deepEqual(addMonths({ year: 2026, month: 1, day: 31 }, 1), { year: 2026, month: 2, day: 28 });
  assert.deepEqual(addMonths({ year: 2026, month: 11, day: 15 }, 2), { year: 2027, month: 1, day: 15 });
  assert.deepEqual(addMonths({ year: 2026, month: 10, day: 28 }, 0), { year: 2026, month: 10, day: 28 });
});
