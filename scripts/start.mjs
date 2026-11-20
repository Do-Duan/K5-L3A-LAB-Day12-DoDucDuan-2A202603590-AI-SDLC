// Serves the built game (dist/) plus the leaderboard API: `npm run build && npm start`.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from './server.mjs';
import { parseArgs, intArg } from './args.mjs';
import { exportLeaderboard } from './leaderboard.mjs';

const args = parseArgs();
if (typeof args['export-leaderboard'] === 'string') { exportLeaderboard(args['export-leaderboard']); process.exit(0); }
const here = dirname(fileURLToPath(import.meta.url));
const root = [join(here, '..', 'dist'), join(here, '..', 'web')].find(p => existsSync(join(p, 'index.html')));
if (!root) { console.error('No build found. Run `npm run build` first.'); process.exit(1); }
const port = intArg(args, 'port', 4173);
await startStaticServer({ root, port });
console.log(`Đảo Đèn Lồng: http://127.0.0.1:${port}/`);
