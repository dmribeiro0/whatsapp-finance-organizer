import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolved from the project root, so the bot works no matter where it's started from
const ROOT = fileURLToPath(new URL('..', import.meta.url));

export const DATA_DIR = path.join(ROOT, 'data');
export const AUTH_DIR = path.join(DATA_DIR, 'auth');
export const STATE_FILE = path.join(DATA_DIR, 'state.json');
export const SERVICE_ACCOUNT_FILE = path.join(DATA_DIR, 'service-account.json');
