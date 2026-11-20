// run_cmd: `npm run dev` starts the game; `npm run dev -- --export-leaderboard out.json` writes the ranking and exits.
import { parseArgs } from './args.mjs';
import { exportLeaderboard } from './leaderboard.mjs';

const args = parseArgs();
if (args['export-leaderboard'] !== undefined) {
  const out = args['export-leaderboard'];
  if (typeof out !== 'string') { console.error('Usage: --export-leaderboard <out.json>'); process.exit(2); }
  exportLeaderboard(out);
  process.exit(0);
}
const { createServer } = await import('vite');
const server = await createServer();
await server.listen();
server.printUrls();
