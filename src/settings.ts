export type Action = 'up' | 'down' | 'left' | 'right' | 'jump' | 'dash' | 'interact' | 'pulse' | 'pause';
export const ACTIONS: { id: Action; label: string }[] = [
  { id: 'up', label: 'Đi lên' }, { id: 'down', label: 'Đi xuống' }, { id: 'left', label: 'Sang trái' }, { id: 'right', label: 'Sang phải' },
  { id: 'jump', label: 'Nhảy' }, { id: 'dash', label: 'Lướt' }, { id: 'interact', label: 'Tương tác (thắp / châm dầu)' },
  { id: 'pulse', label: 'Tỏa Sáng' }, { id: 'pause', label: 'Tạm dừng' },
];
/** Two slots per action; '' means unbound. */
export type Keymap = Record<Action, [string, string]>;
export const DEFAULT_KEYS: Keymap = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  jump: ['Space', ''], dash: ['ShiftLeft', ''], interact: ['KeyE', ''], pulse: ['KeyQ', ''], pause: ['Escape', 'KeyP'],
};
export type Settings = { volume: number; sensitivity: number; colorblind: boolean; reduceMotion: boolean; largeText: boolean; keys: Keymap };

const KEY = 'dao-settings';
const cloneKeys = (k: Keymap): Keymap => JSON.parse(JSON.stringify(k));
export function defaultSettings(): Settings {
  let reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* no matchMedia */ }
  return { volume: 0.5, sensitivity: 1, colorblind: false, reduceMotion: reduce, largeText: false, keys: cloneKeys(DEFAULT_KEYS) };
}

export function loadSettings(): Settings {
  const d = defaultSettings();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || typeof raw !== 'object') return d;
    const keys = cloneKeys(DEFAULT_KEYS);
    for (const a of ACTIONS) {
      const v = raw.keys?.[a.id];
      if (Array.isArray(v) && v.length === 2 && v.every((x: unknown) => typeof x === 'string')) keys[a.id] = [v[0], v[1]];
    }
    return {
      volume: typeof raw.volume === 'number' ? raw.volume : d.volume,
      sensitivity: typeof raw.sensitivity === 'number' ? raw.sensitivity : d.sensitivity,
      colorblind: !!raw.colorblind,
      reduceMotion: typeof raw.reduceMotion === 'boolean' ? raw.reduceMotion : d.reduceMotion,
      largeText: !!raw.largeText,
      keys,
    };
  } catch { return d; }
}
export function saveSettings(s: Settings) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } }

/** Which other action already uses `code`? (the slot being edited is ignored) */
export function findConflict(keys: Keymap, action: Action, slot: 0 | 1, code: string): Action | null {
  for (const a of ACTIONS) for (const s of [0, 1] as const) {
    if (a.id === action && s === slot) continue;
    if (keys[a.id][s] === code) return a.id;
  }
  return null;
}

const LABELS: Record<string, string> = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ShiftLeft: 'Shift trái', ShiftRight: 'Shift phải', Escape: 'Esc', Space: 'Space', ControlLeft: 'Ctrl trái', ControlRight: 'Ctrl phải', Enter: 'Enter', Tab: 'Tab' };
export function keyLabel(code: string): string {
  if (!code) return '—';
  return LABELS[code] ?? code.replace(/^Key/, '').replace(/^Digit/, '');
}
export const isPressed = (keys: Keymap, held: Set<string>, a: Action) => keys[a].some(c => c && held.has(c));
