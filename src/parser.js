export const normalize = (s) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// "56,80" / "1.234,56" / "56.80" / "1234" -> number
export function parseAmount(raw) {
  let s = raw;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (!/\.\d{1,2}$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

// Every amount written with digits in the text: "2 pizzas por 50,90" -> [2, 50.9]
export const amountsIn = (text) =>
  (String(text).match(/\d[\d.,]*/g) ?? []).map((s) => parseAmount(s.replace(/[.,]+$/, ''))).filter((n) => n !== null);

// Fixed format, used when there's no LLM (or it fails): sign + amount + text.
// "-56,80 almoco spoleto" -> { type: 'saidas', amount: 56.8, description: 'almoco spoleto' }
// Returns null if the message isn't a transaction. A leading "-" is an expense, "+" is income.
export function parseMessage(text) {
  const m = String(text).trim().match(/^([+-])\s*(?:R\$\s*)?([\d.,]+)\s*(.*)$/is);
  if (!m) return null;
  const amount = parseAmount(m[2]);
  if (amount === null) return null;
  return { type: m[1] === '-' ? 'saidas' : 'entradas', amount, description: m[3].trim() };
}

// Most installments a purchase can be split into
export const MAX_INSTALLMENTS = 24;

// Fixed-format installments: "tênis 3x" -> { parcelas: 3, description: 'tênis' }. The amount stays the total.
export function installmentsIn(description) {
  const m = description.match(/(?:^|\s)(?:em\s+)?(\d{1,2})\s*x(?=\s|$)/i);
  const n = m ? Number(m[1]) : 1;
  if (n < 2 || n > MAX_INSTALLMENTS) return { parcelas: 1, description };
  return { parcelas: n, description: description.replace(m[0], ' ').replace(/\s+/g, ' ').trim() };
}

// An installment purchase that doesn't say how it was paid went on the credit card: the Config PAGAMENTO
// named like "crédito" ("CRÉDITO", "CARTÃO DE CRÉDITO"), or '' if there's none
export const creditPayment = (config) =>
  config.pagamentos.find((p) => normalize(p.name).includes('credito'))?.name ?? '';

// Rows of the Config tab (from A2): A = TIPO, B = its keywords, D = PAGAMENTO, E = its keywords.
// Keywords are separated by commas and may have more than one word.
export function parseConfig(rows) {
  const list = (nameCol, keysCol) => rows
    .filter((r) => String(r[nameCol] ?? '').trim())
    .map((r) => ({
      name: String(r[nameCol]).trim(),
      keys: String(r[keysCol] ?? '').split(',').map((k) => k.trim()).filter(Boolean),
    }));
  return { tipos: list(0, 1), pagamentos: list(3, 4) };
}

const tokens = (s) => normalize(s).split(/\s+/).filter(Boolean);

// Earliest place in `words` where an item's name or one of its keywords appears; on a tie the longer
// phrase wins ("mercado livre" over "mercado"). Returns { item, start, length, byName } or null.
function findItem(words, items) {
  let best = null;
  for (const item of items) {
    for (const [phrase, byName] of [[item.name, true], ...item.keys.map((k) => [k, false])]) {
      const p = tokens(phrase);
      if (!p.length) continue;
      for (let i = 0; i + p.length <= words.length && (best === null || i <= best.start); i++) {
        if (!p.every((w, j) => words[i + j] === w)) continue;
        if (best === null || i < best.start || p.length > best.length) best = { item, start: i, length: p.length, byName };
        break;
      }
    }
  }
  return best;
}

// Fixed-format fallback: splits the description into TIPO, PAGAMENTO and observation using the Config keywords.
// "alimentação pix tauste" -> { tipo: 'ALIMENTAÇÃO', pagamento: 'PIX', obs: 'tauste' }
// What isn't found stays empty. The PAGAMENTO word always leaves the observation; the TIPO word only when it's
// the TIPO's own name, so a keyword like "almoço" stays as a useful note. Income only has an observation.
export function classify({ type, description }, config) {
  if (type === 'entradas') return { tipo: '', pagamento: '', obs: description };

  const original = description.split(/\s+/).filter(Boolean);
  const words = original.map(normalize);
  const drop = new Set();

  const tipo = findItem(words, config.tipos);
  if (tipo?.byName) for (let i = 0; i < tipo.length; i++) drop.add(tipo.start + i);

  const pag = findItem(words, config.pagamentos);
  if (pag) for (let i = 0; i < pag.length; i++) drop.add(pag.start + i);

  return {
    tipo: tipo?.item.name ?? '',
    pagamento: pag?.item.name ?? '',
    obs: original.filter((_, i) => !drop.has(i)).join(' '),
  };
}
