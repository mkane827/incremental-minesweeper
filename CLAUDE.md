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
│   ├── upgrades-store.ts     # UpgradesStore for persistent meta-progression (mine capacity, board rows, board cols)
│   └── keybindings-store.ts  # KeybindingsStore for configurable keyboard shortcuts & mouse click actions
└── components/
    ├── board/                # Grid component
    ├── cell/                 # Individual square component (OnPush)
    ├── game-header/          # Mine counter, sniffer countdown, face/reset, timer
    ├── settings-dialog/      # Keyboard shortcut & mouse-action settings dialog
    └── upgrades-dialog/      # Shop dialog for mine capacity, rows, and columns upgrades
```

## Game Mechanics

- **Core loop**: `BoardConfig` (rows/cols/mines) is generated from `UpgradesStore`'s current levels on every `newGame()`. Winning a board awards its mine count to `CurrencyStore`; losing awards nothing.
- **Upgrades** (`UpgradesStore`, bought with banked mines, persisted to `localStorage`): mine capacity, board rows, and board columns are three independent tracks, each with its own exponential cost curve. Loads legacy single-`boardSize` saves by applying that level to both rows and cols.
- **Auto-flag** (`board.util.ts#autoFlag`): after any reveal/chord, hidden neighbours of a satisfied number are auto-flagged when the count of hidden+flagged neighbours equals the cell's adjacent-mine count. Runs to a fixed point (loops until no more cells change).
- **Sniffer** (🐶): a placeable marker on a hidden cell. `GameStore` counts down `secondsUntilSniff` (resets to 10) while `playing`; when it hits zero with any sniffers on the board, one random sniffed cell auto-resolves (flag if a mine, reveal + auto-flag if safe) and the timer resets. Placing a sniffer while the countdown is already at 0 resolves that cell immediately instead of waiting for the next tick.
- **Keybindings** (`KeybindingsStore`): reveal/flag/sniffer are independently rebindable single letters (default `z`/`x`/`c`, no overlaps allowed), and left/right mouse click are independently mappable to reveal, flag, or sniff. Hovering a cell focuses it so letter shortcuts act on the hovered square; space bar starts a new game except when a cell, dialog, or form control would otherwise handle it (always allowed once the round is won/lost).

## Key Guidelines & Conventions

1. **State Immutability**: Never mutate cell array or cell objects in place. Always return new arrays/objects for changed cells so `OnPush` components re-render efficiently.
2. **Pure Board Logic**: Board calculations live in `src/app/services/board.util.ts` as pure functions, enabling isolated unit testing without Angular dependencies.
3. **No RxJS / Tailwind**: Keep app logic driven by Angular Signals and pure functions. Styling uses SCSS and Angular Material components.
4. **Zoneless**: Explicitly zoneless. Do not import `zone.js` or rely on Zone-based change detection.
