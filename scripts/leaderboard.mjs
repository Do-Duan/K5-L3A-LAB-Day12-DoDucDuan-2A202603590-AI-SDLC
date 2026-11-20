// Leaderboard disk persistence (Ticket-04 §3). Rules live in leaderboard-core.mjs.
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeEntry, rank, addEntry } from './leaderboard-core.mjs';
export * from './leaderboard-core.mjs';

export function defaultFile() {
  return process.env.LEADERBOARD_FILE || join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'leaderboard.json');
}

export function loadEntries(file = defaultFile()) {
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    const list = Array.isArray(data) ? data : data.entries;
    const ok = [];
    for (const e of Array.isArray(list) ? list : []) { try { ok.push(normalizeEntry(e)); } catch { /* skip corrupt row */ } }
    return rank(ok);
  } catch { return []; }
}

export function saveEntries(entries, file = defaultFile()) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify({ entries }, null, 2) + '\n');
  renameSync(tmp, file); // atomic replace: a crash never leaves a half-written file
}

export function submit(raw, file = defaultFile()) {
  const next = addEntry(loadEntries(file), raw);
  saveEntries(next, file);
  return next;
}

export function exportLeaderboard(out, file = defaultFile()) {
  writeFileSync(out, JSON.stringify({ entries: loadEntries(file) }, null, 2) + '\n');
}

