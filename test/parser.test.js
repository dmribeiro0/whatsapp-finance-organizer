import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMessage, parseConfig, classify, amountsIn } from '../src/parser.js';
import { configValues } from '../src/template.js';

// The Config tab exactly as `npm run setup` writes it (rows from A2)
const config = parseConfig(configValues()[0].values.slice(1));
const c = (text) => classify(parseMessage(text), config);

test('amount formats', () => {
  assert.deepEqual(parseMessage('-56,80 almoco spoleto'), { type: 'saidas', amount: 56.8, description: 'almoco spoleto' });
  assert.equal(parseMessage('-56.80 Almoço').amount, 56.8);
  assert.equal(parseMessage('-1.234,56 aluguel').amount, 1234.56);
  assert.equal(parseMessage('- R$ 30 gasolina').amount, 30);
  assert.equal(parseMessage('+1201 salário').type, 'entradas');
});

test('not a transaction', () => {
  assert.equal(parseMessage('almoco 20'), null);
  assert.equal(parseMessage('-0 x'), null);
});

test('reads the Config tab', () => {
  assert.equal(config.tipos.length, 6);
  assert.deepEqual(config.pagamentos.map((p) => p.name), ['CRÉDITO', 'DÉBITO', 'DINHEIRO', 'PIX']);
  assert.ok(config.tipos.find((t) => t.name === 'COMPRAS').keys.includes('mercado livre'));
});

test('amounts written in a text', () => {
  assert.deepEqual(amountsIn('2 pizzas por R$50,90.'), [2, 50.9]);
  assert.deepEqual(amountsIn('-1.234,56 aluguel'), [1234.56]);
  assert.deepEqual(amountsIn('sem valor'), []);
});

test('tipo and pagamento by name leave the observation', () => {
  assert.deepEqual(c('-25 alimentação pix tauste'), { tipo: 'ALIMENTAÇÃO', pagamento: 'PIX', obs: 'tauste' });
  assert.deepEqual(c('-25 Tauste ALIMENTACAO credito'), { tipo: 'ALIMENTAÇÃO', pagamento: 'CRÉDITO', obs: 'Tauste' });
});

test('keywords pick the tipo but stay in the observation', () => {
  assert.deepEqual(c('-30 almoço spoleto cartão'), { tipo: 'ALIMENTAÇÃO', pagamento: 'CRÉDITO', obs: 'almoço spoleto' });
  assert.equal(c('-80 pedido mercado livre').tipo, 'COMPRAS');
});

test('the first matching word wins', () => {
  assert.equal(c('-40 uber para o restaurante').tipo, 'TRANSPORTE');
});

test('what is not in the message stays empty', () => {
  assert.deepEqual(c('-1.234,56 aluguel'), { tipo: '', pagamento: '', obs: 'aluguel' });
  assert.deepEqual(c('-10'), { tipo: '', pagamento: '', obs: '' });
});

test('income only has an observation', () => {
  assert.deepEqual(c('+1201 salário de outubro'), { tipo: '', pagamento: '', obs: 'salário de outubro' });
});
