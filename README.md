# Incremental Minesweeper

An incremental Minesweeper game built with Angular 21, Angular Material, Signals, zoneless change detection, and SCSS. No Tailwind, no RxJS in app code.

## Running & Testing

```bash
npm install
npm start                  # Dev server at http://localhost:4200
npx ng test --watch=false  # Run Vitest unit tests once
npx ng build               # Production build
```

## How to Play

- **Left click** — reveal a square (or click a revealed number whose flags match to chord around it).
- **Right click** — place or remove a flag.
- **Keyboard & mouse shortcuts** — hover a cell and press `z` (reveal), `x` (flag), or `c` (sniffer); `Space` starts a new game. All bindings and cell size are configurable in **Settings**.
- The first click is always safe; mines are laid *after* it, avoiding the clicked square and its neighbours.

## Incremental Progression

Clearing a board awards its mine count to your spendable balance and lifetime total (persisted in `localStorage`):

- **Board & capacity upgrades:** Increase mine count (up to a 50% density cap) and expand board rows and columns.
- **Quality-of-life & automation unlocks:**
  - **Highlight available chords** — highlights revealed numbers whose current flags match and still have hidden neighbours (toggleable below the board).
  - **Sniffer & Autosniffer** — periodically resolves a marked square or random hidden square.
  - **Auto-flag** — instantly cascades and locks in logically guaranteed mines after moves (toggleable below the board).
  - **Auto-chord** — periodically chords an available revealed number.
  - **Auto-restart** — automatically starts a new round after win or loss.
- **Prestige:** Earn prestige points from lifetime mines earned and spend them on permanent unlocks that survive future prestige resets.

## Layout

```text
src/app/
├── models/cell.ts               # Cell, CellState, GameStatus, BoardConfig interfaces
├── services/
│   ├── board.util.ts            # Pure board logic (mines, flood fill, reveal, chording, auto-flag)
│   ├── game-store.ts            # Round lifecycle and wall-clock-deadline timers
│   ├── currency-store.ts        # Spendable mines and lifetime mines earned
│   ├── upgrades-store.ts        # Run-scoped upgrades, unlocks, and toggles
│   ├── prestige-store.ts        # Permanent prestige points and unlocks
│   ├── keybindings-store.ts     # Configurable keyboard shortcuts and mouse actions
│   └── display-store.ts         # Persisted cell size
└── components/
    ├── board/                   # Grid and chord readiness/highlighting
    ├── cell/                    # Individual square (OnPush)
    ├── game-header/             # Mine counter, automation countdowns, reset, timer
    ├── upgrades-dialog/         # Mine-bought upgrades and unlocks
    ├── prestige-dialog/         # Prestige reset and permanent unlocks
    └── settings-dialog/         # Keybindings, mouse actions, and cell size
```
