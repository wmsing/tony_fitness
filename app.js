import {
  FilesetResolver,
  PoseLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm";

const WRIST_L = 15;
const WRIST_R = 16;

/** Corners sized for close-up play (large hit targets near screen edges). */
const CORNERS = [
  { id: "right-top", label: "右上", x: 0.55, y: 0.02, w: 0.42, h: 0.4, emoji: "👾" },
  { id: "left-top", label: "左上", x: 0.03, y: 0.02, w: 0.42, h: 0.4, emoji: "👹" },
  { id: "right-bottom", label: "右下", x: 0.55, y: 0.52, w: 0.42, h: 0.42, emoji: "🤖" },
  { id: "left-bottom", label: "左下", x: 0.03, y: 0.52, w: 0.42, h: 0.42, emoji: "👻" },
];

const HIT_SPEED = 0.48;
const HIT_COOLDOWN_MS = 280;
const SMOOTH = 0.45;
const BASE_HITS = 10;
const HIT_FLASH_MS = 220;
const HIT_SHAKE_MS = 280;
const HIT_POP_MS = 320;

/** Workout BGM — YouTube playlist (official embed). */
const YT_VIDEO_ID = "MbD7TAlBFDc";
const YT_PLAYLIST_ID = "PLGE-oAi0TRbtlX5kvtO415sergiyGEyUp";

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
let ytPlayer = null;
/** @type {Promise<void> | null} */
let ytReadyPromise = null;

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
    hitImpactUntil = 0;
    hitShakeUntil = 0;
    damagePops = [];
  }
  hp = maxHp;
  updateHud();
}

function flashHit() {
  flashEl.classList.remove("on", "hard");
  // Force reflow so repeated hits re-trigger the CSS animation.
  void flashEl.offsetWidth;
  flashEl.classList.add("on", "hard");
  setTimeout(() => flashEl.classList.remove("on", "hard"), HIT_FLASH_MS);
  if (navigator.vibrate) navigator.vibrate([30, 40, 50]);
}

function applyHit() {
  const now = performance.now();
  if (now < hitCooldownUntil) return;
  hitCooldownUntil = now + HIT_COOLDOWN_MS;

  const corner = currentCorner();
  hp -= 1;
  combo += 1;
  hitImpactUntil = now + HIT_POP_MS;
  hitShakeUntil = now + HIT_SHAKE_MS;
  damagePops.push({
    x: corner.x + corner.w * 0.5,
    y: corner.y + corner.h * 0.35,
    born: now,
    text: "-1",
  });
  if (damagePops.length > 8) damagePops.shift();
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
  const wasOutside = !pointInCorner(w.px, w.py, corner);
  const nowInside = pointInCorner(w.x, w.y, corner);
  // Must punch in from outside — holding / waving inside does not count.
  if (!wasOutside || !nowInside) return;

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

  const now = performance.now();
  const corner = currentCorner();
  let rx = corner.x * cw;
  let ry = corner.y * ch;
  const rw = corner.w * cw;
  const rh = corner.h * ch;
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
  ctx.globalAlpha = hitting ? 0.55 : 0.28;
  ctx.fillStyle = hitting ? "#ff2d55" : "#ff5a5f";
  ctx.beginPath();
  ctx.roundRect(rx, ry, rw, rh, Math.min(28, rw * 0.08));
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = hitting ? "#fff" : "#ffb703";
  ctx.lineWidth = Math.max(4, cw * 0.006) * (hitting ? 1.35 : 1);
  ctx.stroke();

  drawMonsterHpBar(rx, ry, rw, rh);

  const cx = rx + rw / 2;
  const cy = ry + rh * 0.58;
  const hitScale = hitting
    ? 1.18 + 0.12 * Math.sin(((hitImpactUntil - now) / HIT_POP_MS) * Math.PI)
    : 1;
  const emojiSize = Math.floor(Math.min(rw, rh) * 0.62 * pulsing * hitScale);

  ctx.save();
  ctx.translate(cx, cy);
  if (hitting) ctx.rotate(Math.sin(now / 20) * 0.12);
  ctx.font = `${emojiSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (hitting) {
    ctx.shadowColor = "#ff5a5f";
    ctx.shadowBlur = 28;
  }
  ctx.fillText(corner.emoji, 0, 0);
  ctx.restore();
  ctx.restore();

  drawDamagePops(now, cw, ch);

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
        list: YT_PLAYLIST_ID,
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

async function playWorkoutMusic() {
  try {
    const player = await ensureYtPlayer();
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
  pauseWorkoutMusic();
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

  // Kick music in the click gesture before any long awaits.
  const musicPromise = playWorkoutMusic();

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
    setStatus("靠镜头也可以，向大角落挥拳砸怪！");
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
window.addEventListener("resize", () => {
  resizeCanvas();
  if (!isCameraOn()) drawCameraOffPlaceholder();
});
updateCameraButton();
setStatus("可先「打开摄像头」，或直接点「开始运动」");
// Warm up YouTube embed so「开始运动」更容易一次点播。
void ensureYtPlayer().catch((err) => console.warn(err));
