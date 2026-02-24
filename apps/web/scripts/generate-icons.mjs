import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, "..");
const sourceSvgPath = path.resolve(webRoot, "src/assets/appicon.svg");

const favicon16 = path.resolve(webRoot, "icons/favicon-16.png");
const favicon32 = path.resolve(webRoot, "icons/favicon-32.png");
const favicon48 = path.resolve(webRoot, "icons/favicon-48.png");
const faviconIco = path.resolve(webRoot, "icons/favicon.ico");
const icon192 = path.resolve(webRoot, "icons/icon-192.png");
const icon512 = path.resolve(webRoot, "icons/icon-512.png");
const appleTouch = path.resolve(webRoot, "icons/apple-touch-icon.png");
const publicFaviconIco = path.resolve(webRoot, "public/favicon.ico");
const publicFavicon16 = path.resolve(webRoot, "public/icons/favicon-16.png");
const publicFavicon32 = path.resolve(webRoot, "public/icons/favicon-32.png");
const publicFavicon48 = path.resolve(webRoot, "public/icons/favicon-48.png");
const publicAppiconSvg = path.resolve(webRoot, "public/icons/appicon.svg");
const public192 = path.resolve(webRoot, "public/assets/icon-192.png");
const public512 = path.resolve(webRoot, "public/assets/icon-512.png");
const publicAppleTouch = path.resolve(webRoot, "public/icons/apple-touch-icon.png");

const outputSpecs = [
  { size: 16, path: favicon16 },
  { size: 32, path: favicon32 },
  { size: 48, path: favicon48 },
  { size: 192, path: icon192 },
  { size: 512, path: icon512 },
  { size: 180, path: appleTouch }
];

const faviconIcoPngSpecs = [
  { size: 16, path: favicon16 },
  { size: 32, path: favicon32 },
  { size: 48, path: favicon48 }
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
      #icon-wrap,
      svg {
        display: block;
        width: ${size}px;
        height: ${size}px;
      }
    </style>
  </head>
  <body>
    <div id="icon-wrap">${sourceUrl}</div>
  </body>
</html>`;
}

function mimeTypeFor(assetPath) {
  if (assetPath.endsWith(".svg")) return "image/svg+xml";
  if (assetPath.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

async function readCanonicalSourceSvg() {
  let svgText = "";
  try {
    svgText = await readFile(sourceSvgPath, "utf-8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(
        `Canonical icon source is missing: ${sourceSvgPath}\nCreate or restore this file, then rerun the generator.`
      );
    }
    if (error?.code === "EACCES") {
      throw new Error(
        `Canonical icon source is not readable: ${sourceSvgPath}\nCheck file permissions, then rerun the generator.`
      );
    }
    throw new Error(`Failed to read canonical icon source ${sourceSvgPath}: ${error?.message || error}`);
  }

  if (!svgText.trim()) {
    throw new Error(`Canonical icon source is empty: ${sourceSvgPath}`);
  }

  if (!/<svg[\s>]/i.test(svgText)) {
    throw new Error(`Canonical icon source does not contain a valid <svg> root: ${sourceSvgPath}`);
  }

  return svgText;
}

async function inlineSvgAssetHrefs(svgText) {
  const hrefRegex = /\b(?:href|xlink:href)="([^"]+)"/g;
  const uniqueRefs = new Set();
  let match = hrefRegex.exec(svgText);
  while (match) {
    const href = match[1];
    if (href.startsWith("data:") || href.startsWith("#")) {
      match = hrefRegex.exec(svgText);
      continue;
    }
    if (/^https?:\/\//i.test(href)) {
      throw new Error(
        `External SVG asset URLs are not supported in ${sourceSvgPath}: ${href}\nUse local relative assets so exports are deterministic.`
      );
    }
    uniqueRefs.add(href);
    match = hrefRegex.exec(svgText);
  }

  let inlinedSvg = svgText;
  for (const href of uniqueRefs) {
    const absoluteAssetPath = path.resolve(path.dirname(sourceSvgPath), href);
    let assetBuffer;
    try {
      assetBuffer = await readFile(absoluteAssetPath);
    } catch (error) {
      if (error?.code === "ENOENT") {
        throw new Error(
          `SVG references a missing asset: "${href}"\nExpected at: ${absoluteAssetPath}\nFix the path in ${sourceSvgPath}.`
        );
      }
      if (error?.code === "EACCES") {
        throw new Error(
          `SVG references an unreadable asset: "${href}"\nPath: ${absoluteAssetPath}\nCheck permissions and rerun.`
        );
      }
      throw new Error(
        `Failed to read SVG referenced asset "${href}" at ${absoluteAssetPath}: ${error?.message || error}`
      );
    }
    const mimeType = mimeTypeFor(absoluteAssetPath);
    const dataUri = `data:${mimeType};base64,${assetBuffer.toString("base64")}`;
    const quotedHref = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    inlinedSvg = inlinedSvg
      .replace(new RegExp(`href="${quotedHref}"`, "g"), `href="${dataUri}"`)
      .replace(new RegExp(`xlink:href="${quotedHref}"`, "g"), `xlink:href="${dataUri}"`);
  }

  return inlinedSvg;
}

async function renderIcon(page, size, outputPath, inlinedSvg) {
  await page.setViewportSize({ width: size, height: size });
  try {
    await page.setContent(iconHtml(inlinedSvg, size), { waitUntil: "load" });

    await page.waitForFunction(() => {
      const svg = document.querySelector("svg");
      if (!svg) return false;
      const imageNodes = document.querySelectorAll("image");
      for (const node of imageNodes) {
        const href = node.getAttribute("href") || node.getAttribute("xlink:href") || "";
        if (href && !href.startsWith("data:")) return false;
      }
      return true;
    }, { timeout: 5000 });

    await page.screenshot({
      path: outputPath,
      type: "png",
      omitBackground: true
    });
  } catch (error) {
    throw new Error(
      `Failed to render ${size}x${size} icon from ${sourceSvgPath}: ${error?.message || error}`
    );
  }
}

async function ensureOutputDirs() {
  const dirs = [
    path.dirname(favicon16),
    path.dirname(favicon32),
    path.dirname(favicon48),
    path.dirname(faviconIco),
    path.dirname(icon192),
    path.dirname(icon512),
    path.dirname(appleTouch),
    path.dirname(publicFaviconIco),
    path.dirname(publicFavicon16),
    path.dirname(publicFavicon32),
    path.dirname(publicFavicon48),
    path.dirname(publicAppiconSvg),
    path.dirname(public192),
    path.dirname(public512),
    path.dirname(publicAppleTouch)
  ];

  await Promise.all(dirs.map((dir) => mkdir(dir, { recursive: true })));
}

async function buildIcoBufferFromPngSpecs(pngSpecs) {
  const pngEntries = await Promise.all(
    pngSpecs.map(async (spec) => ({
      size: spec.size,
      buffer: await readFile(spec.path)
    }))
  );

  const count = pngEntries.length;
  const headerSize = 6 + count * 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  let offset = headerSize;
  const payloadBuffers = [];
  pngEntries.forEach((entry, index) => {
    const base = 6 + index * 16;
    const width = entry.size >= 256 ? 0 : entry.size;
    const height = entry.size >= 256 ? 0 : entry.size;
    header.writeUInt8(width, base + 0);
    header.writeUInt8(height, base + 1);
    header.writeUInt8(0, base + 2);
    header.writeUInt8(0, base + 3);
    header.writeUInt16LE(1, base + 4);
    header.writeUInt16LE(32, base + 6);
    header.writeUInt32LE(entry.buffer.length, base + 8);
    header.writeUInt32LE(offset, base + 12);
    offset += entry.buffer.length;
    payloadBuffers.push(entry.buffer);
  });

  return Buffer.concat([header, ...payloadBuffers]);
}

async function main() {
  await ensureOutputDirs();
  const svgText = await readCanonicalSourceSvg();
  const inlinedSvg = await inlineSvgAssetHrefs(svgText);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    for (const outputSpec of outputSpecs) {
      await renderIcon(page, outputSpec.size, outputSpec.path, inlinedSvg);
      console.log(`Generated ${path.relative(webRoot, outputSpec.path)} (${outputSpec.size}x${outputSpec.size})`);
    }

    const icoBuffer = await buildIcoBufferFromPngSpecs(faviconIcoPngSpecs);
    await writeFile(faviconIco, icoBuffer);
    console.log(`Generated ${path.relative(webRoot, faviconIco)} (${faviconIcoPngSpecs.length} embedded sizes)`);
  } finally {
    await page.close();
    await browser.close();
  }

  await copyFile(favicon16, publicFavicon16);
  await copyFile(favicon32, publicFavicon32);
  await copyFile(favicon48, publicFavicon48);
  await copyFile(faviconIco, publicFaviconIco);
  await copyFile(sourceSvgPath, publicAppiconSvg);
  await copyFile(icon192, public192);
  await copyFile(icon512, public512);
  await copyFile(appleTouch, publicAppleTouch);

  console.log("Mirrored icons to public favicon, assets, and icons directories");
}

main().catch((error) => {
  console.error("Icon generation failed.");
  console.error(error?.message || error);
  console.error("If Chromium is missing, run: npx --prefix /Users/matthew/Projects/multipass/apps/server playwright install chromium");
  process.exit(1);
});
