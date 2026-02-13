import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, "..");
const sourceSvgPath = path.resolve(webRoot, "icons/icon-source-checkerboard.svg");

const icon192 = path.resolve(webRoot, "icons/icon-192.png");
const icon512 = path.resolve(webRoot, "icons/icon-512.png");
const appleTouch = path.resolve(webRoot, "icons/apple-touch-icon.png");
const public192 = path.resolve(webRoot, "public/assets/icon-192.png");
const public512 = path.resolve(webRoot, "public/assets/icon-512.png");
const publicAppleTouch = path.resolve(webRoot, "public/icons/apple-touch-icon.png");

const outputSpecs = [
  { size: 192, path: icon192 },
  { size: 512, path: icon512 },
  { size: 180, path: appleTouch }
];

const serverPackageJsonPath = path.resolve(webRoot, "../server/package.json");
const requireFromServer = createRequire(serverPackageJsonPath);
const { chromium } = requireFromServer("@playwright/test");

function iconHtml(sourceUrl, size) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html,
      body {
        margin: 0;
        width: ${size}px;
        height: ${size}px;
        background: transparent;
        overflow: hidden;
      }
      img {
        display: block;
        width: ${size}px;
        height: ${size}px;
      }
    </style>
  </head>
  <body>
    <img id="icon" src="${sourceUrl}" alt="" />
  </body>
</html>`;
}

async function renderIcon(page, size, outputPath) {
  await page.setViewportSize({ width: size, height: size });
  const sourceUrl = `${pathToFileURL(sourceSvgPath).href}?size=${size}&ts=${Date.now()}`;
  await page.setContent(iconHtml(sourceUrl, size), { waitUntil: "load" });

  await page.waitForFunction(() => {
    const image = document.getElementById("icon");
    return Boolean(image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
  });

  await page.screenshot({
    path: outputPath,
    type: "png",
    omitBackground: true
  });
}

async function ensureOutputDirs() {
  const dirs = [
    path.dirname(icon192),
    path.dirname(icon512),
    path.dirname(appleTouch),
    path.dirname(public192),
    path.dirname(public512),
    path.dirname(publicAppleTouch)
  ];

  await Promise.all(dirs.map((dir) => mkdir(dir, { recursive: true })));
}

async function main() {
  await ensureOutputDirs();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    for (const outputSpec of outputSpecs) {
      await renderIcon(page, outputSpec.size, outputSpec.path);
      console.log(`Generated ${path.relative(webRoot, outputSpec.path)} (${outputSpec.size}x${outputSpec.size})`);
    }
  } finally {
    await page.close();
    await browser.close();
  }

  await copyFile(icon192, public192);
  await copyFile(icon512, public512);
  await copyFile(appleTouch, publicAppleTouch);

  console.log("Mirrored icons to public assets and public icons directories");
}

main().catch((error) => {
  console.error("Icon generation failed.");
  console.error(error?.message || error);
  console.error("If Chromium is missing, run: npx --prefix /Users/matthew/Projects/multipass/apps/server playwright install chromium");
  process.exit(1);
});
