import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "assets/enemy/png");

const JOBS = [
  { id: "right-top", fbx: "assets/enemy/KURENAI_asset/KURENAI_lowpoly.fbx" },
  { id: "left-top", fbx: "assets/enemy/SAMIDALE_asset/SAMIDALE_lowpoly.fbx" },
  { id: "right-bottom", fbx: "assets/enemy/GEKKOU_asset/GEKKOU_lowpoly.fbx" },
  { id: "left-bottom", fbx: "assets/enemy/KASA_asset/KASA_Lowpoly.fbx" },
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".fbx": "application/octet-stream",
  ".png": "image/png",
};

function contentType(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const filePath = path.join(root, urlPath === "/" ? "scripts/render-enemy.html" : urlPath);
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  res.writeHead(200, { "Content-Type": contentType(filePath) });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"],
});

try {
  for (const job of JOBS) {
    const page = await browser.newPage();
    page.on("console", (msg) => console.log(`[browser:${job.id}]`, msg.text()));
    page.on("pageerror", (err) => console.error(`[pageerror:${job.id}]`, err));
    const target = `http://127.0.0.1:${port}/scripts/render-enemy.html?fbx=/${encodeURI(job.fbx)}&size=768`;
    console.log("Rendering", job.id, "←", job.fbx);
    await page.goto(target, { waitUntil: "networkidle0", timeout: 120000 });
    await page.waitForFunction("window.__renderDone === true", { timeout: 120000 });
    const result = await page.evaluate(() => ({
      png: window.__png,
      error: window.__error,
    }));
    await page.close();
    if (result.error || !result.png) {
      throw new Error(`Failed ${job.id}: ${result.error || "no png"}`);
    }
    const outPath = path.join(outDir, `${job.id}.png`);
    const base64 = result.png.replace(/^data:image\/png;base64,/, "");
    const rawBuf = Buffer.from(base64, "base64");
    // Magenta (#FF00FF) backdrop → transparent (models are dark; avoid black-key).
    const { default: sharp } = await import("sharp");
    const { data, info } = await sharp(rawBuf)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r > 220 && g < 40 && b > 220) {
        data[i + 3] = 0;
      }
    }
    await sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png()
      .toFile(outPath);
    console.log("Wrote", outPath);
  }
} finally {
  await browser.close();
  server.close();
}

console.log("Done.");
