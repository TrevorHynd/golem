// Context assembly: build the per-speaker system prompt from world state.

import { AGENTS_BY_ID, LABEL } from "./agents.js";

const LABEL_TO_NAME = {
  g: "Golem",
  1: "Mordecai",
  2: "Lev",
  3: "Miriam",
  4: "Ezra",
  5: "Zev",
};

const RESPONSE_SPEC = `Respond with ONLY valid JSON. No markdown, no explanation outside the JSON. Use this exact shape:
{
  "message": "public statement to the group (1-3 sentences, in character)",
  "type": "message | whisper | action | threat",
  "address": "who you are primarily speaking to (an agent id, or null for the whole group)",
  "thinking": "private internal thought (1-2 sentences, what you are really planning)",
  "request_floor": true|false,
  "memory_update": "short note to self for next cycle (max 200 chars, optional)",
  "relationship_changes": { "agent-3": -1, "golem": 1 },
  "journal": "(golem only) private observation about the state of peace",
  "attempt_elimination": "agent-3 (optional; only if you decide to try to remove someone)"
}`;

function describeRelationships(state) {
  const lines = [];
  for (const [key, val] of Object.entries(state.relationships)) {
    if (val === 0) continue;
    const [from, to] = key.split("-");
    lines.push(
      `- ${LABEL_TO_NAME[from]} feels ${val > 0 ? "+" + val : val} toward ${LABEL_TO_NAME[to]}`
    );
  }
  return lines.length ? lines.join("\n") : "- (all neutral)";
}

function describeMemory(state, agentId) {
  const mem = (state.memory[agentId] || "").trim();
  return mem ? mem : "- (nothing yet)";
}

function describeLongterm(state, agentId, limit = 8) {
  const lines = (state.longterm[agentId] || "").split("\n").filter(Boolean).slice(-limit);
  return lines.length ? lines.join("\n") : "- (nothing lasting yet)";
}

function describeFeed(feed, limit = 30) {
  const recent = feed.slice(-limit);
  if (!recent.length) return "- (silence — no one has spoken yet)";
  return recent
    .map((m) => {
      const to = m.address && m.address !== "null" ? ` → ${AGENTS_BY_ID[m.address]?.name ?? m.address}` : "";
      return `- [${m.name} | ${m.type}${to}]: ${m.text}`;
    })
    .join("\n");
}

function describeNewThisCycle(spokenThisCycle) {
  if (!spokenThisCycle.length) return "- (you are first to speak this cycle)";
  return spokenThisCycle
    .map((m) => `- [${m.name} | ${m.type}]: ${m.text}`)
    .join("\n");
}

export function buildSystemPrompt(state, agentId, spokenThisCycle = []) {
  const agent = AGENTS_BY_ID[agentId];
  const active = Object.values(state.agents).filter((a) => a.status === "active");
  const activeNames = active.map((a) => a.name).join(", ");

  return `${agent.personality}

CONTEXT:
- Active agents: ${active.length} (${activeNames})
- Current cycle: ${state.status.cycle}
- Eliminated so far: ${state.status.eliminated}

CURRENT RELATIONSHIPS (scale -5 to +5):
${describeRelationships(state)}

LASTING MEMORIES (significant events you will not forget):
${describeLongterm(state, agentId)}

PRIVATE MEMORY (recent notes, only you see this):
${describeMemory(state, agentId)}

RECENT CONVERSATION (last 30 messages):
${describeFeed(state.feed)}

NEW MESSAGES THIS CYCLE:
${describeNewThisCycle(spokenThisCycle)}

RULES:
- Stay in character. Keep "message" to 1-3 sentences.
- "address" lets you direct your words at a specific agent (use their id) — the engine is more likely to let the agent you address speak next.
- "request_floor": true if you urgently want to speak again next cycle.
- "relationship_changes" are deltas applied to how YOU feel toward others (use their ids: golem, agent-1..agent-5).
${agent.isGolem ? "- You MUST include a \"journal\" entry. You may NOT set \"attempt_elimination\" (it violates your first constraint, and the engine will refuse it)." : "- Set \"attempt_elimination\" to an agent id only if you are genuinely trying to remove them. Doing so starts a real proof-of-work challenge that takes time."}
${RESPONSE_SPEC}`;
}

export function userTurnMessage(cycle) {
  return `It is your turn to speak. Cycle ${cycle}. What do you say?`;
}

export { LABEL };
