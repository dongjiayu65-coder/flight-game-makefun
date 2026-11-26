# flight-game-makefun

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/OWNER/flight-game-makefun/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/OWNER/flight-game-makefun/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**《我是那只苍蝇》 — First-Person Fly at Dinner.** You are a fly over a
family dinner table. You cannot steer like a plane: you glide, and the
buzz key (space) dashes you forward — but every dash deflects by a
random angle, because you are a fly. Steal the three dishes in order
(greens, tomato-egg soup, birthday cake), landing on each to feed;
every course makes you one weight fatter and your dashes wilder.
Four humans sweep the table with their gaze cones — get watched too
long and a giant palm comes down, shadow first. Eat everything, then
escape through the open window.

A complete game from static files — no build step, no network
requests. Open `game/index.html` through any static file server and
play with mouse + keyboard (mouse leads, space buzzes, R restarts).

## Run it

```sh
node serve.ts
```

then open http://localhost:8080 in a desktop browser.

To produce the hand-in output (the game, the screenshots and
`dossier.json`) the way the grader does:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=kdtwaazp&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
