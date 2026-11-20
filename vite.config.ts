import { defineConfig } from 'vite';
import { leaderboardApi } from './scripts/server.mjs';

// Serves /api/leaderboard in both `vite` (dev) and `vite preview`, persisting to data/leaderboard.json.
const api = () => ({
  name: 'leaderboard-api',
  configureServer(s: { middlewares: { use: (fn: unknown) => void } }) { s.middlewares.use(leaderboardApi()); },
  configurePreviewServer(s: { middlewares: { use: (fn: unknown) => void } }) { s.middlewares.use(leaderboardApi()); },
});
export default defineConfig({ plugins: [api()], server: { host: '0.0.0.0' } });
