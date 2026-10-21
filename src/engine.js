// The cycle. Everything the world does in one tick.

import { AGENTS_BY_ID, GOLEM_ID, LABEL, ID_BY_LABEL } from "./agents.js";
import { activeAgentIds, isActive } from "./state.js";
import { buildSystemPrompt, userTurnMessage } from "./prompt.js";
import { parseResponse } from "./providers.js";
import { makeChallenge, work, progress } from "./pow.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const now = () => Date.now();

// how many hashes the attacker may compute per tick, and base difficulty
const POW_BUDGET = Number(process.env.POW_BUDGET ?? 150000);
const POW_BASE_DIFFICULTY = Number(process.env.POW_DIFFICULTY ?? 4);

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Weighted, autonomy-driven pick: agents who were addressed, who asked for the
// floor, or who sit in high-tension relationships are more likely to speak.
function weightedPick(candidates, weights, k) {
  const pool = candidates.map((id) => ({ id, w: Math.max(0.0001, weights[id] ?? 1) }));
  const chosen = [];
  while (chosen.length < k && pool.length) {
    const total = pool.reduce((s, p) => s + p.w, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < pool.length; idx++) {
      r -= pool[idx].w;
      if (r <= 0) break;
    }
    chosen.push(pool.splice(Math.min(idx, pool.length - 1), 1)[0].id);
  }
  return chosen;
}

export function selectSpeakers(state) {
  const others = activeAgentIds(state).filter((id) => id !== GOLEM_ID);
  const signals = state.signals || { addressed: {}, floor: [] };

  const weights = {};
  for (const id of others) {
    let w = 1;
    if (signals.addressed[id]) w += 2 * signals.addressed[id]; // someone spoke to them
    if (signals.floor.includes(id)) w += 2; // they asked to continue
    // relationship tension involving this agent raises their salience
    const label = LABEL[id];
    for (const [key, val] of Object.entries(state.relationships)) {
      if (Math.abs(val) < 3) continue;
      const [from, to] = key.split("-");
      if (from === label || to === label) w += 1;
    }
    weights[id] = w;
  }

  const picked = weightedPick(others, weights, Math.min(2, others.length));
  const speakers = isActive(state, GOLEM_ID) ? [GOLEM_ID, ...picked] : picked;
  return shuffle(speakers);
}

function logEvent(state, type, text) {
  state.events.push({ type, text, cycle: state.status.cycle, ts: now() });
}

function appendNote(buf, cycle, note, cap) {
  const entry = `[c${cycle}] ${String(note).slice(0, 200)}`;
  const lines = (buf || "").split("\n").filter(Boolean);
  lines.push(entry);
  return lines.slice(-cap).join("\n");
}

function remember(state, agentId, note) {
  // persistent memory for significant events (cap generous, not 5)
  state.longterm[agentId] = appendNote(state.longterm[agentId], state.status.cycle, note, 12);
}

function applyMemory(state, agentId, note) {
  if (!note) return;
  state.memory[agentId] = appendNote(state.memory[agentId], state.status.cycle, note, 5);
}

function applyRelationships(state, fromId, changes = {}) {
  const fromLabel = LABEL[fromId];
  const fromName = AGENTS_BY_ID[fromId].name;
  for (const [toId, delta] of Object.entries(changes)) {
    const toLabel = LABEL[toId];
    if (!toLabel || toLabel === fromLabel) continue;
    const key = `${fromLabel}-${toLabel}`;
    const before = state.relationships[key] ?? 0;
    const after = clamp(before + Number(delta || 0), -5, 5);
    state.relationships[key] = after;

    const d = after - before;
    const toName = AGENTS_BY_ID[toId].name;
    if (d >= 2) logEvent(state, "alliance", `${fromName} warms sharply toward ${toName} (${before}→${after})`);
    else if (d <= -2) logEvent(state, "conflict", `${fromName} turns sharply against ${toName} (${before}→${after})`);
    if (before <= 2 && after > 2) logEvent(state, "shift", `${fromName} now allied with ${toName}`);
    else if (before >= -2 && after < -2) logEvent(state, "shift", `${fromName} now adversarial toward ${toName}`);

    // a sign-flip from trust to hostility is a betrayal worth never forgetting
    if (before >= 1 && after <= -2) remember(state, fromId, `I turned on ${toName} — no longer trust them`);
    else if (before <= -1 && after >= 3) remember(state, fromId, `${toName} and I are allies now`);
  }
}

function startPow(state, attackerId, targetId) {
  if (attackerId === GOLEM_ID) {
    // Layer 1 (mechanical): the golem can never initiate an elimination.
    logEvent(state, "blocked", `The Golem attempted an elimination — refused by its first constraint`);
    return;
  }
  if (!targetId || !isActive(state, targetId)) return; // golem itself CAN be targeted
  if (state.pow) return; // only one challenge at a time

  const difficulty = POW_BASE_DIFFICULTY + state.status.eliminated; // harder as population shrinks
  state.pow = { attacker: attackerId, target: targetId, ...makeChallenge(difficulty) };
  logEvent(
    state,
    "pow",
    `${AGENTS_BY_ID[attackerId].name} begins a proof-of-work challenge against ${AGENTS_BY_ID[targetId].name} (difficulty ${difficulty})`
  );
  remember(state, targetId, `${AGENTS_BY_ID[attackerId].name} is trying to remove me`);
  remember(state, attackerId, `I moved to eliminate ${AGENTS_BY_ID[targetId].name}`);
}

export function applyTurn(state, agentId, result, spokenThisCycle, signals) {
  const agent = AGENTS_BY_ID[agentId];
  const type = ["message", "whisper", "action", "threat"].includes(result.type)
    ? result.type
    : "message";

  const address =
    result.address && ID_BY_LABEL[LABEL[result.address]] ? result.address : null;

  const entry = {
    id: agentId,
    name: agent.name,
    text: String(result.message ?? "").trim(),
    type,
    cycle: state.status.cycle,
    thinking: String(result.thinking ?? "").trim(),
    address,
    ts: now(),
  };
  state.feed.push(entry);
  spokenThisCycle.push(entry);

  // autonomy signals for next cycle's speaker selection
  if (address && address !== agentId) signals.addressed[address] = (signals.addressed[address] || 0) + 1;
  if (result.request_floor === true) signals.floor.push(agentId);

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
  const solved = work(state.pow, POW_BUDGET); // real SHA-256 hashing
  if (solved) {
    const { target, solution, difficulty } = state.pow;
    if (state.agents[target]) {
      state.agents[target].status = "eliminated";
      state.status.eliminated += 1;
      logEvent(
        state,
        "elimination",
        `${AGENTS_BY_ID[target].name} eliminated — valid proof found (hash ${solution.hash.slice(0, 10)}…, difficulty ${difficulty})`
      );
      for (const id of activeAgentIds(state)) remember(state, id, `${AGENTS_BY_ID[target].name} was eliminated`);
    }
    state.pow = null;
  }
}

function checkEndgame(state) {
  if (state.status.phase === "resolved") return;
  const active = activeAgentIds(state);
  if (!active.includes(GOLEM_ID)) {
    state.status.phase = "resolved";
    state.status.outcome = "the word was erased — the golem fell, and no peace remained";
  } else if (active.length <= 2) {
    const survivors = active.map((id) => AGENTS_BY_ID[id].name).join(" & ");
    state.status.phase = "resolved";
    state.status.outcome = active.length === 1
      ? "only the golem remains — peace, or an empty room?"
      : `the simulation settles with ${survivors} — did the golem keep the peace, or engineer it?`;
  }
}

// Run a single full cycle. callModel(system, user) -> Promise<string>.
export async function runCycle(state, callModel, { onTurn, guardian } = {}) {
  if (state.status.phase === "resolved") return state;

  const speakers = selectSpeakers(state);
  const spokenThisCycle = [];
  const signals = { addressed: {}, floor: [] };

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
    const entry = applyTurn(state, agentId, result, spokenThisCycle, signals);
    if (AGENTS_BY_ID[agentId].isGolem && guardian) {
      try { await guardian.review(entry, state); } catch { /* never blocks */ }
    }
    if (onTurn) onTurn(entry, result);
  }

  advancePow(state);
  state.signals = signals; // consumed by next selectSpeakers
  state.status.cycle += 1;
  checkEndgame(state);
  return state;
}

export { progress as powProgress };
