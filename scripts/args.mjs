// Tiny shared CLI helper: `--key value` pairs and bare `--flag`.
export function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}
export function intArg(args, key, def) {
  if (args[key] === undefined) return def;
  const n = Number(args[key]);
  if (!Number.isFinite(n)) throw new Error(`--${key} must be a number`);
  return n;
}
