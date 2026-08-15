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
  // Village mode units
  loadEnemyImage(
    "ally-warrior",
    "assets/enemy/tiny-swords/Units/Blue Units/Warrior/Warrior_Idle.png"
  );
  loadEnemyImage(
    "ally-warrior-run",
    "assets/enemy/tiny-swords/Units/Blue Units/Warrior/Warrior_Run.png"
  );
  loadEnemyImage(
    "ally-repair",
    "assets/enemy/tiny-swords/Units/Blue Units/Monk/Idle.png"
  );
  loadEnemyImage(
    "ally-repair-run",
    "assets/enemy/tiny-swords/Units/Blue Units/Monk/Run.png"
  );
  loadEnemyImage(
    "invader",
    "assets/enemy/tiny-swords/Units/Red Units/Pawn/Pawn_Idle.png"
  );
  loadEnemyImage(
    "invader-run",
    "assets/enemy/tiny-swords/Units/Red Units/Pawn/Pawn_Run.png"
  );
}

function drawEnemySprite(corner, now, artSize, useAttack, hitImpactUntil = 0) {
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
    maxHp: 160,
  },
  {
    key: "bg-tower",
    src: "assets/enemy/tiny-swords/Buildings/Red Buildings/Tower.png",
    x: 0.32,
    y: 0.5,
    h: 0.22,
    maxHp: 100,
  },
  {
    key: "bg-archery",
    src: "assets/enemy/tiny-swords/Buildings/Yellow Buildings/Archery.png",
    x: 0.68,
    y: 0.5,
    h: 0.22,
    maxHp: 100,
  },
  {
    key: "bg-house1",
    src: "assets/enemy/tiny-swords/Buildings/Blue Buildings/House1.png",
    x: 0.42,
    y: 0.58,
    h: 0.16,
    maxHp: 80,
  },
  {
    key: "bg-house2",
    src: "assets/enemy/tiny-swords/Buildings/Yellow Buildings/House2.png",
    x: 0.58,
    y: 0.58,
    h: 0.16,
    maxHp: 80,
  },
  {
    key: "bg-barracks",
    src: "assets/enemy/tiny-swords/Buildings/Purple Buildings/Barracks.png",
    x: 0.5,
    y: 0.68,
    h: 0.18,
    maxHp: 110,
  },
];

const ROLE_CHARGE_MIN = 4;
const ROLE_CHARGE_MAX = 8;
const INVADER_ATTACK_MS = 1200;
const ALLY_SPEED = 0.055;
const ALLY_ATTACK_MS = 700;
const ALLY_ATTACK_DMG = 2;
const ALLY_REPAIR_MS = 800;
const ALLY_REPAIR_AMT = 3;
const ALLY_LIFETIME_MS = 16000;
const DIFFICULTY_STORAGE_KEY = "tony_fitness_difficulty";

/** @typedef {'easy' | 'normal' | 'hard' | 'insane'} DifficultyId */

const DIFFICULTY_PRESETS = {
  easy: {
    label: "简单",
    desc: "敌兵较少较慢，砸怪血量更低，适合热身入门。",
    maxInvaders: 8,
    spawnMs: 2400,
    speed: 0.04,
    invaderHp: 6,
    attackDmg: 1,
    startCap: 3,
    rampSec: 30,
    smashHits: 6,
    smashMin: 1,
    smashMax: 2,
    burstHot: 0.35,
  },
  normal: {
    label: "普通",
    desc: "敌兵密度与砸怪血量适中，适合日常锻炼。",
    maxInvaders: 14,
    spawnMs: 1500,
    speed: 0.055,
    invaderHp: 8,
    attackDmg: 2,
    startCap: 6,
    rampSec: 20,
    smashHits: 10,
    smashMin: 1,
    smashMax: 2,
    burstHot: 0.55,
  },
  hard: {
    label: "困难",
    desc: "敌兵更多更快，砸怪更耐打，需要更频繁挥拳。",
    maxInvaders: 18,
    spawnMs: 1100,
    speed: 0.065,
    invaderHp: 10,
    attackDmg: 2,
    startCap: 8,
    rampSec: 15,
    smashHits: 14,
    smashMin: 1,
    smashMax: 3,
    burstHot: 0.7,
  },
  insane: {
    label: "地狱",
    desc: "几乎不停刷怪，拆房更快，适合高强度冲刺。",
    maxInvaders: 24,
    spawnMs: 800,
    speed: 0.078,
    invaderHp: 12,
    attackDmg: 3,
    startCap: 10,
    rampSec: 12,
    smashHits: 18,
    smashMin: 2,
    smashMax: 3,
    burstHot: 0.85,
  },
};

/** @returns {DifficultyId} */
function loadSavedDifficulty() {
  try {
    const saved = localStorage.getItem(DIFFICULTY_STORAGE_KEY);
    if (saved && DIFFICULTY_PRESETS[saved]) return /** @type {DifficultyId} */ (saved);
  } catch {
    /* ignore */
  }
  return "normal";
}

/** @type {DifficultyId} */
let difficulty = loadSavedDifficulty();

function diffCfg() {
  return DIFFICULTY_PRESETS[difficulty] || DIFFICULTY_PRESETS.normal;
}
const HIT_COMBO_TIMEOUT_MS = 2200;
const TITLE_TOAST_MS = 1000;
const COMBO_TITLE_TIERS = [
  { at: 10, text: "铁拳" },
  { at: 20, text: "风暴" },
  { at: 50, text: "传说" },
];
const EVENT_FIRST_DELAY_MS = 12000;
const EVENT_COOLDOWN_MIN_MS = 18000;
const EVENT_COOLDOWN_MAX_MS = 28000;
const EVENT_DURATION_MS = 8000;
const EVENT_REPAIR_BONUS_RATIO = 0.12;

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
const YT_MODE_STORAGE_KEY = "tony_fitness_yt_mode";
/** @typedef {'shuffle' | 'loop'} YtPlayMode */

function loadSavedPlaylistId() {
  try {
    const saved = localStorage.getItem(YT_PLAYLIST_STORAGE_KEY)?.trim();
    if (saved) return saved;
  } catch {
    /* private mode / blocked storage */
  }
  return YT_PLAYLIST_ID_DEFAULT;
}

/** @returns {YtPlayMode} */
function loadSavedPlayMode() {
  try {
    const saved = localStorage.getItem(YT_MODE_STORAGE_KEY);
    if (saved === "loop" || saved === "shuffle") return saved;
  } catch {
    /* ignore */
  }
  return "shuffle";
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
const ytSongEl = document.getElementById("yt-song");
const ytArtistEl = document.getElementById("yt-artist");
const ytPrevBtn = document.getElementById("yt-prev");
const ytNextBtn = document.getElementById("yt-next");
const ytModeBtn = document.getElementById("yt-mode");
const statusEl = document.getElementById("status");
const scoreEl = document.getElementById("score");
const comboEl = document.getElementById("combo");
const promptEl = document.getElementById("prompt");
const hpFill = document.getElementById("hp-fill");
const hpText = document.getElementById("hp-text");
const scoreLabel = document.getElementById("score-label");
const comboLabel = document.getElementById("combo-label");
const appEl = document.getElementById("app");
const modeMenu = document.getElementById("mode-menu");
const modeSmashBtn = document.getElementById("mode-smash");
const modeVillageBtn = document.getElementById("mode-village");
const modeSettingsBtn = document.getElementById("mode-settings");
const settingsPanel = document.getElementById("settings-panel");
const settingsBackBtn = document.getElementById("settings-back");
const difficultyDesc = document.getElementById("difficulty-desc");
const menuBtn = document.getElementById("menu-btn");
const resultOverlay = document.getElementById("result-overlay");
const resultTitle = document.getElementById("result-title");
const resultBody = document.getElementById("result-body");
const resultMenuBtn = document.getElementById("result-menu-btn");

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
/** @type {YtPlayMode} */
let ytPlayMode = loadSavedPlayMode();
/** Playlist index to keep looping while in single-track mode. */
let ytLoopIndex = null;
/** When false, canvas uses black bg; camera still runs for pose. */
let showCameraBg = false;

/** @type {null | 'smash' | 'village'} */
let gameMode = null;
let villageLost = false;

let score = 0;
let combo = 0;
let hitCooldownUntil = 0;
let celebrateUntil = 0;
/**
 * Active monsters on screen (1–2). Smash mode only.
 * @type {{cornerIndex: number, hp: number, maxHp: number, hitImpactUntil: number, hitShakeUntil: number}[]}
 */
let enemies = [];
/** @type {{x: number, y: number, born: number, text: string}[]} */
let damagePops = [];
/** @type {{x: number, y: number, born: number, fxKey: string, scale: number}[]} */
let hitFx = [];

/** @type {{key: string, src: string, x: number, y: number, h: number, hp: number, maxHp: number}[]} */
let buildings = [];
/**
 * @type {{type: 'warrior' | 'repairer', cornerIndex: number, hp: number, maxHp: number, hitImpactUntil: number, hitShakeUntil: number}[]}
 */
let rolePads = [];
/**
 * @type {{type: 'warrior' | 'repairer', x: number, y: number, born: number, nextActionAt: number}[]}
 */
let allies = [];
/**
 * @type {{x: number, y: number, hp: number, maxHp: number, targetKey: string | null, nextAttackAt: number}[]}
 */
let invaders = [];
let nextInvaderAt = 0;
let villageStartedAt = 0;
let villageKills = 0;
let villageSummons = 0;
let villageRepairs = 0;
/** Village punch combo for titles (HUD still shows summons). */
let hitCombo = 0;
let hitComboLastAt = 0;
let lastTitleTier = 0;
/** @type {null | { text: string, born: number, until: number }} */
let titleToast = null;
let nextEventAt = 0;
let invaderIdSeq = 1;
/**
 * @type {null | { type: 'repair' | 'warrior', until: number, buildingKey?: string, eliteId?: number }}
 */
let activeEvent = null;

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

function resetComboTitleState() {
  hitCombo = 0;
  hitComboLastAt = 0;
  lastTitleTier = 0;
  titleToast = null;
}

function maybeShowComboTitle(count) {
  let unlocked = null;
  for (const tier of COMBO_TITLE_TIERS) {
    if (count >= tier.at && lastTitleTier < tier.at) {
      unlocked = tier;
    }
  }
  if (!unlocked) return;
  lastTitleTier = unlocked.at;
  const now = performance.now();
  titleToast = {
    text: unlocked.text,
    born: now,
    until: now + TITLE_TOAST_MS,
  };
  setStatus(`连击 ${unlocked.at}！${unlocked.text}`);
}

function registerHitCombo() {
  const now = performance.now();
  if (now - hitComboLastAt > HIT_COMBO_TIMEOUT_MS) {
    hitCombo = 0;
    lastTitleTier = 0;
  }
  hitCombo += 1;
  hitComboLastAt = now;
  maybeShowComboTitle(hitCombo);
}

function tickHitComboTimeout(now = performance.now()) {
  if (hitCombo > 0 && now - hitComboLastAt > HIT_COMBO_TIMEOUT_MS) {
    hitCombo = 0;
    lastTitleTier = 0;
  }
}

function drawTitleToast(now, cw, ch) {
  if (!titleToast || now > titleToast.until) {
    if (titleToast && now > titleToast.until) titleToast = null;
    return;
  }
  const t = (now - titleToast.born) / TITLE_TOAST_MS;
  const alpha = t < 0.15 ? t / 0.15 : t > 0.7 ? (1 - t) / 0.3 : 1;
  const scale = 0.85 + Math.min(1, t * 2.2) * 0.35;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.translate(cw / 2, ch * 0.28);
  ctx.scale(scale, scale);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(6, cw * 0.01);
  ctx.strokeStyle = "rgba(8,16,28,0.85)";
  ctx.fillStyle = "#ffe566";
  const size = Math.max(42, Math.floor(cw * 0.09));
  ctx.font = `bold ${size}px sans-serif`;
  ctx.strokeText(titleToast.text, 0, 0);
  ctx.fillText(titleToast.text, 0, 0);
  ctx.restore();
}

function drawEventBanner(now, cw, ch) {
  if (!activeEvent || now > activeEvent.until) return;
  const label =
    activeEvent.type === "repair" ? "⚡ 快修！危楼冒烟" : "⚡ 快充战士！精英冲锋";
  ctx.save();
  ctx.globalAlpha = 0.92;
  const w = Math.min(cw * 0.72, 420);
  const h = Math.max(34, ch * 0.045);
  const x = (cw - w) / 2;
  const y = ch * 0.12;
  ctx.fillStyle =
    activeEvent.type === "repair"
      ? "rgba(255, 140, 40, 0.88)"
      : "rgba(255, 70, 90, 0.88)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${Math.max(14, Math.floor(h * 0.48))}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cw / 2, y + h / 2);
  ctx.restore();
}

function showMenu() {
  stopLoop();
  gameMode = null;
  villageLost = false;
  if (resultOverlay) resultOverlay.hidden = true;
  hideSettings();
  appEl?.classList.add("menu-open");
  setStatus("选择模式后开始运动");
  resizeCanvas();
  drawMenuPreview();
}

function showSettings() {
  stopLoop();
  appEl?.classList.remove("menu-open");
  appEl?.classList.add("settings-open");
  if (settingsPanel) settingsPanel.hidden = false;
  syncDifficultyUI();
  setStatus("调节难度后返回菜单");
}

function hideSettings() {
  appEl?.classList.remove("settings-open");
  if (settingsPanel) settingsPanel.hidden = true;
}

function setDifficulty(id) {
  if (!DIFFICULTY_PRESETS[id]) return;
  difficulty = /** @type {DifficultyId} */ (id);
  try {
    localStorage.setItem(DIFFICULTY_STORAGE_KEY, difficulty);
  } catch {
    /* ignore */
  }
  syncDifficultyUI();
  setStatus(`难度：${diffCfg().label}`);
}

function syncDifficultyUI() {
  const cfg = diffCfg();
  document.querySelectorAll(".diff-btn").forEach((btn) => {
    btn.classList.toggle("on", btn.getAttribute("data-diff") === difficulty);
  });
  if (difficultyDesc) difficultyDesc.textContent = cfg.desc;
}

function enterMode(mode) {
  gameMode = mode;
  villageLost = false;
  if (resultOverlay) resultOverlay.hidden = true;
  appEl?.classList.remove("menu-open");
  score = 0;
  combo = 0;
  resetComboTitleState();
  enemies = [];
  rolePads = [];
  allies = [];
  invaders = [];
  buildings = [];
  damagePops = [];
  hitFx = [];
  activeEvent = null;
  nextEventAt = 0;
  if (mode === "smash") {
    if (scoreLabel) scoreLabel.textContent = "分数";
    if (comboLabel) comboLabel.textContent = "连击";
    resetEnemies();
    setStatus("砸怪模式：点「开始运动」开练");
  } else {
    if (scoreLabel) scoreLabel.textContent = "击退";
    if (comboLabel) comboLabel.textContent = "召唤";
    resetVillage();
    setStatus("守村模式：点「开始运动」，给战士/维修充能");
  }
  updateHud();
  resizeCanvas();
  if (!isCameraOn()) drawCameraOffPlaceholder();
  else drawScene(null);
}

function roleChargeMax() {
  return Math.min(
    ROLE_CHARGE_MAX + Math.floor(score / 8),
    ROLE_CHARGE_MAX + 4
  );
}

function makeRolePad(type, cornerIndex) {
  const maxHp = randomInt(ROLE_CHARGE_MIN, roleChargeMax());
  return {
    type,
    cornerIndex,
    hp: maxHp,
    maxHp,
    hitImpactUntil: 0,
    hitShakeUntil: 0,
  };
}

function resetVillage() {
  buildings = BG_BUILDINGS.map((b) => ({
    key: b.key,
    src: b.src,
    x: b.x,
    y: b.y,
    h: b.h,
    maxHp: b.maxHp || 80,
    hp: b.maxHp || 80,
  }));
  rolePads = [
    makeRolePad("warrior", 1), // 左上
    makeRolePad("repairer", 0), // 右上
  ];
  allies = [];
  invaders = [];
  nextInvaderAt = performance.now() + 600;
  villageStartedAt = performance.now();
  villageKills = 0;
  villageSummons = 0;
  villageRepairs = 0;
  villageLost = false;
  resetComboTitleState();
  activeEvent = null;
  nextEventAt = performance.now() + EVENT_FIRST_DELAY_MS;
  invaderIdSeq = 1;
  updateHud();
}

function aliveBuildings() {
  return buildings.filter((b) => b.hp > 0);
}

function nearestBuilding(x, y) {
  const alive = aliveBuildings();
  if (!alive.length) return null;
  let best = alive[0];
  let bestD = Infinity;
  for (const b of alive) {
    const d = Math.hypot(b.x - x, b.y - 0.08 - y);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

function lowestHpBuilding() {
  const alive = aliveBuildings();
  if (!alive.length) return null;
  return alive.reduce((a, b) => (a.hp / a.maxHp <= b.hp / b.maxHp ? a : b));
}

function currentInvaderCap() {
  const cfg = diffCfg();
  const elapsed = (performance.now() - villageStartedAt) / 1000;
  return Math.min(
    cfg.maxInvaders,
    cfg.startCap + Math.floor(elapsed / cfg.rampSec)
  );
}

function spawnInvader(opts = {}) {
  const elite = Boolean(opts.elite);
  const cfg = diffCfg();
  if (!elite && invaders.length >= currentInvaderCap()) return null;
  if (!aliveBuildings().length) return null;
  const edge = randomInt(0, 3);
  let x = 0.5;
  let y = 0.5;
  if (edge === 0) {
    x = Math.random();
    y = 0.02;
  } else if (edge === 1) {
    x = Math.random();
    y = 0.92;
  } else if (edge === 2) {
    x = 0.02;
    y = 0.15 + Math.random() * 0.7;
  } else {
    x = 0.98;
    y = 0.15 + Math.random() * 0.7;
  }
  const target = nearestBuilding(x, y);
  const baseHp = cfg.invaderHp;
  const hp = elite ? Math.round(baseHp * 2.5) : baseHp;
  const inv = {
    id: invaderIdSeq++,
    x,
    y,
    hp,
    maxHp: hp,
    targetKey: target?.key ?? null,
    nextAttackAt: 0,
    elite,
    speed: elite ? cfg.speed * 1.35 : cfg.speed,
    attackDmg: elite ? cfg.attackDmg + 1 : cfg.attackDmg,
  };
  invaders.push(inv);
  return inv;
}

function clearActiveEvent(message) {
  activeEvent = null;
  nextEventAt =
    performance.now() +
    randomInt(EVENT_COOLDOWN_MIN_MS, EVENT_COOLDOWN_MAX_MS);
  if (message) setStatus(message);
}

function resolveRepairEvent(building, reason = "危机解除") {
  if (!activeEvent || activeEvent.type !== "repair") return;
  if (building && building.hp > 0) {
    const bonus = Math.max(8, Math.round(building.maxHp * EVENT_REPAIR_BONUS_RATIO));
    building.hp = Math.min(building.maxHp, building.hp + bonus);
    damagePops.push({
      x: building.x,
      y: building.y - 0.14,
      born: performance.now(),
      text: reason,
    });
  }
  clearActiveEvent("快修成功！建筑加固");
}

function tryStartVillageEvent(now) {
  if (activeEvent || now < nextEventAt) return;
  if (now - villageStartedAt < EVENT_FIRST_DELAY_MS) return;

  const damaged = aliveBuildings().filter((b) => b.hp / b.maxHp < 0.55);
  let type = "warrior";
  if (damaged.length > 0 && Math.random() < 0.65) type = "repair";
  else if (damaged.length > 0 && Math.random() < 0.5) type = "repair";

  if (type === "repair") {
    if (!damaged.length) {
      nextEventAt = now + 4000;
      return;
    }
    const building = damaged.reduce((a, b) =>
      a.hp / a.maxHp <= b.hp / b.maxHp ? a : b
    );
    activeEvent = {
      type: "repair",
      until: now + EVENT_DURATION_MS,
      buildingKey: building.key,
    };
    setStatus("危楼冒烟！快充「维修」或派维修兵！");
  } else {
    const elite = spawnInvader({ elite: true });
    if (!elite) {
      nextEventAt = now + 4000;
      return;
    }
    activeEvent = {
      type: "warrior",
      until: now + EVENT_DURATION_MS + 4000,
      eliteId: elite.id,
    };
    setStatus("精英冲锋！快充「战士」拦下它！");
  }
}

function spawnAlliesFromPad(pad) {
  const count = pad.maxHp;
  const corner = CORNERS[pad.cornerIndex % CORNERS.length];
  const box = cornerNormRect(corner);
  const cx = box.x + box.w * 0.5;
  const cy = box.y + box.h * 0.55;
  const now = performance.now();
  for (let i = 0; i < count; i++) {
    allies.push({
      type: pad.type,
      x: cx + (Math.random() - 0.5) * 0.08,
      y: cy + (Math.random() - 0.5) * 0.06,
      born: now,
      nextActionAt: now + 200 + i * 40,
    });
  }
  villageSummons += count;
  score = villageKills;
  damagePops.push({
    x: cx,
    y: box.y + box.h * 0.25,
    born: now,
    text: pad.type === "warrior" ? `战士+${count}` : `维修+${count}`,
  });

  if (
    pad.type === "repairer" &&
    activeEvent?.type === "repair" &&
    activeEvent.buildingKey
  ) {
    const b = buildings.find((x) => x.key === activeEvent.buildingKey);
    if (b && b.hp > 0) resolveRepairEvent(b);
  }
}

function applyRoleHit(source, pad) {
  const now = performance.now();
  if (now < hitCooldownUntil || !pad) return;
  hitCooldownUntil = now + HIT_COOLDOWN_MS;

  const corner = CORNERS[pad.cornerIndex % CORNERS.length];
  const box = cornerNormRect(corner);
  const spawnAtComplete = pad.maxHp;
  pad.hp -= 1;
  registerHitCombo();
  pad.hitImpactUntil = now + HIT_POP_MS;
  pad.hitShakeUntil = now + HIT_SHAKE_MS;
  damagePops.push({
    x: box.x + box.w * 0.5,
    y: box.y + box.h * 0.35,
    born: now,
    text: source === "nod" ? "点头!" : source === "slip" ? "躲闪!" : "-1",
  });
  if (damagePops.length > 10) damagePops.shift();
  flashHit();

  if (pad.hp <= 0) {
    spawnAlliesFromPad(pad);
    const idx = rolePads.indexOf(pad);
    const refreshed = makeRolePad(pad.type, pad.cornerIndex);
    rolePads[idx] = refreshed;
    celebrateUntil = now + 700;
    setStatus(
      `${pad.type === "warrior" ? "战士" : "维修"}就绪！召唤 ${spawnAtComplete} 名 · 连击 ${hitCombo}`
    );
  } else {
    updateHud();
    setStatus(
      `充能${pad.type === "warrior" ? "战士" : "维修"} ${pad.hp}/${pad.maxHp}（打满出 ${pad.maxHp}）· 连击 ${hitCombo}`
    );
  }
  updateHud();
}

function updateVillage(dt, now) {
  if (villageLost || gameMode !== "village") return;

  tickHitComboTimeout(now);
  tryStartVillageEvent(now);

  if (activeEvent && now > activeEvent.until) {
    if (activeEvent.type === "repair") {
      clearActiveEvent("快修超时，继续守村");
    } else {
      // Elite may still be alive after banner timeout — keep hunting until dead
      const eliteAlive = invaders.some(
        (i) => i.elite && i.id === activeEvent.eliteId && i.hp > 0
      );
      if (!eliteAlive) clearActiveEvent(null);
      else activeEvent.until = now + 5000;
    }
  }

  if (now >= nextInvaderAt) {
    const cfg = diffCfg();
    const roll = Math.random();
    const burst = roll < cfg.burstHot * 0.35 ? 3 : roll < cfg.burstHot ? 2 : 1;
    for (let i = 0; i < burst; i++) spawnInvader();
    nextInvaderAt = now + cfg.spawnMs + randomInt(0, Math.floor(cfg.spawnMs * 0.35));
  }

  // Invaders move / attack buildings
  for (const inv of invaders) {
    let target = buildings.find((b) => b.key === inv.targetKey && b.hp > 0);
    if (!target) {
      target = nearestBuilding(inv.x, inv.y);
      inv.targetKey = target?.key ?? null;
    }
    if (!target) continue;
    const tx = target.x;
    const ty = Math.max(0.12, target.y - 0.06);
    const dx = tx - inv.x;
    const dy = ty - inv.y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    const speed = inv.speed || diffCfg().speed;
    const dmg = inv.attackDmg || diffCfg().attackDmg;
    if (dist > 0.045) {
      inv.x += (dx / dist) * speed * dt;
      inv.y += (dy / dist) * speed * dt;
    } else if (now >= inv.nextAttackAt) {
      target.hp = Math.max(0, target.hp - dmg);
      inv.nextAttackAt = now + INVADER_ATTACK_MS;
      damagePops.push({
        x: target.x,
        y: target.y - 0.12,
        born: now,
        text: `-${dmg}`,
      });
    }
  }

  // Allies
  for (const ally of allies) {
    if (now - ally.born > ALLY_LIFETIME_MS) continue;
    if (ally.type === "warrior") {
      let target = null;
      let bestD = Infinity;
      for (const inv of invaders) {
        if (inv.hp <= 0) continue;
        // Prefer elite during warrior event
        const bias =
          activeEvent?.type === "warrior" && inv.id === activeEvent.eliteId
            ? -0.15
            : 0;
        const d = Math.hypot(inv.x - ally.x, inv.y - ally.y) + bias;
        if (d < bestD) {
          bestD = Math.hypot(inv.x - ally.x, inv.y - ally.y);
          target = inv;
        }
      }
      if (!target) continue;
      if (bestD > 0.04) {
        ally.x += ((target.x - ally.x) / bestD) * ALLY_SPEED * dt;
        ally.y += ((target.y - ally.y) / bestD) * ALLY_SPEED * dt;
      } else if (now >= ally.nextActionAt) {
        target.hp -= ALLY_ATTACK_DMG;
        ally.nextActionAt = now + ALLY_ATTACK_MS;
        if (target.hp <= 0) {
          const wasElite = target.elite;
          villageKills += wasElite ? 3 : 1;
          score = villageKills;
          if (
            wasElite &&
            activeEvent?.type === "warrior" &&
            activeEvent.eliteId === target.id
          ) {
            damagePops.push({
              x: target.x,
              y: target.y - 0.05,
              born: now,
              text: "击退精英",
            });
            clearActiveEvent("击退精英！干得漂亮");
          }
        }
      }
    } else {
      let target = lowestHpBuilding();
      if (
        activeEvent?.type === "repair" &&
        activeEvent.buildingKey
      ) {
        const urgent = buildings.find(
          (b) => b.key === activeEvent.buildingKey && b.hp > 0
        );
        if (urgent) target = urgent;
      }
      if (!target || target.hp >= target.maxHp) continue;
      const tx = target.x;
      const ty = Math.max(0.12, target.y - 0.05);
      const dist = Math.hypot(tx - ally.x, ty - ally.y) || 0.0001;
      if (dist > 0.04) {
        ally.x += ((tx - ally.x) / dist) * ALLY_SPEED * dt;
        ally.y += ((ty - ally.y) / dist) * ALLY_SPEED * dt;
      } else if (now >= ally.nextActionAt) {
        const before = target.hp;
        target.hp = Math.min(target.maxHp, target.hp + ALLY_REPAIR_AMT);
        if (target.hp > before) villageRepairs += 1;
        ally.nextActionAt = now + ALLY_REPAIR_MS;
        if (
          activeEvent?.type === "repair" &&
          activeEvent.buildingKey === target.key &&
          target.hp > before
        ) {
          resolveRepairEvent(target);
        }
      }
    }
  }

  invaders = invaders.filter((i) => i.hp > 0);
  allies = allies.filter((a) => now - a.born <= ALLY_LIFETIME_MS);

  if (
    activeEvent?.type === "warrior" &&
    !invaders.some((i) => i.id === activeEvent.eliteId)
  ) {
    // Elite died somehow without ally callback
    clearActiveEvent(null);
  }

  if (buildings.length && buildings.every((b) => b.hp <= 0)) {
    endVillageLose();
  } else {
    updateHud();
  }
}

function endVillageLose() {
  if (villageLost) return;
  villageLost = true;
  stopLoop();
  const secs = Math.max(1, Math.round((performance.now() - villageStartedAt) / 1000));
  if (resultTitle) resultTitle.textContent = "村庄沦陷";
  if (resultBody) {
    resultBody.textContent = `坚持 ${secs} 秒\n击退 ${villageKills} · 召唤 ${villageSummons} · 维修 ${villageRepairs}`;
  }
  if (resultOverlay) resultOverlay.hidden = false;
  setStatus("全部建筑被毁。可返回菜单再战。");
}

function drawUnitSprite(imgKey, x, y, size, cols = 6) {
  const img = enemyImages.get(imgKey);
  if (!(img?.complete && img.naturalWidth > 0)) {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x, y, size * 0.35, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const fw = img.naturalWidth / cols;
  const fh = img.naturalHeight;
  const frame = Math.floor(performance.now() / 90) % cols;
  ctx.drawImage(img, frame * fw, 0, fw, fh, x - size / 2, y - size / 2, size, size);
}

function drawBuildingHpBar(bx, by, bw, building) {
  const barW = Math.min(bw * 0.85, canvas.width * 0.14);
  const barH = Math.max(8, canvas.height * 0.012);
  const x = bx + (bw - barW) / 2;
  const y = by - barH - 6;
  const ratio = Math.max(0, building.hp / building.maxHp);
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x - 1, y - 1, barW + 2, barH + 2);
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillRect(x, y, barW, barH);
  ctx.fillStyle = ratio > 0.35 ? "#3ddc97" : "#ff5a5f";
  ctx.fillRect(x, y, barW * ratio, barH);
}

function drawRolePad(pad, now, cw, ch) {
  const corner = CORNERS[pad.cornerIndex % CORNERS.length];
  const box = cornerNormRect(corner);
  let rx = box.x * cw;
  let ry = box.y * ch;
  const rw = box.w * cw;
  const rh = box.h * ch;
  const hitting = now < pad.hitImpactUntil;
  const shaking = now < pad.hitShakeUntil;
  if (shaking) {
    const t = 1 - (pad.hitShakeUntil - now) / HIT_SHAKE_MS;
    const amp = (1 - t) * Math.max(8, cw * 0.014);
    rx += Math.sin(now / 18) * amp;
    ry += Math.cos(now / 15) * amp * 0.7;
  }
  const color = pad.type === "warrior" ? "#4cc9f0" : "#ffe566";
  ctx.save();
  ctx.globalAlpha = hitting ? 0.5 : 0.3;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(rx, ry, rw, rh, Math.min(24, rw * 0.08));
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = Math.max(3, cw * 0.005);
  ctx.stroke();

  const label = pad.type === "warrior" ? "战士充能" : "维修充能";
  ctx.fillStyle = "#081018";
  ctx.font = `bold ${Math.max(14, Math.floor(cw * 0.028))}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(label, rx + rw / 2, ry + rh * 0.22);
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${Math.max(16, Math.floor(cw * 0.032))}px sans-serif`;
  ctx.fillText(`打满出 ${pad.maxHp}`, rx + rw / 2, ry + rh * 0.38);

  // charge bar (remaining hits)
  const barW = rw * 0.7;
  const barH = Math.max(12, rh * 0.08);
  const bx = rx + (rw - barW) / 2;
  const by = ry + rh * 0.48;
  const ratio = Math.max(0, pad.hp / pad.maxHp);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(bx - 2, by - 2, barW + 4, barH + 4);
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillRect(bx, by, barW, barH);
  ctx.fillStyle = color;
  ctx.fillRect(bx, by, barW * ratio, barH);
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${Math.max(12, Math.floor(barH * 0.9))}px sans-serif`;
  ctx.fillText(`${pad.hp}/${pad.maxHp}`, rx + rw / 2, by + barH / 2 + 1);

  const artKey = pad.type === "warrior" ? "ally-warrior" : "ally-repair";
  const artSize = Math.min(rw, rh) * 0.55;
  const cols = pad.type === "warrior" ? 8 : 6;
  drawUnitSprite(artKey, rx + rw / 2, ry + rh * 0.78, artSize, cols);
  ctx.restore();
}

function drawMenuPreview() {
  resizeCanvas();
  const cw = canvas.width;
  const ch = canvas.height;
  if (!cw || !ch) return;
  drawTinySwordsBackground(cw, ch, BG_BUILDINGS);
}

function currentCorner() {
  return CORNERS[(enemies[0]?.cornerIndex ?? 0) % CORNERS.length];
}

function cornerOf(enemy) {
  return CORNERS[enemy.cornerIndex % CORNERS.length];
}

function anyEnemyImpact(now = performance.now()) {
  if (gameMode === "village") {
    return rolePads.some((p) => now < p.hitImpactUntil);
  }
  return enemies.some((e) => now < e.hitImpactUntil);
}

function occupiedCornerSet() {
  return new Set(enemies.map((e) => e.cornerIndex));
}

function freeCornerIndexes() {
  const occupied = occupiedCornerSet();
  const free = [];
  for (let i = 0; i < CORNERS.length; i++) {
    if (!occupied.has(i)) free.push(i);
  }
  return free;
}

function randomInt(min, maxInclusive) {
  return min + Math.floor(Math.random() * (maxInclusive - min + 1));
}

/** Spawn one enemy in a random free corner (任一：左上/右上/左下/右下). */
function spawnEnemy() {
  const cfg = diffCfg();
  if (enemies.length >= cfg.smashMax) return null;
  const free = freeCornerIndexes();
  if (free.length === 0) return null;
  const cornerIndex = free[Math.floor(Math.random() * free.length)];
  const maxHp = cfg.smashHits + Math.floor(score / 3);
  const enemy = {
    cornerIndex,
    hp: maxHp,
    maxHp,
    hitImpactUntil: 0,
    hitShakeUntil: 0,
  };
  enemies.push(enemy);
  return enemy;
}

/**
 * Keep 1–N enemies based on difficulty.
 */
function refillEnemies() {
  const cfg = diffCfg();
  const want = randomInt(cfg.smashMin, cfg.smashMax);
  while (enemies.length < want) {
    if (!spawnEnemy()) break;
  }
  if (enemies.length < cfg.smashMin) spawnEnemy();
  updateHud();
}

function resetEnemies() {
  enemies = [];
  damagePops = [];
  hitFx = [];
  refillEnemies();
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
  if (gameMode === "village") {
    scoreEl.textContent = String(villageKills);
    comboEl.textContent = String(villageSummons);
    const totalHp = buildings.reduce((s, b) => s + Math.max(0, b.hp), 0);
    const totalMax = buildings.reduce((s, b) => s + b.maxHp, 0) || 1;
    const alive = aliveBuildings().length;
    hpFill.style.width = `${Math.max(0, (totalHp / totalMax) * 100)}%`;
    hpText.textContent = `建筑 ${alive}/${buildings.length} · ${totalHp}/${totalMax}`;
    const w = allies.filter((a) => a.type === "warrior").length;
    const r = allies.filter((a) => a.type === "repairer").length;
    if (performance.now() < celebrateUntil) {
      promptEl.textContent = `友军出击！战士 ${w} · 维修 ${r}`;
    } else {
      promptEl.textContent = `充能战士/维修 · 血条=召唤数 · 友军 ${w}/${r}`;
    }
    return;
  }

  scoreEl.textContent = String(score);
  comboEl.textContent = String(combo);

  const totalHp = enemies.reduce((s, e) => s + e.hp, 0);
  const totalMax = enemies.reduce((s, e) => s + e.maxHp, 0) || 1;
  hpFill.style.width = `${Math.max(0, (totalHp / totalMax) * 100)}%`;
  hpText.textContent =
    enemies.length > 1
      ? `${enemies.length}只 · ${totalHp}/${totalMax}`
      : `${totalHp} / ${totalMax}`;

  const labels = enemies.map((e) => {
    const c = cornerOf(e);
    return `「${c.label}」${c.name || c.emoji}`;
  });

  if (performance.now() < celebrateUntil) {
    promptEl.textContent =
      labels.length > 0 ? `击杀！继续砸 ${labels.join(" + ")}` : "击杀！";
  } else if (labels.length === 0) {
    promptEl.textContent = gameMode ? "准备开始" : "选择模式";
  } else {
    promptEl.textContent = `砸 ${labels.join(" + ")} · 挥拳 / 甩头`;
  }
}

function spawnMonster(advance = false) {
  if (advance) {
    // Kept for compatibility; kills now remove + refill via refillEnemies.
  }
  refillEnemies();
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

function applyHit(source = "punch", enemy = null) {
  const now = performance.now();
  if (now < hitCooldownUntil) return;
  const target = enemy ?? enemies[0];
  if (!target) return;
  hitCooldownUntil = now + HIT_COOLDOWN_MS;

  const corner = cornerOf(target);
  const box = cornerNormRect(corner);
  target.hp -= 1;
  combo += 1;
  maybeShowComboTitle(combo);
  const attackFrames = corner.attackCols || corner.sheetCols || 4;
  const attackMs = Math.max(HIT_POP_MS, attackFrames * ENEMY_FRAME_MS);
  target.hitImpactUntil = now + attackMs;
  target.hitShakeUntil = now + HIT_SHAKE_MS;
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

  if (target.hp <= 0) {
    score += 1;
    combo = 0;
    lastTitleTier = 0;
    celebrateUntil = now + 900;
    enemies = enemies.filter((e) => e !== target);
    refillEnemies();
    setStatus(`干得漂亮！已击杀 ${score} 只`);
  } else {
    updateHud();
    const how =
      source === "nod"
        ? "点头"
        : source === "slip"
          ? "甩头躲闪"
          : source === "head"
            ? "头部撞击"
            : "挥拳";
    setStatus(`${how}击中「${corner.label}」！连击 ${combo}`);
  }
}

function drawMonsterHpBar(rx, ry, rw, rh, enemy) {
  const barW = Math.min(rw * 0.72, canvas.width * 0.28);
  const barH = Math.max(14, rh * 0.07);
  const bx = rx + (rw - barW) / 2;
  const by = Math.max(8, ry + rh * 0.08);
  const ratio = Math.max(0, enemy.hp / enemy.maxHp);
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
  ctx.fillText(`${enemy.hp}/${enemy.maxHp}`, bx + barW / 2, by + barH / 2 + 0.5);
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

  if (gameMode === "village") {
    if (villageLost || rolePads.length === 0) return;
    for (const pad of rolePads) {
      const corner = CORNERS[pad.cornerIndex % CORNERS.length];
      const wasOutside = !pointInCorner(w.px, w.py, corner);
      const nowInside = pointInCorner(w.x, w.y, corner);
      if (!wasOutside || !nowInside) continue;
      const speed = Math.hypot(w.x - w.px, w.y - w.py) / dt;
      if (speed >= HIT_SPEED) {
        applyRoleHit("punch", pad);
        return;
      }
    }
    return;
  }

  if (enemies.length === 0) return;
  for (const enemy of enemies) {
    const corner = cornerOf(enemy);
    const wasOutside = !pointInCorner(w.px, w.py, corner);
    const nowInside = pointInCorner(w.x, w.y, corner);
    if (!wasOutside || !nowInside) continue;

    const speed = Math.hypot(w.x - w.px, w.y - w.py) / dt;
    if (speed >= HIT_SPEED) {
      applyHit("punch", enemy);
      return;
    }
  }
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

/** Head slip (lateral) / nod (down) / jab into a monster or role pad. */
function checkHeadHit(dt) {
  if (!head.ready || dt <= 0) return;

  const targets =
    gameMode === "village"
      ? rolePads.map((pad) => ({
          pad,
          corner: CORNERS[pad.cornerIndex % CORNERS.length],
        }))
      : enemies.map((enemy) => ({ enemy, corner: cornerOf(enemy) }));

  if (!targets.length || (gameMode === "village" && villageLost)) return;

  for (const t of targets) {
    const wasOutside = !pointInCorner(head.px, head.py, t.corner);
    const nowInside = pointInCorner(head.x, head.y, t.corner);
    if (!wasOutside || !nowInside) continue;

    const dx = head.x - head.px;
    const dy = head.y - head.py;
    const speed = Math.hypot(dx, dy) / dt;
    const isNod = dy > 0.01 && dy >= Math.abs(dx) * 0.65 && speed >= HEAD_HIT_SPEED * 0.9;
    const isSlip =
      Math.abs(dx) > 0.01 && Math.abs(dx) >= Math.abs(dy) * 0.65 && speed >= HEAD_SLIP_SPEED;
    const isJab = speed >= HEAD_HIT_SPEED;
    const source = isNod ? "nod" : isSlip ? "slip" : isJab ? "head" : null;
    if (!source) continue;
    if (gameMode === "village") applyRoleHit(source, t.pad);
    else applyHit(source, t.enemy);
    return;
  }
}

/** Cover-draw mirrored video, then overlays in the same mirrored space. */
function drawTinySwordsBackground(cw, ch, buildingList = null) {
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

  const list = buildingList || (gameMode === "village" && buildings.length ? buildings : BG_BUILDINGS);
  // Sort by y so lower buildings draw in front.
  const sorted = [...list].sort((a, b) => a.y - b.y);
  for (const b of sorted) {
    if (b.hp != null && b.hp <= 0) {
      // Ruined tint placeholder
      ctx.save();
      ctx.globalAlpha = 0.35;
    }
    const img = enemyImages.get(b.key);
    if (!(img?.complete && img.naturalWidth > 0)) {
      if (b.hp != null && b.hp <= 0) ctx.restore();
      continue;
    }
    const drawH = ch * b.h;
    const drawW = (img.naturalWidth / img.naturalHeight) * drawH;
    const x = b.x * cw - drawW / 2;
    const y = b.y * ch - drawH;
    ctx.drawImage(img, x, y, drawW, drawH);
    if (b.hp != null && b.hp <= 0) ctx.restore();
    else if (b.hp != null && b.maxHp != null && b.hp > 0) {
      drawBuildingHpBar(x, y, drawW, b);
      const isUrgent =
        activeEvent?.type === "repair" && activeEvent.buildingKey === b.key;
      if (isUrgent) {
        const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 120);
        ctx.save();
        ctx.globalAlpha = 0.35 + pulse * 0.35;
        ctx.strokeStyle = "#ff9f1c";
        ctx.lineWidth = Math.max(3, drawW * 0.04);
        ctx.strokeRect(x - 4, y - 4, drawW + 8, drawH + 8);
        // smoke puffs
        ctx.globalAlpha = 0.5 + pulse * 0.3;
        ctx.fillStyle = "rgba(80,80,80,0.7)";
        const sx = x + drawW * 0.55;
        const sy = y + drawH * 0.15;
        for (let i = 0; i < 3; i++) {
          const oy = -i * 12 - (performance.now() / 30) % 20;
          ctx.beginPath();
          ctx.arc(sx + i * 6, sy + oy, 8 + i * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = "#ff9f1c";
        ctx.font = `bold ${Math.max(14, Math.floor(drawW * 0.22))}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("快修！", x + drawW / 2, y - 14);
        ctx.restore();
      }
    }
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

  if (gameMode === "village") {
    for (const pad of rolePads) drawRolePad(pad, now, cw, ch);
    for (const inv of invaders) {
      const elite = Boolean(inv.elite);
      const size = Math.max(36, cw * 0.055) * (elite ? 1.45 : 1);
      if (elite) {
        ctx.save();
        ctx.strokeStyle = "#ff2d55";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(inv.x * cw, inv.y * ch, size * 0.55, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      drawUnitSprite("invader-run", inv.x * cw, inv.y * ch, size, 6);
      // tiny hp
      const bw = size * 0.8;
      const bh = 6;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(inv.x * cw - bw / 2, inv.y * ch - size * 0.55, bw, bh);
      ctx.fillStyle = elite ? "#ff9f1c" : "#ff5a5f";
      ctx.fillRect(
        inv.x * cw - bw / 2,
        inv.y * ch - size * 0.55,
        bw * Math.max(0, inv.hp / inv.maxHp),
        bh
      );
      if (elite) {
        ctx.fillStyle = "#ffe566";
        ctx.font = `bold ${Math.max(12, Math.floor(cw * 0.022))}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("精英", inv.x * cw, inv.y * ch - size * 0.7);
      }
    }
    for (const ally of allies) {
      const size = Math.max(32, cw * 0.048);
      const key =
        ally.type === "warrior" ? "ally-warrior-run" : "ally-repair-run";
      const cols = ally.type === "warrior" ? 6 : 4;
      drawUnitSprite(key, ally.x * cw, ally.y * ch, size, cols);
    }
  } else {
    for (const enemy of enemies) {
      drawOneEnemy(enemy, now, cw, ch);
    }
  }

  drawDamagePops(now, cw, ch);
  drawHitFx(now, cw, ch);
  drawEventBanner(now, cw, ch);
  drawTitleToast(now, cw, ch);

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

function drawOneEnemy(enemy, now, cw, ch) {
  const corner = cornerOf(enemy);
  const box = cornerNormRect(corner);
  let rx = box.x * cw;
  let ry = box.y * ch;
  const rw = box.w * cw;
  const rh = box.h * ch;
  const pulsing = 0.9 + 0.1 * Math.sin(now / 160 + enemy.cornerIndex);
  const hitting = now < enemy.hitImpactUntil;
  const shaking = now < enemy.hitShakeUntil;

  if (shaking) {
    const t = 1 - (enemy.hitShakeUntil - now) / HIT_SHAKE_MS;
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

  drawMonsterHpBar(rx, ry, rw, rh, enemy);

  const cx = rx + rw / 2;
  const cy = ry + rh * 0.58;
  const hitScale = hitting
    ? 1.18 + 0.12 * Math.sin(((enemy.hitImpactUntil - now) / HIT_POP_MS) * Math.PI)
    : 1;
  const artSize = Math.floor(Math.min(rw, rh) * 1.7 * pulsing * hitScale);

  ctx.save();
  ctx.translate(cx, cy);
  if (hitting) ctx.rotate(Math.sin(now / 20) * 0.12);
  if (hitting) {
    ctx.shadowColor = "#3ddc97";
    ctx.shadowBlur = 28;
  }
  drawEnemySprite(corner, now, artSize, hitting, enemy.hitImpactUntil);
  ctx.restore();
  ctx.restore();
}

function drawHeadMarker(now, cw, ch) {
  if (!head.ready) return;
  const x = head.x * cw;
  const y = head.y * ch;
  const moving = Math.hypot(head.x - head.px, head.y - head.py);
  const impact = anyEnemyImpact(now);
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
  const impact = anyEnemyImpact(now);
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

/** Parse YouTube title/author into song + singer for display. */
function parseTrackInfo(data) {
  const rawTitle = String(data?.title || "").trim();
  const rawAuthor = String(data?.author || "").trim();
  if (!rawTitle) {
    return { song: "等待曲目…", artist: "—" };
  }

  const split = rawTitle.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (split) {
    return { artist: split[1].trim(), song: split[2].trim() };
  }

  const topic = rawAuthor.match(/^(.+?)\s*-\s*Topic$/i);
  if (topic) {
    return { artist: topic[1].trim(), song: rawTitle };
  }

  return {
    song: rawTitle,
    artist: rawAuthor || "未知歌手",
  };
}

function updateNowPlaying() {
  if (!ytSongEl || !ytArtistEl) return;
  try {
    const data = ytPlayer?.getVideoData?.();
    const info = parseTrackInfo(data);
    ytSongEl.textContent = info.song;
    ytArtistEl.textContent = info.artist;
    ytSongEl.title = info.song;
    ytArtistEl.title = info.artist;
  } catch {
    ytSongEl.textContent = "等待曲目…";
    ytArtistEl.textContent = "—";
  }
}

function skipPlaylist(dir) {
  try {
    if (!ytPlayer) return;
    // Allow next/prev to become the new loop target.
    ytLoopIndex = null;
    if (dir < 0) ytPlayer.previousVideo?.();
    else ytPlayer.nextVideo?.();
    setTimeout(() => {
      try {
        if (ytPlayMode === "loop") {
          const idx = ytPlayer.getPlaylistIndex?.();
          if (typeof idx === "number" && idx >= 0) ytLoopIndex = idx;
        }
      } catch {
        /* ignore */
      }
      updateNowPlaying();
    }, 350);
  } catch (err) {
    console.warn(err);
    setStatus("切歌失败，请稍后再试");
  }
}

function syncPlayModeButton() {
  if (!ytModeBtn) return;
  const isLoop = ytPlayMode === "loop";
  ytModeBtn.textContent = isLoop ? "单曲" : "随机";
  ytModeBtn.classList.toggle("loop", isLoop);
  ytModeBtn.title = isLoop ? "当前：单曲循环（点按切换随机）" : "当前：随机播放（点按切换单曲循环）";
  ytModeBtn.setAttribute("aria-label", ytModeBtn.title);
}

function applyPlayModeToPlayer(player = ytPlayer) {
  if (!player) return;
  try {
    if (ytPlayMode === "loop") {
      player.setShuffle?.(false);
      player.setLoop?.(false);
      const idx = player.getPlaylistIndex?.();
      if (typeof idx === "number" && idx >= 0) ytLoopIndex = idx;
    } else {
      ytLoopIndex = null;
      player.setShuffle?.(true);
      player.setLoop?.(true);
    }
  } catch {
    /* player may not be ready for shuffle/loop yet */
  }
}

function setPlayMode(mode) {
  ytPlayMode = mode === "loop" ? "loop" : "shuffle";
  try {
    localStorage.setItem(YT_MODE_STORAGE_KEY, ytPlayMode);
  } catch {
    /* ignore */
  }
  if (ytPlayMode === "loop") {
    try {
      const idx = ytPlayer?.getPlaylistIndex?.();
      ytLoopIndex = typeof idx === "number" && idx >= 0 ? idx : null;
    } catch {
      ytLoopIndex = null;
    }
  } else {
    ytLoopIndex = null;
  }
  syncPlayModeButton();
  applyPlayModeToPlayer();
  setStatus(ytPlayMode === "loop" ? "已切换：单曲循环" : "已切换：随机播放");
}

function togglePlayMode() {
  setPlayMode(ytPlayMode === "loop" ? "shuffle" : "loop");
}

function replayLoopedTrack() {
  try {
    if (typeof ytLoopIndex === "number" && ytLoopIndex >= 0) {
      ytPlayer.playVideoAt(ytLoopIndex);
      return;
    }
    ytPlayer.seekTo?.(0, true);
    ytPlayer.playVideo?.();
  } catch {
    /* ignore */
  }
}

function onYtStateChange(event) {
  updateNowPlaying();
  if (ytPlayMode !== "loop" || !ytPlayer) return;

  // YT.PlayerState: ENDED=0, PLAYING=1, BUFFERING=3
  if (event?.data === 0) {
    replayLoopedTrack();
    return;
  }

  if (event?.data === 1 || event?.data === 3) {
    try {
      const idx = ytPlayer.getPlaylistIndex?.();
      if (ytLoopIndex == null && typeof idx === "number" && idx >= 0) {
        ytLoopIndex = idx;
      }
      // Playlist auto-advanced — snap back to the looped index.
      if (
        typeof ytLoopIndex === "number" &&
        typeof idx === "number" &&
        idx !== ytLoopIndex
      ) {
        ytPlayer.playVideoAt(ytLoopIndex);
      }
    } catch {
      /* ignore */
    }
  }
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
      width: "96",
      height: "54",
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
          applyPlayModeToPlayer(event.target);
          updateNowPlaying();
          if (settled) return;
          settled = true;
          resolve();
        },
        onStateChange: onYtStateChange,
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
  updateNowPlaying();
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
    applyPlayModeToPlayer(player);
    if (play || running) {
      setTimeout(() => {
        try {
          const list = player.getPlaylist?.() ?? null;
          if (list && list.length > 0) {
            if (ytPlayMode === "shuffle") {
              player.playVideoAt(Math.floor(Math.random() * list.length));
            } else {
              player.playVideo();
            }
          } else {
            player.playVideo();
          }
          updateNowPlaying();
        } catch {
          /* ignore */
        }
      }, 350);
    } else {
      updateNowPlaying();
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

    applyPlayModeToPlayer(player);
    const list = player.getPlaylist?.() ?? null;
    if (list && list.length > 0) {
      if (ytPlayMode === "shuffle") {
        player.playVideoAt(Math.floor(Math.random() * list.length));
      } else {
        player.playVideo();
      }
    } else {
      // Playlist not loaded yet — start; in shuffle, jump ahead once ready.
      player.playVideo();
      if (ytPlayMode === "shuffle") {
        setTimeout(() => {
          try {
            applyPlayModeToPlayer(player);
            player.nextVideo();
          } catch {
            /* ignore */
          }
        }, 400);
      }
    }
    updateNowPlaying();
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

  if (gameMode === "village" && !villageLost) {
    updateVillage(dt, now);
  } else if (gameMode === "smash") {
    tickHitComboTimeout(now);
  }

  if (video.currentTime === lastVideoTime) {
    drawScene(null);
    return;
  }
  lastVideoTime = video.currentTime;

  const result = poseLandmarker.detectForVideo(video, now);
  const raw = result.landmarks?.[0] ?? null;
  let mirrored = null;

  if (raw && gameMode) {
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
  if (!gameMode) {
    setStatus("请先在菜单选择「砸怪健身」或「守村保卫」");
    return;
  }
  if (villageLost && gameMode === "village") {
    setStatus("本局已结束，请返回菜单再开一局");
    return;
  }

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
      void unlock
        .then(() => {
          punchSfx.pause();
          punchSfx.currentTime = 0;
        })
        .catch(() => {});
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
    resetComboTitleState();
    if (gameMode === "smash") {
      resetEnemies();
      setStatus("随机 1～2 只怪，砸向任一角落！");
    } else {
      resetVillage();
      setStatus("给左上战士 / 右上维修充能，打满按血条召唤友军！");
    }
    wrists.left.ready = false;
    wrists.right.ready = false;
    head.ready = false;
    lastTs = 0;
    lastVideoTime = -1;

    running = true;
    startBtn.textContent = "暂停";
    startBtn.classList.add("playing");
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
modeSmashBtn?.addEventListener("click", () => enterMode("smash"));
modeVillageBtn?.addEventListener("click", () => enterMode("village"));
modeSettingsBtn?.addEventListener("click", () => showSettings());
settingsBackBtn?.addEventListener("click", () => {
  hideSettings();
  showMenu();
});
document.querySelectorAll(".diff-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    setDifficulty(btn.getAttribute("data-diff") || "normal");
  });
});
menuBtn?.addEventListener("click", () => showMenu());
resultMenuBtn?.addEventListener("click", () => showMenu());
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
ytPrevBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  skipPlaylist(-1);
});
ytNextBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  skipPlaylist(1);
});
ytModeBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  togglePlayMode();
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
  if (appEl?.classList.contains("menu-open")) drawMenuPreview();
  else if (!isCameraOn()) drawCameraOffPlaceholder();
  else if (!running) drawScene(null);
});
updateCameraButton();
updateBgButton();
syncPlaylistInput();
syncPlayModeButton();
preloadEnemyImages();
syncDifficultyUI();
showMenu();
// Warm up YouTube embed so「开始运动」更容易一次点播。
void ensureYtPlayer().catch((err) => console.warn(err));
