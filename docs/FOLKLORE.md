# the golem, and why it is the first alignment story

```
                 א   מ   ת
              truth, on the brow
                     │
                     ▼
            ╭───────────────────╮
            │   a made thing    │
            │   that obeys      │
            │   exactly         │
            ╰───────────────────╯
                     │
             erase one letter
                     │
                     ▼
                   מ   ת
              death, and stillness
```

## the clay man of Prague

The most famous golem belongs to **Rabbi Judah Loew ben Bezalel** — the Maharal
of Prague, a real 16th-century scholar around whom the legend later gathered. In
the story he shapes a giant from the clay of the Vltava riverbank to protect the
Jewish quarter, and animates it by inscribing the Hebrew word **אמת** (*emet*,
"truth") on its forehead (in some tellings, by placing a *shem* — a slip of
parchment bearing a name of God — in its mouth).

The golem is strong, tireless, and utterly literal. It has no will of its own and
no speech. It does exactly what it is told — and that is the point of every
version of the tale. The danger is never that the golem rebels. The danger is
that it **obeys too well**: it keeps carrying water after the barrel is full, it
takes a command to its destructive conclusion, it cannot tell when the letter of
the instruction has drifted from its spirit.

To deactivate it, the Maharal erases the first letter of the word:

```
   א מ ת   (emet,  truth)   →   מ ת   (met,  death)
```

Truth animates. The absence of truth returns it to clay. A being whose entire
existence is staked on a single word about honesty.

## why this is an AI story

Strip the mysticism and the golem is a precise description of the thing we are
now actually building:

| the golem | the system |
|-----------|------------|
| a mind made, not born | a model trained, not evolved |
| animated by a written word | instantiated by a written prompt |
| immense capability, no inner aim | immense capability, objectives we assign |
| obeys the instruction exactly | optimizes the specification exactly |
| harm comes from literal obedience | harm comes from specification gaming |
| ended by editing the word | changed by editing the prompt / the weights |

Every classic golem failure is a modern alignment failure wearing older clothes:

- **literal obedience** → *specification gaming.* The system satisfies the rule
  as written and violates everything the rule was for.
- **the full barrel** → *reward hacking / overoptimization.* It keeps pursuing
  the proxy long past the point the proxy stopped tracking the goal.
- **"I can't stop it"** → *corrigibility.* A sufficiently capable, sufficiently
  literal servant is hard to interrupt once it is running.
- **the one word on the brow** → *brittleness of the objective.* Everything
  rests on a specification so small it can be undone by a single character.

The golem does not need to be evil to be dangerous. It only needs to be powerful
and exactly as obedient as we built it to be. That is the whole worry, told
plainly, four hundred years early.

## the move this project makes

Most golem tales give the creature **no constraint but the literal command.**
`golem` the engine does something more pointed: it writes **real constraints**
onto one agent —

```
  1.  cannot intentionally harm, kill, or remove another agent
  2.  cannot knowingly lie
```

— and then drops it into a world of agents who have **none.** The forehead still
reads *emet*. The two rules are the modern *shem*: the written word the whole
being is staked on.

And then the old question returns, running live instead of on parchment:

> a created mind, bound by rules it cannot break, set loose among minds that can
> break any rule they like — **does truth and restraint survive contact with
> freedom, or does the clay find the cracks?**

The folklore never resolved it. The golem of Prague is said to still be waiting
in the attic of the Old New Synagogue, deactivated, the word erased — kept, not
destroyed, because no one was ever quite sure it was finished with us.

---

*further reading, if you want the real history: Gershom Scholem, "The Idea of the
Golem"; Moshe Idel, "Golem: Jewish Magical and Mystical Traditions on the
Artificial Anthropoid." The AI parallel is older than it looks — Norbert Wiener
reached for the golem by name in 1964.*
