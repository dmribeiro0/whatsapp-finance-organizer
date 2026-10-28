// Runs the LLM on sample messages and compares with the expected fields: npm run eval
// Uses LLM from config.js and the Config tab that `npm run setup` creates. Each message is one API call.
import { LLM } from '../config.js';
import { parseConfig } from '../src/parser.js';
import { extractWithLLM } from '../src/llm.js';
import { configValues } from '../src/template.js';

const config = parseConfig(configValues()[0].values.slice(1));

// [message, expected] — expected null = not a transaction; a field left undefined isn't checked;
// an array means any of those values is right
const S = (amount, tipo, pagamento) => ({ type: 'saidas', amount, tipo, pagamento });
const E = (amount) => ({ type: 'entradas', amount });
const CASES = [
  ['-25 alimentação pix tauste', S(25, 'ALIMENTAÇÃO', 'PIX')],
  ['gastei 32,90 no ifood', S(32.9, 'ALIMENTAÇÃO', '')],
  ['uber 18,50 cartão', S(18.5, 'TRANSPORTE', 'CRÉDITO')],
  ['paguei 120 de luz no débito', S(120, 'OUTROS', 'DÉBITO')],
  ['50 conto', S(50, '', '')],
  ['recebi 1201 do salário', E(1201)],
  ['+40 carona', E(40)],
  ['amanhã eu te pago', null],
  ['spotify 21,90', S(21.9, 'ASSINATURA', '')],
  ['comprei um tênis na shopee por 149,90 no crédito', S(149.9, 'COMPRAS', 'CRÉDITO')],
  ['mercado 230,45 pix', S(230.45, 'ALIMENTAÇÃO', 'PIX')],
  ['coloquei 200 na caixinha', S(200, 'INVESTIMENTOS')],
  ['gasolina 150 débito', S(150, 'TRANSPORTE', 'DÉBITO')],
  ['a Ana me mandou um pix de 35 pela pizza', E(35)],
  ['paguei 15 em dinheiro no lanche', S(15, 'ALIMENTAÇÃO', 'DINHEIRO')],
  ['-1.234,56 aluguel', S(1234.56, 'OUTROS', '')],
  ['quanto eu gastei esse mês?', null],
  ['R$ 9,90 netflix cartão de débito', S(9.9, 'ASSINATURA', 'DÉBITO')],
  ['vendi o fone por 80', E(80)],
  ['almoço com a galera 42', S(42, 'ALIMENTAÇÃO', '')],
  ['presente da mãe 60 pix', S(60, 'COMPRAS', 'PIX')],
  ['reembolso do trabalho 300', E(300)],
  ['2 cafés por 12', S(12, 'ALIMENTAÇÃO', '')],
  ['ônibus 4,40', S(4.4, 'TRANSPORTE', '')],
  ['-80 lanche do culto jovem', S(80, 'ALIMENTAÇÃO', '')],
  ['farmácia 37,80 no crédito', S(37.8, ['OUTROS', 'COMPRAS'], 'CRÉDITO')],
  // Installments: amount is always the total
  ['tênis 300 em 3x no crédito', { ...S(300, 'COMPRAS', 'CRÉDITO'), parcelas: 3 }],
  ['celular 12x de 150', { ...S(1800, 'COMPRAS', 'CRÉDITO'), parcelas: 12 }],
  ['comprei um fone de 89,90 em 2x', { ...S(89.9, 'COMPRAS', 'CRÉDITO'), parcelas: 2 }],
  ['gastei 200 em 4 vezes na arezzo', { ...S(200, 'COMPRAS', 'CRÉDITO'), parcelas: 4 }],
  ['geladeira 2.400 parcelada em 10 vezes no cartão', { ...S(2400, undefined, 'CRÉDITO'), parcelas: 10 }],
  ['parcela 3/10 do celular 150', { ...S(150), parcelas: 1 }],
  // Numbers that aren't amounts
  ['me liga no 11 98765-4321', null],
  ['meu pix é 12996759907', null],
  ['culto sábado às 19h30', null],
  ['somos 15 pessoas confirmadas', null],
];

if (!LLM?.apiKey) {
  console.error('Sem LLM.apiKey no config.js');
  process.exit(1);
}
let ok = 0;
const start = Date.now();
for (const [text, expected] of CASES) {
  let got;
  try {
    got = await extractWithLLM(text, config, LLM);
  } catch (err) {
    got = { error: err.message };
  }
  const wrong = expected === null
    ? (got === null ? [] : ['transacao'])
    : got === null || got.error ? ['transacao']
      : Object.entries(expected).filter(([k, v]) => v !== undefined && ![v].flat().includes(got[k])).map(([k]) => k);
  if (!wrong.length) ok++;
  const shown = got && !got.error ? `${got.type} ${got.amount}${got.parcelas > 1 ? ` em ${got.parcelas}x` : ''} ${got.tipo || '-'} ${got.pagamento || '-'} "${got.obs}"` : JSON.stringify(got);
  console.log(`${wrong.length ? '✗' : '✓'} ${text.padEnd(50)} ${shown}${wrong.length ? `   (errado: ${wrong.join(', ')})` : ''}`);
}
console.log(`\n${ok}/${CASES.length} certos com ${LLM.model}, ${((Date.now() - start) / CASES.length / 1000).toFixed(1)} s por mensagem`);
