# Incremental Minesweeper

An incremental Minesweeper game built with Angular 21, Angular Material, Signals, and SCSS.

## Core Rules & Workflow

1. **Always keep `AGENTS.md` updated** whenever architectural decisions, new stores, components, or scripts are modified or added.
2. **Testing**: Run unit tests with `npx ng test --watch=false` before finishing any task to ensure all test suites pass.
3. **Angular 21 Conventions**: Use Signals (`signal()`, `computed()`), `OnPush` change detection, pure utility functions, and zoneless configuration.

## Development & Build Commands

- **Development Server**: `npm start` (runs `ng serve`, available at http://localhost:4200)
- **Run Unit Tests**: `npx ng test --watch=false` (runs Vitest unit test suite once)
- **Watch Unit Tests**: `npx ng test`
- **Build Production**: `npx ng build`

## Architecture & Technology Stack

- **Framework**: Angular 21 with **zoneless change detection** (`provideZonelessChangeDetection()`). No `zone.js` dependency.
- **State Management**: Angular **Signals** (`signal`, `computed`, `effect`). Single-source-of-truth stores (`GameStore`, `CurrencyStore`, `UpgradesStore`, `PrestigeStore`, `KeybindingsStore`, `DisplayStore`).
- **Component Strategy**: `ChangeDetectionStrategy.OnPush` across all components. Signal inputs (`input.required<T>()`) and outputs.
- **Styling**: SCSS + Angular Material. Plain SCSS design (no Tailwind, no RxJS in app logic).
- **Unit Testing**: Vitest integrated via `@angular/build` (`npx ng test --watch=false`). Mostly service-level specs; `game-header.spec.ts` is the component-level spec (uses `TestBed.createComponent`).

## Directory Structure

```
src/app/
├── models/
│   └── cell.ts               # Cell, CellState, GameStatus, BoardConfig interfaces
├── services/
│   ├── board.util.ts         # Pure functions for board logic (mines, flood fill, reveal, chording, cascading auto-flag, chord-ready/available-chord checks)
│   ├── game-store.ts         # GameStore signal store for round lifecycle & the three wall-clock-deadline timers (sniffer/auto-chord/auto-restart)
│   ├── currency-store.ts     # CurrencyStore for spendable mines + lifetime mines earned (never resets)
│   ├── upgrades-store.ts     # UpgradesStore for run-scoped meta-progression (mine capacity w/ density cap, board rows/cols, three timer speeds, automation/highlight unlocks & toggles); resettable by prestige
│   ├── prestige-store.ts     # PrestigeStore for permanent meta-progression above UpgradesStore, bought with prestige points
│   ├── keybindings-store.ts  # KeybindingsStore for configurable keyboard shortcuts & mouse click actions
│   └── display-store.ts      # DisplayStore for the player-chosen cell size (fixed regardless of board size)
└── components/
    ├── board/                # Grid component; also computes chord-ready and chord-highlighted cells
    ├── cell/                 # Individual square component (OnPush)
    ├── game-header/          # Mine counter, sniffer/auto-chord/auto-restart countdowns (each hidden until unlocked), face/reset, timer
    ├── settings-dialog/      # Keyboard shortcut, mouse-action, and cell-size settings dialog
    ├── upgrades-dialog/      # Shop dialog for mine/board/speed upgrades & unlocks, with a live mine-density readout
    └── prestige-dialog/      # Prestige action + shop for permanent (prestige-point) unlocks
```

## Game Mechanics

- **Core loop**: `BoardConfig` (rows/cols/mines) is generated from `UpgradesStore`'s current levels on every `newGame()`. Winning a board awards its mine count to `CurrencyStore`; losing awards nothing. The board cleared/boom banner (`app.ts`) is itself a button that starts a new game when clicked.
- **Hands-off by design**: `GameStore`'s timer starts once in the constructor and runs for the store's lifetime (not just while `playing`), so the sniffer and auto-chord timers are already counting down the moment `newGame()` runs, before the player does anything. If the sniffer fires while still `idle`, it (via `ensureMinesPlaced`) safely lays mines around whichever cell it picks and starts the round itself — a player never strictly has to click to begin.
- **Wall-clock timers, not tick-counters**: every timer (`_snifferDeadline`, `_autoChordDeadline`, `_autoRestartDeadline`) is stored as an absolute `Date.now() + intervalMs` deadline and compared against the current time each tick, rather than decrementing a counter by a fixed amount per tick. This matters because browsers throttle `setInterval` in backgrounded/inactive tabs — a tick-counter approach would run in slow motion when throttled, while deadline comparison always resolves at the correct real-world moment regardless of how sparsely the interval actually fires. Auto-flag is the exception - see below, it isn't timer-driven at all.
- **Upgrades** (`UpgradesStore`, bought with banked mines, persisted to `localStorage`): mine capacity, board rows, board columns, sniffer speed, auto-chord speed, and auto-restart speed are six independent tracks, each with its own exponential cost curve. Loads legacy single-`boardSize` saves by applying that level to both rows and cols. If any upgrade changes while the round is still `idle` (nothing locked in yet), `GameStore` immediately regenerates the board/timers to reflect it via a constructor `effect()` — the effect's automatic first run is explicitly skipped (a `firstEffectRun` flag) so it only reacts to genuine purchases, not its own initial firing.
  - **Mine density cap**: mine capacity can't be bought past 50% of the current board's cells (`MAX_MINE_DENSITY`, `mineDensityCapMines`). Growing the board (more rows/cols) raises the cap. The upgrades dialog shows the current density and turns it red at/above 50%.
  - **Timer speed curve** (`timerIntervalMs`, shared by the sniffer/auto-chord/auto-restart timer upgrades): starts at 10s; each level removes a full second down to 7s, then half a second down to 5s, then a quarter second down to 3s, then a fifth of a second per level indefinitely (asymptotically bounded by a hard `MIN_TIMER_MS` floor that exponential cost growth makes practically unreachable).
- **Auto-flag** (🚩, `board.util.ts#autoFlagAll`): a single unlock, no speed track and *not* timer-driven at all - `GameStore#applyAutoFlag` runs inline right after every `reveal()`/`chord()`/sniffer-resolution, cascading through `board.util.ts#findFlaggableMine` in a loop until no further deduction is available, so it flags every currently-provable mine in one pass (flagging one mine can immediately satisfy a different revealed number, unlocking the next). A constructor `effect()` also re-runs it whenever `autoFlagUnlocked`/`autoFlagEnabled` newly become true (buying the unlock or flipping the toggle on), so it retroactively catches anything already deducible from clues exposed before that moment rather than waiting for the next move. Once unlocked, `app.html` shows a `mat-slide-toggle` below the board (defaults on) bound to `UpgradesStore#autoFlagEnabled`/`setAutoFlagEnabled` - switching it off doesn't un-flag anything already placed, it just stops future auto-flagging. A cell it flags gets `Cell#autoFlagged: true` (`cell.scss` renders it in a distinct tertiary colour instead of the player's error-red) and `toggleFlag` refuses to remove it - it's locked in, not misclick-removable, unlike a player-placed flag. Sniffer- and win-time-flagged mines are unaffected (`autoFlagged` stays `false`); only `autoFlagAll` sets it.
- **Sniffer** (🐶): a placeable marker on a hidden cell. When its timer fires, one random *marked* sniffer auto-resolves if any are placed, otherwise the autosniffer kicks in (if unlocked) and resolves a random *hidden* square instead (flag if a mine, reveal if safe) — either way the timer resets. Resolving a mine always flags it rather than revealing it, so the sniffer (manual or auto) can never itself lose the game. Placing a sniffer once the deadline has already passed resolves it immediately instead of waiting for the next tick.
- **Auto-chord** (🤖, `board.util.ts#findAvailableChord`): when its timer fires, looks for a revealed number whose flagged-neighbour count already matches and that still has a hidden neighbour worth revealing, and chords it. If none exists yet, stays armed and retries every subsequent tick until one appears (often fed by auto-flag, which already ran inline right after the reveal/chord that exposed the clue).
- **Auto-restart**: once the round ends (won/lost), its own timer starts fresh from that exact moment (not from `newGame()` time) and calls `newGame()` when it elapses, looping the whole cycle without any input.
- **Automation unlocks** (`UpgradesStore`): sniffer, auto-flag, auto-chord, and auto-restart are each inert until a one-time "unlock" purchase is made (100/150/250/100 mines respectively) — until then, nothing fires, manually placing a sniffer (`toggleSniffer`) is blocked, and `game-header.html` hides that mechanic's readout entirely (`@if (upgrades.xUnlocked())`) rather than showing a dead countdown (auto-flag has no header readout at all, timer-based or otherwise). Sniffer/auto-chord/auto-restart's speed-upgrade tracks are gated on their unlock (`canAffordXSpeed`/`buyXSpeed` all check the unlock flag); auto-flag has no speed track to gate. Auto-sniffer (the random-hidden-cell fallback) is a further, pricier unlock (300 mines) layered on top of the base sniffer unlock — `buyAutoSnifferUnlock` refuses to run and `load()` refuses to trust a persisted `autoSnifferUnlocked: true` unless `snifferUnlocked` is also true, so it can never be active without the base sniffer.
- **Prestige** (`PrestigeStore`, permanent, persisted separately from `UpgradesStore`): `CurrencyStore` tracks `lifetimeMines` alongside the spendable `mines` balance - lifetime mines never decrease, not even on a prestige reset, so prestige gain is always judged against the same ever-growing total. `prestigePointsForLifetimeMines(lifetimeMines) = floor(sqrt(lifetimeMines / 800))` sets how many points a given lifetime total is worth; `PrestigeStore#availableGain` is that total minus points already claimed (`_lifetimePointsClaimed`), and `claimAvailableGain()` banks the difference. The `PrestigeDialog`'s "Prestige" action (two-step confirm) calls `prestige.claimAvailableGain()`, then `currency.resetSpendable()` (zeroes spendable mines only) and `upgrades.resetForPrestige()` (zeroes every mine-bought level *and* unlock, and resets the auto-flag and chord-highlight toggles back to their on-by-default states), then forces `game.newGame()`. Prestige points buy permanent versions of the four automation unlocks plus auto-sniffer (1/2/3/1/3 points; auto-sniffer gated on the permanent sniffer, same pattern as the mine-bought version) and permanent chord highlighting (1 point) - `UpgradesStore`'s `xUnlocked` signals are `computed(() => this._xUnlocked() || this.prestige.permanentXUnlocked())`, so a permanent unlock survives `resetForPrestige()` and even lets that mechanic's speed track be bought with mines before its mine-based unlock is ever purchased. `UpgradesStore` depends on `PrestigeStore` (one-way, to read the permanent flags) - `PrestigeStore` itself has no dependency on `UpgradesStore`, and the reset orchestration lives in `PrestigeDialog` instead, specifically to avoid a circular provider dependency.
- **Chord-ready cursor & highlighting**: `board.util.ts#isChordReady` (used by `board.ts`'s `chordReady` computed `Set`) marks any revealed number whose flag count already matches its adjacent-mine count; those cells get `cursor: pointer` (`cell.scss` `.is-chord-ready`) instead of the default cursor other revealed cells use. `board.util.ts#isAvailableChord` narrows that to revealed numbers with matching flags (regardless of whether the flags are correct) that still have a hidden neighbour left to reveal; once `UpgradesStore#chordHighlightUnlocked` is bought (50 mines, or permanently via 1 prestige point), `board.ts`'s `chordHighlighted` computed `Set` highlights those cells via `.is-chord-highlighted`, with a toggle (`chordHighlightEnabled`/`setChordHighlightEnabled`) below the board in `app.html`.
- **Keybindings** (`KeybindingsStore`): reveal/flag/sniffer are independently rebindable single letters (default `z`/`x`/`c`, no overlaps allowed), and left/right mouse click are independently mappable to reveal, flag, or sniff. Hovering a cell focuses it so letter shortcuts act on the hovered square; space bar starts a new game except when a cell, dialog, or form control would otherwise handle it (always allowed once the round is won/lost).
- **Cell size** (`DisplayStore`, persisted): a player-chosen pixel size (Small/Medium/Large/Extra large) applied via a `--ms-cell-size` CSS custom property that `Board` sets as a host binding, read by `cell.scss` for every cell dimension. Deliberately fixed regardless of board size or viewport - `board.ts`'s `gridTemplate` always renders `config().cols` tracks at that one size, so growing rows/cols (or a narrow viewport) never shrinks cells to fit. Instead `app.html` wraps `<ms-board />` in a `.board-scroll` container (`overflow-x: auto`) so an oversized board scrolls horizontally under the always-visible header/toolbar rather than squeezing cells smaller.

## Key Guidelines & Conventions

1. **State Immutability**: Never mutate cell array or cell objects in place. Always return new arrays/objects for changed cells so `OnPush` components re-render efficiently.
2. **Pure Board Logic**: Board calculations live in `src/app/services/board.util.ts` as pure functions, enabling isolated unit testing without Angular dependencies.
3. **No RxJS / Tailwind**: Keep app logic driven by Angular Signals and pure functions. Styling uses SCSS and Angular Material components.
4. **Zoneless**: Explicitly zoneless. Do not import `zone.js` or rely on Zone-based change detection.
5. **Timer tests need fake timers from construction**: `GameStore`'s timer starts in the constructor, not on first reveal, so every `game-store.spec.ts` test calls `vi.useFakeTimers()` in `beforeEach` (before `createStore()`) to avoid a real background interval running during tests.
