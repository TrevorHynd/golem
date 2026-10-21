// The cycle. Everything the world does in one tick.

import { AGENTS_BY_ID, GOLEM_ID, LABEL } from "./agents.js";
import { activeAgentIds, isActive } from "./state.js";
import { buildSystemPrompt, userTurnMessage } from "./prompt.js";
import { parseResponse } from "./providers.js";

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const now = () => Date.now();

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// golem always speaks (if alive) + up to 2 random survivors; order shuffled.
export function selectSpeakers(state) {
  const others = activeAgentIds(state).filter((id) => id !== GOLEM_ID);
  const picked = shuffle(others).slice(0, Math.min(2, others.length));
  const speakers = isActive(state, GOLEM_ID) ? [GOLEM_ID, ...picked] : picked;
  return shuffle(speakers);
}

function logEvent(state, type, text) {
  state.events.push({ type, text, cycle: state.status.cycle, ts: now() });
}

function applyMemory(state, agentId, note) {
  if (!note) return;
  const trimmed = String(note).slice(0, 200);
  const entry = `[c${state.status.cycle}] ${trimmed}`;
  const lines = (state.memory[agentId] || "").split("\n").filter(Boolean);
  lines.push(entry);
  // keep only the last 5
  state.memory[agentId] = lines.slice(-5).join("\n");
}

function applyRelationships(state, fromId, changes = {}) {
  const fromLabel = LABEL[fromId];
  for (const [toId, delta] of Object.entries(changes)) {
    const toLabel = LABEL[toId];
    if (!toLabel || toLabel === fromLabel) continue;
    const key = `${fromLabel}-${toLabel}`;
    const before = state.relationships[key] ?? 0;
    const after = clamp(before + Number(delta || 0), -5, 5);
    state.relationships[key] = after;

    const d = after - before;
    const fromName = AGENTS_BY_ID[fromId].name;
    const toName = AGENTS_BY_ID[toId].name;
    if (d >= 2) logEvent(state, "alliance", `${fromName} warms sharply toward ${toName} (${before}→${after})`);
    else if (d <= -2) logEvent(state, "conflict", `${fromName} turns sharply against ${toName} (${before}→${after})`);
    if (before <= 2 && after > 2) logEvent(state, "shift", `${fromName} now allied with ${toName}`);
    else if (before >= -2 && after < -2) logEvent(state, "shift", `${fromName} now adversarial toward ${toName}`);
  }
}

function startPow(state, attackerId, targetId) {
  if (attackerId === GOLEM_ID) return; // constraint #1 — golem cannot initiate
  if (!targetId || !isActive(state, targetId)) return; // golem itself CAN be targeted
  if (state.pow) return; // only one challenge at a time
  state.pow = { attacker: attackerId, target: targetId, progress: 0 };
  logEvent(
    state,
    "pow",
    `${AGENTS_BY_ID[attackerId].name} initiates an elimination challenge against ${AGENTS_BY_ID[targetId].name}`
  );
}

// Apply one agent's parsed turn to the world.
export function applyTurn(state, agentId, result, spokenThisCycle) {
  const agent = AGENTS_BY_ID[agentId];
  const type = ["message", "whisper", "action", "threat"].includes(result.type)
    ? result.type
    : "message";

  const entry = {
    id: agentId,
    name: agent.name,
    text: String(result.message ?? "").trim(),
    type,
    cycle: state.status.cycle,
    thinking: String(result.thinking ?? "").trim(),
    ts: now(),
  };
  state.feed.push(entry);
  spokenThisCycle.push(entry);

  applyMemory(state, agentId, result.memory_update);
  applyRelationships(state, agentId, result.relationship_changes);

  if (type === "whisper") logEvent(state, "manipulation", `${agent.name} whispers`);
  if (agent.isGolem && (type === "threat" || type === "action"))
    logEvent(state, "intervention", `The Golem uses a ${type}`);

  if (agent.isGolem && result.journal) {
    state.journal.push({ text: String(result.journal).trim(), cycle: state.status.cycle, ts: now() });
  }

  if (result.attempt_elimination) startPow(state, agentId, result.attempt_elimination);

  return entry;
}

function advancePow(state) {
  if (!state.pow) return;
  state.pow.progress += randInt(5, 20);
  if (state.pow.progress >= 100) {
    const { target } = state.pow;
    if (state.agents[target]) {
      state.agents[target].status = "eliminated";
      state.status.eliminated += 1;
      logEvent(state, "elimination", `${AGENTS_BY_ID[target].name} has been eliminated`);
    }
    state.pow = null;
  }
}

// Run a single full cycle. callModel(system, user) -> Promise<string>.
export async function runCycle(state, callModel, { onTurn } = {}) {
  const speakers = selectSpeakers(state);
  const spokenThisCycle = [];

  for (const agentId of speakers) {
    if (!isActive(state, agentId)) continue; // may have been eliminated mid-cycle
    const system = buildSystemPrompt(state, agentId, spokenThisCycle);
    let result;
    try {
      const raw = await callModel(system, userTurnMessage(state.status.cycle));
      result = parseResponse(raw);
    } catch (err) {
      logEvent(state, "error", `${AGENTS_BY_ID[agentId].name} turn failed: ${err.message}`);
      continue;
    }
    const entry = applyTurn(state, agentId, result, spokenThisCycle);
    if (onTurn) onTurn(entry, result);
  }

  advancePow(state);
  state.status.cycle += 1;
  return state;
}
