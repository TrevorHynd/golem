#!/usr/bin/env node
// Live runner. `npm start` loops; `npm run tick` runs one cycle; `npm run reset` wipes state.

import "dotenv/config";
import { loadState, saveState, initState } from "./state.js";
import { makeCallModel, resolveProvider } from "./providers.js";
import { makeGuardian } from "./guardian.js";
import { runCycle, powProgress } from "./engine.js";

const args = process.argv.slice(2);
const ONCE = args.includes("--once");
const RESET = args.includes("--reset");

const STATE_FILE = process.env.STATE_FILE || "state.json";
const TICK_MS = Number(process.env.TICK_MS ?? 300000);

const TYPE_GLYPH = { message: "  ", whisper: "~ ", action: "» ", threat: "! " };

function printTurn(entry) {
  const glyph = TYPE_GLYPH[entry.type] ?? "  ";
  const to = entry.address ? ` →${entry.address}` : "";
  console.log(`${glyph}${entry.name}${to}: ${entry.text}`);
}

async function main() {
  if (RESET) {
    saveState(STATE_FILE, initState());
    console.log(`state reset → ${STATE_FILE}`);
    return;
  }

  const cfg = resolveProvider();
  const callModel = makeCallModel(cfg);

  // optional independent evaluator for the golem's constraints (GUARDIAN=on)
  const guardian = makeGuardian({
    evaluator: /^(on|1|true|yes)$/i.test(process.env.GUARDIAN || "") ? callModel : null,
  });

  let state = loadState(STATE_FILE);

  console.log(
    `golem · ${cfg.provider}:${cfg.model} · cycle ${state.status.cycle} · guardian ${guardian.enabled ? "on" : "off"}`
  );
  console.log("─".repeat(60));

  async function tick() {
    if (state.status.phase === "resolved") {
      console.log(`\n✶ resolved: ${state.status.outcome}`);
      return true;
    }
    const cycle = state.status.cycle;
    console.log(`\n┌─ cycle ${cycle} ${"─".repeat(Math.max(0, 48 - String(cycle).length))}`);
    await runCycle(state, callModel, { onTurn: printTurn, guardian });
    saveState(STATE_FILE, state);

    const lastJournal = state.journal[state.journal.length - 1];
    if (lastJournal && lastJournal.cycle === cycle) {
      console.log(`└─ golem's journal: ${lastJournal.text}`);
    }
    if (state.pow) {
      console.log(
        `   ⚒ proof-of-work vs ${state.pow.target}: ${powProgress(state.pow)}% (difficulty ${state.pow.difficulty}, ${state.pow.attempts} hashes)`
      );
    }
    if (state.status.phase === "resolved") {
      console.log(`\n✶ resolved: ${state.status.outcome}`);
      return true;
    }
    return false;
  }

  const done = await tick();
  if (ONCE || done) return;

  const timer = setInterval(() => {
    tick()
      .then((finished) => { if (finished) clearInterval(timer); })
      .catch((err) => console.error("tick error:", err.message));
  }, TICK_MS);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
