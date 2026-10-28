// The standard spreadsheet: Config (categories), MODELO (hidden month tab the bot copies) and Log.
// Pure data: setup.js sends these to the Sheets API.

export const CONFIG_SHEET = 'Config';
export const LOG_SHEET = 'Log';
export const MODEL_SHEET = 'MODELO';

// 'Quem' is last so the ID stays in column H for rows written before it existed
export const LOG_HEADER = ['Data', 'Valor', 'Tipo', 'Categoria', 'Pagamento', 'Observação', 'Mensagem', 'ID', 'Quem'];
export const LOG_ID_COL = 'H';

// Config tab: A = TIPO, B = keywords, D = PAGAMENTO, E = keywords, G = help text
const TIPOS = [
  ['TRANSPORTE', 'uber, 99, ônibus, metrô, trem, gasolina, combustível, posto, estacionamento, pedágio'],
  ['ALIMENTAÇÃO', 'almoço, janta, jantar, lanche, café, restaurante, ifood, padaria, pizza, mercado, supermercado, feira'],
  ['INVESTIMENTOS', 'investimento, poupança, cdb, tesouro, caixinha'],
  ['ASSINATURA', 'assinaturas, spotify, netflix, youtube, prime, icloud'],
  ['COMPRAS', 'compra, shopee, amazon, mercado livre, roupa, presente'],
  ['OUTROS', ''],
];
const PAGAMENTOS = [
  ['CRÉDITO', 'cartão, cartão de crédito'],
  ['DÉBITO', 'cartão de débito'],
  ['DINHEIRO', 'espécie'],
  ['PIX', ''],
];
export const CONFIG_HELP = [
  'Como o bot usa esta aba (ele relê a cada mensagem):',
  '• A IA escolhe o TIPO (coluna A) e o PAGAMENTO (coluna D) só entre os nomes destas listas; as palavras-chave são dicas.',
  '• Se a mensagem não disser o que foi comprado ou como pagou, o campo fica vazio (compra parcelada sem pagamento vai como CRÉDITO).',
  '• Comprou algo que não cabe em nenhum tipo: OUTROS.',
  '• Sem IA (ou se ela falhar), vale o formato fixo "-valor tipo pagamento observação" e as palavras-chave decidem.',
  '• Pode adicionar, renomear ou apagar linhas. Palavras-chave separadas por vírgula.',
  '• O resumo do mês mostra até 15 tipos e 8 pagamentos.',
];

export function configValues() {
  const rows = Math.max(TIPOS.length, PAGAMENTOS.length);
  const body = Array.from({ length: rows }, (_, i) => [...(TIPOS[i] ?? ['', '']), '', ...(PAGAMENTOS[i] ?? ['', ''])]);
  return [
    { range: `${CONFIG_SHEET}!A1:E${rows + 1}`, values: [['TIPO', 'PALAVRAS-CHAVE', '', 'PAGAMENTO', 'PALAVRAS-CHAVE'], ...body] },
    { range: `${CONFIG_SHEET}!G1:G${CONFIG_HELP.length}`, values: CONFIG_HELP.map((h) => [h]) },
  ];
}

export const logValues = () => [{ range: `${LOG_SHEET}!A1`, values: [LOG_HEADER] }];

// Summary cards on the month tab: label in I:J, value in K:L, two rows tall
const CARDS = { gastos: 9, ganhos: 12, saldoMes: 15, anterior: 18, atual: 21 };
// SALDO ANTERIOR (filled by the bot with the previous month's SALDO ATUAL) and SALDO ATUAL
export const PREV_BALANCE_CELL = `K${CARDS.anterior}`;
export const BALANCE_CELL = `K${CARDS.atual}`;
// Summary blocks (column J = name, K = total): rows where the TIPO / PAGAMENTO lists spill
const TIPO_ROWS = [26, 40];
const PAG_ROWS = [45, 52];
// Rows of the SAÍDAS / ENTRADAS tables that get borders, colors and dropdowns (the bot can write past it)
const LAST_ROW = 200;

// Month tab. Formulas use ';' because setup sets the spreadsheet locale to pt_BR.
export function modelValues() {
  const m = MODEL_SHEET;
  const sumBy = (rows, col) => `=ARRAYFORMULA(IF(J${rows[0]}:J${rows[1]}="";"";SUMIF(${col}4:${col};J${rows[0]}:J${rows[1]};Q4:Q)))`;
  return [
    { range: `${m}!B2`, values: [['CONTROLE DE FINANÇAS']] },
    { range: `${m}!P2`, values: [['SAÍDAS']] },
    { range: `${m}!P3:T3`, values: [['DATA', 'VALOR', 'PAGAMENTO', 'TIPO', 'OBSERVAÇÕES']] },
    { range: `${m}!V2`, values: [['ENTRADAS']] },
    { range: `${m}!V3:X3`, values: [['DATA', 'VALOR', 'OBSERVAÇÃO']] },
    { range: `${m}!I${CARDS.gastos}`, values: [['GASTOS TOTAIS:']] },
    { range: `${m}!K${CARDS.gastos}`, values: [['=SUM(Q4:Q)']] },
    { range: `${m}!I${CARDS.ganhos}`, values: [['GANHOS TOTAIS:']] },
    { range: `${m}!K${CARDS.ganhos}`, values: [['=SUM(W4:W)']] },
    { range: `${m}!I${CARDS.saldoMes}`, values: [['SALDO DO MÊS:']] },
    { range: `${m}!K${CARDS.saldoMes}`, values: [[`=K${CARDS.ganhos}-K${CARDS.gastos}`]] },
    { range: `${m}!I${CARDS.anterior}`, values: [['SALDO ANTERIOR:']] },
    { range: `${m}!I${CARDS.atual}`, values: [['SALDO ATUAL:']] },
    { range: `${m}!K${CARDS.atual}`, values: [[`=${PREV_BALANCE_CELL}+K${CARDS.saldoMes}`]] },
    { range: `${m}!J${TIPO_ROWS[0] - 2}`, values: [['TOTAL POR TIPO']] },
    { range: `${m}!J${TIPO_ROWS[0] - 1}:K${TIPO_ROWS[0] - 1}`, values: [['TIPO', 'TOTAL']] },
    { range: `${m}!J${TIPO_ROWS[0]}`, values: [[`=FILTER(${CONFIG_SHEET}!A2:A;${CONFIG_SHEET}!A2:A<>"")`]] },
    { range: `${m}!K${TIPO_ROWS[0]}`, values: [[sumBy(TIPO_ROWS, 'S')]] },
    { range: `${m}!J${PAG_ROWS[0] - 2}`, values: [['TOTAL POR PAGAMENTO']] },
    { range: `${m}!J${PAG_ROWS[0] - 1}:K${PAG_ROWS[0] - 1}`, values: [['PAGAMENTO', 'TOTAL']] },
    { range: `${m}!J${PAG_ROWS[0]}`, values: [[`=FILTER(${CONFIG_SHEET}!D2:D;${CONFIG_SHEET}!D2:D<>"")`]] },
    { range: `${m}!K${PAG_ROWS[0]}`, values: [[sumBy(PAG_ROWS, 'R')]] },
  ];
}

// ---- Formatting (copied from the FINANÇAS sheet) ----

const hex = (h) => ({ red: parseInt(h.slice(1, 3), 16) / 255, green: parseInt(h.slice(3, 5), 16) / 255, blue: parseInt(h.slice(5, 7), 16) / 255 });
const GRAY = hex('#BDBDBD');
const LIGHT = hex('#D9D9D9');
const BLACK = {};
const RED = hex('#E06666');
const GREEN = hex('#93C47D');
const AMBER = hex('#FBBC04');
const LIGHT_GREEN = hex('#B6D7A8');
const DATE = { type: 'DATE', pattern: 'dd"-"mmm' };
const MONEY = { type: 'CURRENCY', pattern: '[$R$ -416]#,##0.00' };

// Google Sheets dropdown-chip colors [background, text]. The color of a TIPO / PAGAMENTO comes from its row
// in the Config tab, so renaming or adding categories keeps the colors without touching the month tabs.
const CHIP = {
  blue: ['#BFE1F6', '#0A53A8'], yellow: ['#FFE5A0', '#473821'], green: ['#D4EDBC', '#11734B'],
  gray: ['#E8EAED', '#3C4043'], purple: ['#E6CFF2', '#5A3286'], orange: ['#FFC8AA', '#753800'],
  teal: ['#C6DBE1', '#215A6C'], red: ['#FFCFC9', '#B10202'],
};
// Defaults match FINANÇAS: TRANSPORTE blue, ALIMENTAÇÃO yellow, INVESTIMENTOS green, ASSINATURA gray, COMPRAS purple;
// CRÉDITO red, DÉBITO yellow, DINHEIRO green, PIX blue
const TIPO_COLORS = ['blue', 'yellow', 'green', 'gray', 'purple', 'orange', 'teal', 'red'];
const PAG_COLORS = ['red', 'yellow', 'green', 'blue', 'purple', 'teal', 'orange', 'gray'];
const chip = (palette, i) => CHIP[palette[i % palette.length]];

// 'P4:T200' -> GridRange
function grid(sheetId, a1) {
  const ref = (s) => {
    const [, letters, digits] = s.match(/^([A-Z]+)(\d+)$/);
    const col = [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
    return { col, row: +digits - 1 };
  };
  const [a, b = a] = a1.split(':').map(ref);
  return { sheetId, startRowIndex: a.row, endRowIndex: b.row + 1, startColumnIndex: a.col, endColumnIndex: b.col + 1 };
}

const text = (fontFamily, fontSize, bold = false) => ({ textFormat: { fontFamily, fontSize, bold } });
const line = (style, color = BLACK) => ({ style, colorStyle: { rgbColor: color } });
const box = (color = BLACK) => ({ borders: Object.fromEntries(['top', 'bottom', 'left', 'right'].map((k) => [k, line('SOLID_MEDIUM', color)])) });
// Table body: thick black lines between columns, thin gray lines between rows
const rows = { borders: { left: line('SOLID_MEDIUM'), right: line('SOLID_MEDIUM'), top: line('SOLID', LIGHT), bottom: line('SOLID', LIGHT) } };

function format(sheetId, a1, cellFormat) {
  return {
    repeatCell: {
      range: grid(sheetId, a1),
      cell: { userEnteredFormat: cellFormat },
      fields: `userEnteredFormat(${Object.keys(cellFormat).join(',')})`,
    },
  };
}
const merge = (sheetId, a1) => ({ mergeCells: { range: grid(sheetId, a1), mergeType: 'MERGE_ALL' } });
const width = (sheetId, col, pixelSize) => ({
  updateDimensionProperties: {
    range: { sheetId, dimension: 'COLUMNS', startIndex: col, endIndex: col + 1 },
    properties: { pixelSize }, fields: 'pixelSize',
  },
});
const dropdown = (sheetId, a1, source) => ({
  setDataValidation: {
    range: grid(sheetId, a1),
    rule: { condition: { type: 'ONE_OF_RANGE', values: [{ userEnteredValue: source }] }, showCustomUi: true, strict: false },
  },
});
// Colors the cells of `a1` whose text equals Config!<configCol><row> with that row's chip color
const chipRule = (sheetId, a1, configCol, configRow, [bg, fg]) => {
  const first = a1.split(':')[0];
  return {
    addConditionalFormatRule: {
      index: 0,
      rule: {
        ranges: [grid(sheetId, a1)],
        booleanRule: {
          condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: `=AND(${first}<>"";${first}=INDIRECT("${CONFIG_SHEET}!${configCol}${configRow}"))` }] },
          format: { backgroundColor: hex(bg), textFormat: { foregroundColor: hex(fg) } },
        },
      },
    },
  };
};
const pie = (sheetId, title, rowsRange, anchorRow, offsetY) => ({
  addChart: {
    chart: {
      spec: {
        title, fontName: 'Roboto', hiddenDimensionStrategy: 'SKIP_HIDDEN_ROWS_AND_COLUMNS',
        pieChart: {
          legendPosition: 'RIGHT_LEGEND', pieHole: 0.5,
          domain: { sourceRange: { sources: [grid(sheetId, `J${rowsRange[0]}:J${rowsRange[1]}`)] } },
          series: { sourceRange: { sources: [grid(sheetId, `K${rowsRange[0]}:K${rowsRange[1]}`)] } },
        },
      },
      position: {
        overlayPosition: {
          anchorCell: { sheetId, rowIndex: anchorRow, columnIndex: 0 },
          offsetXPixels: 100, offsetYPixels: offsetY, widthPixels: 600, heightPixels: 371,
        },
      },
    },
  },
});

export function modelFormatRequests(id) {
  const section = (from, to) => [
    merge(id, `${from}2:${to}2`),
    format(id, `${from}2:${to}2`, { backgroundColor: GRAY, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE', ...text('Bebas Neue', 28), ...box() }),
    format(id, `${from}3:${to}3`, { horizontalAlignment: 'CENTER', ...text('Noto Sans', 12), ...box() }),
    format(id, `${from}4:${to}${LAST_ROW}`, rows),
  ];
  const column = (col, cellFormat) => format(id, `${col}4:${col}${LAST_ROW}`, cellFormat);
  const card = (row, color) => [`I${row}:J${row + 1}`, `K${row}:L${row + 1}`].flatMap((a1) => [
    merge(id, a1),
    format(id, a1, { backgroundColor: color, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE', numberFormat: MONEY, ...text('Bebas Neue', 24), ...box(color) }),
  ]);
  const summary = (titleRow, [first, last]) => [
    merge(id, `J${titleRow}:K${titleRow}`),
    format(id, `J${titleRow}:K${titleRow}`, { backgroundColor: GRAY, horizontalAlignment: 'CENTER', ...text('Noto Sans', 12), ...box() }),
    format(id, `J${titleRow + 1}:K${titleRow + 1}`, { horizontalAlignment: 'CENTER', ...text('Noto Sans', 12), ...box() }),
    format(id, `J${first}:K${last}`, rows),
    format(id, `J${last}:K${last}`, { borders: { ...rows.borders, bottom: line('SOLID_MEDIUM') } }),
    format(id, `J${first}:J${last}`, { horizontalAlignment: 'LEFT', ...text('Arial', 12) }),
    format(id, `K${first}:K${last}`, { horizontalAlignment: 'CENTER', numberFormat: MONEY, ...text('Arial', 12, true) }),
  ];
  const widths = { H: 79, I: 100, J: 140, K: 100, L: 100, P: 100, Q: 109, R: 134, S: 183, T: 195, U: 100, V: 136, W: 100, X: 237 };
  const tipoChips = Array.from({ length: TIPO_ROWS[1] - TIPO_ROWS[0] + 1 }, (_, i) => chip(TIPO_COLORS, i));
  const pagChips = Array.from({ length: PAG_ROWS[1] - PAG_ROWS[0] + 1 }, (_, i) => chip(PAG_COLORS, i));

  return [
    { updateSheetProperties: { properties: { sheetId: id, hidden: true, gridProperties: { hideGridlines: true } }, fields: 'hidden,gridProperties.hideGridlines' } },
    ...Object.entries(widths).map(([c, px]) => width(id, c.charCodeAt(0) - 65, px)),
    merge(id, 'B2:L2'),
    format(id, 'B2:L2', { backgroundColor: GRAY, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE', ...text('Bebas Neue', 24) }),
    ...section('P', 'T'),
    column('P', { horizontalAlignment: 'CENTER', numberFormat: DATE, ...text('Noto Sans', 12) }),
    column('Q', { horizontalAlignment: 'CENTER', numberFormat: MONEY, ...text('Arial', 12, true) }),
    column('R', { horizontalAlignment: 'CENTER', ...text('Arial', 12, true) }),
    column('S', { horizontalAlignment: 'LEFT', ...text('Arial', 12) }),
    column('T', { horizontalAlignment: 'LEFT', ...text('Arial', 12) }),
    ...section('V', 'X'),
    column('V', { horizontalAlignment: 'CENTER', numberFormat: DATE, ...text('Noto Sans', 10) }),
    column('W', { horizontalAlignment: 'CENTER', numberFormat: MONEY, ...text('Arial', 10) }),
    column('X', { horizontalAlignment: 'LEFT', ...text('Arial', 10) }),
    ...card(CARDS.gastos, RED),
    ...card(CARDS.ganhos, GREEN),
    ...card(CARDS.saldoMes, LIGHT_GREEN),
    ...card(CARDS.anterior, LIGHT),
    ...card(CARDS.atual, AMBER),
    ...summary(TIPO_ROWS[0] - 2, TIPO_ROWS),
    ...summary(PAG_ROWS[0] - 2, PAG_ROWS),
    dropdown(id, `R4:R${LAST_ROW}`, `=${CONFIG_SHEET}!$D$2:$D$30`),
    dropdown(id, `S4:S${LAST_ROW}`, `=${CONFIG_SHEET}!$A$2:$A$30`),
    ...tipoChips.flatMap((c, i) => [chipRule(id, `S4:S${LAST_ROW}`, 'A', i + 2, c), chipRule(id, `J${TIPO_ROWS[0]}:J${TIPO_ROWS[1]}`, 'A', i + 2, c)]),
    ...pagChips.flatMap((c, i) => [chipRule(id, `R4:R${LAST_ROW}`, 'D', i + 2, c), chipRule(id, `J${PAG_ROWS[0]}:J${PAG_ROWS[1]}`, 'D', i + 2, c)]),
    pie(id, 'GASTOS POR TIPO', TIPO_ROWS, 2, 16),
    pie(id, 'GASTOS POR PAGAMENTO', PAG_ROWS, 22, 19),
  ];
}

// Formatting only (no values), so it can be reapplied to an existing Config tab
export function configFormatRequests(id) {
  const n = (r) => r[1] - r[0] + 1;
  const colored = (col, palette, count) => Array.from({ length: count }, (_, i) => {
    const [bg, fg] = chip(palette, i);
    return format(id, `${col}${i + 2}`, { backgroundColor: hex(bg), textFormat: { foregroundColor: hex(fg), bold: true } });
  });
  return [
    { updateSheetProperties: { properties: { sheetId: id, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
    ...[[0, 150], [1, 420], [2, 30], [3, 130], [4, 300], [5, 30]].map(([c, px]) => width(id, c, px)),
    format(id, 'A1:E1', { backgroundColor: GRAY, horizontalAlignment: 'CENTER', ...text('Noto Sans', 11, true), borders: { bottom: line('SOLID_MEDIUM') } }),
    format(id, 'C1', { backgroundColor: hex('#FFFFFF'), borders: {} }),
    ...colored('A', TIPO_COLORS, n(TIPO_ROWS)),
    ...colored('D', PAG_COLORS, n(PAG_ROWS)),
    format(id, 'G1', text('Noto Sans', 10, true)),
  ];
}

export function logFormatRequests(id) {
  return [
    { updateSheetProperties: { properties: { sheetId: id, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
    format(id, 'A1:I1', { backgroundColor: GRAY, ...text('Noto Sans', 10, true) }),
  ];
}
