import { addEntry, rank, isoLocal, type LeaderboardEntry } from '../scripts/leaderboard-core.mjs';
export type { LeaderboardEntry };
export { validateName, isoLocal, NAME_MAX, NAME_MIN } from '../scripts/leaderboard-core.mjs';

const KEY = 'dao-leaderboard';
const readLocal = (): LeaderboardEntry[] => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? rank(v) : []; } catch { return []; } };
const writeLocal = (e: LeaderboardEntry[]) => { try { localStorage.setItem(KEY, JSON.stringify(e)); } catch { /* ignore */ } };

/** The game server stores the ranking on disk (data/leaderboard.json). Without a server we fall back to localStorage. */
export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const r = await fetch('/api/leaderboard', { cache: 'no-store' });
    if (r.ok) { const j = await r.json(); if (Array.isArray(j.entries)) return j.entries; }
  } catch { /* offline / static hosting */ }
  return readLocal();
}

export async function submitScore(entry: Omit<LeaderboardEntry, 'achieved_at'> & { achieved_at: string }): Promise<LeaderboardEntry[]> {
  try {
    const r = await fetch('/api/leaderboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) });
    if (r.ok) return (await r.json()).entries;
    if (r.status === 400) throw new Error((await r.json()).error);
  } catch (e) { if (e instanceof Error && e.message && !/fetch|network|Failed/i.test(e.message)) throw e; }
  const next = addEntry(readLocal(), entry); // validates too
  writeLocal(next);
  return next;
}
