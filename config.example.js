// ---- Copy this file to config.js and edit it to match your setup (config.js is not versioned) ----

// One entry per WhatsApp group: the exact group name and the spreadsheet it writes to.
// The ID comes from the sheet URL: https://docs.google.com/spreadsheets/d/<ID>/edit
// Each spreadsheet must be prepared once with: npm run setup -- <ID>
// Several groups can share a spreadsheet; categories and payment types live in its Config tab.
// By default only messages you send count. Add everyone: true for a shared group (e.g. a team's treasury)
// to read every member's messages; there, messages without a number are treated as conversation and ignored.
export const GROUPS = [
  { group: 'Extrato - Banco', spreadsheetId: 'COLE_O_ID_DA_PLANILHA_AQUI' },
  // { group: 'Extrato - Outro Banco', spreadsheetId: 'OUTRO_ID' },
];

// AI that reads the messages, so any wording works ("gastei 25 no ifood", "-25 alimentação pix").
// Any OpenAI-compatible chat API; the default is Groq's free tier (no card needed).
// Get a key at https://console.groq.com/keys and paste it in apiKey. It's a secret: config.js is not versioned.
// Without a key (or if the API fails), the bot only understands the fixed format "-valor tipo pagamento observação".
export const LLM = {
  baseUrl: 'https://api.groq.com/openai/v1',
  model: 'openai/gpt-oss-20b',
  apiKey: '',
  extra: { reasoning_effort: 'low' }, // extra request fields for this provider/model
};

// Timezone used to decide the date and month of a transaction
export const TIMEZONE = 'America/Sao_Paulo';

// To link with a code instead of the QR: your number with country + area code, digits only
// (e.g. '5521987654321'). Leave empty to use the QR code.
export const PAIRING_PHONE = '';
