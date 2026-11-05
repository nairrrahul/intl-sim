# International Soccer Simulator

An observer-mode simulation of international football: every national team, every confederation's
competitions, World Cup cycle included. There is no club management; you watch (and step through)
the simulation, browse players and nations, shortlist players and save/load the world.

Stack: React 18 · TypeScript · Vite · Tailwind · Zustand · React Router (unchanged).

## Running

```bash
npm install
npm run dev        # development server
npm run typecheck  # tsc --noEmit
npm run build
```

## How simulation works

The calendar is six international windows per season (`IW1`–`IW6`) on a four-year cycle
(`src/engine/international/data/team_windows.csv` says which competition each confederation plays in each
window). The world always has exactly one *open* window: its call-ups are made and its fixtures drawn, but
no match is played until you simulate it.

* **Simulate window** plays every remaining matchday of the open window, then opens the next one.
* **Next matchday** plays a single matchday of the open window.
* **Play N / Finish season** chain whole windows.

Matchdays are **left-aligned by competition** (`engine/international/lanes.ts`). Each competition in a
window is a *lane*; matchday N plays the Nth round of every lane. Knockout rounds are drawn when the
previous round finishes and join their lane on the next free matchday:

```
MD1  Friendlies · Set 1  | Copa América · Group MD1
MD2  Friendlies · Set 2  | Copa América · Group MD2
MD3                      | Copa América · Group MD3
MD4                      | Copa América · Quarter-finals
MD5                      | Copa América · Semi-finals
MD6                      | Copa América · Final
```

After `IW6` the season rolls over: every player ages one year and develops (`players/growth.ts`).

## Layout

```
src/
  config.ts                      season start year, season labels
  engine/
    game.ts                      the Game facade the UI talks to (actions + window progress)
    queries.ts                   read-only views for the UI
    world/                       World state, creation, matchday/window/year lifecycle
    match/                       match engine (scoreline model, penalties) + data
    nations/                     nation metadata (codes, flags, confederations)
    players/                     types, name generation, initial generation, yearly growth, config
    international/
      types.ts                   match, round, window and state types
      state.ts                   fresh international state
      calendar/                  window calendar (cycle, window types, labels)
      windowBuilder.ts           opens a window: call-ups, draws, friendlies, lanes
      worldCupWindow.ts          World Cup part of window opening
      windowSimulation.ts        plays matchdays, awards caps
      matchResolution.ts         one match: result, ranking points, ties, knockout winners
      roundProgression.ts        what happens after each round (standings, next rounds, qualifying)
      windowCompletion.ts        closes a window and draws what follows
      rankings.ts, nationStrength.ts, callUps.ts, friendlies.ts, lanes.ts
      nationViews.ts, trophies.ts  per-nation fixtures/results and trophies
      competitions/              one module per competition (+ shared cup helpers)
    save/                        lossless graph serializer + save-file format
    shared/                      random helpers, bracket/schedule builders
  store/gameStore.ts             Zustand store
  ui/                            pages, components, sidebar catalog (competitions.ts)
```

## Players, squads and nation overall

* **Loading:** a new world loads its players from `src/engine/players/data/players.json`.
* **Squads:** each nation picks the best starting XI across every formation its players can fill
  (`players/formations.ts`), plus 7 substitutes (always including a backup goalkeeper when one exists).
  A nation's overall is the rounded average of its XI (`international/squads.ts`). Squads are refreshed whenever a
  window opens. Retired players are never selected. The XI + substitutes are the window's matchday squad (caps).
* **Retirement:** players aged 34+ get a yearly chance to retire at the end of the season
  (`players/retirement.ts`). Retired players stay in the pool (shortlist keeps them under a Retired tab).
* **Newgens:** at the start of every season after the first, each nation gets 11 fifteen-year-olds
  (1 GK, 4 DEF, 3 MID, 3 FWD) generated from its youth rating (`players/newgen.ts`). The formula's 1-200
  ability scale is mapped onto the game's rating scale by `RATING_MIN/RATING_MAX` in `players/config.ts`.

## God Mode

Toggle it from the gear menu in the header. It unlocks: editing a nation's youth rating (Nation page → Overview),
adding players (sidebar → Add Player), choosing a nation's formation (Nation page → Starting XI), and rigging
unplayed fixtures by right-clicking them (nation fixtures, group panels, knockout trees, window page). A rigged
match has a red outline; a rigged knockout draw goes to randomized penalties.
