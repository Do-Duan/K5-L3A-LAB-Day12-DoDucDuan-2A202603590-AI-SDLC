import * as THREE from 'three';
import { Simulation } from './sim';
import { benchScenario, benchCamera, benchStats, BENCH } from './bench';
import { ACTIONS, DEFAULT_KEYS, findConflict, isPressed, keyLabel, loadSettings, saveSettings, type Action, type Settings } from './settings';
import { clearCampaign, enterNight, loadCampaign, newCampaign, nightsWon, saveCampaign, totalScore } from './campaign';
import { fetchLeaderboard, submitScore, validateName, isoLocal, NAME_MAX, NAME_MIN } from './leaderboard';
import contract from '../game.contract.json';
import './style.css';

/* ------------------------------------------------------------------ mode & state */
const params = new URLSearchParams(location.search);
const bench = params.has('bench');
const menuMode = !bench && !params.has('night');
const rawNight = Number(params.get('night') ?? '1');
const night = ([1, 2, 3].includes(rawNight) ? rawNight : 1) as 1 | 2 | 3;
const benchSeed = Number(params.get('seed') ?? '42');
const benchDuration = Number(params.get('duration') ?? '30');

let campaign = loadCampaign() ?? newCampaign(12);
if (!menuMode && !bench) { campaign = enterNight(campaign, night); saveCampaign(campaign); }
const seed = bench ? benchSeed : campaign.seed + night;
const sim = new Simulation(seed, bench ? benchScenario(benchSeed) : { mote_spawn: true }, night);
let settings: Settings = loadSettings();

/* ------------------------------------------------------------------ DOM */
const app = document.querySelector<HTMLDivElement>('#app')!;
const NIGHT_NAMES = ['', 'ĐẢO BẾN', 'HAI ĐẢO', 'ĐỈNH CHUÔNG'];
app.innerHTML = `
<div class="hud"><div class="brand">✦ ĐẢO ĐÈN LỒNG</div>
  <div class="stats"><span id="score">✧ 0</span><span id="flames">♥♥♥</span><span id="motes">✦ 0 / 10</span><span id="clock">04:00</span></div>
  <div class="objective" id="objective">GIỮ ĐẢO SÁNG TỚI BÌNH MINH</div>
  <div class="warn" id="warn" aria-live="polite"></div><div class="cues" id="cues" aria-live="polite"></div></div>
<div class="hint" id="hint"></div><div class="flash" id="flash"></div><div id="arrows"></div>
<section class="screen ${menuMode ? '' : 'hidden'}" id="menu"><h1>ĐẢO ĐÈN LỒNG</h1><p>Giữ đảo sáng tới bình minh.</p>
  <button id="m-play">Chơi</button><button id="m-board">Bảng xếp hạng</button><button id="m-settings">Cài đặt</button></section>
<section class="screen ${menuMode || bench ? 'hidden' : ''}" id="intro"><h1>ĐÊM ${night}: ${NIGHT_NAMES[night]}</h1><p>Ông Đăng: Hãy gom đom đóm, thắp và giữ cho đèn luôn sáng.</p><button id="start">Bắt đầu đêm</button></section>
<section class="screen hidden" id="pause"><h1>TẠM DỪNG</h1><button id="resume">Tiếp tục</button><button id="replay">Chơi lại đêm</button><button id="settings-open">Cài đặt</button><button id="home">Về menu</button></section>
<section class="screen hidden" id="settings"><h1>CÀI ĐẶT</h1>
  <div class="settings-grid">
    <label>Âm lượng <input id="volume" type="range" min="0" max="1" step=".05"></label>
    <label>Độ nhạy chuột <input id="sensitivity" type="range" min=".2" max="2" step=".1"></label>
    <label><input id="cb" type="checkbox"> Bảng màu dễ phân biệt</label>
    <label><input id="reduce" type="checkbox"> Giảm chuyển động (tắt rung camera, chớp màn hình)</label>
    <label><input id="large" type="checkbox"> Chữ lớn (×1.25)</label>
  </div>
  <h2>Phím điều khiển</h2><div class="keys" id="keys"></div><div class="key-msg" id="key-msg" aria-live="assertive"></div>
  <div class="row"><button id="keys-reset">Khôi phục mặc định</button><button id="settings-close">Xong</button></div></section>
<section class="screen hidden" id="board"><h1>BẢNG XẾP HẠNG</h1><div id="board-body" class="board"></div><button id="board-close">Đóng</button></section>
<section class="screen hidden" id="end"><h1 id="end-title"></h1><p id="end-sub"></p>
  <form id="name-form" class="hidden" autocomplete="off"><label>Tên (${NAME_MIN}–${NAME_MAX} ký tự: chữ, số, _)<input id="name" maxlength="${NAME_MAX + 4}" spellcheck="false"></label>
    <div class="key-msg" id="name-msg" aria-live="assertive"></div><button type="submit" id="name-save">Lưu điểm</button></form>
  <div class="row" id="end-buttons"></div></section>`;
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const show = (el: Element, on: boolean) => el.classList.toggle('hidden', !on);

/* ------------------------------------------------------------------ three.js scene */
const scene = new THREE.Scene();
scene.background = new THREE.Color('#11172b');
scene.fog = new THREE.FogExp2('#11172b', 0.018);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight('#9bb8ff', '#231b31', 2));
const moon = new THREE.DirectionalLight('#d5ddff', 2.1);
moon.position.set(-12, 25, 8); moon.castShadow = true; scene.add(moon);
scene.add(new THREE.AmbientLight('#ffcb7a', 0.15));
const mat = (color: string, emissive?: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...(emissive ? { emissive, emissiveIntensity: 1.4 } : {}) });

const groundRadius = night === 1 ? 40 : night === 2 ? 28 : 45;
const ground = new THREE.Mesh(new THREE.CircleGeometry(groundRadius, 64), mat('#344653'));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const shore = new THREE.Mesh(new THREE.CircleGeometry(groundRadius + 0.4, 64), mat('#222e43'));
shore.rotation.x = -Math.PI / 2; shore.position.y = -0.08; scene.add(shore);
if (night === 2) {
  const island = new THREE.Mesh(new THREE.CircleGeometry(28, 64), mat('#344653')); island.rotation.x = -Math.PI / 2; island.position.set(70, -0.01, 0); scene.add(island);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.25, 4), mat('#9a7852')); bridge.position.set(35, 0.1, 0); scene.add(bridge);
}
if (night === 3) {
  const terrace = new THREE.Mesh(new THREE.RingGeometry(12, 24, 64), mat('#456259')); terrace.rotation.x = -Math.PI / 2; terrace.position.y = 3; scene.add(terrace);
  const summit = new THREE.Mesh(new THREE.CircleGeometry(8, 48), mat('#597463')); summit.rotation.x = -Math.PI / 2; summit.position.y = 6; scene.add(summit);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 8, 12), mat('#6d596c')); tower.position.set(0, 10, 0); scene.add(tower);
  for (const a of [30, 150]) {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(12, 0.4, 3), mat('#a48b66'));
    ramp.position.set(Math.cos(a * Math.PI / 180) * 27, 1.5, Math.sin(a * Math.PI / 180) * 27); ramp.rotation.y = -a * Math.PI / 180; scene.add(ramp);
  }
}
// Scattered low-poly trees keep the island readable without external assets.
for (let i = 0; i < 48; i++) {
  const a = i * 2.399, r = 8 + (i % 7) * 2.1, tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.2, 7), mat('#493a39')); trunk.position.y = 0.6;
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2, 7), mat(i % 3 ? '#315b54' : '#3b5260')); crown.position.y = 2;
  tree.add(trunk, crown); tree.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); tree.scale.setScalar(0.7 + (i % 4) * 0.12); tree.castShadow = true; scene.add(tree);
}

const player = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.65, 4, 8), mat('#f0c88e')); body.position.y = 0.82; player.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), mat('#f2cfaa')); head.position.y = 1.5; player.add(head);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.56, 0.22, 12), mat('#dba95e')); hat.position.y = 1.75; player.add(hat);
  const lamp = new THREE.PointLight('#ffba53', 2.8, 8); lamp.position.y = 1.2; player.add(lamp);
  const tiny = new THREE.Mesh(new THREE.SphereGeometry(0.12), mat('#ffc66f', '#ffae42')); tiny.position.set(0.45, 1.05, 0); player.add(tiny);
  scene.add(player);
}

// Lanterns: children = [post, glow, light, fuel bar, fuel bar bg, torn paper]
const litMat = mat('#ffc878', '#ffae42'), offMat = mat('#714b70');
const lanternMeshes: THREE.Group[] = [];
for (const l of sim.lanterns) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.23, 2.8, 8), mat('#754b37')); post.position.y = 1.4;
  const glow = new THREE.Mesh(new THREE.OctahedronGeometry(0.58), offMat); glow.position.y = 3.1;
  const pl = new THREE.PointLight('#ffad51', 0, 11); pl.position.y = 3.2;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: '#ffd58c' })); bar.position.y = 4.1;
  const barBg = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.16, 0.1), new THREE.MeshBasicMaterial({ color: '#1a1a22' })); barBg.position.set(0, 4.1, -0.03);
  const tear = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 0.05), new THREE.MeshBasicMaterial({ color: '#0e0b14' })); tear.position.set(0.25, 3.0, 0.5); tear.rotation.z = 0.6;
  g.add(post, glow, pl, bar, barBg, tear);
  g.position.set(l.pos[0], l.pos[1], l.pos[2]); scene.add(g); lanternMeshes.push(g);
}

const moteGeo = new THREE.IcosahedronGeometry(0.18, 1), moteMat = mat('#c5fff1', '#83f5dc');
const moteMeshes: THREE.Mesh[] = [];

// Ink Shades: dark body, coloured rim + eyes (#7A3CFF, or #00B3FF in the colour-blind palette). Geometry/materials are shared.
const shadeBodyGeo = new THREE.SphereGeometry(0.65, 12, 10), shadeRimGeo = new THREE.SphereGeometry(0.72, 12, 10), shadeEyeGeo = new THREE.SphereGeometry(0.09, 8, 6);
const shadeBodyMat = mat('#28213b', '#4c2868');
const shadeRimMat = new THREE.MeshBasicMaterial({ color: '#7A3CFF', side: THREE.BackSide }), shadeEyeMat = new THREE.MeshBasicMaterial({ color: '#7A3CFF' });
const shadeMeshes: THREE.Group[] = [];
function makeShade() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(shadeBodyGeo, shadeBodyMat), new THREE.Mesh(shadeRimGeo, shadeRimMat));
  for (const x of [-0.22, 0.22]) { const e = new THREE.Mesh(shadeEyeGeo, shadeEyeMat); e.position.set(x, 0.15, 0.58); g.add(e); }
  scene.add(g); return g;
}

/* ------------------------------------------------------------------ Tỏa Sáng (pulse) effect */
const PULSE_R = contract.tuning.pulse_radius, PULSE_S = 0.6;
const ringGeo = new THREE.RingGeometry(0.9, 1, 64), glowGeo = new THREE.SphereGeometry(1, 24, 16);
const pulseFx: { ring: THREE.Mesh; glow: THREE.Mesh; light: THREE.PointLight; t: number }[] = [];
function spawnPulse() {
  const base = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } as const;
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffe9a8', side: THREE.DoubleSide, ...base }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(sim.player.pos[0], sim.player.pos[1] + 0.12, sim.player.pos[2]);
  const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: '#ffd27a', ...base }));
  glow.position.set(sim.player.pos[0], sim.player.pos[1] + 1.1, sim.player.pos[2]);
  const light = new THREE.PointLight('#ffe9a8', 10, PULSE_R * 2.2); light.position.copy(glow.position);
  scene.add(ring, glow, light); pulseFx.push({ ring, glow, light, t: 0 });
}
function updatePulse(dt: number) {
  for (let i = pulseFx.length - 1; i >= 0; i--) {
    const f = pulseFx[i]; f.t += dt;
    const k = f.t / PULSE_S;
    if (k >= 1) { scene.remove(f.ring, f.glow, f.light); (f.ring.material as THREE.Material).dispose(); (f.glow.material as THREE.Material).dispose(); pulseFx.splice(i, 1); continue; }
    // "Giảm chuyển động": no expanding wave, just a soft fading glow at full radius.
    const r = settings.reduceMotion ? PULSE_R : PULSE_R * (1 - (1 - k) ** 3);
    f.ring.scale.setScalar(Math.max(0.01, r));
    f.glow.scale.setScalar(settings.reduceMotion ? 1.2 : 0.6 + 1.4 * (1 - k));
    (f.ring.material as THREE.MeshBasicMaterial).opacity = 1 - k;
    (f.glow.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k);
    f.light.intensity = 10 * (1 - k);
  }
}

/* ------------------------------------------------------------------ settings UI */
const held = new Set<string>();
const keysEl = $('#keys'), keyMsg = $('#key-msg');
let capture: { action: Action; slot: 0 | 1 } | null = null;
function hintText() {
  const k = (a: Action) => keyLabel(settings.keys[a][0]);
  return `${k('up')}${k('left')}${k('down')}${k('right')} di chuyển · ${k('jump')} nhảy · ${k('dash')} lướt · ${k('interact')} thắp / châm dầu · ${k('pulse')} tỏa sáng · ${k('pause')} tạm dừng`;
}
function renderKeys() {
  keysEl.textContent = '';
  for (const a of ACTIONS) {
    const row = document.createElement('div'); row.className = 'key-row';
    const label = document.createElement('span'); label.textContent = a.label; row.append(label);
    for (const slot of [0, 1] as const) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'key-btn';
      b.textContent = capture && capture.action === a.id && capture.slot === slot ? 'Nhấn phím…' : keyLabel(settings.keys[a.id][slot]);
      b.setAttribute('aria-label', `${a.label}, ô ${slot + 1}: ${keyLabel(settings.keys[a.id][slot])}. Bấm để đổi phím`);
      b.onclick = () => { capture = { action: a.id, slot }; keyMsg.textContent = 'Nhấn phím mới · Esc: hủy · Backspace: xóa ô phụ'; renderKeys(); };
      row.append(b);
    }
    keysEl.append(row);
  }
}
function applySettings() {
  document.documentElement.style.setProperty('--ui', settings.largeText ? '1.25' : '1');
  document.documentElement.style.setProperty('--warn', settings.colorblind ? '#FFFFFF' : '#FF5A5F');
  const c = settings.colorblind ? '#00B3FF' : '#7A3CFF';
  shadeRimMat.color.set(c); shadeEyeMat.color.set(c);
  $('#hint').textContent = hintText();
}
function persist() { saveSettings(settings); applySettings(); }
function handleCapture(code: string) {
  if (!capture) return;
  const { action, slot } = capture;
  capture = null;
  if (code === 'Escape') keyMsg.textContent = 'Đã hủy.';
  else if (code === 'Backspace' || code === 'Delete') {
    if (settings.keys[action][slot === 0 ? 1 : 0]) { settings.keys[action][slot] = ''; keyMsg.textContent = 'Đã xóa phím.'; persist(); }
    else keyMsg.textContent = '⚠ Mỗi hành động cần ít nhất một phím.';
  } else {
    const clash = findConflict(settings.keys, action, slot, code);
    if (clash) keyMsg.textContent = `⚠ Phím ${keyLabel(code)} đã được dùng cho "${ACTIONS.find(a => a.id === clash)!.label}". Hãy chọn phím khác.`;
    else { settings.keys[action][slot] = code; keyMsg.textContent = `Đã gán ${keyLabel(code)}.`; persist(); }
  }
  renderKeys();
}
const volume = $<HTMLInputElement>('#volume'), sensitivity = $<HTMLInputElement>('#sensitivity');
const cb = $<HTMLInputElement>('#cb'), reduce = $<HTMLInputElement>('#reduce'), large = $<HTMLInputElement>('#large');
volume.value = String(settings.volume); sensitivity.value = String(settings.sensitivity);
cb.checked = settings.colorblind; reduce.checked = settings.reduceMotion; large.checked = settings.largeText;
volume.oninput = () => { settings.volume = Number(volume.value); persist(); };
sensitivity.oninput = () => { settings.sensitivity = Number(sensitivity.value); persist(); };
cb.onchange = () => { settings.colorblind = cb.checked; persist(); };
reduce.onchange = () => { settings.reduceMotion = reduce.checked; persist(); };
large.onchange = () => { settings.largeText = large.checked; persist(); };
$('#keys-reset').onclick = () => { settings.keys = JSON.parse(JSON.stringify(DEFAULT_KEYS)); capture = null; keyMsg.textContent = 'Đã khôi phục phím mặc định.'; persist(); renderKeys(); };
renderKeys(); applySettings();

/* ------------------------------------------------------------------ menus */
let menuOpen = !bench, settingsOpen = false, pauseEdge = false, ended = false;
const intro = $('#intro'), pauseMenu = $('#pause'), settingsEl = $('#settings'), menuEl = $('#menu'), boardEl = $('#board'), endEl = $('#end');
const goMenu = () => { location.href = location.pathname; };
$('#start').onclick = () => { menuOpen = false; show(intro, false); };
$('#resume').onclick = () => { menuOpen = false; pauseEdge = true; show(pauseMenu, false); };
$('#replay').onclick = () => location.reload();
$('#home').onclick = goMenu;
$('#settings-open').onclick = () => { settingsOpen = true; show(settingsEl, true); };
$('#m-settings').onclick = () => { settingsOpen = true; show(settingsEl, true); };
$('#settings-close').onclick = () => { capture = null; renderKeys(); keyMsg.textContent = ''; settingsOpen = false; show(settingsEl, false); };
$('#m-play').onclick = () => { clearCampaign(); saveCampaign(newCampaign()); location.search = '?night=1'; };
async function openBoard() {
  show(boardEl, true);
  const body = $('#board-body'); body.textContent = 'Đang tải…';
  const entries = await fetchLeaderboard();
  body.textContent = '';
  if (!entries.length) { body.textContent = 'Chưa có điểm nào. Hãy là người đầu tiên!'; return; }
  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>#</th><th>Tên</th><th>Điểm</th><th>Đêm thắng</th><th>Thời gian</th></tr></thead>';
  const tb = document.createElement('tbody');
  entries.forEach((e, i) => {
    const tr = document.createElement('tr');
    for (const v of [String(i + 1), e.name, String(e.score), `${e.nights_won}/3`, new Date(e.achieved_at).toLocaleString('vi-VN')]) { const td = document.createElement('td'); td.textContent = v; tr.append(td); }
    tb.append(tr);
  });
  table.append(tb); body.append(table);
}
$('#m-board').onclick = openBoard;
$('#board-close').onclick = () => show(boardEl, false);

/* ------------------------------------------------------------------ input */
const isTextField = (t: EventTarget | null) => t instanceof HTMLInputElement && (t.type === 'text' || t.type === 'search');
function togglePause() {
  if (sim.state === 'paused') { menuOpen = false; show(pauseMenu, false); pauseEdge = true; }
  else if (!menuOpen && !settingsOpen && sim.state === 'playing') pauseEdge = true;
}
addEventListener('keydown', e => {
  if (capture) { e.preventDefault(); handleCapture(e.code); return; }
  if (isTextField(e.target)) return;
  const bound = ACTIONS.some(a => settings.keys[a.id].includes(e.code));
  if (settings.keys.pause.includes(e.code) && !e.repeat && !bench) togglePause();
  held.add(e.code);
  if (bound && !(e.target instanceof HTMLButtonElement && e.code === 'Space')) e.preventDefault();
});
addEventListener('keyup', e => held.delete(e.code));
addEventListener('blur', () => held.clear());

/* ------------------------------------------------------------------ cues (visual indicators / subtitles) */
const cuesEl = $('#cues'), warnEl = $('#warn'), arrowsEl = $('#arrows'), flashEl = $('#flash');
const transient = new Map<string, { text: string; until: number }>();
const spawnArrows = new Map<string, { until: number; el: HTMLElement }>();
let cuesHtml = '';
const addTransient = (key: string, text: string, ms: number) => transient.set(key, { text, until: performance.now() + ms });
let shakeLeft = 0;
function handleEvents() {
  for (const ev of sim.takeEvents()) {
    if (ev.name === 'player_hit') {
      if (!settings.reduceMotion && !bench) { shakeLeft = 0.35; flashEl.style.transition = 'none'; flashEl.style.opacity = '0.35'; requestAnimationFrame(() => { flashEl.style.transition = 'opacity .35s'; flashEl.style.opacity = '0'; }); }
      addTransient('hit', '⚠ Mây bị thương!', 2000);
    } else if (ev.name === 'shade_spawned') {
      const id = String(ev.data.id);
      addTransient(`spawn-${id}`, '⚠ Bóng Mực xuất hiện', 4000);
      const el = document.createElement('div'); el.className = 'arrow'; el.textContent = '➤'; el.setAttribute('aria-hidden', 'true'); arrowsEl.append(el);
      spawnArrows.set(id, { until: performance.now() + 6000, el });
    } else if (ev.name === 'pulse') spawnPulse();
    else if (ev.name === 'lantern_out') addTransient(`out-${ev.data.lantern_id}`, `⚠ Đèn ${ev.data.lantern_id} đã tắt`, 3000);
    else if (ev.name === 'refuel') addTransient('refuel', `✦ Châm dầu đèn ${ev.data.lantern_id}`, 1200);
  }
}
const tmp = new THREE.Vector3();
function updateArrows(now: number) {
  const w = innerWidth, h = innerHeight, m = 48;
  for (const [id, a] of spawnArrows) {
    const s = sim.shades.find(x => x.id === id);
    if (!s || now > a.until) { a.el.remove(); spawnArrows.delete(id); continue; }
    tmp.set(s.pos[0], 0.65, s.pos[2]).project(camera);
    let sx = (tmp.x * 0.5 + 0.5) * w, sy = (-tmp.y * 0.5 + 0.5) * h;
    if (tmp.z > 1) { sx = w - sx; sy = h - sy; } // behind the camera: mirror
    const onScreen = tmp.z <= 1 && sx > m && sx < w - m && sy > m && sy < h - m;
    if (onScreen) { a.el.style.display = 'none'; continue; }
    const cx = w / 2, cy = h / 2, dx = sx - cx, dy = sy - cy;
    const k = Math.min((cx - m) / Math.abs(dx || 1e-6), (cy - m) / Math.abs(dy || 1e-6));
    a.el.style.display = 'block';
    a.el.style.left = `${cx + dx * k}px`; a.el.style.top = `${cy + dy * k}px`;
    a.el.style.transform = `translate(-50%,-50%) rotate(${Math.atan2(dy, dx)}rad)`;
  }
}
function persistentCues(lowFuel: boolean): string[] {
  const out: string[] = [];
  if (sim.state === 'playing' && sim.time <= 10 && !bench) out.push('⏳ 10 giây cuối!');
  if (sim.night === 3 && sim.windEnabled) {
    const c = sim.simTick % 1800;
    if (c >= 30 && c < 120) out.push('🌬 Gió sắp thổi');
    else if (sim.wind.active) out.push('🌬 Gió đang thổi');
  }
  if (lowFuel) out.push('⚠ Đèn sắp hết dầu (<30)');
  return out;
}

/* ------------------------------------------------------------------ end of night, campaign, leaderboard */
const endTitle = $('#end-title'), endSub = $('#end-sub'), endButtons = $('#end-buttons'), nameForm = $('#name-form');
const nameInput = $<HTMLInputElement>('#name'), nameMsg = $('#name-msg');
const mkButton = (text: string, fn: () => void) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.onclick = fn; return b; };
function endNight() {
  ended = true;
  const won = sim.state === 'won';
  if (won) { campaign.scores[String(night)] = sim.score; saveCampaign(campaign); }
  endButtons.textContent = '';
  const total = totalScore(campaign), wonCount = nightsWon(campaign);
  if (won && night < 3) {
    endTitle.textContent = `BÌNH MINH! ĐÊM ${night} ĐÃ QUA`;
    endSub.textContent = `Điểm đêm: ${sim.score} · Tổng: ${total}. Đảo vẫn sáng — hành trình tiếp tục.`;
    show(nameForm, false);
    endButtons.append(mkButton('Đêm tiếp theo', () => { location.search = `?night=${night + 1}`; }));
    return show(endEl, true);
  }
  endTitle.textContent = won ? 'BÌNH MINH!' : 'ĐÊM VẪN TỐI';
  endSub.textContent = (won ? 'Đảo đã được thắp sáng.' : sim.player.flames <= 0 ? 'Mây hết Ngọn Lửa.' : 'Đảo không đủ đèn sáng khi bình minh.') + ` Tổng điểm: ${total} (${wonCount}/3 đêm thắng).`;
  show(nameForm, true);
  if (!won) endButtons.append(mkButton('Chơi lại đêm', () => location.reload()));
  endButtons.append(mkButton('Về menu', goMenu));
  show(endEl, true);
  nameInput.focus();
}
nameForm.addEventListener('submit', async ev => {
  ev.preventDefault();
  const err = validateName(nameInput.value.trim());
  if (err) { nameMsg.textContent = `⚠ ${err}`; return; }
  try {
    await submitScore({ name: nameInput.value.trim(), score: totalScore(campaign), nights_won: nightsWon(campaign), achieved_at: isoLocal(), seed: campaign.seed });
    clearCampaign(); show(nameForm, false); nameMsg.textContent = ''; endSub.textContent = 'Đã lưu điểm!';
    endButtons.textContent = ''; endButtons.append(mkButton('Bảng xếp hạng', openBoard), mkButton('Về menu', goMenu));
    openBoard();
  } catch (e) { nameMsg.textContent = `⚠ ${(e as Error).message}`; }
});
$('#board-close').addEventListener('click', () => { if (ended) nameInput.blur(); });

/* ------------------------------------------------------------------ main loop */
const scoreEl = $('#score'), flamesEl = $('#flames'), motesEl = $('#motes'), clockEl = $('#clock'), objectiveEl = $('#objective');
const clock3 = new THREE.Clock();
let accumulator = 0, elapsed = 0;
// benchmark bookkeeping
let benchStart = -1, measureStart = -1, prevTs = 0, firstEpoch = 0;
const benchDts: number[] = [];
(window as unknown as { __bench: unknown }).__bench = { done: false };
(window as unknown as { __sim: Simulation }).__sim = sim; // debug/e2e hook

function frame(ts: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(clock3.getDelta(), 0.05);
  accumulator += dt; elapsed += dt;
  while (accumulator >= 1 / 60 && ['playing', 'paused'].includes(sim.state) && !menuOpen && !settingsOpen) {
    const k = settings.keys;
    const move: [number, number] = [
      Number(isPressed(k, held, 'right')) - Number(isPressed(k, held, 'left')),
      Number(isPressed(k, held, 'down')) - Number(isPressed(k, held, 'up')),
    ];
    sim.step(bench ? {} : { move, pulse: isPressed(k, held, 'pulse'), interact: isPressed(k, held, 'interact'), dash: isPressed(k, held, 'dash'), jump: isPressed(k, held, 'jump'), pause: pauseEdge });
    pauseEdge = false; accumulator -= 1 / 60;
  }
  if (sim.state === 'paused') { show(pauseMenu, true); menuOpen = true; }
  handleEvents();
  updatePulse(dt);
  player.position.set(sim.player.pos[0], sim.player.pos[1], sim.player.pos[2]);

  const blink = Math.floor(elapsed * 2) % 2 === 0; // 1 Hz
  let weak = false;
  for (let i = 0; i < lanternMeshes.length; i++) {
    const L = sim.lanterns[i], fuel = L.fuelU / 60, lit = L.lit, low = lit && fuel < 30;
    if (low) weak = true;
    const g = lanternMeshes[i], glow = g.children[1] as THREE.Mesh, show1 = !low || blink;
    glow.material = lit ? litMat : offMat;
    (g.children[2] as THREE.PointLight).intensity = lit && show1 ? 1.2 + 2.3 * fuel / 100 : 0;
    glow.visible = show1; glow.scale.y = lit ? 1 : 0.8; // unlit lanterns are squashed 20%
    // Progress bar on every lantern: fuel when lit (gold), deposited motes towards lighting when unlit (cyan).
    const cost = L.ever_lit ? contract.tuning.relight_cost : contract.tuning.lantern_cost;
    const prog = lit ? fuel / 100 : Math.min(1, L.deposited / cost);
    const barOn = lit ? show1 : true;
    g.children[3].visible = barOn; g.children[4].visible = barOn;
    g.children[3].scale.x = Math.max(0.001, prog); g.children[3].position.x = -0.6 * (1 - prog);
    ((g.children[3] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(lit ? '#ffd58c' : '#7fe3ff');
    g.children[5].visible = !lit; // torn paper
  }
  while (moteMeshes.length < sim.motes.length) { const o = new THREE.Mesh(moteGeo, moteMat); scene.add(o); moteMeshes.push(o); }
  for (let i = 0; i < moteMeshes.length; i++) {
    const m = sim.motes[i];
    if (!m) { moteMeshes[i].visible = false; continue; }
    moteMeshes[i].visible = true; moteMeshes[i].position.set(m.pos[0], 0.55 + Math.sin(elapsed * 3 + i) * 0.12, m.pos[2]); moteMeshes[i].rotation.y += dt;
  }
  while (shadeMeshes.length < sim.shades.length) shadeMeshes.push(makeShade());
  for (let i = 0; i < shadeMeshes.length; i++) {
    const s = sim.shades[i];
    if (s) { shadeMeshes[i].visible = true; shadeMeshes[i].position.set(s.pos[0], 0.65 + Math.sin(elapsed * 3 + i) * 0.18, s.pos[2]); } else shadeMeshes[i].visible = false;
  }

  // HUD
  const now = performance.now();
  scoreEl.textContent = `✧ ${sim.score}`;
  flamesEl.textContent = '♥'.repeat(Math.max(0, sim.player.flames)) + '♡'.repeat(Math.max(0, 3 - sim.player.flames));
  motesEl.textContent = `✦ ${sim.player.carried} / ${sim.capacity}`;
  const sec = Math.ceil(sim.time);
  clockEl.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  objectiveEl.textContent = `GIỮ ≥ ${sim.litNeeded()}/${sim.lanterns.length} ĐÈN SÁNG TỚI BÌNH MINH (${sim.litCount()} đang sáng)`;
  warnEl.textContent = weak || sim.player.flames === 1 ? `${settings.colorblind ? '⚠ ' : ''}${weak ? 'ĐÈN SẮP HẾT DẦU' : 'CHỈ CÒN 1 NGỌN LỬA'}` : '';
  const lines = persistentCues(weak);
  for (const [k, v] of transient) { if (now > v.until) transient.delete(k); else lines.push(v.text); }
  const html = lines.slice(0, 5).map(t => `<div class="cue">${t}</div>`).join('');
  if (html !== cuesHtml) { cuesEl.innerHTML = html; cuesHtml = html; }

  // camera
  if (bench) {
    if (benchStart < 0) benchStart = ts;
    const p = benchCamera((ts - benchStart) / 1000);
    camera.position.set(p[0], p[1], p[2]); camera.lookAt(0, 0, 0);
  } else {
    const target = new THREE.Vector3(player.position.x, player.position.y + 8, player.position.z + 12);
    camera.position.lerp(target, 0.08);
    if (shakeLeft > 0 && !settings.reduceMotion) { shakeLeft = Math.max(0, shakeLeft - dt); const a = 0.3 * shakeLeft / 0.35; camera.position.x += (Math.random() - 0.5) * a; camera.position.y += (Math.random() - 0.5) * a; }
    camera.lookAt(player.position.x, player.position.y + 0.5, player.position.z);
  }
  renderer.render(scene, camera);
  updateArrows(now);

  if (bench) benchTick(ts);
  else if (!ended && (sim.state === 'won' || sim.state === 'lost')) endNight();
  prevTs = ts;
}

function benchTick(ts: number) {
  if (firstEpoch === 0) firstEpoch = Date.now(); // first rendered frame of the bench scene
  const t = (ts - benchStart) / 1000;
  const b = (window as unknown as { __bench: Record<string, unknown> }).__bench;
  if (b.done || t < BENCH.warmup_s) return;
  if (measureStart < 0) { measureStart = ts; return; }
  benchDts.push(ts - prevTs);
  if (ts - measureStart >= benchDuration * 1000) {
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    Object.assign(b, benchStats(benchDts), {
      done: true, first_frame_epoch_ms: firstEpoch, three_revision: THREE.REVISION,
      gl_renderer: ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown',
    });
  }
}
requestAnimationFrame(frame);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
