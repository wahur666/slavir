<img src="src/assets/slavir.png" alt="Slavir" width="200px" height="200px">

Slavir is an Open-Source Real Time Tactics game inspired by CNC Rivals.

## Project goals:

- Implement basic mechanics of the game.
- Single player against bots

## Tech Stack

- [Phaser 4](https://phaser.io/)
- [Typescript](https://www.typescriptlang.org/)
- CSS
- Webpack
- [Tiled editor](https://www.mapeditor.org/)
- Assets - [OpenGameArt](https://opengameart.org/)

Read the [Roadmap](roadmap.md) what's planed (eventually).

See [Game systems architecture](docs/architecture.md) for how units, buildings, players and the command hub
connect.

## Run locally

Requires Node.js and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:8081. Use `npm run build` to build into `public/`.

## Playing

A three-second countdown precedes each match. Click a building card to unlock its
units, then click unit cards to recruit. Click a friendly unit to select it and
click the map to move, or a visible enemy to attack. Idle combat units attack
eligible enemies in range and follow ordered targets while they remain visible.
Harvesters gather resources automatically. Hold the objective pads to damage the
enemy base with missile strikes.

You can field 10 units, including at most two harvesters. Recruiting starts a
cooldown of 2.5 seconds per fielded unit before the next recruitment; losing a
unit reduces the remaining cooldown by 2.5 seconds.

Press Escape or click Pause to freeze the match, including movement, combat,
resource income, countdowns, and pending missile strikes. Resume with Escape or
the Resume button, or return to the menu to start a fresh match. Press F to
dismiss the selected unit. Retire ends the match as a defeat.

Two commander powers sit on the right of the map. Click a card (or press Q / W),
then click a hex; right click or Escape cancels. Each has a 30 second cooldown:

- **Turret** (40): a gun emplacement with 2400 health that shoots ground and air
  units for 120 DPS. It takes 1.33 seconds to deploy and lasts 20 seconds. It goes
  on a visible, free, walkable hex that is not a pad, at most 1½ hexes past the
  middle of the map. It does not count towards the unit cap.
- **Ion Cannon** (130): after a 3.3 second blast sequence, deals 6000 damage to the
  enemies on the targeted visible hex (1000 to harvesters, 4000 to turrets) and half
  of that to the hexes around it. Units that move away in time escape.

The bot recruits harvesters, builds barracks followed by a factory and hangar,
reinforces objective pads, and chooses affordable counters to visible enemies. It
drops turrets on enemies that come near its base or units, and fires the ion cannon
at enemy groups that stand still.

When a match ends, **Download replay** saves it as a small JSON file and **Load
replay** plays one back. See [docs/replays.md](docs/replays.md) for how replays
work and the determinism rules game code must follow to keep them in sync.

## Verification

`npm run typecheck` checks types for the game and the tests. Tests use
[Vitest](https://vitest.dev/): `npm run test:unit` runs the fast unit tests in
`tests/unit` (`npm run test:watch` for watch mode), and `npm test` builds the game
and runs both the unit tests and the gameplay regressions in `tests/e2e` in a
temporary headless browser. The browser tests require Node.js 22
or newer and Chrome, Chromium, or Edge; set `CHROME_PATH` if the executable is not
in one of the detected locations. They cover countdowns, pause/resume, purchases,
production caps, combat, bot decisions, and returning to a fresh match.
