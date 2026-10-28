// WhatsApp connection via Baileys: login (QR or pairing code), reconnects, and
// delivering the text messages of the configured groups.
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from 'baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { PAIRING_PHONE } from '../config.js';
import { AUTH_DIR } from './paths.js';

const textOf = (msg) => msg.message?.conversation ?? msg.message?.extendedTextMessage?.text ?? null;

// Who sent a message: my own name, or the sender's WhatsApp name (or number)
function authorOf(msg, sock) {
  if (msg.key.fromMe) return sock.user?.name ?? 'eu';
  const jid = [msg.key.participantAlt, msg.key.participant].find((j) => j?.endsWith('@s.whatsapp.net')) ?? msg.key.participant ?? '';
  return msg.pushName || jid.split('@')[0];
}

// Calls onMessage({ group, id, text, timestamp, fromMe, author, react }) for every text message in one of
// the groups (by exact name). Calls are sequential: the next one starts only after the previous one resolves.
export function connectWhatsApp(groupNames, onMessage) {
  let sock = null; // replaced on every reconnect
  let groupByJid = new Map(); // jid -> group name
  let groupsFetched;
  const groupsReady = new Promise((resolve) => { groupsFetched = resolve; });
  let pairingRequested = false;
  let queue = Promise.resolve();

  async function start() {
    const { state: auth, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();
    sock = makeWASocket({ auth, version, logger: pino({ level: 'warn' }) });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr && PAIRING_PHONE && !sock.authState.creds.registered) {
        if (!pairingRequested) {
          pairingRequested = true;
          const code = await sock.requestPairingCode(PAIRING_PHONE.replace(/\D/g, ''));
          console.log(`Código de pareamento: ${code.match(/.{1,4}/g).join('-')}`);
          console.log('WhatsApp > Aparelhos conectados > Conectar aparelho > Conectar com número de telefone');
        }
      } else if (qr) {
        console.log('Escaneie com o WhatsApp > Aparelhos conectados > Conectar aparelho:');
        qrcode.generate(qr, { small: true });
      }
      if (connection === 'open') {
        const groups = Object.values(await sock.groupFetchAllParticipating());
        groupByJid = new Map(groups.filter((g) => groupNames.includes(g.subject)).map((g) => [g.id, g.subject]));
        const found = [...groupByJid.values()];
        const missing = groupNames.filter((n) => !found.includes(n));
        if (found.length) console.log(`Conectado. Ouvindo ${found.map((n) => `"${n}"`).join(', ')}`);
        if (missing.length) {
          console.error(`Grupo(s) não encontrado(s): ${missing.map((n) => `"${n}"`).join(', ')}. Grupos: ${groups.map((g) => g.subject).join(', ')}`);
        }
        groupsFetched();
      }
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code === DisconnectReason.loggedOut) {
          console.error('Desconectado do WhatsApp. Apague a pasta data/auth/ e rode de novo para conectar.');
          process.exit(1);
        }
        console.log(`Conexão caiu (${code}), reconectando...`);
        setTimeout(start, 3000);
      }
    });

    sock.ev.on('messages.upsert', ({ messages }) => {
      for (const msg of messages) {
        const text = textOf(msg);
        if (!text || !msg.key.remoteJid?.endsWith('@g.us')) continue;
        // Messages can arrive before the group list is fetched, so wait for it
        queue = queue.then(async () => {
          await groupsReady;
          const jid = msg.key.remoteJid;
          const group = groupByJid.get(jid);
          if (!group) return;
          const react = (emoji) => sock.sendMessage(jid, { react: { text: emoji, key: msg.key } }).catch(() => {});
          await onMessage({
            group, id: msg.key.id, text, timestamp: Number(msg.messageTimestamp),
            fromMe: Boolean(msg.key.fromMe), author: authorOf(msg, sock), react,
          });
        });
      }
    });
  }

  start();
}
