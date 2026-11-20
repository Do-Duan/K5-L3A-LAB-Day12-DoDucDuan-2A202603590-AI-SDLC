// Builds release/dao-den-long-v<version>-web.zip: static web build + tiny Node server (leaderboard on disk).
// Usage: npm run package   (runs after `npm run build`)
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
if (!existsSync(join(root, 'dist', 'index.html'))) { console.error('Run `npm run build` first.'); process.exit(1); }
const name = `dao-den-long-v${version}-web`;
const stage = join(root, 'release', name);
rmSync(join(root, 'release'), { recursive: true, force: true });
mkdirSync(join(stage, 'scripts'), { recursive: true });
cpSync(join(root, 'dist'), join(stage, 'web'), { recursive: true });
for (const f of ['start.mjs', 'server.mjs', 'leaderboard.mjs', 'leaderboard-core.mjs', 'args.mjs']) cpSync(join(root, 'scripts', f), join(stage, 'scripts', f));
for (const f of ['LICENSE', 'CREDITS.md', 'CHANGELOG.md']) if (existsSync(join(root, f))) cpSync(join(root, f), join(stage, f));
writeFileSync(join(stage, 'package.json'), JSON.stringify({ name: 'dao-den-long-web', version, type: 'module', scripts: { start: 'node scripts/start.mjs' } }, null, 2) + '\n');
writeFileSync(join(stage, 'HOW-TO-RUN.md'), `# Đảo Đèn Lồng v${version} (web)\n\nYêu cầu: Node.js 20+ và trình duyệt hiện đại (Chrome/Edge/Firefox) có WebGL.\n\n\`\`\`\nnode scripts/start.mjs        # hoặc: npm start\n\`\`\`\n\nMở http://127.0.0.1:4173/ (đổi cổng: \`--port 8080\`). Bảng xếp hạng lưu ở \`data/leaderboard.json\`; xuất ra tệp:\n\n\`\`\`\nnode scripts/start.mjs --export-leaderboard out.json\n\`\`\`\n\nNếu chỉ host thư mục \`web/\` bằng máy chủ tĩnh bất kỳ, game vẫn chạy; bảng xếp hạng sẽ lưu trong trình duyệt (localStorage).\n`);
const zip = join(root, 'release', `${name}.zip`);
const rel = join(root, 'release');
const r = process.platform === 'win32'
  ? spawnSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${name}' -DestinationPath '${name}.zip' -Force`], { cwd: rel, stdio: 'inherit' })
  : spawnSync('zip', ['-r', '-q', `${name}.zip`, name], { cwd: rel, stdio: 'inherit' });
if (r.status !== 0) { console.error('Could not create zip (needs PowerShell or `zip`).'); process.exit(1); }
console.log('created', zip);
