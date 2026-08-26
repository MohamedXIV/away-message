# Gameplay, Progression, Economy, and Daily Life

## Game Loop and Progression

## 1. Core loop

The game loop is:

```text
Wake / return to room
→ check what changed
→ decide what matters today
→ work / spend / browse / talk / wait
→ improve material or social life
→ encounter authored/systemic events
→ sleep
→ world advances
```

A typical day should not feel identical to the previous day because different systems are moving on the same timeline.

---

## 2. Session-scale loop

At the scale of 5–20 real minutes, the player should constantly alternate between short intentions.

Examples:

- start a large download,
- leave the PC,
- make tea,
- return because Pulse chimed,
- reply to Maya,
- notice disk space is low,
- delete an old installer,
- read a classified listing,
- realize work begins soon,
- take the shift.

The game should rarely force one activity for a long uninterrupted period.

---

## 3. Progression axes

### Money

`broke → getting by → stable → some disposable income`

Money should remain meaningful throughout the 14 days.

### Room

`temporary motel room → recognizably personal space`

The evaluation build needs only a few visible changes:
- better desk/monitor arrangement,
- speakers,
- small decorative item,
- maybe a better chair or lamp.

### Computer

`bare, slow, old OS → customized, faster, newer OS`

This is one of the strongest progression axes.

### Social graph

`small contact list → recurring people → anticipation → real meeting`

### Internet identity

`unknown user → recognizable handle in a few small communities`

This can be light in the evaluation build.

### Knowledge

`outsider → notices relationships between names, sites, physical places, and repeated details`

---

## 4. No global "level"

Do not add:

- Player Level
- XP
- generic skill points
- visible social XP
- computer level number

Progression should be represented by owned things, known things, unlocked things, and changed behavior.

---

## 5. The daily decision triangle

Most meaningful decisions should sit somewhere inside:

```text
TIME
 /  \
MONEY — SOCIAL LIFE
```

Examples:

- work overtime for money but miss someone's online window,
- spend cash on RAM but make rent tighter,
- meet someone after work but arrive tired,
- wait for a cheaper classified listing but remain stuck on old OS,
- stay up late talking and start the next day with less energy.

Do not turn every decision into a punishment. The purpose is texture, not optimization anxiety.

---

## 6. Time scale

Canonical default:

- `1 real second = 1 game minute`

This must be configurable centrally.

UI interactions do not freeze time unless they are explicit pause/settings screens.

Some actions perform authored time jumps:

| Action | Default game time |
|---|---:|
| Make tea | 6 min |
| Make coffee | 5 min |
| Make noodles / simple meal | 15 min |
| Shower | 12 min |
| Look through window | 4 min |
| Quick errand | 20–45 min |
| Work shift | several hours |
| Café meeting | 45–90 min |
| Sleep | jump to chosen/required wake time |

All time jumps must use the same simulation advancement path as ordinary ticking.

---

## 7. Energy

Use a light energy model.

Purpose:
- make sleep meaningful,
- make late-night chatting have a cost,
- make work feel like part of life.

Do not turn energy into survival micromanagement.

Suggested hidden/visible range:
`0–100`

Player-facing feedback can be qualitative:
- Rested
- Fine
- Tired
- Exhausted

Effects:
- very low energy can lengthen some action times,
- can make an optional work shift unavailable,
- can affect a small number of authored thoughts,
- should not make the player unable to continue the story.

---

## 8. Hunger / food

Food is an expense and a time activity, not a nutrition simulator.

Keep it light.

A daily food cost can be represented through:
- motel food,
- convenience-store food,
- work meal,
- café purchase.

No calorie system.

---

## 9. Upgrade philosophy

An upgrade is valuable when it changes actual behavior.

Bad:
`RAM upgrade: +20% Computer`

Good:
- more apps can remain open,
- startup delays decrease,
- a newer program becomes compatible.

Bad:
`Internet Tier 2`

Good:
- large download ETA changes visibly,
- file transfer with a friend becomes practical,
- image-heavy pages load faster,
- webcam feature becomes usable.

Bad:
`OS Level 2`

Good:
- new visual shell,
- new application compatibility,
- newer software versions,
- quality-of-life features.

---

## 10. Systemic stories

The simulation should produce small stories without authored scenes.

Examples:

- player spends rent money on RAM and has to work an extra shift,
- a long download fails before FlashFetch is installed,
- a friend comes online while player is at work,
- player installs bundled toolbar by rushing through setup,
- player finds a used upgrade just before buying new,
- player misses a café appointment because of bad time management,
- player schedules a download overnight and wakes to it completed.

These are desirable outcomes.

---

## 11. Authored stories

Authored narrative provides:
- character arcs,
- introductions,
- meetings,
- revelations,
- changes in relationships,
- important website content,
- controlled dramatic beats.

The game should alternate between:
- authored events,
- quiet systemic days,
- ambient observations.

Never schedule a major story beat every day.

---

## 12. Progression freedom

The player should not need a perfect build.

The ending must tolerate:
- old OS still installed but upgrade path clearly available,
- lower cash,
- different software choices,
- weaker relationship with one contact,
- skipped optional internet arc.

The evaluation build tests the fantasy, not optimization mastery.

---

## Economy, Jobs, and Daily Life

## 1. Economy goal

Money should feel like **lifestyle pressure**, not a score.

The player should frequently think:

- Can I afford this?
- Should I wait?
- Do I need another shift?
- Is the upgrade worth delaying something else?
- Do I buy reliable new hardware or gamble on used?

The evaluation build must not become a poverty punishment simulator.

---

## 2. Canonical default values

These are tuning defaults for the evaluation build.

Starting cash:
`$38`

Primary work shift:
`+$62`

Weekly motel payment:
approximately `$140–$160`

Internet payment:
approximately `$20–$30`

Food/ordinary spending:
small recurring costs

RAM upgrade:
approximately `$40–$55`

OS 6:
approximately `$35–$50`

Internet upgrade:
approximately `$25–$40` initial cost

Used storage upgrade:
approximately `$45–$65`

Values may be tuned for pacing, but the player should not afford every upgrade immediately.

---

## 3. Rent

Rent/motel payment is the strongest recurring obligation.

Evaluation schedule:
- first meaningful due point around Day 7
- second due point around Day 14

Possible consequences of late payment:
- fee,
- awkward motel interaction,
- reduced cash buffer.

Do not hard fail the whole evaluation build for one missed payment.

---

## 4. Internet bill

Internet is important enough to have its own cost.

The game can show:
- current plan,
- payment date,
- faster plan.

For the evaluation build, missed payment can create warning/pressure rather than completely disabling the core game.

---

## 5. Primary job

The starting job is mundane food-service / cart work.

First shift:
- more explicit scene,
- introduces Ryan,
- establishes routine.

Later:
- quick shift,
- optional short event interruptions.

The player should not have to perform repetitive minigame labor every day.

---

## 6. Secondary income

Include one optional secondary income activity.

Examples:
- extra evening shift,
- delivery/odd job,
- small online listing sale.

Purpose:
- give the player agency when money is tight,
- create time trade-offs.

Do not create a complex career system.

---

## 7. Classifieds

Used hardware can be cheaper but less certain.

Evaluation choices:
- buy reliable new RAM,
- buy cheaper used RAM,
- wait for a listing,
- meet seller / pickup.

A listing can disappear if the player waits too long.

---

## 8. Digital-gold risk

Include one small optional risky financial system.

Fictional service:
`GoldNet` or equivalent.

Mechanic:
- player can move a limited amount of cash into a digital-gold balance,
- rate moves through a small authored/seeded schedule,
- player can gain or lose modest money.

Purpose:
- introduce uncertainty,
- create player-generated stories,
- evoke pre-crypto digital-money culture.

Do not build:
- complex market simulation,
- leverage,
- dozens of assets,
- real cryptocurrency.

---

## 9. Daily activities

Small room activities:
- tea
- coffee
- noodles/meal
- shower
- bed/rest
- window
- TV/radio optional
- clean/organize optional

They exist primarily to:
- consume believable time,
- create space between digital events,
- let background simulation show itself.

They are not minigames.

---

## 10. Work vs social time

One of the strongest recurring tensions is:

> Someone may be online while the player is at work.

The player can sometimes:
- leave early,
- take a cheaper/shorter shift,
- miss a conversation,
- catch someone later.

Do not punish the player severely for choosing either life or money.

---

## 11. Purchases should change the world

Buying:
- RAM,
- speakers,
- monitor,
- internet plan,
- OS,
should visibly or behaviorally change something.

Avoid purely numerical upgrades.

---

## 12. No exponential wealth curve

The evaluation arc is:

```text
broke
→ getting by
→ stable enough to make choices
```

Not:
`$38 → millionaire`

Even successful risky play should not destroy the meaning of ordinary costs.
