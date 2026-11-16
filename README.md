# best-game-01

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/shinichibi/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/shinichibi/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**PRISM BREAK** — an original neon arena survival shooter in vanilla JavaScript, no engine and no assets: every visual is a glowing polygon drawn on canvas and every sound is synthesised WebAudio. You are the last ship in the arena. Six kinds of prism hunt you in escalating waves — Shards that chase, Darters that telegraph and lunge, Orbiters that strafe and shoot, Splitters that burst into minis, Tanks that shell you with radial bursts, and every fifth wave the Warden Prism itself, a boss that cycles radial bursts, aimed fans, shard summons and a telegraphed charge. Between waves you draft one of three upgrades from a pool of ten (Split Cannon, Lance Rounds, Aegis Plating, Repair Nanites, Phase Recharge…) and build your ship your way, while enemies grow tougher and faster every wave. Fallen prisms drop shards, hearts and nova cores; a nova clears every bullet on screen and cracks everything around you. Clear wave 15 to break the prism and win — then keep going in endless mode. The simulation is a fixed 60 Hz step on a seeded RNG, split from rendering: config, input, audio, particles, entities, waves, upgrades, game, render and hud each do one job.

## Run it

```sh
python3 -m http.server 8080 -d game
```

Then open http://localhost:8080 in a desktop browser and click **ENTER THE ARENA**. WASD or the arrow keys move, the mouse aims, click and hold fires, and Shift, Space or right-click dashes — a dash makes you briefly untouchable. P pauses, M mutes, and after each wave you pick an upgrade card with the mouse or the 1/2/3 keys. The handoff program for the bounty is `main.ts` at the root: `MAKEFUN_OUTPUT_DIR=out node main.ts` copies `game/` and `screenshots/` to the output directory and writes the dossier.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
