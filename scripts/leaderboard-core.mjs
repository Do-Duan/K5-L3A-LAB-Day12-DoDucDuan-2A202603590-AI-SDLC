// Leaderboard rules (Ticket-04 §3): validation, ranking, top-10. No I/O, so the browser client can import it too.

export const MAX_ENTRIES = 10;
export const NAME_MIN = 3, NAME_MAX = 12;
// Letters of the Latin script (covers Vietnamese diacritics), digits and underscore.
export const NAME_RE = /^[\p{Script=Latin}0-9_]+$/u;

/** ISO 8601 with the local UTC offset, e.g. 2026-11-20T21:04:05+07:00. */
export function isoLocal(d = new Date()) {
  const p = (n, w = 2) => String(Math.abs(n)).padStart(w, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${sign}${p(Math.trunc(off / 60))}:${p(off % 60)}`;
}

/** Returns an error string or null. */
export function validateName(name) {
  if (typeof name !== 'string') return 'Tên phải là chuỗi';
  const n = name.normalize('NFC');
  const len = [...n].length;
  if (len < NAME_MIN || len > NAME_MAX) return `Tên phải dài ${NAME_MIN}–${NAME_MAX} ký tự`;
  if (!NAME_RE.test(n)) return 'Tên chỉ gồm chữ cái, số và dấu gạch dưới';
  return null;
}

/** Validates + normalises one entry. Throws Error(message) on invalid input. */
export function normalizeEntry(raw, now = new Date()) {
  if (!raw || typeof raw !== 'object') throw new Error('Mục không hợp lệ');
  const err = validateName(raw.name);
  if (err) throw new Error(err);
  if (!Number.isInteger(raw.score) || raw.score < 0) throw new Error('score phải là số nguyên ≥ 0');
  if (!Number.isInteger(raw.nights_won) || raw.nights_won < 0 || raw.nights_won > 3) throw new Error('nights_won phải từ 0 đến 3');
  if (!Number.isInteger(raw.seed)) throw new Error('seed phải là số nguyên');
  const achieved_at = typeof raw.achieved_at === 'string' && !Number.isNaN(Date.parse(raw.achieved_at)) && /(Z|[+-]\d\d:\d\d)$/.test(raw.achieved_at)
    ? raw.achieved_at : isoLocal(now);
  return { name: raw.name.normalize('NFC'), score: raw.score, nights_won: raw.nights_won, achieved_at, seed: raw.seed };
}

/** Sort by score desc, then earlier achieved_at first, then original order (stable). Keeps the top 10. */
export function rank(entries) {
  return entries
    .map((e, i) => ({ e, i, t: Date.parse(e.achieved_at) }))
    .sort((a, b) => b.e.score - a.e.score || a.t - b.t || a.i - b.i)
    .slice(0, MAX_ENTRIES)
    .map(x => x.e);
}

export function addEntry(entries, raw, now = new Date()) {
  // New entries go last so that an exact tie in score AND time keeps the earlier insertion on top.
  return rank([...entries, normalizeEntry(raw, now)]);
}

