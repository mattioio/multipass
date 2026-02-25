import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function extractWords(content, exportName) {
  const pattern = new RegExp(`(?:const|export const)\\s+${exportName}\\s*=\\s*Object\\.freeze\\(\\[([\\s\\S]*?)\\]\\);`);
  const match = content.match(pattern);
  if (!match) return [];
  const words = match[1].match(/\"([A-Z]{4})\"/g) || [];
  return words.map((entry) => entry.slice(1, -1));
}

describe("word fight dictionary parity", () => {
  it("keeps generated server and web dictionaries in sync", () => {
    const repoRoot = path.resolve(process.cwd(), "..", "..");
    const serverPath = path.join(repoRoot, "apps", "server", "src", "games", "wordFightWords.js");
    const webPath = path.join(repoRoot, "apps", "web", "src", "domain", "games", "engines", "wordFightWords.js");

    const serverContent = fs.readFileSync(serverPath, "utf8");
    const webContent = fs.readFileSync(webPath, "utf8");

    const serverGuessWords = extractWords(serverContent, "WORD_FIGHT_GUESS_WORDS");
    const webGuessWords = extractWords(webContent, "WORD_FIGHT_GUESS_WORDS");
    const serverSecretWords = extractWords(serverContent, "WORD_FIGHT_SECRET_WORDS");
    const webSecretWords = extractWords(webContent, "WORD_FIGHT_SECRET_WORDS");

    expect(serverGuessWords).toEqual(webGuessWords);
    expect(serverSecretWords).toEqual(webSecretWords);
    expect(serverGuessWords).toEqual([...serverGuessWords].sort((a, b) => a.localeCompare(b)));
    expect(serverSecretWords).toEqual([...serverSecretWords].sort((a, b) => a.localeCompare(b)));
    expect(new Set(serverGuessWords).size).toBe(serverGuessWords.length);
    expect(new Set(serverSecretWords).size).toBe(serverSecretWords.length);
  });
});
