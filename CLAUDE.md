# Incremental Minesweeper

An incremental Minesweeper game built with Angular 21, Angular Material, Signals, and SCSS.

## Development & Build Commands

- **Development Server**: `npm start` (runs `ng serve`, available at http://localhost:4200)
- **Run Unit Tests**: `npx ng test --watch=false` (runs Vitest unit test suite once)
- **Watch Unit Tests**: `npx ng test`
- **Build Production**: `npx ng build`

## Architecture & Technology Stack

- **Framework**: Angular 21 with **zoneless change detection** (`provideZonelessChangeDetection()`). No `zone.js` dependency.
- **State Management**: Angular **Signals** (`signal`, `computed`). Single-source-of-truth stores (`GameStore`, `CurrencyStore`, `UpgradesStore`, `KeybindingsStore`).
- **Component Strategy**: `ChangeDetectionStrategy.OnPush` across all components. Signal inputs (`input.required<T>()`) and outputs.
- **Styling**: SCSS + Angular Material. Plain SCSS design (no Tailwind, no RxJS in app logic).
- **Unit Testing**: Vitest integrated via `@angular/build` (`npx ng test --watch=false`). Mostly service-level specs; `game-header.spec.ts` is the first component-level spec (uses `TestBed.createComponent`).

## Directory Structure

```
src/app/
├── models/
│   └── cell.ts               # Cell, CellState, GameStatus, BoardConfig interfaces
├── services/
│   ├── board.util.ts         # Pure functions for board logic (mines, flood fill, reveal, chording, auto-flag)
│   ├── game-store.ts         # GameStore signal store for round lifecycle, timer & sniffer countdown
│   ├── currency-store.ts     # CurrencyStore for earned/spent mines
│   ├── upgrades-store.ts     # UpgradesStore for persistent meta-progression (mine capacity, board rows/cols, sniffer/auto-chord speed)
│   └── keybindings-store.ts  # KeybindingsStore for configurable keyboard shortcuts & mouse click actions
└── components/
    ├── board/                # Grid component
    ├── cell/                 # Individual square component (OnPush)
    ├── game-header/          # Mine counter, sniffer & auto-chord countdowns, face/reset, timer
    ├── settings-dialog/      # Keyboard shortcut & mouse-action settings dialog
    └── upgrades-dialog/      # Shop dialog for mine/board/speed upgrades
```

## Game Mechanics

- **Core loop**: `BoardConfig` (rows/cols/mines) is generated from `UpgradesStore`'s current levels on every `newGame()`. Winning a board awards its mine count to `CurrencyStore`; losing awards nothing.
- **Upgrades** (`UpgradesStore`, bought with banked mines, persisted to `localStorage`): mine capacity, board rows, board columns, sniffer speed, and auto-chord speed are five independent tracks, each with its own exponential cost curve. The two speed tracks shave a second off their respective timer per level (base 10s, floor 3s) and cap out once the floor is reached (`isSnifferSpeedMaxed` / `isAutoChordSpeedMaxed`). Loads legacy single-`boardSize` saves by applying that level to both rows and cols.
- **Auto-flag** (`board.util.ts#autoFlag`): after any reveal/chord, hidden neighbours of a satisfied number are auto-flagged when the count of hidden+flagged neighbours equals the cell's adjacent-mine count. Runs to a fixed point (loops until no more cells change).
- **Sniffer** (🐶): a placeable marker on a hidden cell. `GameStore` counts down `secondsUntilSniff` (resets to `UpgradesStore.snifferIntervalSeconds()`) while `playing`; when it hits zero, one random *marked* sniffer auto-resolves if any are placed, otherwise the autosniffer kicks in and resolves a random *hidden* square instead (flag if a mine, reveal + auto-flag if safe) — either way the timer resets. Resolving a mine always flags it rather than revealing it, so the sniffer (manual or auto) can never itself lose the game. Placing a sniffer while the countdown is already at 0 resolves that cell immediately instead of waiting for the next tick.
- **Auto-chord** (🤖, `board.util.ts#findAvailableChord`): `GameStore` counts down `secondsUntilAutoChord` (resets to `UpgradesStore.autoChordIntervalSeconds()`) while `playing`; when it hits zero it looks for a revealed number whose flagged-neighbour count already matches and that still has a hidden neighbour worth revealing, and chords it. If none exists yet, the countdown freezes at 0 and retries every subsequent tick until one appears.
- **Keybindings** (`KeybindingsStore`): reveal/flag/sniffer are independently rebindable single letters (default `z`/`x`/`c`, no overlaps allowed), and left/right mouse click are independently mappable to reveal, flag, or sniff. Hovering a cell focuses it so letter shortcuts act on the hovered square; space bar starts a new game except when a cell, dialog, or form control would otherwise handle it (always allowed once the round is won/lost).

## Key Guidelines & Conventions

1. **State Immutability**: Never mutate cell array or cell objects in place. Always return new arrays/objects for changed cells so `OnPush` components re-render efficiently.
2. **Pure Board Logic**: Board calculations live in `src/app/services/board.util.ts` as pure functions, enabling isolated unit testing without Angular dependencies.
3. **No RxJS / Tailwind**: Keep app logic driven by Angular Signals and pure functions. Styling uses SCSS and Angular Material components.
4. **Zoneless**: Explicitly zoneless. Do not import `zone.js` or rely on Zone-based change detection.
