// Turns a blank Google Sheet into the standard spreadsheet (Config, Log, hidden MODELO and the current month).
// Usage: npm run setup -- <SPREADSHEET_ID>            share the sheet with the service account as editor first
//        npm run setup -- <SPREADSHEET_ID> --modelo   already set up: rebuilds MODELO with the current template and
//                                                      recolors Config; month tabs that already exist don't change
import fs from 'node:fs';
import { TIMEZONE } from '../config.js';
import { SERVICE_ACCOUNT_FILE } from './paths.js';
import { createSheetsClient, getMeta, ensureMonthTab } from './sheets.js';
import { localParts } from './layout.js';
import {
  CONFIG_SHEET, LOG_SHEET, MODEL_SHEET, configValues, logValues, modelValues,
  configFormatRequests, logFormatRequests, modelFormatRequests,
} from './template.js';

const [spreadsheetId, flag] = process.argv.slice(2);
if (!spreadsheetId || (flag && flag !== '--modelo')) {
  console.error('Uso: npm run setup -- <ID_DA_PLANILHA> [--modelo]');
  process.exit(1);
}

const sheets = createSheetsClient();
let meta;
try {
  meta = await getMeta(sheets, spreadsheetId);
} catch (err) {
  const email = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_FILE, 'utf8')).client_email;
  console.error(`Não consegui abrir a planilha (${err.message}). Ela está compartilhada como Editor com ${email}?`);
  process.exit(1);
}
const tab = (title) => meta.sheets.find((s) => s.properties.title === title)?.properties;
const batch = (requests) => sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
const addSheets = async (titles) => (await batch(titles.map((title) => ({
  addSheet: { properties: { title, gridProperties: { rowCount: 1000, columnCount: 26 } } },
})))).data.replies.map((r) => r.addSheet.properties.sheetId);
const writeValues = (data) => sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: 'USER_ENTERED', data } });

if (flag === '--modelo') {
  if (!tab(MODEL_SHEET) || !tab(CONFIG_SHEET)) {
    console.error(`"${meta.properties.title}" não tem as abas ${MODEL_SHEET} e ${CONFIG_SHEET}. Rode sem --modelo.`);
    process.exit(1);
  }
  await batch([{ deleteSheet: { sheetId: tab(MODEL_SHEET).sheetId } }]);
  const [modelId] = await addSheets([MODEL_SHEET]);
  await writeValues(modelValues());
  await batch([...configFormatRequests(tab(CONFIG_SHEET).sheetId), ...modelFormatRequests(modelId)]);
  console.log(`Pronto: MODELO de "${meta.properties.title}" refeita. Os meses que ainda vão ser criados usam o visual novo;`);
  console.log('para refazer uma aba de mês vazia, apague-a e o bot cria de novo na próxima mensagem.');
  process.exit(0);
}

const taken = [CONFIG_SHEET, LOG_SHEET, MODEL_SHEET].filter((n) => tab(n));
if (taken.length) {
  console.error(`A planilha "${meta.properties.title}" já tem a(s) aba(s) ${taken.join(', ')}. Use uma planilha em branco (ou --modelo).`);
  process.exit(1);
}

// The bot is in Portuguese: dates as 28-out., money as R$ 1.201,00 and formulas with ';'
await batch([{ updateSpreadsheetProperties: { properties: { locale: 'pt_BR', timeZone: TIMEZONE }, fields: 'locale,timeZone' } }]);

const [configId, logId, modelId] = await addSheets([CONFIG_SHEET, LOG_SHEET, MODEL_SHEET]);
await writeValues([...configValues(), ...logValues(), ...modelValues()]);
await batch([...configFormatRequests(configId), ...logFormatRequests(logId), ...modelFormatRequests(modelId)]);

// The blank tab a new spreadsheet comes with ('Página1', 'Sheet1') is removed if it's still empty
for (const { properties: p } of meta.sheets) {
  if (!/^(sheet|página|planilha|folha)\s*1$/i.test(p.title)) continue;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${p.title}'!A1:Z100` });
  if (!res.data.values?.length) await batch([{ deleteSheet: { sheetId: p.sheetId } }]);
}

const { year, month } = localParts(new Date(), TIMEZONE);
const month0 = await ensureMonthTab(sheets, spreadsheetId, year, month);
console.log(`Pronto: "${meta.properties.title}" tem Config, Log, MODELO (oculta) e ${month0}.`);
console.log(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
