/** Campaign = Nights 1→3 played in a row; the leaderboard score is the sum of the Nights won. */
export type Campaign = { seed: number; scores: Record<string, number> };
const KEY = 'dao-campaign';
export function newCampaign(seed = Math.floor(Math.random() * 90000) + 10000): Campaign { return { seed, scores: {} }; }
export function loadCampaign(): Campaign | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (c && Number.isInteger(c.seed) && c.scores && typeof c.scores === 'object') return c;
  } catch { /* ignore */ }
  return null;
}
export function saveCampaign(c: Campaign) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* ignore */ } }
export function clearCampaign() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
export const totalScore = (c: Campaign) => Object.values(c.scores).reduce((a, b) => a + b, 0);
export const nightsWon = (c: Campaign) => Object.keys(c.scores).length;
/** Replaying Night N discards the results of Night N and later. */
export function enterNight(c: Campaign, night: number): Campaign {
  const scores: Record<string, number> = {};
  for (const [k, v] of Object.entries(c.scores)) if (Number(k) < night) scores[k] = v;
  return { ...c, scores };
}
