import { BoardConfig } from '../models/cell';
import {
  createCells,
  flagRemainingMines,
  floodReveal,
  isCleared,
  neighborIndexes,
  placeMines,
  revealMines,
} from './board.util';

const CONFIG: BoardConfig = { rows: 4, cols: 4, mines: 3 };

describe('createCells', () => {
  it('builds a fully hidden, mine-free board of the right size', () => {
    const cells = createCells(CONFIG);

    expect(cells).toHaveLength(16);
    expect(cells.every((cell) => cell.state === 'hidden')).toBe(true);
    expect(cells.every((cell) => !cell.isMine)).toBe(true);
  });

  it('assigns row/col/index consistently with row-major order', () => {
    const cells = createCells(CONFIG);

    expect(cells[5]).toMatchObject({ index: 5, row: 1, col: 1 });
    expect(cells[13]).toMatchObject({ index: 13, row: 3, col: 1 });
  });
});

describe('neighborIndexes', () => {
  it('returns 3 neighbours for a corner cell', () => {
    expect(neighborIndexes(0, CONFIG)).toEqual(
      expect.arrayContaining([1, 4, 5]),
    );
    expect(neighborIndexes(0, CONFIG)).toHaveLength(3);
  });

  it('returns 5 neighbours for an edge cell', () => {
    expect(neighborIndexes(1, CONFIG)).toHaveLength(5);
  });

  it('returns 8 neighbours for an interior cell', () => {
    expect(neighborIndexes(5, CONFIG)).toHaveLength(8);
  });
});

describe('placeMines', () => {
  it('places exactly config.mines mines', () => {
    const cells = placeMines(createCells(CONFIG), CONFIG, 0);
    expect(cells.filter((cell) => cell.isMine)).toHaveLength(CONFIG.mines);
  });

  it('never mines the clicked cell or its neighbours when there is room', () => {
    const safeIndex = 5;
    const cells = placeMines(createCells(CONFIG), CONFIG, safeIndex);
    const safeZone = [safeIndex, ...neighborIndexes(safeIndex, CONFIG)];

    for (const index of safeZone) {
      expect(cells[index].isMine).toBe(false);
    }
  });

  it('computes correct adjacency counts', () => {
    const config: BoardConfig = { rows: 3, cols: 3, mines: 1 };
    const withMines = placeMines(createCells(config), config, 0);

    for (const cell of withMines) {
      if (cell.isMine) {
        continue;
      }
      const expected = neighborIndexes(cell.index, config).filter(
        (n) => withMines[n].isMine,
      ).length;
      expect(cell.adjacentMines).toBe(expected);
    }
  });

  it('always keeps at least the clicked cell mine-free when the board is nearly full of mines', () => {
    const config: BoardConfig = { rows: 3, cols: 3, mines: 8 };
    const cells = placeMines(createCells(config), config, 4);
    expect(cells[4].isMine).toBe(false);
  });
});

describe('floodReveal', () => {
  it('cascades through connected blanks and stops at the numbered border', () => {
    // 3x3 board, single mine in the corner (index 8) so index 0 is blank and
    // should flood everything except the mine and its immediate neighbours' far side.
    const config: BoardConfig = { rows: 3, cols: 3, mines: 1 };
    let cells = createCells(config).map((cell) => ({
      ...cell,
      isMine: cell.index === 8,
    }));
    cells = cells.map((cell) => ({
      ...cell,
      adjacentMines: cell.isMine
        ? 0
        : neighborIndexes(cell.index, config).filter((n) => cells[n].isMine).length,
    }));

    const next = floodReveal(cells, 0, config);

    // Every non-mine cell should end up revealed; the mine itself stays hidden.
    for (const cell of next) {
      if (cell.isMine) {
        expect(cell.state).toBe('hidden');
      } else {
        expect(cell.state).toBe('revealed');
      }
    }
  });

  it('does not reveal a flagged cell', () => {
    const config: BoardConfig = { rows: 2, cols: 2, mines: 0 };
    let cells = createCells(config);
    cells = cells.map((cell) =>
      cell.index === 1 ? { ...cell, state: 'flagged' as const } : cell,
    );

    const next = floodReveal(cells, 0, config);

    expect(next[1].state).toBe('flagged');
  });
});

describe('revealMines', () => {
  it('marks the detonated mine exploded and reveals the rest', () => {
    const config: BoardConfig = { rows: 2, cols: 2, mines: 2 };
    const cells = createCells(config).map((cell) => ({
      ...cell,
      isMine: cell.index === 0 || cell.index === 3,
    }));

    const next = revealMines(cells, 0);

    expect(next[0]).toMatchObject({ state: 'revealed', exploded: true });
    expect(next[3]).toMatchObject({ state: 'revealed', exploded: false });
  });

  it('leaves a correctly flagged mine flagged instead of revealing it', () => {
    const config: BoardConfig = { rows: 2, cols: 2, mines: 2 };
    const cells = createCells(config).map((cell) => ({
      ...cell,
      isMine: cell.index === 0 || cell.index === 3,
      state: cell.index === 3 ? ('flagged' as const) : cell.state,
    }));

    const next = revealMines(cells, 0);

    expect(next[3].state).toBe('flagged');
  });

  it('marks a wrong flag on a non-mine cell that was flagged', () => {
    const config: BoardConfig = { rows: 2, cols: 2, mines: 1 };
    const cells = createCells(config).map((cell) => ({
      ...cell,
      isMine: cell.index === 0,
      state: cell.index === 1 ? ('flagged' as const) : cell.state,
    }));

    const next = revealMines(cells, 0);

    expect(next[1]).toMatchObject({ state: 'flagged', wrongFlag: true });
  });
});

describe('flagRemainingMines', () => {
  it('flags every unflagged mine and leaves everything else untouched', () => {
    const config: BoardConfig = { rows: 2, cols: 2, mines: 2 };
    const cells = createCells(config).map((cell) => ({
      ...cell,
      isMine: cell.index === 0 || cell.index === 3,
    }));

    const next = flagRemainingMines(cells);

    expect(next[0].state).toBe('flagged');
    expect(next[3].state).toBe('flagged');
    expect(next[1].state).toBe('hidden');
    expect(next[2].state).toBe('hidden');
  });
});

describe('isCleared', () => {
  it('is false while a non-mine cell remains hidden', () => {
    const config: BoardConfig = { rows: 2, cols: 2, mines: 1 };
    const cells = createCells(config).map((cell) => ({ ...cell, isMine: cell.index === 0 }));
    expect(isCleared(cells)).toBe(false);
  });

  it('is true once every non-mine cell is revealed', () => {
    const config: BoardConfig = { rows: 2, cols: 2, mines: 1 };
    const cells = createCells(config).map((cell) => ({
      ...cell,
      isMine: cell.index === 0,
      state: cell.index === 0 ? cell.state : ('revealed' as const),
    }));
    expect(isCleared(cells)).toBe(true);
  });
});
