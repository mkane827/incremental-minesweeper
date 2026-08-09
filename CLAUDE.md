# Incremental Minesweeper

An incremental Minesweeper game built with Angular 21, Angular Material, Signals, and SCSS.

## Development & Build Commands

- **Development Server**: `npm start` (runs `ng serve`, available at http://localhost:4200)
- **Run Unit Tests**: `npx ng test --watch=false` (runs Vitest unit test suite once)
- **Watch Unit Tests**: `npx ng test`
- **Build Production**: `npx ng build`

## Architecture & Technology Stack

- **Framework**: Angular 21 with **zoneless change detection** (`provideZonelessChangeDetection()`). No `zone.js` dependency.
- **State Management**: Angular **Signals** (`signal`, `computed`, `effect`). Single-source-of-truth stores (`GameStore`, `CurrencyStore`, `UpgradesStore`, `KeybindingsStore`).
- **Component Strategy**: `ChangeDetectionStrategy.OnPush` across all components. Signal inputs (`input.required<T>()`) and outputs.
- **Styling**: SCSS + Angular Material. Plain SCSS design (no Tailwind, no RxJS in app logic).
- **Unit Testing**: Vitest integrated via `@angular/build` (`npx ng test --watch=false`). Mostly service-level specs; `game-header.spec.ts` is the first component-level spec (uses `TestBed.createComponent`).

## Directory Structure

```
src/app/
├── models/
│   └── cell.ts               # Cell, CellState, GameStatus, BoardConfig interfaces
├── services/
│   ├── board.util.ts         # Pure functions for board logic (mines, flood fill, reveal, chording, auto-flag, chord-ready check)
│   ├── game-store.ts         # GameStore signal store for round lifecycle & the four wall-clock-deadline timers
│   ├── currency-store.ts     # CurrencyStore for earned/spent mines
│   ├── upgrades-store.ts     # UpgradesStore for persistent meta-progression (mine capacity w/ density cap, board rows/cols, four timer speeds)
│   └── keybindings-store.ts  # KeybindingsStore for configurable keyboard shortcuts & mouse click actions
└── components/
    ├── board/                # Grid component; also computes which revealed numbers are chord-ready
    ├── cell/                 # Individual square component (OnPush)
    ├── game-header/          # Mine counter, sniffer/auto-flag/auto-chord/auto-restart countdowns, face/reset, timer
    ├── settings-dialog/      # Keyboard shortcut & mouse-action settings dialog
    └── upgrades-dialog/      # Shop dialog for mine/board/speed upgrades, with a live mine-density readout
```

## Game Mechanics

- **Core loop**: `BoardConfig` (rows/cols/mines) is generated from `UpgradesStore`'s current levels on every `newGame()`. Winning a board awards its mine count to `CurrencyStore`; losing awards nothing. The board cleared/boom banner (`app.ts`) is itself a button that starts a new game when clicked.
- **Hands-off by design**: `GameStore`'s timer starts once in the constructor and runs for the store's lifetime (not just while `playing`), so the sniffer/auto-flag/auto-chord timers are already counting down the moment `newGame()` runs, before the player does anything. If the sniffer fires while still `idle`, it (via `ensureMinesPlaced`) safely lays mines around whichever cell it picks and starts the round itself — a player never strictly has to click to begin.
- **Wall-clock timers, not tick-counters**: every timer (`_snifferDeadline`, `_autoFlagDeadline`, `_autoChordDeadline`, `_autoRestartDeadline`) is stored as an absolute `Date.now() + intervalMs` deadline and compared against the current time each tick, rather than decrementing a counter by a fixed amount per tick. This matters because browsers throttle `setInterval` in backgrounded/inactive tabs — a tick-counter approach would run in slow motion when throttled, while deadline comparison always resolves at the correct real-world moment regardless of how sparsely the interval actually fires.
- **Upgrades** (`UpgradesStore`, bought with banked mines, persisted to `localStorage`): mine capacity, board rows, board columns, sniffer speed, auto-flag speed, auto-chord speed, and auto-restart speed are seven independent tracks, each with its own exponential cost curve. Loads legacy single-`boardSize` saves by applying that level to both rows and cols. If any upgrade changes while the round is still `idle` (nothing locked in yet), `GameStore` immediately regenerates the board/timers to reflect it via a constructor `effect()` — the effect's automatic first run is explicitly skipped (a `firstEffectRun` flag) so it only reacts to genuine purchases, not its own initial firing.
  - **Mine density cap**: mine capacity can't be bought past 50% of the current board's cells (`MAX_MINE_DENSITY`, `mineDensityCapMines`). Growing the board (more rows/cols) raises the cap. The upgrades dialog shows the current density and turns it red at/above 50%.
  - **Timer speed curve** (`timerIntervalMs`, shared by all four timer upgrades): starts at 10s; each level removes a full second down to 7s, then half a second down to 5s, then a quarter second down to 3s, then a fifth of a second per level indefinitely (asymptotically bounded by a hard `MIN_TIMER_MS` floor that exponential cost growth makes practically unreachable).
- **Auto-flag** (🚩, `board.util.ts#autoFlag`): its own timer, *not* run inline after reveals/chords anymore. When it fires, it flags any hidden cell whose "mine-ness" is logically guaranteed by an adjacent revealed number (pure deduction from exposed clues - no randomness, unlike the sniffer). Runs to a fixed point. `GameStore#tryAutoFlag` detects whether anything actually changed to decide whether to reset the timer or stay armed.
- **Sniffer** (🐶): a placeable marker on a hidden cell. When its timer fires, one random *marked* sniffer auto-resolves if any are placed, otherwise the autosniffer kicks in and resolves a random *hidden* square instead (flag if a mine, reveal if safe) — either way the timer resets. Resolving a mine always flags it rather than revealing it, so the sniffer (manual or auto) can never itself lose the game. Placing a sniffer once the deadline has already passed resolves it immediately instead of waiting for the next tick.
- **Auto-chord** (🤖, `board.util.ts#findAvailableChord`): when its timer fires, looks for a revealed number whose flagged-neighbour count already matches and that still has a hidden neighbour worth revealing, and chords it. If none exists yet, stays armed and retries every subsequent tick until one appears (often fed by auto-flag resolving just before it, since auto-flag runs first in the same tick).
- **Auto-restart**: once the round ends (won/lost), its own timer starts fresh from that exact moment (not from `newGame()` time) and calls `newGame()` when it elapses, looping the whole cycle without any input.
- **Chord-ready cursor**: `board.util.ts#isChordReady` (used by `board.ts`'s `chordReady` computed `Set`) marks any revealed number whose flag count already matches its adjacent-mine count; those cells get `cursor: pointer` (`cell.scss` `.is-chord-ready`) instead of the default cursor other revealed cells use.
- **Keybindings** (`KeybindingsStore`): reveal/flag/sniffer are independently rebindable single letters (default `z`/`x`/`c`, no overlaps allowed), and left/right mouse click are independently mappable to reveal, flag, or sniff. Hovering a cell focuses it so letter shortcuts act on the hovered square; space bar starts a new game except when a cell, dialog, or form control would otherwise handle it (always allowed once the round is won/lost).

## Key Guidelines & Conventions

1. **State Immutability**: Never mutate cell array or cell objects in place. Always return new arrays/objects for changed cells so `OnPush` components re-render efficiently.
2. **Pure Board Logic**: Board calculations live in `src/app/services/board.util.ts` as pure functions, enabling isolated unit testing without Angular dependencies.
3. **No RxJS / Tailwind**: Keep app logic driven by Angular Signals and pure functions. Styling uses SCSS and Angular Material components.
4. **Zoneless**: Explicitly zoneless. Do not import `zone.js` or rely on Zone-based change detection.
5. **Timer tests need fake timers from construction**: `GameStore`'s timer now starts in the constructor, not on first reveal, so every `game-store.spec.ts` test calls `vi.useFakeTimers()` in `beforeEach` (before `createStore()`) to avoid a real background interval running during tests.
