// Google Sheets API: month tabs, the Config tab and the Log tab of each spreadsheet.
import { google } from 'googleapis';
import { SERVICE_ACCOUNT_FILE } from './paths.js';
import { CONFIG_SHEET, LOG_SHEET, MODEL_SHEET, LOG_HEADER, LOG_ID_COL, PREV_BALANCE_CELL, BALANCE_CELL } from './template.js';
import {
  findTables, nextRow, buildRow, cellA1, monthTabName, monthTitle, dateSerial, localParts, previousMonthTab,
  splitInstallments, addMonths,
} from './layout.js';
import { parseConfig } from './parser.js';

export const range = (sheet, a1) => `'${sheet.replace(/'/g, "''")}'!${a1}`;

export function createSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

export async function getMeta(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.get({
    spreadsheetId, fields: 'properties(title,locale),sheets.properties(sheetId,title,index)',
  });
  return res.data;
}

// Checks the spreadsheet was set up and returns its title and the message IDs already in its Log
export async function loadSpreadsheet(sheets, spreadsheetId) {
  const meta = await getMeta(sheets, spreadsheetId);
  const titles = meta.sheets.map((s) => s.properties.title);
  const missing = [CONFIG_SHEET, LOG_SHEET, MODEL_SHEET].filter((n) => !titles.includes(n));
  if (missing.length) {
    throw new Error(`Planilha "${meta.properties.title}" sem a(s) aba(s) ${missing.join(', ')}. Rode: npm run setup -- ${spreadsheetId}`);
  }
  // Logs created before a column was added get the current header
  await sheets.spreadsheets.values.update({
    spreadsheetId, range: range(LOG_SHEET, 'A1'), valueInputOption: 'RAW', requestBody: { values: [LOG_HEADER] },
  });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: range(LOG_SHEET, `${LOG_ID_COL}2:${LOG_ID_COL}`) });
  return { title: meta.properties.title, ids: new Set((res.data.values ?? []).map((r) => r[0]).filter(Boolean)) };
}

// Creates the month tab ('NOV 2026') as a copy of MODELO if it doesn't exist yet. Its SALDO ANTERIOR points to the
// SALDO ATUAL of the previous month tab, so the balance carries over (in the first month it's left to be typed in).
// Returns the tab's name.
export async function ensureMonthTab(sheets, spreadsheetId, year, month) {
  const name = monthTabName(year, month);
  const meta = await getMeta(sheets, spreadsheetId);
  const tab = (title) => meta.sheets.find((s) => s.properties.title === title)?.properties;
  if (tab(name)) return name;

  // New months go right before Config, so the month tabs stay in order
  const res = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        duplicateSheet: { sourceSheetId: tab(MODEL_SHEET).sheetId, insertSheetIndex: tab(CONFIG_SHEET).index, newSheetName: name },
      }],
    },
  });
  const sheetId = res.data.replies[0].duplicateSheet.properties.sheetId;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ updateSheetProperties: { properties: { sheetId, hidden: false }, fields: 'hidden' } }] },
  });
  const data = [{ range: range(name, 'B2'), values: [[monthTitle(year, month)]] }];
  const prev = previousMonthTab(meta.sheets.map((s) => s.properties.title), year, month);
  if (prev) data.push({ range: range(name, PREV_BALANCE_CELL), values: [[`=${range(prev, BALANCE_CELL)}`]] });
  await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: 'USER_ENTERED', data } });
  return name;
}

// TIPOS and PAGAMENTOS of the Config tab. Read on every message, so edits apply right away.
export async function readConfig(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: range(CONFIG_SHEET, 'A2:E') });
  return parseConfig(res.data.values ?? []);
}

// Writes one row in the next empty row of the month's SAÍDAS or ENTRADAS table. Returns { tab, row }.
async function writeRow(sheets, spreadsheetId, type, { year, month, day }, fields) {
  const tab = await ensureMonthTab(sheets, spreadsheetId, year, month);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId, range: range(tab, 'A1:Z'), valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const grid = res.data.values ?? [];
  const table = findTables(grid)[type];
  const row = nextRow(grid, table);
  const { startCol, values } = buildRow(table, { data: dateSerial(year, month, day), ...fields });
  await sheets.spreadsheets.values.update({
    spreadsheetId, range: range(tab, cellA1(row, startCol)), valueInputOption: 'RAW', requestBody: { values: [values] },
  });
  return { tab, row: row + 1 };
}

// Writes the transaction ({ type, amount, tipo, pagamento, obs, parcelas }) and appends it to the Log.
// An expense in installments gets one row per month, starting this month ("tênis (1/3)", "tênis (2/3)"...);
// the month tabs ahead are created as needed. A QUEM column, if the table has one, gets the author.
// Returns the rows written: [{ tab, row }].
export async function writeTransaction(sheets, spreadsheetId, tx, date, { id, text, author = '' }, timeZone) {
  const { day, year, month, stamp } = localParts(date, timeZone);
  const n = tx.parcelas ?? 1;
  const amounts = splitInstallments(tx.amount, n);
  const saida = tx.type === 'saidas';
  const written = [];
  for (let k = 0; k < n; k++) {
    const obs = n > 1 ? `${tx.obs ? `${tx.obs} ` : ''}(${k + 1}/${n})` : tx.obs;
    written.push(await writeRow(sheets, spreadsheetId, tx.type, addMonths({ year, month, day }, k), {
      valor: amounts[k], pagamento: tx.pagamento, tipo: tx.tipo, obs, quem: author,
    }));
    await sheets.spreadsheets.values.append({
      spreadsheetId, range: range(LOG_SHEET, 'A:I'), valueInputOption: 'RAW',
      requestBody: {
        values: [[stamp, saida ? -amounts[k] : amounts[k], saida ? 'Saída' : 'Entrada', tx.tipo, tx.pagamento, obs, text, id, author]],
      },
    });
  }
  return written;
}
