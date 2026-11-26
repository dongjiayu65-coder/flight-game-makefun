# flight-game-makefun

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/dongjiayu65-coder/flight-game-makefun/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/dongjiayu65-coder/flight-game-makefun/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**One Fly Ruins a Birthday Party.** You are a fly at Timmy's 8th
birthday dinner, and the family is your weapon. Land on anything —
soup, faces, the roast chicken — and somebody's hand comes down on
it. Dodge at the very last instant: the later you bail, the higher
the rating (Early / Good / Close! / PERFECT!!) and the bigger the
combo. Whatever the hand lands on breaks, splashes, flies across
the table and sets off something else — soup in Mom's hair, Grandpa's
dentures on a tour of the table, the dog making off with the chicken.
Chain the chaos, evolve (golden fly, fire fly, rainbow fly), and at
0:10 the cake starts glowing: land on it and all four hands come
down at once. Survive the Final Slap for the CAKE-POCALYPSE — then
see yourself in the ruined family photo and the 12-cell Disaster Log.

Ninety seconds, three lives, one fly. The first ten seconds teach
you everything, starting with Dad slapping his own face.

A complete game from static files — no build step, no network
requests. Open `game/index.html` through any static file server and
play with mouse + keyboard (mouse steers, SPACE / right-click
dodges, R restarts, P pauses). Progress and the Disaster Log are
kept in `localStorage`.

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
