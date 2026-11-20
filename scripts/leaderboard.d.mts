export * from './leaderboard-core.mjs';
import type { LeaderboardEntry } from './leaderboard-core.mjs';
export function defaultFile(): string;
export function loadEntries(file?: string): LeaderboardEntry[];
export function saveEntries(entries: LeaderboardEntry[], file?: string): void;
export function submit(raw: unknown, file?: string): LeaderboardEntry[];
export function exportLeaderboard(out: string, file?: string): void;
