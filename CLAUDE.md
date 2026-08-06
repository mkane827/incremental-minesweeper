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
- **Unit Testing**: Vitest integrated via `@angular/build` (`npx ng test --watch=false`).

## Directory Structure

```
src/app/
├── models/
│   └── cell.ts               # Cell, CellState, GameStatus, BoardConfig interfaces
├── services/
│   ├── board.util.ts         # Pure functions for board logic (mines, flood fill, reveal, chording)
│   ├── game-store.ts         # GameStore signal store for round lifecycle & timer
│   ├── currency-store.ts     # CurrencyStore for earned/spent mines
│   ├── upgrades-store.ts     # UpgradesStore for persistent meta-progression (mines/board size)
│   └── keybindings-store.ts  # KeybindingsStore for configurable keyboard controls
└── components/
    ├── board/                # Grid component
    ├── cell/                 # Individual square component (OnPush)
    ├── game-header/          # Mine counter, face/reset, timer
    ├── settings-dialog/      # Keyboard shortcut settings dialog
    └── upgrades-dialog/      # Shop dialog for mine capacity & board size upgrades
```

## Key Guidelines & Conventions

1. **State Immutability**: Never mutate cell array or cell objects in place. Always return new arrays/objects for changed cells so `OnPush` components re-render efficiently.
2. **Pure Board Logic**: Board calculations live in `src/app/services/board.util.ts` as pure functions, enabling isolated unit testing without Angular dependencies.
3. **No RxJS / Tailwind**: Keep app logic driven by Angular Signals and pure functions. Styling uses SCSS and Angular Material components.
4. **Zoneless**: Explicitly zoneless. Do not import `zone.js` or rely on Zone-based change detection.
