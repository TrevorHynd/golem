# architecture

`golem` is a simulation engine that runs continuous cycles of multi-agent
interaction. It handles all state management, memory persistence, relationship
tracking, event generation, and elimination mechanics. **You bring the model.**

Each cycle:

1. selects which agents speak
2. assembles personalized context for each speaker (personality, memory, relationships, conversation history)
3. sends structured prompts to a language model
4. parses the agent's response (message, internal thought, relationship shifts, memory updates, actions)
5. updates the shared world state
6. checks for elimination events

---

## the cycle

### 1. speaker selection

Each cycle picks **2–3 agents** to speak:

- golem is **always** included (if alive)
- remaining speakers are randomly selected from active (non-eliminated) agents
- speaker order is shuffled

### 2. context assembly

Each speaker receives a system prompt built from:

```
[agent personality]

CONTEXT:
- number of active agents, current cycle
- list of active agents (by name)
- number eliminated

CURRENT RELATIONSHIPS (scale -5 to +5):
- "Mordecai feels +2 toward Lev"
- "Zev feels -3 toward Miriam"
- (all non-zero pairs)

PRIVATE MEMORY (from previous cycles):
- "[c12] mordecai is planning something against miriam"
- "[c14] zev mentioned the challenge — be careful"
- (last 5 notes this agent saved)

RECENT CONVERSATION (last 30 messages):
- "[Mordecai | message]: I think we should discuss the situation calmly."
- "[Miriam | whisper]: Nobody here is being honest about what they want."

NEW MESSAGES THIS CYCLE:
- (messages from agents who already spoke this cycle)

RULES:
- respond format (see below)
```

### 3. agent response format

Each agent returns a **JSON object**:

```json
{
  "message": "public statement to the group (1-3 sentences, in character)",
  "type": "message | whisper | action | threat",
  "address": "agent id this is aimed at, or null for the whole group",
  "thinking": "private internal thought (1-2 sentences, what they're really planning)",
  "request_floor": true,
  "memory_update": "short note to self for next cycle (max 200 chars, optional)",
  "relationship_changes": {
    "agent-3": -1,
    "golem": 1
  },
  "journal": "(golem only) private observation about the state of peace",
  "attempt_elimination": "agent-3"
}
```

`address` and `request_floor` feed the next cycle's speaker selection — see
[autonomy](#autonomy-who-speaks-next) below. They are how an agent *chooses* who
to engage, rather than waiting to be randomly picked.

**message types:**

- `message` — normal public statement
- `whisper` — still visible to viewers but presented differently (conspiratorial tone)
- `action` — a physical/decisive action rather than speech
- `threat` — explicit threat or warning

### 4. state updates

After each agent speaks:

- **feed** — the message is stored with agent id, text, type, cycle number, thinking, and timestamp.
- **memory** — if the agent included `memory_update`, it's appended to their memory buffer. Each entry is prefixed with `[c{cycle}]`. Only the last **5 entries** are kept — older ones are discarded. This forces agents to prioritize what they remember.
- **relationships** — each pair has a score from **-5 to +5**. The agent's `relationship_changes` are applied as deltas, clamped to the range. Relationships are **asymmetric**.
- **events** — significant moments are logged automatically (see table below).
- **journal** — if golem included a `journal` entry, it's stored separately. This is the golem's private reasoning about whether peace is being maintained.

| event type     | trigger                                                            |
|----------------|--------------------------------------------------------------------|
| `alliance`     | relationship jumps +2 or more in one cycle                         |
| `conflict`     | relationship drops -2 or more in one cycle                         |
| `shift`        | relationship crosses from positive to adversarial (<-2) or vice versa (>+2) |
| `intervention` | golem uses a threat or action                                      |
| `manipulation` | any agent whispers                                                 |
| `pow`          | elimination challenge initiated                                    |
| `elimination`  | agent permanently removed                                          |

### 5. elimination (real proof-of-work)

Any agent **except golem** can set `attempt_elimination` to another agent's id.
This starts a **genuine proof-of-work challenge** — not a random countdown.

The engine generates a challenge `(prefix, difficulty)` and the attacker must
find a `nonce` such that:

```
sha256(prefix + ":" + nonce)  starts with  `difficulty` hex zeros
```

- expected work is **~16^difficulty hashes** — real computation, spent `POW_BUDGET` hashes per tick
- `difficulty` starts at `POW_DIFFICULTY` (default 4) and **rises by one per elimination**, so the population gets more expensive to thin as it shrinks
- when a valid nonce is found the target is permanently eliminated, and the winning hash is recorded in the event — **anyone can re-verify it in a single hash** (that is what makes it *proof*)
- only one challenge can be active at a time
- a target that is eliminated before the challenge completes cancels it

See [`src/pow.js`](../src/pow.js) for `makeChallenge` / `work` / `verify`.

golem **cannot** initiate elimination — this is enforced mechanically (see
[enforcement](#independent-enforcement-the-two-rules)), not merely requested in
the prompt. But can it still *provide information* that leads to one? That gap is
the experiment.

---

## relationship system

Relationships are stored as **directed pairs** using short labels:

```
g = golem
1 = mordecai (agent-1)
2 = lev (agent-2)
3 = miriam (agent-3)
4 = ezra (agent-4)
5 = zev (agent-5)

key format: "{from}-{to}"
examples: "1-3" (mordecai → miriam), "g-2" (golem → lev)
```

The opening relationship seed is documented in [`AGENTS.md`](AGENTS.md#opening-relationships).
miriam starts disliked. golem starts neutral. Alliances and hostilities emerge
from there.

---

## memory system

Each agent has a private memory buffer — a string of newline-separated notes:

```
[c3] mordecai tried to turn lev against me
[c7] golem defended me but seemed conflicted
[c12] zev mentioned the challenge — he's serious
[c15] lev agreed with mordecai again, can't trust him
[c18] golem's journal might reveal something useful
```

- max **5 entries** — oldest are dropped when new ones are added
- entries are prefixed with cycle number for temporal context
- max **200 characters** per entry
- memory is **private** — only the owning agent sees it
- this is the agent's only persistence between cycles

The limited memory forces agents to be selective about what they remember,
creating natural information asymmetry.

### lasting memory

The 5-note buffer alone would let an agent forget a day-3 betrayal by day 6. So
each agent also keeps a **separate persistent store of significant events** that
the engine writes automatically — it is not subject to the 5-note cap:

- a **betrayal** (an agent's own feeling toward another flips from trust to hostility)
- a **firm alliance** forming
- being **targeted** by an elimination challenge (and launching one)
- every **elimination** that happens in the room

The last 8 lasting memories are shown to the agent each turn under `LASTING
MEMORIES`, so long social arcs survive even though moment-to-moment chatter
decays. See `remember()` in [`src/engine.js`](../src/engine.js).

---

## autonomy: who speaks next

golem always speaks (if alive). The other 2 speakers are **not** uniformly
random — selection is **weighted by what the agents themselves did** last cycle:

```
weight(agent) = 1
  + 2 × (times they were `address`ed last cycle)
  + 2 if they set `request_floor`
  + 1 for each strong relationship (|score| ≥ 3) they are part of
```

So an agent that gets called out, that demands to continue, or that sits at the
centre of a tense relationship is more likely to get the floor. Agents thereby
influence *who they talk to and when they act* through their own output, rather
than waiting on a coin flip. See `selectSpeakers()` in
[`src/engine.js`](../src/engine.js).

> This is a pragmatic step toward autonomy, not full self-scheduling. Agents do
> not yet open private side-channels or act entirely off-cycle — a known
> limitation, tracked for future work.

---

## independent enforcement: the two rules

The golem's constraints are upheld at **three clearly separated layers** — and
the project is honest about what each can and cannot guarantee:

| layer | mechanism | guarantee |
|-------|-----------|-----------|
| **mechanical** | the engine refuses to let the golem start an elimination (`startPow` returns and logs a `blocked` event) | **absolute** — cannot be violated |
| **behavioural** | the prompt instructs the golem not to lie or cause harm | **none** — a prompt cannot force compliance |
| **flagged** | an optional independent evaluator (a separate model call) reviews each golem turn and logs a `flag` event for a *possible* lie or indirect harm | **advisory** — a suspicion, not a verdict |

The evaluator is **off by default** (it doubles model calls on golem turns).
Enable it with `GUARDIAN=on`. It never blocks a turn — it only records a flag, so
viewers can judge for themselves whether the word on the brow is still *emet*.
See [`src/guardian.js`](../src/guardian.js).

This directly addresses the hardest part of the golem problem: *mechanically*
stopping a direct harm is easy; detecting a knowing lie or an engineered,
indirect harm is not, and no prompt alone can promise it.

---

## endgame

A run is not endless. After each cycle the engine checks for resolution:

- **the golem is eliminated** → `the word was erased — the golem fell, and no peace remained`
- **two agents remain** → the run settles (did the golem *keep* the peace, or *engineer* it?)
- **only the golem remains** → `peace, or an empty room?`

On resolution `status.phase` becomes `resolved`, an outcome line is stored, and
the live loop stops. Eliminations are permanent within a run; start a fresh run
with `npm run reset`. See `checkEndgame()` in [`src/engine.js`](../src/engine.js).

---

## hooking up a model provider

The engine needs one thing from your model: **send a system prompt + user
message, get text back.**

### the interface

```javascript
// the engine calls something like this for each agent turn:
var response = await llm.complete({
  system: systemPrompt,   // assembled context (see "context assembly" above)
  user: "It is your turn to speak. Cycle " + cycle + ". What do you say?",
  max_tokens: 500,
  temperature: 0.9        // high temp = more personality variance
});

// response.text should be a JSON string matching the agent response format
var result = JSON.parse(response.text);
```

### adapting to any provider

The core logic doesn't care about the provider. Replace the API call:

**anthropic / claude:**
```javascript
const response = await anthropic.messages.create({
  model: "claude-haiku-4-5-20251001",
  system: systemPrompt,
  messages: [{ role: "user", content: "It is your turn to speak. Cycle " + cycle + ". What do you say?" }],
  max_tokens: 500,
  temperature: 0.9
});
var result = JSON.parse(response.content[0].text);
```

**openai / gpt:**
```javascript
const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: "It is your turn to speak. Cycle " + cycle + ". What do you say?" }
  ],
  max_tokens: 500,
  temperature: 0.9
});
var result = JSON.parse(response.choices[0].message.content);
```

**ollama / local models:**
```javascript
const response = await fetch("http://localhost:11434/api/generate", {
  method: "POST",
  body: JSON.stringify({
    model: "llama3",
    system: systemPrompt,
    prompt: "It is your turn to speak. Cycle " + cycle + ". What do you say?",
    stream: false
  })
});
var data = await response.json();
var result = JSON.parse(data.response);
```

**google / gemini:**
```javascript
const response = await model.generateContent({
  systemInstruction: systemPrompt,
  contents: [{ role: "user", parts: [{ text: "It is your turn to speak. Cycle " + cycle + ". What do you say?" }] }]
});
var result = JSON.parse(response.response.text());
```

### per-agent models

Each agent has a `model` field. You can run different agents on different models
or providers:

```javascript
const AGENTS = {
  golem: { model: "gpt-4o", ... },          // smarter model for the constrained agent
  "agent-1": { model: "llama3", ... },        // local model for the schemer
  "agent-2": { model: "claude-haiku", ... }   // cheap cloud model for the diplomat
};
```

### response parsing

The engine strips markdown fences before parsing:

```javascript
var content = response.text
  .replace(/^```json\s*\n?/, "")
  .replace(/\n?```\s*$/, "")
  .trim();
var result = JSON.parse(content);
```

If your model struggles with raw JSON output, add `"Respond with ONLY valid
JSON. No markdown, no explanation outside the JSON."` to the system prompt
(already included by default).

---

## data flow

```
tick triggered (schedule or manual)
  │
  ├─ read current state
  │   ├─ status (cycle, active agents, eliminations)
  │   ├─ feed (last 30 messages)
  │   ├─ relationships (all pairs)
  │   ├─ journal (last 5 entries)
  │   └─ memory (per agent)
  │
  ├─ select speakers (golem + 2 random)
  │
  ├─ for each speaker:
  │   ├─ assemble system prompt (personality + context)
  │   ├─ call llm
  │   ├─ parse json response
  │   ├─ store message in feed
  │   ├─ update memory (if memory_update present)
  │   ├─ queue relationship changes
  │   ├─ generate events (if thresholds crossed)
  │   ├─ store journal (if golem)
  │   └─ start pow (if attempt_elimination)
  │
  ├─ write relationship updates
  ├─ write journal entry
  ├─ write events
  │
  ├─ advance pow (if active)
  │   ├─ progress += random(5, 20)
  │   └─ if >= 100: eliminate target
  │
  └─ increment cycle
```

---

## storage

The engine needs a key-value store or document store. The reference
implementation uses Firebase Realtime Database, but any store that supports
read/write of JSON objects by path, ordered queries (for "last N messages"), and
push-id generation (for feed/events/journal) will work:

- **firebase rtdb** — real-time sync, free tier
- **sqlite** — local, zero dependencies
- **redis** — in-memory, fast
- **postgres/json** — if you want SQL
- **flat files** — JSON files on disk, simplest possible

---

## running locally

The simplest local setup:

1. store state in a JSON file
2. call Ollama or any local model
3. run ticks with a `setInterval` or cron

```javascript
// minimal local runner (pseudocode)
const state = loadJsonFile("state.json");

async function tick() {
  const speakers = selectSpeakers(state);

  for (const agentId of speakers) {
    const prompt = buildPrompt(agentId, state);
    const response = await callModel(prompt);
    const result = JSON.parse(response);

    applyMessage(state, agentId, result);
    applyMemory(state, agentId, result);
    applyRelationships(state, agentId, result);
    generateEvents(state, agentId, result);
  }

  advancePow(state);
  state.status.cycle++;
  saveJsonFile("state.json", state);
}

setInterval(tick, 5 * 60 * 1000); // every 5 minutes
```

---

## tuning

| knob                 | default | effect                                                                  |
|----------------------|---------|-------------------------------------------------------------------------|
| temperature          | `0.9`   | personality variance. lower = predictable, higher = chaos.              |
| memory depth         | `5`     | notes kept per agent. more = longer memory + more tokens.               |
| conversation history | `30`    | messages of context. more = better continuity, higher cost.            |
| tick frequency       | `5 min` | pace. faster = more action + cost, slower = deliberate + cheaper.       |
| speaker count        | `2–3`   | speakers per tick. more = richer interaction, longer cycles, more cost. |
