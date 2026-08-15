import {
  FilesetResolver,
  PoseLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm";

const WRIST_L = 15;
const WRIST_R = 16;
const ELBOW_L = 13;
const ELBOW_R = 14;
const NOSE = 0;

/** Corners sized for close-up play (layout is relative to the HUD/footer safe band). */
const ENEMY_FRAME_MS = 90;

const CORNERS = [
  {
    id: "right-top",
    label: "右上",
    x: 0.52,
    y: 0.0,
    w: 0.48,
    h: 0.48,
    emoji: "⚔️",
    name: "Warrior",
    img: "assets/enemy/tiny-swords/Units/Red Units/Warrior/Warrior_Idle.png",
    sheetCols: 8,
    sheetRows: 1,
    attackImg: "assets/enemy/tiny-swords/Units/Red Units/Warrior/Warrior_Attack1.png",
    attackCols: 4,
    attackRows: 1,
  },
  {
    id: "left-top",
    label: "左上",
    x: 0.0,
    y: 0.0,
    w: 0.48,
    h: 0.48,
    emoji: "🏹",
    name: "Archer",
    img: "assets/enemy/tiny-swords/Units/Red Units/Archer/Archer_Idle.png",
    sheetCols: 6,
    sheetRows: 1,
    attackImg: "assets/enemy/tiny-swords/Units/Red Units/Archer/Archer_Shoot.png",
    attackCols: 8,
    attackRows: 1,
  },
  {
    id: "right-bottom",
    label: "右下",
    x: 0.52,
    y: 0.52,
    w: 0.48,
    h: 0.48,
    emoji: "🪓",
    name: "Pawn",
    img: "assets/enemy/tiny-swords/Units/Red Units/Pawn/Pawn_Idle.png",
    sheetCols: 8,
    sheetRows: 1,
    attackImg: "assets/enemy/tiny-swords/Units/Red Units/Pawn/Pawn_Interact Axe.png",
    attackCols: 6,
    attackRows: 1,
  },
  {
    id: "left-bottom",
    label: "左下",
    x: 0.0,
    y: 0.52,
    w: 0.48,
    h: 0.48,
    emoji: "🙏",
    name: "Monk",
    img: "assets/enemy/tiny-swords/Units/Red Units/Monk/Idle.png",
    sheetCols: 6,
    sheetRows: 1,
    attackImg: "assets/enemy/tiny-swords/Units/Red Units/Monk/Heal.png",
    attackCols: 11,
    attackRows: 1,
  },
];

/** @type {Map<string, HTMLImageElement>} */
const enemyImages = new Map();

function loadEnemyImage(key, src) {
  if (!src || enemyImages.has(key)) return;
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  enemyImages.set(key, image);
}

function preloadEnemyImages() {
  for (const corner of CORNERS) {
    loadEnemyImage(corner.id, corner.img);
    loadEnemyImage(`${corner.id}-attack`, corner.attackImg);
  }
  loadEnemyImage("bg-grass", BG_GRASS_TILE);
  for (const b of BG_BUILDINGS) {
    loadEnemyImage(b.key, b.src);
  }
  for (const fx of HIT_FX) {
    loadEnemyImage(fx.key, fx.src);
  }
}

function drawEnemySprite(corner, now, artSize, useAttack) {
  const key = useAttack && corner.attackImg ? `${corner.id}-attack` : corner.id;
  const enemyImg = enemyImages.get(key);
  const cols = useAttack
    ? corner.attackCols || corner.sheetCols || 1
    : corner.sheetCols || 1;
  const rows = useAttack
    ? corner.attackRows || corner.sheetRows || 1
    : corner.sheetRows || 1;

  if (!(enemyImg?.complete && enemyImg.naturalWidth > 0)) {
    ctx.font = `${Math.floor(artSize * 0.85)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(corner.emoji, 0, 0);
    return;
  }

  const fw = enemyImg.naturalWidth / cols;
  const fh = enemyImg.naturalHeight / rows;
  const frameCount = cols * rows;
  let frame;
  if (useAttack) {
    // Play attack once from the start of this hit.
    const attackFrames = cols * rows;
    const attackMs = Math.max(HIT_POP_MS, attackFrames * ENEMY_FRAME_MS);
    const elapsed = Math.max(0, attackMs - (hitImpactUntil - now));
    frame = Math.min(frameCount - 1, Math.floor(elapsed / ENEMY_FRAME_MS));
  } else {
    frame = Math.floor(now / ENEMY_FRAME_MS) % frameCount;
  }
  const col = frame % cols;
  const row = Math.floor(frame / cols);
  ctx.drawImage(
    enemyImg,
    col * fw,
    row * fh,
    fw,
    fh,
    -artSize / 2,
    -artSize / 2,
    artSize,
    artSize
  );
}

const HIT_SPEED = 0.48;
const HEAD_HIT_SPEED = 0.36;
const HEAD_SLIP_SPEED = 0.3;
const HIT_COOLDOWN_MS = 280;
const SMOOTH = 0.45;
const HEAD_SMOOTH = 0.4;
const BASE_HITS = 10;
const HIT_FLASH_MS = 220;
const HIT_SHAKE_MS = 280;
const HIT_POP_MS = 320;

/** Tiny Swords terrain used when camera preview is hidden. */
const BG_GRASS_TILE = "assets/enemy/tiny-swords/bg-grass-tile.png";

/** Decorative buildings on the grass map (normalized anchor = bottom-center). */
const BG_BUILDINGS = [
  {
    key: "bg-castle",
    src: "assets/enemy/tiny-swords/Buildings/Blue Buildings/Castle.png",
    x: 0.5,
    y: 0.42,
    h: 0.28,
  },
  {
    key: "bg-tower",
    src: "assets/enemy/tiny-swords/Buildings/Red Buildings/Tower.png",
    x: 0.32,
    y: 0.5,
    h: 0.22,
  },
  {
    key: "bg-archery",
    src: "assets/enemy/tiny-swords/Buildings/Yellow Buildings/Archery.png",
    x: 0.68,
    y: 0.5,
    h: 0.22,
  },
  {
    key: "bg-house1",
    src: "assets/enemy/tiny-swords/Buildings/Blue Buildings/House1.png",
    x: 0.42,
    y: 0.58,
    h: 0.16,
  },
  {
    key: "bg-house2",
    src: "assets/enemy/tiny-swords/Buildings/Yellow Buildings/House2.png",
    x: 0.58,
    y: 0.58,
    h: 0.16,
  },
  {
    key: "bg-barracks",
    src: "assets/enemy/tiny-swords/Buildings/Purple Buildings/Barracks.png",
    x: 0.5,
    y: 0.68,
    h: 0.18,
  },
];

/** Punch impact VFX from Tiny Swords Particle FX. */
const HIT_FX = [
  {
    key: "fx-explosion",
    src: "assets/enemy/tiny-swords/Particle FX/Explosion_01.png",
    cols: 8,
    rows: 1,
    frameMs: 45,
    size: 0.28,
  },
  {
    key: "fx-dust",
    src: "assets/enemy/tiny-swords/Particle FX/Dust_02.png",
    cols: 10,
    rows: 1,
    frameMs: 40,
    size: 0.22,
  },
];

/** Workout BGM — YouTube playlist (official embed). */
const YT_VIDEO_ID = "MbD7TAlBFDc";
const YT_PLAYLIST_ID_DEFAULT = "PLGE-oAi0TRbtlX5kvtO415sergiyGEyUp";
const YT_PLAYLIST_STORAGE_KEY = "tony_fitness_yt_playlist";

function loadSavedPlaylistId() {
  try {
    const saved = localStorage.getItem(YT_PLAYLIST_STORAGE_KEY)?.trim();
    if (saved) return saved;
  } catch {
    /* private mode / blocked storage */
  }
  return YT_PLAYLIST_ID_DEFAULT;
}

/** Accept playlist URL or raw list id. */
function parsePlaylistId(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (/^[A-Za-z0-9_-]{10,}$/.test(s)) return s;
  try {
    const href = /^https?:\/\//i.test(s) ? s : `https://${s}`;
    const url = new URL(href);
    const list = url.searchParams.get("list");
    if (list) return list;
  } catch {
    /* fall through */
  }
  const m = s.match(/[?&]list=([A-Za-z0-9_-]+)/i);
  return m ? m[1] : null;
}

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const flashEl = document.getElementById("flash");
const startBtn = document.getElementById("start-btn");
const cameraBtn = document.getElementById("camera-btn");
const bgBtn = document.getElementById("bg-btn");
const playlistInput = document.getElementById("playlist-input");
const playlistBtn = document.getElementById("playlist-btn");
const playlistToggle = document.getElementById("playlist-toggle");
const playlistPop = document.getElementById("playlist-pop");
const playlistCancel = document.getElementById("playlist-cancel");
const playlistMenu = document.getElementById("playlist-menu");
const statusEl = document.getElementById("status");
const scoreEl = document.getElementById("score");
const comboEl = document.getElementById("combo");
const promptEl = document.getElementById("prompt");
const hpFill = document.getElementById("hp-fill");
const hpText = document.getElementById("hp-text");

let poseLandmarker = null;
let running = false;
let rafId = 0;
let lastVideoTime = -1;
let lastTs = 0;
let ytPlayer = null;
/** @type {Promise<void> | null} */
let ytReadyPromise = null;
/** Active playlist id (persisted). */
let ytPlaylistId = loadSavedPlaylistId();
/** When false, canvas uses black bg; camera still runs for pose. */
let showCameraBg = false;

let score = 0;
let combo = 0;
let cornerIndex = 0;
let hp = BASE_HITS;
let maxHp = BASE_HITS;
let hitCooldownUntil = 0;
let celebrateUntil = 0;
let hitImpactUntil = 0;
let hitShakeUntil = 0;
/** @type {{x: number, y: number, born: number, text: string}[]} */
let damagePops = [];
/** @type {{x: number, y: number, born: number, fxKey: string, scale: number}[]} */
let hitFx = [];

const wrists = {
  left: { x: 0.5, y: 0.5, px: 0.5, py: 0.5, angle: -Math.PI / 2, ready: false },
  right: { x: 0.5, y: 0.5, px: 0.5, py: 0.5, angle: -Math.PI / 2, ready: false },
};

/** Nose-tracked head for slip / nod hits. */
const head = { x: 0.5, y: 0.32, px: 0.5, py: 0.32, ready: false };

const punchSfx = new Audio("assets/sound/punch.wav");
punchSfx.preload = "auto";
punchSfx.volume = 0.28;

function setStatus(text) {
  statusEl.textContent = text;
}

function currentCorner() {
  return CORNERS[cornerIndex % CORNERS.length];
}

/** Keep enemies inside the visible band between HUD and footer. */
function getPlayNorm() {
  const appEl = document.getElementById("app");
  if (!appEl) return { x: 0.03, y: 0.1, w: 0.94, h: 0.72 };
  const appRect = appEl.getBoundingClientRect();
  const hud = document.querySelector(".hud");
  const controls = document.querySelector(".controls");
  const pad = 10;
  const topPx =
    (hud?.getBoundingClientRect().bottom ?? appRect.top + 52) - appRect.top + pad;
  const bottomPx =
    appRect.bottom -
    (controls?.getBoundingClientRect().top ?? appRect.bottom - 96) +
    pad;
  const y = Math.min(0.24, Math.max(0.07, topPx / Math.max(1, appRect.height)));
  const bottom = Math.min(0.36, Math.max(0.14, bottomPx / Math.max(1, appRect.height)));
  const h = Math.max(0.42, 1 - y - bottom);
  return { x: 0.03, y, w: 0.94, h };
}

/** Map a corner's layout box into full-canvas normalized coords. */
function cornerNormRect(corner) {
  const p = getPlayNorm();
  return {
    x: p.x + corner.x * p.w,
    y: p.y + corner.y * p.h,
    w: corner.w * p.w,
    h: corner.h * p.h,
  };
}

function updateHud() {
  const corner = currentCorner();
  scoreEl.textContent = String(score);
  comboEl.textContent = String(combo);
  hpFill.style.width = `${Math.max(0, (hp / maxHp) * 100)}%`;
  hpText.textContent = `${hp} / ${maxHp}`;

  if (performance.now() < celebrateUntil) {
    promptEl.textContent = `击杀！下一只去「${corner.label}」`;
  } else {
    promptEl.textContent = `砸「${corner.label}」· 挥拳 / 甩头 · ${corner.name || corner.emoji}`;
  }
}

function spawnMonster(advance = false) {
  if (advance) {
    cornerIndex = (cornerIndex + 1) % CORNERS.length;
    maxHp = BASE_HITS + Math.floor(score / 3);
    hitImpactUntil = 0;
    hitShakeUntil = 0;
    damagePops = [];
    hitFx = [];
  }
  hp = maxHp;
  updateHud();
}

function playPunchSound() {
  try {
    const sfx = punchSfx.cloneNode();
    sfx.volume = punchSfx.volume;
    void sfx.play();
  } catch (err) {
    console.warn(err);
  }
}

function flashHit() {
  flashEl.classList.remove("on", "hard");
  // Force reflow so repeated hits re-trigger the CSS animation.
  void flashEl.offsetWidth;
  flashEl.classList.add("on", "hard");
  setTimeout(() => flashEl.classList.remove("on", "hard"), HIT_FLASH_MS);
  if (navigator.vibrate) navigator.vibrate([30, 40, 50]);
  playPunchSound();
}

function applyHit(source = "punch") {
  const now = performance.now();
  if (now < hitCooldownUntil) return;
  hitCooldownUntil = now + HIT_COOLDOWN_MS;

  const corner = currentCorner();
  const box = cornerNormRect(corner);
  hp -= 1;
  combo += 1;
  const attackFrames = corner.attackCols || corner.sheetCols || 4;
  const attackMs = Math.max(HIT_POP_MS, attackFrames * ENEMY_FRAME_MS);
  hitImpactUntil = now + attackMs;
  hitShakeUntil = now + HIT_SHAKE_MS;
  damagePops.push({
    x: box.x + box.w * 0.5,
    y: box.y + box.h * 0.35,
    born: now,
    text: source === "nod" ? "点头!" : source === "slip" ? "躲闪!" : "-1",
  });
  if (damagePops.length > 8) damagePops.shift();

  const fxX = box.x + box.w * 0.5;
  const fxY = box.y + box.h * 0.55;
  for (const fx of HIT_FX) {
    hitFx.push({
      x: fxX + (Math.random() - 0.5) * 0.04,
      y: fxY + (Math.random() - 0.5) * 0.04,
      born: now,
      fxKey: fx.key,
      scale: 0.85 + Math.random() * 0.35,
    });
  }
  if (hitFx.length > 16) hitFx.splice(0, hitFx.length - 16);

  flashHit();

  if (hp <= 0) {
    score += 1;
    combo = 0;
    celebrateUntil = now + 900;
    spawnMonster(true);
    setStatus(`干得漂亮！已击杀 ${score} 只`);
  } else {
    updateHud();
    const how =
      source === "nod" ? "点头" : source === "slip" ? "甩头躲闪" : source === "head" ? "头部撞击" : "挥拳";
    setStatus(`${how}击中！连击 ${combo}`);
  }
}

function drawMonsterHpBar(rx, ry, rw, rh) {
  const barW = Math.min(rw * 0.72, canvas.width * 0.28);
  const barH = Math.max(14, rh * 0.07);
  const bx = rx + (rw - barW) / 2;
  const by = Math.max(8, ry + rh * 0.08);
  const ratio = Math.max(0, hp / maxHp);
  const pad = Math.max(2, barH * 0.18);

  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.beginPath();
  ctx.roundRect(bx - 3, by - 3, barW + 6, barH + 6, 8);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  ctx.beginPath();
  ctx.roundRect(bx, by, barW, barH, 6);
  ctx.fill();

  const fillW = Math.max(0, (barW - pad * 2) * ratio);
  if (fillW > 0) {
    const grad = ctx.createLinearGradient(bx, by, bx + barW, by);
    grad.addColorStop(0, ratio > 0.35 ? "#ff5a5f" : "#ff2d55");
    grad.addColorStop(1, ratio > 0.35 ? "#ffb703" : "#ff6b35");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(bx + pad, by + pad, fillW, barH - pad * 2, 4);
    ctx.fill();
  }

  ctx.fillStyle = "#fff";
  ctx.font = `bold ${Math.max(12, Math.floor(barH * 0.85))}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${hp}/${maxHp}`, bx + barW / 2, by + barH / 2 + 0.5);
}

function drawDamagePops(now, cw, ch) {
  damagePops = damagePops.filter((p) => now - p.born < 700);
  for (const p of damagePops) {
    const t = (now - p.born) / 700;
    const rise = t * ch * 0.08;
    const alpha = 1 - t;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#ffe566";
    ctx.strokeStyle = "#c1121f";
    ctx.lineWidth = 4;
    ctx.font = `bold ${Math.floor(cw * 0.055 * (1.15 - t * 0.25))}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const x = p.x * cw;
    const y = p.y * ch - rise;
    ctx.strokeText(p.text, x, y);
    ctx.fillText(p.text, x, y);
    ctx.restore();
  }
}

function drawHitFx(now, cw, ch) {
  const defs = Object.fromEntries(HIT_FX.map((f) => [f.key, f]));
  hitFx = hitFx.filter((p) => {
    const def = defs[p.fxKey];
    if (!def) return false;
    return now - p.born < def.cols * def.frameMs;
  });

  ctx.imageSmoothingEnabled = false;
  for (const p of hitFx) {
    const def = defs[p.fxKey];
    const img = enemyImages.get(def.key);
    if (!(img?.complete && img.naturalWidth > 0)) continue;
    const frame = Math.min(
      def.cols - 1,
      Math.floor((now - p.born) / def.frameMs)
    );
    const fw = img.naturalWidth / def.cols;
    const fh = img.naturalHeight / def.rows;
    const size = Math.min(cw, ch) * def.size * p.scale;
    const x = p.x * cw - size / 2;
    const y = p.y * ch - size / 2;
    ctx.drawImage(img, frame * fw, 0, fw, fh, x, y, size, size);
  }
  ctx.imageSmoothingEnabled = true;
}

function pointInCorner(x, y, corner) {
  const box = cornerNormRect(corner);
  return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
}

function smoothWrist(side, nx, ny, angle) {
  const w = wrists[side];
  if (!w.ready) {
    w.x = nx;
    w.y = ny;
    w.px = nx;
    w.py = ny;
    w.angle = angle;
    w.ready = true;
    return;
  }
  w.px = w.x;
  w.py = w.y;
  w.x = w.x * (1 - SMOOTH) + nx * SMOOTH;
  w.y = w.y * (1 - SMOOTH) + ny * SMOOTH;
  // Keep angle continuous-ish
  let da = angle - w.angle;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  w.angle += da * SMOOTH;
}

function checkWristHit(side, dt) {
  const w = wrists[side];
  if (!w.ready || dt <= 0) return;
  const corner = currentCorner();
  const wasOutside = !pointInCorner(w.px, w.py, corner);
  const nowInside = pointInCorner(w.x, w.y, corner);
  // Must punch in from outside — holding / waving inside does not count.
  if (!wasOutside || !nowInside) return;

  const speed = Math.hypot(w.x - w.px, w.y - w.py) / dt;
  if (speed >= HIT_SPEED) applyHit("punch");
}

function smoothHead(nx, ny) {
  if (!head.ready) {
    head.x = nx;
    head.y = ny;
    head.px = nx;
    head.py = ny;
    head.ready = true;
    return;
  }
  head.px = head.x;
  head.py = head.y;
  head.x = head.x * (1 - HEAD_SMOOTH) + nx * HEAD_SMOOTH;
  head.y = head.y * (1 - HEAD_SMOOTH) + ny * HEAD_SMOOTH;
}

/** Head slip (lateral) / nod (down) / jab into the monster corner. */
function checkHeadHit(dt) {
  if (!head.ready || dt <= 0) return;
  const corner = currentCorner();
  const wasOutside = !pointInCorner(head.px, head.py, corner);
  const nowInside = pointInCorner(head.x, head.y, corner);
  if (!wasOutside || !nowInside) return;

  const dx = head.x - head.px;
  const dy = head.y - head.py;
  const speed = Math.hypot(dx, dy) / dt;
  const isNod = dy > 0.01 && dy >= Math.abs(dx) * 0.65 && speed >= HEAD_HIT_SPEED * 0.9;
  const isSlip = Math.abs(dx) > 0.01 && Math.abs(dx) >= Math.abs(dy) * 0.65 && speed >= HEAD_SLIP_SPEED;
  const isJab = speed >= HEAD_HIT_SPEED;
  if (isNod) applyHit("nod");
  else if (isSlip) applyHit("slip");
  else if (isJab) applyHit("head");
}

/** Cover-draw mirrored video, then overlays in the same mirrored space. */
function drawTinySwordsBackground(cw, ch) {
  const grass = enemyImages.get("bg-grass");

  if (grass?.complete && grass.naturalWidth > 0) {
    // Pixel-perfect tile size so grass fills the whole canvas edge-to-edge.
    const native = grass.naturalWidth || 64;
    const tile = Math.max(
      native,
      Math.round(Math.min(cw, ch) * 0.08 / native) * native
    );
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < ch + tile; y += tile) {
      for (let x = 0; x < cw + tile; x += tile) {
        ctx.drawImage(grass, x, y, tile, tile);
      }
    }
    ctx.imageSmoothingEnabled = true;
  } else {
    ctx.fillStyle = "#5a9e3a";
    ctx.fillRect(0, 0, cw, ch);
  }

  // Sort by y so lower buildings draw in front.
  const sorted = [...BG_BUILDINGS].sort((a, b) => a.y - b.y);
  for (const b of sorted) {
    const img = enemyImages.get(b.key);
    if (!(img?.complete && img.naturalWidth > 0)) continue;
    const drawH = ch * b.h;
    const drawW = (img.naturalWidth / img.naturalHeight) * drawH;
    const x = b.x * cw - drawW / 2;
    const y = b.y * ch - drawH;
    ctx.drawImage(img, x, y, drawW, drawH);
  }
}

function drawScene(mirroredLandmarks) {
  const cw = canvas.width;
  const ch = canvas.height;
  ctx.clearRect(0, 0, cw, ch);

  if (showCameraBg) {
    const vw = video.videoWidth || cw;
    const vh = video.videoHeight || ch;
    const scale = Math.max(cw / vw, ch / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const ox = (cw - dw) / 2;
    const oy = (ch - dh) / 2;

    ctx.save();
    ctx.translate(cw, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, ox, oy, dw, dh);
    ctx.restore();
  } else {
    drawTinySwordsBackground(cw, ch);
  }

  const now = performance.now();
  const corner = currentCorner();
  const box = cornerNormRect(corner);
  let rx = box.x * cw;
  let ry = box.y * ch;
  const rw = box.w * cw;
  const rh = box.h * ch;
  const pulsing = 0.9 + 0.1 * Math.sin(now / 160);
  const hitting = now < hitImpactUntil;
  const shaking = now < hitShakeUntil;

  if (shaking) {
    const t = 1 - (hitShakeUntil - now) / HIT_SHAKE_MS;
    const amp = (1 - t) * Math.max(10, cw * 0.018);
    rx += Math.sin(now / 18) * amp;
    ry += Math.cos(now / 15) * amp * 0.7;
  }

  ctx.save();
  ctx.globalAlpha = hitting ? 0.5 : 0.28;
  ctx.fillStyle = hitting ? "#2ecc71" : "#3ddc97";
  ctx.beginPath();
  ctx.roundRect(rx, ry, rw, rh, Math.min(28, rw * 0.08));
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = hitting ? "#fff" : "#1faa6a";
  ctx.lineWidth = Math.max(4, cw * 0.006) * (hitting ? 1.35 : 1);
  ctx.stroke();

  drawMonsterHpBar(rx, ry, rw, rh);

  const cx = rx + rw / 2;
  const cy = ry + rh * 0.58;
  const hitScale = hitting
    ? 1.18 + 0.12 * Math.sin(((hitImpactUntil - now) / HIT_POP_MS) * Math.PI)
    : 1;
  const artSize = Math.floor(Math.min(rw, rh) * 1.7 * pulsing * hitScale);

  ctx.save();
  ctx.translate(cx, cy);
  if (hitting) ctx.rotate(Math.sin(now / 20) * 0.12);
  if (hitting) {
    ctx.shadowColor = "#3ddc97";
    ctx.shadowBlur = 28;
  }
  drawEnemySprite(corner, now, artSize, hitting);
  ctx.restore();
  ctx.restore();

  drawDamagePops(now, cw, ch);
  drawHitFx(now, cw, ch);

  if (showCameraBg) {
    if (!mirroredLandmarks) return;
    for (const [idx, color] of [
      [WRIST_L, "#3ddc97"],
      [WRIST_R, "#4cc9f0"],
      [NOSE, "#ffe566"],
    ]) {
      const p = mirroredLandmarks[idx];
      if (!p) continue;
      if (p.visibility != null && p.visibility < 0.4) continue;
      ctx.beginPath();
      ctx.arc(p.x * cw, p.y * ch, Math.max(10, cw * 0.012), 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
    }
    return;
  }

  // Map mode: cartoon gloves + head marker follow pose.
  drawCartoonHands(now, cw, ch);
  drawHeadMarker(now, cw, ch);
}

function drawHeadMarker(now, cw, ch) {
  if (!head.ready) return;
  const x = head.x * cw;
  const y = head.y * ch;
  const moving = Math.hypot(head.x - head.px, head.y - head.py);
  const impact = now < hitImpactUntil;
  const r = Math.max(16, cw * 0.024) * (impact ? 1.2 : 1 + Math.min(0.2, moving * 10));

  ctx.save();
  if (impact) {
    ctx.shadowColor = "#ffe566";
    ctx.shadowBlur = r * 1.2;
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "#ffe566";
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.18);
  ctx.strokeStyle = "#fff";
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#081018";
  ctx.font = `bold ${Math.floor(r * 0.85)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("头", x, y + r * 0.06);
  ctx.restore();
}

function drawCartoonHands(now, cw, ch) {
  const impact = now < hitImpactUntil;
  for (const side of ["left", "right"]) {
    const w = wrists[side];
    if (!w.ready) continue;
    const x = w.x * cw;
    const y = w.y * ch;
    const moving = Math.hypot(w.x - w.px, w.y - w.py);
    const punchBoost = impact ? 1.2 : 1 + Math.min(0.25, moving * 8);
    drawCartoonGlove(x, y, w.angle, side, Math.max(72, cw * 0.1) * punchBoost, impact);
  }
}

/** Cartoon boxing glove; +X is punch direction (elbow → wrist). */
function drawCartoonGlove(x, y, angle, side, size, impact) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const body = side === "left" ? "#3ddc97" : "#4cc9f0";
  const dark = side === "left" ? "#1faa6a" : "#2a8fb8";
  const cuff = "#f4f7fb";

  if (impact) {
    ctx.shadowColor = body;
    ctx.shadowBlur = size * 0.55;
  }

  // Wrist cuff
  ctx.fillStyle = cuff;
  ctx.beginPath();
  ctx.roundRect(-size * 0.55, -size * 0.28, size * 0.42, size * 0.56, size * 0.12);
  ctx.fill();

  // Glove body
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(size * 0.12, 0, size * 0.55, size * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();

  // Knuckle pad
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.ellipse(size * 0.38, 0, size * 0.22, size * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Thumb bump
  ctx.fillStyle = body;
  ctx.beginPath();
  const thumbY = side === "left" ? size * 0.38 : -size * 0.38;
  ctx.ellipse(-size * 0.05, thumbY, size * 0.22, size * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Outline
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = Math.max(2, size * 0.06);
  ctx.beginPath();
  ctx.ellipse(size * 0.12, 0, size * 0.55, size * 0.48, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Impact star
  if (impact) {
    ctx.fillStyle = "#ffe566";
    ctx.font = `bold ${Math.floor(size * 0.55)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("💥", size * 0.7, 0);
  }

  ctx.restore();
}

/**
 * Convert raw MediaPipe landmark (unmirrored video) into mirrored + cover-normalized
 * coordinates matching what we draw on canvas (0–1 over full canvas).
 */
function toCanvasNorm(lm) {
  const cw = canvas.width;
  const ch = canvas.height;
  const vw = video.videoWidth || cw;
  const vh = video.videoHeight || ch;
  const scale = Math.max(cw / vw, ch / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const ox = (cw - dw) / 2;
  const oy = (ch - dh) / 2;

  const mx = 1 - lm.x; // selfie mirror
  const x = (ox + mx * dw) / cw;
  const y = (oy + lm.y * dh) / ch;
  return { x, y, visibility: lm.visibility };
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
}

async function createPose() {
  setStatus("加载姿态模型…");
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );
  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numPoses: 1,
  });
}

function isCameraOn() {
  return Boolean(video.srcObject);
}

function updateCameraButton() {
  if (isCameraOn()) {
    cameraBtn.textContent = "关闭摄像头";
    cameraBtn.classList.add("on");
  } else {
    cameraBtn.textContent = "打开摄像头";
    cameraBtn.classList.remove("on");
  }
}

function updateBgButton() {
  const stage = document.querySelector(".stage");
  if (showCameraBg) {
    bgBtn.textContent = "显示画面";
    bgBtn.classList.add("on");
    stage?.classList.add("camera-bg");
  } else {
    bgBtn.textContent = "地图背景";
    bgBtn.classList.remove("on");
    stage?.classList.remove("camera-bg");
  }
}

function toggleCameraBg() {
  showCameraBg = !showCameraBg;
  updateBgButton();
  if (!isCameraOn()) {
    drawCameraOffPlaceholder();
  } else if (!running) {
    // Refresh a single frame so the mode change is visible immediately.
    drawScene(null);
  }
  setStatus(
    showCameraBg
      ? "已显示摄像头画面。可再点切回地图背景。"
      : "已用 Tiny Swords 地图背景；摄像头仍在识别手臂。"
  );
}

function drawCameraOffPlaceholder() {
  const cw = canvas.width || canvas.clientWidth || 640;
  const ch = canvas.height || canvas.clientHeight || 360;
  if (!canvas.width || !canvas.height) {
    canvas.width = cw;
    canvas.height = ch;
  }
  if (!showCameraBg) {
    drawTinySwordsBackground(canvas.width, canvas.height);
    return;
  }
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#9aa8bd";
  ctx.font = "20px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("摄像头已关闭", canvas.width / 2, canvas.height / 2);
}

async function startCamera() {
  setStatus("请求摄像头权限…");
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: "user",
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  });
  video.srcObject = stream;
  await video.play();
  resizeCanvas();
  updateCameraButton();
}

function stopCamera() {
  if (running) stopLoop();
  const stream = video.srcObject;
  if (stream) {
    for (const track of stream.getTracks()) track.stop();
  }
  video.srcObject = null;
  lastVideoTime = -1;
  wrists.left.ready = false;
  wrists.right.ready = false;
  updateCameraButton();
  drawCameraOffPlaceholder();
  setStatus("摄像头已关闭。可点「打开摄像头」再继续。");
}

async function toggleCamera() {
  cameraBtn.disabled = true;
  try {
    if (isCameraOn()) {
      stopCamera();
    } else {
      await startCamera();
      setStatus("摄像头已打开。点「开始运动」即可挥拳砸怪。");
    }
  } catch (err) {
    console.error(err);
    setStatus(`摄像头失败：${err.message || err}`);
    stopCamera();
  } finally {
    cameraBtn.disabled = false;
  }
}

function loadYouTubeApi() {
  return new Promise((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try {
        prev?.();
      } catch {
        /* ignore prior handler errors */
      }
      resolve(window.YT);
    };
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.onerror = () => reject(new Error("无法加载 YouTube API"));
      document.head.appendChild(tag);
    }
  });
}

function syncPlaylistInput() {
  if (playlistInput) playlistInput.value = ytPlaylistId;
}

function savePlaylistId(id) {
  ytPlaylistId = id;
  try {
    localStorage.setItem(YT_PLAYLIST_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
  syncPlaylistInput();
}

async function ensureYtPlayer() {
  if (ytPlayer && ytReadyPromise) {
    await ytReadyPromise;
    return ytPlayer;
  }
  const YT = await loadYouTubeApi();
  ytReadyPromise = new Promise((resolve, reject) => {
    let settled = false;
    ytPlayer = new YT.Player("yt-player", {
      width: "148",
      height: "83",
      videoId: YT_VIDEO_ID,
      playerVars: {
        listType: "playlist",
        list: ytPlaylistId,
        autoplay: 0,
        controls: 1,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
        origin: window.location.origin,
      },
      events: {
        onReady: (event) => {
          try {
            event.target.setShuffle(true);
            event.target.setLoop(true);
          } catch {
            /* shuffle may fail before playlist is fully loaded */
          }
          if (settled) return;
          settled = true;
          resolve();
        },
        onError: (e) => {
          console.warn("YouTube player error", e?.data);
          if (settled) return;
          settled = true;
          reject(new Error(`YouTube 播放错误：${e?.data ?? "unknown"}`));
        },
      },
    });
  });
  await ytReadyPromise;
  return ytPlayer;
}

/**
 * Load a user playlist into the embed.
 * @param {string} raw URL or id
 * @param {{ play?: boolean }} [opts]
 */
async function applyUserPlaylist(raw, opts = {}) {
  const { play = false } = opts;
  const id = parsePlaylistId(raw);
  if (!id) {
    setStatus("无法识别播放列表，请粘贴 YouTube 播放列表链接或 list= ID");
    return false;
  }

  playlistBtn.disabled = true;
  try {
    savePlaylistId(id);
    const player = await ensureYtPlayer();
    player.loadPlaylist({
      listType: "playlist",
      list: id,
      index: 0,
    });
    try {
      player.setShuffle(true);
      player.setLoop(true);
    } catch {
      /* ignore */
    }
    if (play || running) {
      setTimeout(() => {
        try {
          const list = player.getPlaylist?.() ?? null;
          if (list && list.length > 0) {
            player.playVideoAt(Math.floor(Math.random() * list.length));
          } else {
            player.playVideo();
          }
        } catch {
          /* ignore */
        }
      }, 350);
    }
    setStatus(play || running ? "已更换播放列表并开始播放" : "已更换播放列表（开始运动时播放）");
    return true;
  } catch (err) {
    console.warn(err);
    setStatus(`更换播放列表失败：${err.message || err}`);
    return false;
  } finally {
    playlistBtn.disabled = false;
  }
}

async function onPlaylistApply() {
  const raw = playlistInput?.value ?? "";
  const playing = ytPlayer?.getPlayerState?.() === 1;
  const ok = await applyUserPlaylist(raw, { play: playing || running });
  if (ok) closePlaylistPop();
}

function isPlaylistPopOpen() {
  return Boolean(playlistPop && !playlistPop.hidden);
}

function openPlaylistPop() {
  if (!playlistPop || !playlistToggle) return;
  syncPlaylistInput();
  playlistPop.hidden = false;
  playlistToggle.setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => {
    playlistInput?.focus();
    playlistInput?.select();
  });
}

function closePlaylistPop() {
  if (!playlistPop || !playlistToggle) return;
  playlistPop.hidden = true;
  playlistToggle.setAttribute("aria-expanded", "false");
}

function togglePlaylistPop() {
  if (isPlaylistPopOpen()) closePlaylistPop();
  else openPlaylistPop();
}

async function playWorkoutMusic() {
  try {
    const player = await ensureYtPlayer();
    // Keep current track if already playing (pause game / camera should not restart BGM).
    const state = player.getPlayerState?.();
    if (state === 1 /* YT.PlayerState.PLAYING */) return;

    try {
      player.setShuffle(true);
      player.setLoop(true);
    } catch {
      /* ignore */
    }
    const list = player.getPlaylist?.() ?? null;
    if (list && list.length > 0) {
      const index = Math.floor(Math.random() * list.length);
      player.playVideoAt(index);
    } else {
      // Playlist not loaded yet — start then jump to a shuffled next track.
      player.playVideo();
      setTimeout(() => {
        try {
          player.setShuffle(true);
          player.nextVideo();
        } catch {
          /* ignore */
        }
      }, 400);
    }
  } catch (err) {
    console.warn(err);
    setStatus("游戏已开始；YouTube 音乐未能自动播放，可点底部播放器。");
  }
}

function pauseWorkoutMusic() {
  try {
    ytPlayer?.pauseVideo?.();
  } catch {
    /* player may not be ready */
  }
}

function stopLoop() {
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  startBtn.textContent = "开始运动";
  startBtn.classList.remove("playing");
}

function loop() {
  if (!running) return;
  rafId = requestAnimationFrame(loop);
  if (video.readyState < 2) return;

  const now = performance.now();
  const dt = lastTs ? (now - lastTs) / 1000 : 0.016;
  lastTs = now;

  if (video.currentTime === lastVideoTime) {
    drawScene(null);
    return;
  }
  lastVideoTime = video.currentTime;

  const result = poseLandmarker.detectForVideo(video, now);
  const raw = result.landmarks?.[0] ?? null;
  let mirrored = null;

  if (raw) {
    mirrored = raw.map((lm) => {
      const n = toCanvasNorm(lm);
      return { x: n.x, y: n.y, visibility: n.visibility };
    });

    const l = raw[WRIST_L];
    const r = raw[WRIST_R];
    const le = raw[ELBOW_L];
    const re = raw[ELBOW_R];
    if (l && (l.visibility == null || l.visibility > 0.35)) {
      const n = toCanvasNorm(l);
      let angle = -Math.PI / 2;
      if (le && (le.visibility == null || le.visibility > 0.25)) {
        const e = toCanvasNorm(le);
        angle = Math.atan2(n.y - e.y, n.x - e.x);
      }
      smoothWrist("left", n.x, n.y, angle);
      checkWristHit("left", dt);
    }
    if (r && (r.visibility == null || r.visibility > 0.35)) {
      const n = toCanvasNorm(r);
      let angle = -Math.PI / 2;
      if (re && (re.visibility == null || re.visibility > 0.25)) {
        const e = toCanvasNorm(re);
        angle = Math.atan2(n.y - e.y, n.x - e.x);
      }
      smoothWrist("right", n.x, n.y, angle);
      checkWristHit("right", dt);
    }

    const nose = raw[NOSE];
    if (nose && (nose.visibility == null || nose.visibility > 0.35)) {
      const n = toCanvasNorm(nose);
      smoothHead(n.x, n.y);
      checkHeadHit(dt);
    }
  }

  drawScene(mirrored);
  if (performance.now() < celebrateUntil) updateHud();
}

async function toggle() {
  if (running) {
    stopLoop();
    setStatus("已暂停。再点开始继续。");
    return;
  }

  // Kick music in the click gesture before any long awaits.
  const musicPromise = playWorkoutMusic();
  // Unlock SFX in the same gesture (needed on some mobile browsers).
  try {
    punchSfx.currentTime = 0;
    const unlock = punchSfx.play();
    if (unlock) {
      void unlock.then(() => {
        punchSfx.pause();
        punchSfx.currentTime = 0;
      }).catch(() => {});
    }
  } catch {
    /* ignore */
  }

  startBtn.disabled = true;
  try {
    if (!poseLandmarker) await createPose();
    if (!isCameraOn()) await startCamera();

    score = 0;
    combo = 0;
    cornerIndex = 0;
    maxHp = BASE_HITS;
    spawnMonster(false);
    wrists.left.ready = false;
    wrists.right.ready = false;
    head.ready = false;
    lastTs = 0;
    lastVideoTime = -1;

    running = true;
    startBtn.textContent = "暂停";
    startBtn.classList.add("playing");
    setStatus("挥拳或甩头/点头，砸向大角落怪物！");
    loop();
    await musicPromise;
  } catch (err) {
    console.error(err);
    setStatus(`启动失败：${err.message || err}`);
    stopLoop();
  } finally {
    startBtn.disabled = false;
  }
}

startBtn.addEventListener("click", toggle);
cameraBtn.addEventListener("click", toggleCamera);
bgBtn.addEventListener("click", toggleCameraBg);
playlistToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  togglePlaylistPop();
});
playlistBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  void onPlaylistApply();
});
playlistCancel.addEventListener("click", (e) => {
  e.stopPropagation();
  closePlaylistPop();
});
playlistPop.addEventListener("click", (e) => e.stopPropagation());
playlistInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    void onPlaylistApply();
  } else if (e.key === "Escape") {
    e.preventDefault();
    closePlaylistPop();
  }
});
document.addEventListener("click", (e) => {
  if (!isPlaylistPopOpen()) return;
  if (playlistMenu?.contains(e.target)) return;
  closePlaylistPop();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && isPlaylistPopOpen()) closePlaylistPop();
});
window.addEventListener("resize", () => {
  resizeCanvas();
  if (!isCameraOn()) drawCameraOffPlaceholder();
});
updateCameraButton();
updateBgButton();
syncPlaylistInput();
preloadEnemyImages();
setStatus("可先「打开摄像头」，或直接点「开始运动」");
// Warm up YouTube embed so「开始运动」更容易一次点播。
void ensureYtPlayer().catch((err) => console.warn(err));
