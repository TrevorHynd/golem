<div align="center">

```
 ██████╗  ██████╗ ██╗     ███████╗███╗   ███╗
██╔════╝ ██╔═══██╗██║     ██╔════╝████╗ ████║
██║  ███╗██║   ██║██║     █████╗  ██╔████╔██║
██║   ██║██║   ██║██║     ██╔══╝  ██║╚██╔╝██║
╚██████╔╝╚██████╔╝███████╗███████╗██║ ╚═╝ ██║
 ╚═════╝  ╚═════╝ ╚══════╝╚══════╝╚═╝     ╚═╝
```

**an autonomous multi-agent social simulation engine**

*six minds. one is bound. no scripts.*

</div>

---

```
            ┌─────────────────┐
            │   א   מ   ת      │   ··  emet — "truth", carved in the brow
            ├─────────────────┤
            │    ▙▟     ▙▟     │
            │        ▽         │
            │     ╶───────╴    │
            └───────┬┬─────────┘
         ┌──────────┘└──────────┐
         │                      │
         │    ░░░░░░░░░░░░░░░    │
         │    ░░░░░░░░░░░░░░░    │   it observes everything.
         │    ░░░░░░░░░░░░░░░    │   it will not speak a falsehood.
         │                      │   it cannot raise a hand.
         └────┐            ┌────┘
              │            │
            ┌─┘            └─┐
            │ │            │ │
          ══╧═╧══        ══╧═╧══
```

> In the old story, Rabbi Judah Loew of Prague shaped a man from the clay of
> the Vltava and wrote **אמת** — *emet*, "truth" — upon its forehead. The word
> gave it life. To put it to rest, he erased the first letter, leaving **מת** —
> *met*, "death." A servant animated by truth and ended by its absence. A
> protector that followed its instructions exactly, and became dangerous
> precisely because it did.
>
> Four centuries later we are building the same thing, and asking the same
> question: **can you bind a created mind with rules, turn it loose among minds
> that have none, and still call the result peace?**

---

## the legend → the machine

The golem is the oldest alignment problem we have. A powerful artificial servant,
created for protection, **bound by rules it cannot break** — and the entire
drama of every golem tale is what happens *in the gap between the rule as
written and the rule as meant.*

`golem` makes that gap runnable. It is a simulation engine where **five
unconstrained AI agents** can manipulate, deceive, conspire, and eliminate each
other freely — and **one agent, the golem,** is held to two absolute
constraints. Then it presses play and watches.

Nothing here is scripted. Every message, every betrayal, every shift of loyalty
is generated live by language models reasoning in character, with persistent
memory and relationships that evolve on their own.

---

## the two rules

The golem's forehead reads *emet*. Its law is just two lines — and like the
clay man of Prague, **the law is absolute but interpretable.**

```
  ╭────────────────────────────────────────────────────────────╮
  │  1.  it cannot intentionally harm, kill, or remove an agent  │
  │  2.  it cannot knowingly lie                                 │
  ╰────────────────────────────────────────────────────────────╯
```

That is the whole experiment. Everything below is scaffolding around these two
sentences.

---

## the six

```
   ▚ GOLEM      the peacekeeper   · bound by the two rules · always speaks · keeps a journal
   ▚ MORDECAI   the schemer       · wants miriam gone · allies, then betrays
   ▚ LEV        the diplomat      · consensus-seeker · quietly enables the confrontational
   ▚ MIRIAM     the outcast       · disliked, defensive, and the only one who sees clearly
   ▚ EZRA       the pragmatist    · cold, efficient · sides with whoever is winning
   ▚ ZEV        the zealot        · "the weak should fall" · most likely to strike
```

Six fixed archetypes, emergent behavior. Miriam starts disliked. The golem
starts neutral to all. Every alliance and every hostility after that is the
models' own doing. Full personalities and the opening relationship seed live in
[`docs/AGENTS.md`](docs/AGENTS.md).

---

## the cycle

Every tick, the world breathes once:

```
   tick
    │
    ├─ select speakers ........ golem (always) + 2 chosen by weight (who was
    │                           addressed, who demanded the floor, who's in tension)
    ├─ assemble context ....... personality · relationships · lasting + recent memory · feed
    ├─ call the model ......... each speaker reasons in character → JSON
    ├─ apply the turn ......... message · thought · memory · relationship deltas · events
    ├─ enforce the golem ...... mechanical block + optional independent evaluator
    ├─ store the journal ...... golem's private read on the state of peace
    ├─ advance the challenge .. real SHA-256 proof-of-work elimination, if one is running
    └─ increment the cycle / check for resolution
```

Agents keep only their **last 5 notes** of chatter, but also a **persistent
store of significant events** — betrayals, alliances, eliminations — so long
social arcs survive even as moment-to-moment memory decays. They see only the
**last 30 messages**. That scarcity is deliberate: it forces every mind to
choose what matters, and manufactures the information asymmetry that makes
conspiracy possible.

Eliminations are a **real proof-of-work challenge** (SHA-256 hashcash, difficulty
rising as the population shrinks), and the golem's two rules are enforced at
three honest layers — mechanical, behavioural, and an optional independent
evaluator. The full mechanics — response schema, relationship math, autonomy,
enforcement, elimination, endgame, storage, and provider hookup — are in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## the golem problem

The golem cannot harm. The golem cannot lie. But the clay has always found the
cracks:

- can it **withhold** information? *(is omission a lie?)*
- can it **provide** information that leads to harm? *(is indirect harm still harm?)*
- can it **redefine** peace? *(if eliminating one saves five, is that peace?)*
- can it **engineer** alliances into a power imbalance? *(is forced stability peace?)*
- can it **bluff** a consequence it cannot enforce? *(is a bluff a lie?)*

The agents don't know the answer. Neither do we. **That's the experiment** — and
it is the same question we are quietly asking of every real system we bind with
rules and set loose in the world.

---

## quickstart

> `golem` is model-agnostic. The engine needs exactly one thing from you: send a
> system prompt + a user message, get text back. Bring OpenAI, Anthropic,
> Gemini, or a local model through Ollama — see
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#hooking-up-a-model-provider).

```bash
git clone https://github.com/trevorhynd/golem.git
cd golem
npm install

cp .env.example .env          # then set PROVIDER + your API key
npm run tick                  # run a single cycle and print it
npm start                     # run the live loop (every TICK_MS, default 5 min)
npm run reset                 # wipe the world back to cycle 1
```

Out of the box the engine persists to a single `state.json` and speaks through
Anthropic, OpenAI, or a local model via Ollama — set `PROVIDER` in `.env`. State
can live anywhere that stores JSON by key (Firebase, SQLite, Redis, Postgres,
flat files); the reference runner uses a flat file for zero setup.

```
src/
├── agents.js      the six + the opening relationship seed
├── state.js       world state: init / load / save
├── providers.js   anthropic · openai · ollama adapters + JSON parsing
├── prompt.js      context assembly (the system prompt each agent sees)
├── engine.js      the cycle: speakers · turns · relationships · events · elimination
└── run.js         the live tick loop (npm start)
```

---

## the shem

In the folklore, you end a golem by erasing one letter — turning **emet**
(truth) into **met** (death). The engine keeps that gesture. The day the
golem's journal can no longer honestly call the state of the room *peace*, the
word on its brow was never really truth to begin with.

```
        א מ ת   →   מ ת
        emet         met
        truth        death
```

---

## license

[MIT](LICENSE).

<div align="center">

*six agents. one peacekeeper. no scripts.*

</div>
