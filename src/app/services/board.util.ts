import { BoardConfig, Cell } from '../models/cell';

/** Builds a fresh, mine-free board. Mines are placed after the first click. */
export function createCells(config: BoardConfig): Cell[] {
  const cells: Cell[] = [];
  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.cols; col++) {
      cells.push({
        index: row * config.cols + col,
        row,
        col,
        isMine: false,
        adjacentMines: 0,
        state: 'hidden',
        exploded: false,
        wrongFlag: false,
        hasSniffer: false,
        autoFlagged: false,
      });
    }
  }
  return cells;
}

/** Indexes of the (up to) eight squares touching `index`. */
export function neighborIndexes(index: number, config: BoardConfig): number[] {
  const { rows, cols } = config;
  const row = Math.floor(index / cols);
  const col = index % cols;
  const result: number[] = [];

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) {
        continue;
      }
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || r >= rows || c < 0 || c >= cols) {
        continue;
      }
      result.push(r * cols + c);
    }
  }

  return result;
}

/**
 * Scatters mines across the board, guaranteeing the first click (and, when
 * there is room, everything touching it) is safe. Also fills in adjacency
 * counts.
 */
export function placeMines(
  cells: readonly Cell[],
  config: BoardConfig,
  safeIndex: number,
): Cell[] {
  const total = cells.length;
  const safe = new Set<number>([safeIndex]);

  // Only carve out the full 3x3 opening if there is still room for every mine.
  if (config.mines <= total - 9) {
    for (const n of neighborIndexes(safeIndex, config)) {
      safe.add(n);
    }
  }

  const candidates: number[] = [];
  for (let i = 0; i < total; i++) {
    if (!safe.has(i)) {
      candidates.push(i);
    }
  }

  // Partial Fisher-Yates: only shuffle as many slots as we need.
  const mineCount = Math.min(config.mines, candidates.length);
  for (let i = 0; i < mineCount; i++) {
    const j = i + Math.floor(Math.random() * (candidates.length - i));
    const tmp = candidates[i];
    candidates[i] = candidates[j];
    candidates[j] = tmp;
  }
  const mines = new Set(candidates.slice(0, mineCount));

  const withMines = cells.map((cell) => ({ ...cell, isMine: mines.has(cell.index) }));

  return withMines.map((cell) => ({
    ...cell,
    adjacentMines: cell.isMine
      ? 0
      : neighborIndexes(cell.index, config).filter((n) => withMines[n].isMine).length,
  }));
}

/**
 * Reveals `start` and, if it is blank, cascades outward through every
 * connected blank square and the numbered border around it.
 */
export function floodReveal(
  cells: readonly Cell[],
  start: number,
  config: BoardConfig,
): Cell[] {
  const next = cells.slice();
  const stack: number[] = [start];
  const seen = new Set<number>();

  while (stack.length > 0) {
    const index = stack.pop() as number;
    if (seen.has(index)) {
      continue;
    }
    seen.add(index);

    const cell = next[index];
    if (cell.state !== 'hidden') {
      continue;
    }

    next[index] = { ...cell, state: 'revealed' };

    if (!cell.isMine && cell.adjacentMines === 0) {
      for (const n of neighborIndexes(index, config)) {
        if (next[n].state === 'hidden') {
          stack.push(n);
        }
      }
    }
  }

  return next;
}

/** End-of-game reveal: show every mine and mark the flags that were wrong. */
export function revealMines(cells: readonly Cell[], explodedIndex: number): Cell[] {
  return cells.map((cell) => {
    if (cell.index === explodedIndex) {
      return { ...cell, state: 'revealed' as const, exploded: true };
    }
    if (cell.isMine && cell.state !== 'flagged') {
      return { ...cell, state: 'revealed' as const };
    }
    if (!cell.isMine && cell.state === 'flagged') {
      return { ...cell, wrongFlag: true };
    }
    return cell;
  });
}

/** Courtesy flag on every remaining mine once the board is cleared. */
export function flagRemainingMines(cells: readonly Cell[]): Cell[] {
  return cells.map((cell) =>
    cell.isMine && cell.state !== 'flagged'
      ? { ...cell, state: 'flagged' as const }
      : cell,
  );
}

/**
 * Finds a hidden cell whose status as a mine is logically guaranteed by an
 * adjacent revealed number (i.e. where the count of that number's hidden and
 * flagged neighbours already equals its adjacent-mine count). Returns just
 * one square - auto-flag resolves a single cell per timer tick, the same as
 * the sniffer and auto-chord, rather than flagging everything it can deduce
 * at once. Returns `undefined` if nothing is currently deducible.
 */
export function findFlaggableMine(cells: readonly Cell[], config: BoardConfig): number | undefined {
  for (const cell of cells) {
    if (cell.state !== 'revealed' || cell.isMine || cell.adjacentMines === 0) {
      continue;
    }

    const neighbors = neighborIndexes(cell.index, config);
    let unrevealedCount = 0;
    let firstHidden: number | undefined;

    for (const n of neighbors) {
      const neighborState = cells[n].state;
      if (neighborState === 'hidden') {
        unrevealedCount++;
        firstHidden ??= n;
      } else if (neighborState === 'flagged') {
        unrevealedCount++;
      }
    }

    if (unrevealedCount === cell.adjacentMines && firstHidden !== undefined) {
      return firstHidden;
    }
  }

  return undefined;
}

/**
 * Flags every hidden cell whose mine-ness is currently logically guaranteed,
 * repeating until no further deduction is available - flagging one mine can
 * immediately satisfy a different revealed number elsewhere, unlocking the
 * next one. Every cell it flags is marked `autoFlagged: true`.
 */
export function autoFlagAll(cells: readonly Cell[], config: BoardConfig): readonly Cell[] {
  let next = cells;
  let index = findFlaggableMine(next, config);

  while (index !== undefined) {
    const updated = next.slice();
    updated[index] = { ...updated[index], state: 'flagged', autoFlagged: true };
    next = updated;
    index = findFlaggableMine(next, config);
  }

  return next;
}

/** The board is cleared when every non-mine square has been revealed. */
export function isCleared(cells: readonly Cell[]): boolean {
  return cells.every((cell) => cell.isMine || cell.state === 'revealed');
}

/** Whether clicking this revealed number would trigger a chord right now. */
export function isChordReady(cells: readonly Cell[], index: number, config: BoardConfig): boolean {
  const cell = cells[index];
  if (!cell || cell.state !== 'revealed' || cell.adjacentMines === 0) {
    return false;
  }

  const flagged = neighborIndexes(index, config).filter((n) => cells[n].state === 'flagged').length;
  return flagged === cell.adjacentMines;
}

/**
 * Whether `index` is a revealed number whose current flag count matches its
 * adjacent-mine count (regardless of whether those flags are correct) and
 * still has at least one hidden neighbour left to reveal.
 */
export function isAvailableChord(
  cells: readonly Cell[],
  index: number,
  config: BoardConfig,
): boolean {
  const cell = cells[index];
  if (!cell || cell.state !== 'revealed' || cell.adjacentMines === 0) {
    return false;
  }

  const neighbors = neighborIndexes(index, config);
  const flagged = neighbors.filter((n) => cells[n].state === 'flagged').length;
  return flagged === cell.adjacentMines && neighbors.some((n) => cells[n].state === 'hidden');
}

/**
 * Finds a revealed number whose flag count already matches, and that still
 * has at least one hidden neighbour left to reveal (i.e. chording it would
 * actually make progress). Returns `undefined` if no such square exists.
 */
export function findAvailableChord(cells: readonly Cell[], config: BoardConfig): number | undefined {
  return cells.find((cell) => isAvailableChord(cells, cell.index, config))?.index;
}
