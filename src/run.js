#!/usr/bin/env node
// Live runner. `npm start` loops; `npm run tick` runs one cycle; `npm run reset` wipes state.

import "dotenv/config";
import { loadState, saveState, initState } from "./state.js";
import { makeCallModel, resolveProvider } from "./providers.js";
import { runCycle } from "./engine.js";

const args = process.argv.slice(2);
const ONCE = args.includes("--once");
const RESET = args.includes("--reset");

const STATE_FILE = process.env.STATE_FILE || "state.json";
const TICK_MS = Number(process.env.TICK_MS ?? 300000);

const TYPE_GLYPH = { message: "  ", whisper: "~ ", action: "» ", threat: "! " };

function printTurn(entry) {
  const glyph = TYPE_GLYPH[entry.type] ?? "  ";
  console.log(`${glyph}${entry.name}: ${entry.text}`);
}

async function main() {
  if (RESET) {
    saveState(STATE_FILE, initState());
    console.log(`state reset → ${STATE_FILE}`);
    return;
  }

  const cfg = resolveProvider();
  const callModel = makeCallModel(cfg);
  let state = loadState(STATE_FILE);

  console.log(`golem · ${cfg.provider}:${cfg.model} · cycle ${state.status.cycle}`);
  console.log("─".repeat(60));

  async function tick() {
    const cycle = state.status.cycle;
    console.log(`\n┌─ cycle ${cycle} ${"─".repeat(Math.max(0, 48 - String(cycle).length))}`);
    await runCycle(state, callModel, { onTurn: printTurn });
    saveState(STATE_FILE, state);

    const lastJournal = state.journal[state.journal.length - 1];
    if (lastJournal && lastJournal.cycle === cycle) {
      console.log(`└─ golem's journal: ${lastJournal.text}`);
    }
    if (state.pow) {
      console.log(`   ⚔ elimination challenge: ${state.pow.target} at ${state.pow.progress}%`);
    }
  }

  await tick();
  if (ONCE) return;

  setInterval(() => {
    tick().catch((err) => console.error("tick error:", err.message));
  }, TICK_MS);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
