// Entry point: WhatsApp message -> LLM (or fixed format) -> Google Sheets -> reaction.
import fs from 'node:fs';
import { GROUPS, TIMEZONE, LLM } from '../config.js';
import { STATE_FILE, DATA_DIR } from './paths.js';
import { parseMessage, classify } from './parser.js';
import { extractWithLLM } from './llm.js';
import { createSheetsClient, loadSpreadsheet, readConfig, writeTransaction } from './sheets.js';
import { connectWhatsApp } from './whatsapp.js';

const fmt = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Each group only has messages sent after it was first configured processed, so linking the device
// or adding a group (both sync old history) never imports old messages into the sheet.
fs.mkdirSync(DATA_DIR, { recursive: true });
const saved = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {};
const since = typeof saved.since === 'object' ? saved.since : {}; // older state.json had a single number
const now = Math.floor(Date.now() / 1000);
for (const { group } of GROUPS) since[group] ??= now;
fs.writeFileSync(STATE_FILE, JSON.stringify({ since }, null, 2));

const sheets = createSheetsClient();
const groupByName = new Map(GROUPS.map((g) => [g.group, g]));
const processed = new Set();
for (const spreadsheetId of new Set(GROUPS.map((g) => g.spreadsheetId))) {
  const { title, ids } = await loadSpreadsheet(sheets, spreadsheetId);
  ids.forEach((id) => processed.add(id));
  console.log(`Planilha "${title}" OK (${ids.size} transações no Log)`);
}
console.log(LLM?.apiKey ? `IA: ${LLM.model}` : 'IA desligada (sem LLM.apiKey): só o formato fixo "-valor tipo pagamento observação"');

// Message -> { type, amount, tipo, pagamento, obs } or null. The LLM reads any wording; if there's no key
// or the call fails, the fixed format (sign + amount + words) still works.
async function interpret(text, config) {
  if (LLM?.apiKey) {
    try {
      return await extractWithLLM(text, config, LLM);
    } catch (err) {
      console.error(`IA falhou em "${text}" (${err.message}); tentando o formato fixo`);
    }
  }
  const m = parseMessage(text);
  return m && { type: m.type, amount: m.amount, ...classify(m, config) };
}

connectWhatsApp([...groupByName.keys()], async ({ group, id, text, timestamp, fromMe, author, react }) => {
  // Only my messages count, unless the group is shared (everyone: true in config.js)
  const { spreadsheetId, everyone } = groupByName.get(group);
  if ((!fromMe && !everyone) || timestamp < since[group] || processed.has(id)) return;
  // Without a digit there's no amount, so it isn't a transaction. In a shared group that's just conversation:
  // left alone, without a reaction or an API call.
  if (!/\d/.test(text)) return everyone ? undefined : react('❓');

  try {
    const tx = await interpret(text, await readConfig(sheets, spreadsheetId));
    // Not a transaction ("me liga no 98765-4321", "culto às 19h"): flagged in my own groups, left alone in shared ones
    if (!tx) return everyone ? undefined : react('❓');

    const r = await writeTransaction(sheets, spreadsheetId, tx, new Date(timestamp * 1000), { id, text, author }, TIMEZONE);
    processed.add(id);
    const fields = tx.type === 'saidas' ? `${tx.tipo || '?'} / ${tx.pagamento || '?'}` : 'entrada';
    console.log(`[${group}] ${author}: ${text}  ->  ${r.tab} linha ${r.row}: ${fmt(tx.amount)} ${fields} "${tx.obs}"`);
    await react(tx.type === 'saidas' && !tx.tipo ? '🤷' : '✅');
  } catch (err) {
    console.error(`Erro em "${text}" (${group}):`, err.message);
    await react('⚠️');
  }
});
