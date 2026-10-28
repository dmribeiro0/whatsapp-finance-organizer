// Reads a free-form message with an LLM (any OpenAI-compatible chat API; Groq by default) and returns the
// transaction fields. The answer is forced into a JSON schema whose TIPO / PAGAMENTO values come from the Config tab.
import { normalize, amountsIn, classify } from './parser.js';

const describe = (items) => items
  .map((i) => `- ${i.name}${i.keys.length ? ` (ex.: ${i.keys.join(', ')})` : ''}`)
  .join('\n') || '(nenhum)';

function systemPrompt(config) {
  return `Você lê mensagens de WhatsApp em que uma pessoa registra o próprio dinheiro gasto ou recebido, e extrai os dados da transação.

Campos:
- transacao: false se a mensagem não registra um valor gasto ou recebido (conversa, pergunta, lembrete, mensagem sem valor). Aí os outros campos ficam null / "".
- movimento: "saida" para gasto/pagamento/compra e para dinheiro guardado ou investido (caixinha, poupança); "entrada" para dinheiro recebido (salário, pix recebido, reembolso, venda). Sinal "-" no começo é saída e "+" é entrada. Na dúvida, "saida".
- valor: o valor em reais como número, exatamente como escrito na mensagem (56,80 → 56.8; 1.234,56 → 1234.56; R$30 → 30). Nunca calcule nem invente.
- tipo: só para saída. Um dos TIPOS abaixo, pelo que foi comprado. Se uma palavra da mensagem estiver entre os exemplos de um tipo, use esse tipo; os exemplos não precisam aparecer para o tipo servir. Se a mensagem diz o que foi comprado mas nenhum tipo serve, use OUTROS se ele existir. Se não diz nada sobre o que foi comprado, null. Em entrada, null.
- pagamento: só para saída. Um dos PAGAMENTOS abaixo, apenas se a mensagem disser como pagou. Se não disser, null. Em entrada, null.
- observacao: o resto útil da mensagem, curto e com as palavras da pessoa. Mantenha o que diz o que foi comprado, onde ou para quem (lanche, gasolina, uber, ifood, "presente da mãe"). Tire só o valor, o nome do tipo e a forma de pagamento quando escritos na mensagem, e palavras soltas que só ligavam o valor ("por", "de", "no"). "" se não sobrar nada. Em entrada, de onde veio o dinheiro.

TIPOS:
${describe(config.tipos)}

PAGAMENTOS:
${describe(config.pagamentos)}

Exemplos (com os tipos e pagamentos padrão):
"-25 alimentação pix tauste" → saida, 25, ALIMENTAÇÃO, PIX, "tauste"
"gastei 32,90 no ifood" → saida, 32.9, ALIMENTAÇÃO, null, "ifood"
"paguei 120 de luz no débito" → saida, 120, OUTROS, DÉBITO, "luz"
"gasolina 150 débito" → saida, 150, TRANSPORTE, DÉBITO, "gasolina"
"2 cafés por 12" → saida, 12, ALIMENTAÇÃO, null, "2 cafés"
"coloquei 200 na caixinha" → saida, 200, INVESTIMENTOS, null, "caixinha"
"50 conto" → saida, 50, null, null, ""
"recebi 1201 do salário" → entrada, 1201, null, null, "salário"
"amanhã eu te pago" → transacao false`;
}

const nullable = (values) => ({ type: ['string', 'null'], enum: [...values, null] });

// The chat request body (without model / extras)
export function buildRequest(text, config) {
  return {
    temperature: 0,
    messages: [
      { role: 'system', content: systemPrompt(config) },
      { role: 'user', content: String(text) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'transacao',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['transacao', 'movimento', 'valor', 'tipo', 'pagamento', 'observacao'],
          properties: {
            transacao: { type: 'boolean' },
            movimento: nullable(['entrada', 'saida']),
            valor: { type: ['number', 'null'] },
            tipo: nullable(config.tipos.map((t) => t.name)),
            pagamento: nullable(config.pagamentos.map((p) => p.name)),
            observacao: { type: 'string' },
          },
        },
      },
    },
  };
}

// Canonical name from the list, or '' (the model may change case or accents)
const pick = (value, items) => items.find((i) => normalize(i.name) === normalize(value))?.name ?? '';

// Checks the model's answer against the message. Returns { type, amount, tipo, pagamento, obs },
// null when it isn't a transaction, or throws when the answer can't be trusted.
export function readAnswer(answer, text, config) {
  if (!answer.transacao) return null;
  const amount = Math.round(Number(answer.valor) * 100) / 100;
  if (!(amount > 0)) return null;
  // The amount must be written in the message, so a made-up number never reaches the sheet
  if (!amountsIn(text).includes(amount)) throw new Error(`valor ${answer.valor} não aparece na mensagem`);

  const sign = String(text).trim().match(/^([+-])\s*(?:R\$\s*)?\d/)?.[1];
  const type = sign ? (sign === '-' ? 'saidas' : 'entradas') : (answer.movimento === 'entrada' ? 'entradas' : 'saidas');
  const obs = String(answer.observacao ?? '').trim().slice(0, 200);
  if (type === 'entradas') return { type, amount, tipo: '', pagamento: '', obs };

  // A Config keyword in the message wins when the model left the field empty (or tipo as OUTROS),
  // so adding a keyword to the sheet is a sure way to teach the bot
  const byKeyword = classify({ type, description: String(text) }, config);
  let tipo = pick(answer.tipo, config.tipos);
  if ((!tipo || normalize(tipo) === 'outros') && byKeyword.tipo) tipo = byKeyword.tipo;
  return { type, amount, tipo, pagamento: pick(answer.pagamento, config.pagamentos) || byKeyword.pagamento, obs };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// "7.66s" / "1m2.5s" / "250ms" (Groq's rate-limit headers) -> seconds
function seconds(value) {
  const m = String(value ?? '').match(/^(?:(\d+)m)?(?:([\d.]+)s)?(?:([\d.]+)ms)?$/);
  if (!m || !m[0]) return null;
  return (+m[1] || 0) * 60 + (+m[2] || 0) + (+m[3] || 0) / 1000;
}

const MAX_ATTEMPTS = 5;

// Calls the API. `llm` = { baseUrl, model, apiKey, extra }. On a rate limit (429) waits as long as the
// API says and tries again, up to MAX_ATTEMPTS calls, so a burst of messages is slowed down, not lost.
export async function extractWithLLM(text, config, llm, fetchFn = fetch) {
  const body = JSON.stringify({ model: llm.model, ...llm.extra, ...buildRequest(text, config) });
  for (let attempt = 1; ; attempt++) {
    const res = await fetchFn(`${llm.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${llm.apiKey}` },
      body,
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 429 && attempt < MAX_ATTEMPTS) {
      const retryAfter = res.headers.get('retry-after');
      const wait = retryAfter ? Number(retryAfter) : seconds(res.headers.get('x-ratelimit-reset-tokens')) ?? 5;
      await sleep(Math.min(wait + 0.5, 60) * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return readAnswer(JSON.parse(data.choices[0].message.content), text, config);
  }
}
