import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseConfig } from '../src/parser.js';
import { buildRequest, readAnswer, extractWithLLM } from '../src/llm.js';
import { configValues } from '../src/template.js';

const config = parseConfig(configValues()[0].values.slice(1));
const answer = (fields) => ({
  transacao: true, movimento: 'saida', valor: null, tipo: null, pagamento: null, parcelas: null, valor_por_parcela: false, observacao: '', ...fields,
});

test('the schema only allows the Config names', () => {
  const { schema } = buildRequest('x', config).response_format.json_schema;
  assert.deepEqual(schema.properties.tipo.enum, ['TRANSPORTE', 'ALIMENTAÇÃO', 'INVESTIMENTOS', 'ASSINATURA', 'COMPRAS', 'OUTROS', null]);
  assert.deepEqual(schema.properties.pagamento.enum, ['CRÉDITO', 'DÉBITO', 'DINHEIRO', 'PIX', null]);
  assert.deepEqual(schema.required, Object.keys(schema.properties));
});

test('reads a full expense', () => {
  assert.deepEqual(
    readAnswer(answer({ valor: 32.9, tipo: 'ALIMENTAÇÃO', pagamento: 'PIX', observacao: 'ifood' }), 'gastei 32,90 no ifood no pix', config),
    { type: 'saidas', amount: 32.9, tipo: 'ALIMENTAÇÃO', pagamento: 'PIX', obs: 'ifood', parcelas: 1 },
  );
});

test('missing fields stay empty', () => {
  assert.deepEqual(readAnswer(answer({ valor: 50 }), '50 conto', config),
    { type: 'saidas', amount: 50, tipo: '', pagamento: '', obs: '', parcelas: 1 });
});

test('names outside the Config are dropped, case and accents are fixed', () => {
  const r = readAnswer(answer({ valor: 10, tipo: 'alimentacao', pagamento: 'BOLETO' }), '10 lanche boleto', config);
  assert.deepEqual([r.tipo, r.pagamento], ['ALIMENTAÇÃO', '']);
});

test('income never has tipo or pagamento', () => {
  assert.deepEqual(readAnswer(answer({ movimento: 'entrada', valor: 1201, tipo: 'OUTROS', pagamento: 'PIX', observacao: 'salário' }), 'recebi 1201 de salário no pix', config),
    { type: 'entradas', amount: 1201, tipo: '', pagamento: '', obs: 'salário', parcelas: 1 });
});

test('a leading sign wins over the model', () => {
  assert.equal(readAnswer(answer({ movimento: 'entrada', valor: 25 }), '-25 reembolso', config).type, 'saidas');
  assert.equal(readAnswer(answer({ movimento: 'saida', valor: 25 }), '+ R$ 25 pix', config).type, 'entradas');
});

test('a Config keyword fills what the model left empty or as OUTROS', () => {
  assert.deepEqual(readAnswer(answer({ valor: 200, tipo: 'OUTROS', observacao: 'caixinha' }), 'coloquei 200 na caixinha', config),
    { type: 'saidas', amount: 200, tipo: 'INVESTIMENTOS', pagamento: '', obs: 'caixinha', parcelas: 1 });
  assert.equal(readAnswer(answer({ valor: 20 }), '20 uber no cartão', config).pagamento, 'CRÉDITO');
  // ...but never overrides a tipo the model chose
  assert.equal(readAnswer(answer({ valor: 40, tipo: 'ALIMENTAÇÃO' }), 'uber 40 restaurante', config).tipo, 'ALIMENTAÇÃO');
});

test('installments: total or per installment, always returned as the total', () => {
  const total = readAnswer(answer({ valor: 300, tipo: 'COMPRAS', parcelas: 3 }), 'tênis 300 em 3x', config);
  assert.deepEqual([total.amount, total.parcelas], [300, 3]);
  const each = readAnswer(answer({ valor: 150, tipo: 'COMPRAS', parcelas: 12, valor_por_parcela: true }), 'celular 12x de 150', config);
  assert.deepEqual([each.amount, each.parcelas], [1800, 12]);
});

test('installments without a pagamento go on the credit card', () => {
  assert.equal(readAnswer(answer({ valor: 200, tipo: 'COMPRAS', parcelas: 4 }), 'gastei 200 em 4 vezes na arezzo', config).pagamento, 'CRÉDITO');
  // ...but what the message says wins, and a single payment stays empty
  assert.equal(readAnswer(answer({ valor: 200, pagamento: 'PIX', parcelas: 4 }), 'parcelei 200 em 4x no pix', config).pagamento, 'PIX');
  assert.equal(readAnswer(answer({ valor: 200 }), 'gastei 200 na arezzo', config).pagamento, '');
  // Config with another name for it
  const renamed = { ...config, pagamentos: [{ name: 'PIX', keys: [] }, { name: 'Cartão de Credito', keys: [] }] };
  assert.equal(readAnswer(answer({ valor: 200, parcelas: 4 }), '200 em 4x', renamed).pagamento, 'Cartão de Credito');
});

test('installments outside 2..24 and income are not split', () => {
  assert.equal(readAnswer(answer({ valor: 300, parcelas: 30 }), 'tv 300 em 30x', config).parcelas, 1);
  assert.equal(readAnswer(answer({ valor: 300, parcelas: 1 }), 'tv 300 em 1x', config).parcelas, 1);
  assert.equal(readAnswer(answer({ movimento: 'entrada', valor: 300, parcelas: 3 }), 'recebi 300 em 3x', config).parcelas, 1);
});

test('the schema asks for installments', () => {
  const { schema } = buildRequest('x', config).response_format.json_schema;
  assert.deepEqual(schema.properties.parcelas.type, ['integer', 'null']);
  assert.ok(schema.required.includes('valor_por_parcela'));
});

test('not a transaction', () => {
  assert.equal(readAnswer({ ...answer({}), transacao: false }, 'amanhã eu te pago', config), null);
  assert.equal(readAnswer(answer({ valor: null }), 'paguei o almoço', config), null);
  // A phone number read as an amount
  assert.equal(readAnswer(answer({ valor: 12988186800 }), 'o número do João é 12988186800', config), null);
});

test('an amount that is not in the message is rejected', () => {
  assert.throws(() => readAnswer(answer({ valor: 65.8 }), 'paguei 2 cafés de 32,90', config), /não aparece/);
});

test('calls the API and waits through rate limits', async () => {
  const calls = [];
  const reply = { choices: [{ message: { content: JSON.stringify(answer({ valor: 12, tipo: 'TRANSPORTE', observacao: 'uber' })) } }] };
  const fakeFetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization });
    if (calls.length === 1) return { status: 429, ok: false, headers: new Map([['retry-after', '0']]) };
    if (calls.length === 2) return { status: 429, ok: false, headers: new Map([['x-ratelimit-reset-tokens', '10ms']]) };
    return { status: 200, ok: true, json: async () => reply };
  };
  const llm = { baseUrl: 'https://api.example.com/v1/', model: 'm', apiKey: 'k', extra: { reasoning_effort: 'low' } };
  const r = await extractWithLLM('12 uber', config, llm, fakeFetch);
  assert.deepEqual(r, { type: 'saidas', amount: 12, tipo: 'TRANSPORTE', pagamento: '', obs: 'uber', parcelas: 1 });
  assert.equal(calls.length, 3);
  assert.equal(calls[1].url, 'https://api.example.com/v1/chat/completions');
  assert.equal(calls[1].auth, 'Bearer k');
  assert.equal(calls[1].body.model, 'm');
  assert.equal(calls[1].body.reasoning_effort, 'low');
});

test('gives up after 5 rate-limited calls', async () => {
  let n = 0;
  const fakeFetch = async () => { n++; return { status: 429, ok: false, headers: new Map([['retry-after', '0']]), text: async () => 'limit' }; };
  const llm = { baseUrl: 'https://x/v1', model: 'm', apiKey: 'k' };
  await assert.rejects(extractWithLLM('12 uber', config, llm, fakeFetch), /API 429/);
  assert.equal(n, 5);
});
