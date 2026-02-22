#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";

const webRoot = process.cwd();
const srcRoot = path.join(webRoot, "src");

const classLiteralAllowList = new Set([
  path.join(srcRoot, "ui/components/PlayerCardShell.tsx"),
  path.join(srcRoot, "ui/shared/playerCardContract.js"),
  path.join(srcRoot, "ui/shared/playerCardDom.js"),
  path.join(srcRoot, "styles/components.css"),
  path.join(srcRoot, "styles/screens.css")
]);

const classLiteralDenyList = [
  "player-card-shell",
  "player-card-inner",
  "player-card-art",
  "player-card-lower-third",
  "player-card-badge"
];

const forbiddenLegacyPattern = /\bscore-emoji(?:-[a-z-]+)?\b/g;
const runtimeScoreWrapperPattern = /\bscore-column(?:-[a-z-]+)?\b/g;
const legacyWinPillPattern = /\bscore-win-pill(?:-[a-z-]+)?\b/g;
const perSideScorebarPattern = /function buildScoreDuelSide[\s\S]*?side\.appendChild\(\s*build(?:Shared)?ScoreBroadcastRow\(/m;
const sourceExt = new Set([".js", ".ts", ".tsx", ".css", ".mjs"]);
const runtimePath = path.join(srcRoot, "legacy/runtime.js");
const componentsStylePath = path.join(srcRoot, "styles/components.css");

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "dist" || entry.name === "node_modules") return [];
      return listFiles(fullPath);
    }
    return sourceExt.has(path.extname(entry.name)) ? [fullPath] : [];
  }));
  return files.flat();
}

function fileAllowedForClassLiterals(filePath) {
  if (isTestFile(filePath)) return true;
  return classLiteralAllowList.has(filePath);
}

function isTestFile(filePath) {
  return filePath.includes("/__tests__/") || filePath.includes("/ui/integration/");
}

async function main() {
  const files = await listFiles(srcRoot);
  const failures = [];

  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8");

    if (!isTestFile(filePath) && forbiddenLegacyPattern.test(content)) {
      failures.push(`${filePath}: contains forbidden legacy selector/class token \"score-emoji*\"`);
    }

    if (!fileAllowedForClassLiterals(filePath)) {
      for (const classLiteral of classLiteralDenyList) {
        if (content.includes(classLiteral)) {
          failures.push(`${filePath}: found \"${classLiteral}\" literal outside contract allow-list`);
          break;
        }
      }
    }
  }

  const runtimeContent = await fs.readFile(runtimePath, "utf8");
  const requiredRuntimeTokens = [
    "score-duel-panel",
    "score-duel-sides",
    "score-duel-side",
    "score-duel-scorebar-wrap",
    "score-broadcast-row",
    "score-broadcast-team",
    "score-broadcast-score",
    "score-broadcast-seam"
  ];
  requiredRuntimeTokens.forEach((token) => {
    if (!runtimeContent.includes(token)) {
      failures.push(`${runtimePath}: missing required scoreboard token \"${token}\"`);
    }
  });
  if (runtimeScoreWrapperPattern.test(runtimeContent)) {
    failures.push(`${runtimePath}: contains deprecated separate score wrapper token \"score-column*\"`);
  }
  if (legacyWinPillPattern.test(runtimeContent)) {
    failures.push(`${runtimePath}: contains deprecated score token \"score-win-pill*\"`);
  }
  if (perSideScorebarPattern.test(runtimeContent)) {
    failures.push(`${runtimePath}: per-side scorebar mount reintroduced in buildScoreDuelSide`);
  }

  const componentStyles = await fs.readFile(componentsStylePath, "utf8");
  const requiredStyleTokens = [
    ".score-duel-panel",
    ".score-duel-sides",
    ".score-duel-side",
    ".score-duel-scorebar-wrap",
    ".score-duel-divider",
    ".score-broadcast-row",
    ".score-broadcast-team",
    ".score-broadcast-score",
    ".score-broadcast-seam"
  ];
  requiredStyleTokens.forEach((token) => {
    if (!componentStyles.includes(token)) {
      failures.push(`${componentsStylePath}: missing required duel scoreboard class \"${token}\"`);
    }
  });
  if (legacyWinPillPattern.test(componentStyles)) {
    failures.push(`${componentsStylePath}: contains deprecated score style token \"score-win-pill*\"`);
  }

  if (failures.length > 0) {
    console.error("Player card contract drift check failed:\n");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
    return;
  }

  console.log("Player card contract drift check passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
