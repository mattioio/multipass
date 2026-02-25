import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

const sourcePath = path.join(repoRoot, "apps", "server", "src", "games", "wordFightWords.source.uk-us.txt");
const blocklistPath = path.join(repoRoot, "apps", "server", "src", "games", "wordFightWords.blocklist.txt");
const serverOutputPath = path.join(repoRoot, "apps", "server", "src", "games", "wordFightWords.js");
const webOutputPath = path.join(repoRoot, "apps", "web", "src", "domain", "games", "engines", "wordFightWords.js");

const checkOnly = process.argv.includes("--check");

const GUESS_TIERS = Object.freeze([10, 20, 35, 40, 50, 55, 60, 70]);
const SECRET_TIERS = Object.freeze([10, 20, 35, 40]);
const DIALECTS = Object.freeze(["english", "english/american", "english/british"]);

function normalizeWord(rawWord) {
  return String(rawWord || "").trim().toUpperCase();
}

function isValidWord(word) {
  return /^[A-Z]{4}$/.test(word);
}

function parseWordLines(rawText) {
  return String(rawText || "")
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

function formatWords(words) {
  const rows = [];
  const perRow = 10;
  for (let index = 0; index < words.length; index += perRow) {
    const chunk = words.slice(index, index + perRow);
    rows.push(`  ${chunk.map((word) => `"${word}"`).join(", ")}`);
  }
  return rows.join(",\n");
}

function renderServerModule(guessWords, secretWords) {
  return `// AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.\n// Source: wordlist-english (fallback: apps/server/src/games/wordFightWords.source.uk-us.txt)\n// Filter: /^[A-Z]{4}$/ + blocklist exclusions\n\nconst WORD_FIGHT_GUESS_WORDS = Object.freeze([\n${formatWords(guessWords)}\n]);\n\nconst WORD_FIGHT_SECRET_WORDS = Object.freeze([\n${formatWords(secretWords)}\n]);\n\nconst WORD_FIGHT_WORD_SET = new Set(WORD_FIGHT_GUESS_WORDS);\n\nexport const WORD_FIGHT_WORDS = WORD_FIGHT_GUESS_WORDS;\n\nexport function listWordFightWords() {\n  return WORD_FIGHT_GUESS_WORDS;\n}\n\nexport function isWordFightWord(word) {\n  return WORD_FIGHT_WORD_SET.has(String(word || "").toUpperCase());\n}\n\nexport { WORD_FIGHT_GUESS_WORDS, WORD_FIGHT_SECRET_WORDS };\n\nexport default WORD_FIGHT_GUESS_WORDS;\n`;
}

function renderWebModule(guessWords, secretWords) {
  return `// AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.\n// Source: wordlist-english (fallback: apps/server/src/games/wordFightWords.source.uk-us.txt)\n// Filter: /^[A-Z]{4}$/ + blocklist exclusions\n\nexport const WORD_FIGHT_GUESS_WORDS = Object.freeze([\n${formatWords(guessWords)}\n]);\n\nexport const WORD_FIGHT_SECRET_WORDS = Object.freeze([\n${formatWords(secretWords)}\n]);\n\nexport const WORD_FIGHT_WORDS = WORD_FIGHT_GUESS_WORDS;\n\nconst WORD_FIGHT_WORD_SET = new Set(WORD_FIGHT_GUESS_WORDS);\n\nexport function isWordFightWord(word) {\n  return WORD_FIGHT_WORD_SET.has(String(word || "").toUpperCase());\n}\n`;
}

function buildNormalizedSet(rawWords, blocklist) {
  return [...new Set((Array.isArray(rawWords) ? rawWords : [])
    .map(normalizeWord)
    .filter((word) => isValidWord(word) && !blocklist.has(word)))]
    .sort((a, b) => a.localeCompare(b));
}

async function loadSourceWords(blocklist) {
  const sourceRaw = await fs.readFile(sourcePath, "utf8");
  const sourceWords = parseWordLines(sourceRaw);
  const normalized = buildNormalizedSet(sourceWords, blocklist);
  return {
    guessWords: normalized,
    secretWords: normalized,
    source: "fallback_source_file"
  };
}

function getWordlistEntries(wordlists, key) {
  const value = wordlists?.[key];
  return Array.isArray(value) ? value : [];
}

function collectTierWords(wordlists, dialects, tiers) {
  const words = [];
  for (const dialect of dialects) {
    for (const tier of tiers) {
      words.push(...getWordlistEntries(wordlists, `${dialect}/${tier}`));
    }
  }
  return words;
}

async function loadWordlistEnglishWords(blocklist) {
  try {
    const imported = await import("wordlist-english");
    const wordlists = imported?.wordlists || imported?.default?.wordlists || imported?.default || null;
    if (!wordlists || typeof wordlists !== "object") {
      throw new Error("wordlist-english export shape not recognized.");
    }

    const rawGuessWords = collectTierWords(wordlists, DIALECTS, GUESS_TIERS);
    const rawSecretWords = collectTierWords(wordlists, DIALECTS, SECRET_TIERS);

    const guessWords = buildNormalizedSet(rawGuessWords, blocklist);
    const secretWordSet = new Set(buildNormalizedSet(rawSecretWords, blocklist));
    const secretWords = guessWords.filter((word) => secretWordSet.has(word));

    return {
      guessWords,
      secretWords,
      source: "wordlist_english"
    };
  } catch (error) {
    if (error && (error.code === "ERR_MODULE_NOT_FOUND" || /Cannot find package 'wordlist-english'/.test(String(error.message || "")))) {
      return null;
    }
    throw error;
  }
}

async function loadWords() {
  const blocklistRaw = await fs.readFile(blocklistPath, "utf8");
  const blocklist = new Set(
    parseWordLines(blocklistRaw)
      .map(normalizeWord)
      .filter(isValidWord)
  );

  const fromPackage = await loadWordlistEnglishWords(blocklist);
  if (fromPackage) return fromPackage;
  return loadSourceWords(blocklist);
}

async function assertIncludesRequiredWords({ guessWords, secretWords }) {
  const requiredGuessWords = ["TIME", "GOOD", "SEEN", "RAGS", "WORM"];
  const missingGuess = requiredGuessWords.filter((word) => !guessWords.includes(word));
  if (missingGuess.length) {
    throw new Error(`Guess dictionary is missing required words: ${missingGuess.join(", ")}`);
  }

  if (!secretWords.length) {
    throw new Error("Secret dictionary is empty after filtering.");
  }
}

async function main() {
  const dictionary = await loadWords();
  await assertIncludesRequiredWords(dictionary);

  const serverModule = renderServerModule(dictionary.guessWords, dictionary.secretWords);
  const webModule = renderWebModule(dictionary.guessWords, dictionary.secretWords);

  if (checkOnly) {
    const [currentServer, currentWeb] = await Promise.all([
      fs.readFile(serverOutputPath, "utf8"),
      fs.readFile(webOutputPath, "utf8")
    ]);

    if (currentServer !== serverModule || currentWeb !== webModule) {
      throw new Error("Generated dictionary modules are out of date. Run: npm --prefix apps/server run dict:wordfight");
    }

    console.log(`Word Fight dictionary check passed (${dictionary.guessWords.length} guess words, ${dictionary.secretWords.length} secret words, source=${dictionary.source}).`);
    return;
  }

  await Promise.all([
    fs.writeFile(serverOutputPath, serverModule, "utf8"),
    fs.writeFile(webOutputPath, webModule, "utf8")
  ]);

  console.log(`Generated Word Fight dictionaries (${dictionary.guessWords.length} guess words, ${dictionary.secretWords.length} secret words, source=${dictionary.source}).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
