import { writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { CONTRACT_EXAMPLES } from "../src/protocol/schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const outputPath = path.join(repoRoot, "docs", "ws-contract.md");

function jsonBlock(value) {
  return `\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}

const sections = [];
sections.push("# Multipass WebSocket Contract");
sections.push("");
sections.push("This document is generated from `/Users/matthew/Projects/multipass/apps/server/src/protocol/schema.js`.");
sections.push("Do not edit it manually; regenerate with `npm --prefix /Users/matthew/Projects/multipass/apps/server run contract:generate`.");
sections.push("");
sections.push("## Server -> Client");
sections.push("");

for (const [messageType, example] of Object.entries(CONTRACT_EXAMPLES.serverToClient)) {
  sections.push(`### \`${messageType}\``);
  sections.push(jsonBlock(example));
  sections.push("");
}

sections.push("## Client -> Server");
sections.push("");

for (const [messageType, example] of Object.entries(CONTRACT_EXAMPLES.clientToServer)) {
  sections.push(`### \`${messageType}\``);
  sections.push(jsonBlock(example));
  sections.push("");
}

sections.push("## Deprecated Messages");
sections.push("");
sections.push("`ready_up` and `start_round` are accepted for backward compatibility and return typed errors directing clients to `select_game`.");
sections.push("");
sections.push("## Frontend Runtime Validation");
sections.push("");
sections.push("`/Users/matthew/Projects/multipass/apps/web/src/contracts/roomState.js` contains room-shape validation for incoming `room_state` payloads.");

const markdown = `${sections.join("\n").trim()}\n`;
await writeFile(outputPath, markdown, "utf8");
console.log(`Wrote ${outputPath}`);
