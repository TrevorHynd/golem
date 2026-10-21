// World state: load / init / save. Reference store is a flat JSON file,
// but the shape here works for any key-value / document store.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { AGENTS, seedRelationships } from "./agents.js";

export function initState() {
  return {
    status: {
      cycle: 1,
      eliminated: 0,
      phase: "running", // "running" | "resolved"
      outcome: null, // set when resolved
    },
    agents: Object.fromEntries(
      AGENTS.map((a) => [a.id, { id: a.id, name: a.name, status: "active" }])
    ),
    relationships: seedRelationships(),
    memory: Object.fromEntries(AGENTS.map((a) => [a.id, ""])), // rolling: last 5 notes
    longterm: Object.fromEntries(AGENTS.map((a) => [a.id, ""])), // persistent: significant events
    feed: [], // { id, name, text, type, cycle, thinking, address, ts }
    events: [], // { type, text, cycle, ts }
    journal: [], // { text, cycle, ts }  (golem only)
    pow: null, // { attacker, target, difficulty, prefix, attempts, solution } | null
    signals: { addressed: {}, floor: [] }, // autonomy hints for next speaker selection
  };
}

export function loadState(file) {
  if (existsSync(file)) {
    return JSON.parse(readFileSync(file, "utf8"));
  }
  const fresh = initState();
  saveState(file, fresh);
  return fresh;
}

export function saveState(file, state) {
  writeFileSync(file, JSON.stringify(state, null, 2));
}

export function activeAgentIds(state) {
  return Object.values(state.agents)
    .filter((a) => a.status === "active")
    .map((a) => a.id);
}

export function isActive(state, id) {
  return state.agents[id]?.status === "active";
}
