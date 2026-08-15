import {
  FilesetResolver,
  PoseLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm";

const WRIST_L = 15;
const WRIST_R = 16;

/** Corners in mirrored screen space (what you see in selfie view). */
const CORNERS = [
  { id: "right-top", label: "右上", x: 0.7, y: 0.05, w: 0.25, h: 0.28, emoji: "👾" },
  { id: "left-top", label: "左上", x: 0.05, y: 0.05, w: 0.25, h: 0.28, emoji: "👹" },
  { id: "right-bottom", label: "右下", x: 0.7, y: 0.62, w: 0.25, h: 0.28, emoji: "🤖" },
  { id: "left-bottom", label: "左下", x: 0.05, y: 0.62, w: 0.25, h: 0.28, emoji: "👻" },
];

const HIT_SPEED = 0.55;
const HIT_COOLDOWN_MS = 320;
const SMOOTH = 0.45;
const BASE_HITS = 5;

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const flashEl = document.getElementById("flash");
const startBtn = document.getElementById("start-btn");
const cameraBtn = document.getElementById("camera-btn");
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

let score = 0;
let combo = 0;
let cornerIndex = 0;
let hp = BASE_HITS;
let maxHp = BASE_HITS;
let hitCooldownUntil = 0;
let celebrateUntil = 0;

const wrists = {
  left: { x: 0.5, y: 0.5, px: 0.5, py: 0.5, ready: false },
  right: { x: 0.5, y: 0.5, px: 0.5, py: 0.5, ready: false },
};

function setStatus(text) {
  statusEl.textContent = text;
}

function currentCorner() {
  return CORNERS[cornerIndex % CORNERS.length];
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
    promptEl.textContent = `砸向「${corner.label}」${corner.emoji}`;
  }
}

function spawnMonster(advance = false) {
  if (advance) {
    cornerIndex = (cornerIndex + 1) % CORNERS.length;
    maxHp = BASE_HITS + Math.floor(score / 3);
  }
  hp = maxHp;
  updateHud();
}

function flashHit() {
  flashEl.classList.add("on");
  setTimeout(() => flashEl.classList.remove("on"), 120);
  if (navigator.vibrate) navigator.vibrate(40);
}

function applyHit() {
  const now = performance.now();
  if (now < hitCooldownUntil) return;
  hitCooldownUntil = now + HIT_COOLDOWN_MS;

  hp -= 1;
  combo += 1;
  flashHit();

  if (hp <= 0) {
    score += 1;
    combo = 0;
    celebrateUntil = now + 900;
    spawnMonster(true);
    setStatus(`干得漂亮！已击杀 ${score} 只`);
  } else {
    updateHud();
    setStatus(`击中！连击 ${combo}`);
  }
}

function pointInCorner(x, y, corner) {
  return (
    x >= corner.x &&
    x <= corner.x + corner.w &&
    y >= corner.y &&
    y <= corner.y + corner.h
  );
}

function smoothWrist(side, nx, ny) {
  const w = wrists[side];
  if (!w.ready) {
    w.x = nx;
    w.y = ny;
    w.px = nx;
    w.py = ny;
    w.ready = true;
    return;
  }
  w.px = w.x;
  w.py = w.y;
  w.x = w.x * (1 - SMOOTH) + nx * SMOOTH;
  w.y = w.y * (1 - SMOOTH) + ny * SMOOTH;
}

function checkWristHit(side, dt) {
  const w = wrists[side];
  if (!w.ready || dt <= 0) return;
  const corner = currentCorner();
  if (!pointInCorner(w.x, w.y, corner)) return;

  const speed = Math.hypot(w.x - w.px, w.y - w.py) / dt;
  if (speed >= HIT_SPEED) applyHit();
}

/** Cover-draw mirrored video, then overlays in the same mirrored space. */
function drawScene(mirroredLandmarks) {
  const cw = canvas.width;
  const ch = canvas.height;
  ctx.clearRect(0, 0, cw, ch);

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

  const corner = currentCorner();
  const rx = corner.x * cw;
  const ry = corner.y * ch;
  const rw = corner.w * cw;
  const rh = corner.h * ch;
  const pulsing = 0.85 + 0.15 * Math.sin(performance.now() / 180);

  ctx.save();
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = "#ff5a5f";
  ctx.fillRect(rx, ry, rw, rh);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#ffb703";
  ctx.lineWidth = Math.max(3, cw * 0.004);
  ctx.strokeRect(rx, ry, rw, rh);
  ctx.font = `${Math.floor(Math.min(rw, rh) * 0.45 * pulsing)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(corner.emoji, rx + rw / 2, ry + rh / 2);
  ctx.restore();

  if (!mirroredLandmarks) return;
  for (const [idx, color] of [
    [WRIST_L, "#3ddc97"],
    [WRIST_R, "#4cc9f0"],
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

function drawCameraOffPlaceholder() {
  const cw = canvas.width || canvas.clientWidth || 640;
  const ch = canvas.height || canvas.clientHeight || 360;
  if (!canvas.width || !canvas.height) {
    canvas.width = cw;
    canvas.height = ch;
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
    if (l && (l.visibility == null || l.visibility > 0.35)) {
      const n = toCanvasNorm(l);
      smoothWrist("left", n.x, n.y);
      checkWristHit("left", dt);
    }
    if (r && (r.visibility == null || r.visibility > 0.35)) {
      const n = toCanvasNorm(r);
      smoothWrist("right", n.x, n.y);
      checkWristHit("right", dt);
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
    lastTs = 0;
    lastVideoTime = -1;

    running = true;
    startBtn.textContent = "暂停";
    startBtn.classList.add("playing");
    setStatus("站远一点，让上半身入镜，向角落挥拳！");
    loop();
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
window.addEventListener("resize", () => {
  resizeCanvas();
  if (!isCameraOn()) drawCameraOffPlaceholder();
});
updateCameraButton();
setStatus("可先「打开摄像头」，或直接点「开始运动」");
