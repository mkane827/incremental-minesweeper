# Incremental Minesweeper

Stage one: plain 10×10 minesweeper with 10 mines, built on Angular 21 with signals,
zoneless change detection, Angular Material, and SCSS. No Tailwind, no RxJS in app code.

## Running it

```bash
npm install
npm start
```

Then open http://localhost:4200.

## How to play

- **Left click** — reveal a square.
- **Right click** — place or remove a flag.
- **Left click a revealed number** — chord: if its flag count already matches the
  number, everything else around it opens at once.
- The first click is always safe; mines are laid *after* it, avoiding the clicked
  square and its neighbours so you always get an opening.

## Layout

```
src/app/
  models/cell.ts              Cell, CellState, GameStatus, BoardConfig
  services/board.util.ts      Pure board functions (generation, flood fill, reveal)
  services/game-store.ts      Signal store — the only stateful piece
  components/cell/            One square. OnPush, signal inputs/outputs.
  components/board/           The grid.
  components/game-header/     Mine counter, timer, reset.
  app.ts                      Shell: toolbar + card + status banner.
```

### State model

`GameStore` holds four writable signals (`config`, `cells`, `status`,
`elapsedSeconds`) and derives everything else with `computed` — `flagCount`,
`minesRemaining`, `isOver`, `revealedCount`.

Every mutation replaces the cell array *and* the objects for the cells that
changed. Nothing is mutated in place. That means `ms-cell` can stay `OnPush` with
a `input.required<Cell>()` and re-render only when its own square moves.

All board maths lives in `board.util.ts` as pure functions, so it can be unit
tested without touching Angular.

### Why zoneless

`app.config.ts` calls `provideZonelessChangeDetection()`. Angular 21 makes this
the default, but it's declared explicitly so the intent is obvious. There is no
`zone.js` dependency and `polyfills` in `angular.json` is empty.

## Where this goes next

The pieces most likely to grow for the incremental layer:

- `BoardConfig` is already parameterised — `newGame({ rows, cols, mines })` works
  today for any size.
- `GameStore.settle()` is the single place a win is recognised, so that's the
  natural hook for awarding currency.
- `revealedCount` is exposed for scoring, and the timer is already isolated.
