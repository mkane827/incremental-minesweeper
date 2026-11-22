import { BoardConfig } from '../models/cell';
import {
  autoFlagAll,
  createCells,
  findAvailableChord,
  findFlaggableMine,
  flagRemainingMines,
  floodReveal,
  isChordReady,
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

describe('findFlaggableMine', () => {
  it('finds a hidden neighbor when unrevealed neighbors equal adjacentMines', () => {
    // 1x3 board: [mine at 0, safe at 1 with adj=1 (revealed), safe at 2 (revealed)]
    const config: BoardConfig = { rows: 1, cols: 3, mines: 1 };
    const cells = createCells(config).map((cell) => {
      if (cell.index === 0) return { ...cell, isMine: true };
      if (cell.index === 1) return { ...cell, state: 'revealed' as const, adjacentMines: 1 };
      return { ...cell, state: 'revealed' as const, adjacentMines: 0 };
    });

    expect(findFlaggableMine(cells, config)).toBe(0);
  });

  it('returns only one square even when several are simultaneously deducible', () => {
    // 2x2 board:
    // [mine at 0 (hidden), mine at 1 (hidden)]
    // [safe at 2 (revealed, adj=2), safe at 3 (revealed, adj=1)]
    // Cell 2's own count already proves both 0 and 1 are mines (its 2 hidden
    // neighbours == its adjacentMines of 2), but the function returns just the
    // first one it finds rather than flagging every deducible mine at once.
    const config: BoardConfig = { rows: 2, cols: 2, mines: 2 };
    const cells = createCells(config).map((cell) => {
      if (cell.index === 0 || cell.index === 1) return { ...cell, isMine: true };
      if (cell.index === 2) return { ...cell, state: 'revealed' as const, adjacentMines: 2 };
      return { ...cell, state: 'revealed' as const, adjacentMines: 1 };
    });

    expect(findFlaggableMine(cells, config)).toBe(0);
  });

  it('returns undefined when nothing is currently deducible', () => {
    const config: BoardConfig = { rows: 1, cols: 3, mines: 1 };
    const cells = createCells(config).map((cell) =>
      cell.index === 1 ? { ...cell, state: 'revealed' as const, adjacentMines: 1 } : cell,
    );

    // Cell 1 has two hidden neighbours (0 and 2) but adjacentMines is only 1 -
    // not yet narrowed down to a single guaranteed mine.
    expect(findFlaggableMine(cells, config)).toBeUndefined();
  });

  it('ignores a satisfied number whose neighbours are already all flagged', () => {
    const config: BoardConfig = { rows: 1, cols: 3, mines: 1 };
    const cells = createCells(config).map((cell) => {
      if (cell.index === 0) return { ...cell, isMine: true, state: 'flagged' as const };
      if (cell.index === 1) return { ...cell, state: 'revealed' as const, adjacentMines: 1 };
      return { ...cell, state: 'revealed' as const };
    });

    expect(findFlaggableMine(cells, config)).toBeUndefined();
  });
});

describe('autoFlagAll', () => {
  it('flags every currently-deducible mine in a single pass, looping to a fixed point', () => {
    // Same 2x2 board as the findFlaggableMine test above: mines at 0 and 1
    // (hidden), cell 2 revealed with adjacentMines=2 (its 2 hidden neighbours
    // 0 and 1 already prove both are mines), cell 3 revealed with
    // adjacentMines=1. findFlaggableMine alone would return just index 0;
    // autoFlagAll loops until nothing more is deducible, so it also picks up
    // index 1 once flagging 0 leaves it as the sole remaining hidden neighbour.
    const config: BoardConfig = { rows: 2, cols: 2, mines: 2 };
    const cells = createCells(config).map((cell) => {
      if (cell.index === 0 || cell.index === 1) return { ...cell, isMine: true };
      if (cell.index === 2) return { ...cell, state: 'revealed' as const, adjacentMines: 2 };
      return { ...cell, state: 'revealed' as const, adjacentMines: 1 };
    });

    const next = autoFlagAll(cells, config);

    expect(next[0]).toMatchObject({ state: 'flagged', autoFlagged: true });
    expect(next[1]).toMatchObject({ state: 'flagged', autoFlagged: true });
  });

  it('returns the input unchanged when nothing is currently deducible', () => {
    const config: BoardConfig = { rows: 1, cols: 3, mines: 1 };
    const cells = createCells(config).map((cell) =>
      cell.index === 1 ? { ...cell, state: 'revealed' as const, adjacentMines: 1 } : cell,
    );

    const next = autoFlagAll(cells, config);

    expect(next).toBe(cells); // same reference - nothing to do
  });

  it('does not touch a mine the player already flagged themselves', () => {
    const config: BoardConfig = { rows: 1, cols: 3, mines: 1 };
    const cells = createCells(config).map((cell) => {
      if (cell.index === 0) return { ...cell, isMine: true, state: 'flagged' as const };
      if (cell.index === 1) return { ...cell, state: 'revealed' as const, adjacentMines: 1 };
      return { ...cell, state: 'revealed' as const, adjacentMines: 0 };
    });

    const next = autoFlagAll(cells, config);

    expect(next[0]).toMatchObject({ state: 'flagged', autoFlagged: false }); // untouched, still a manual flag
  });
});

describe('findAvailableChord', () => {
  it('finds a revealed number whose flag count matches and still has a hidden neighbour', () => {
    // 1x3 board: mine at 0 (flagged), "1" at 1 (revealed), hidden at 2.
    const config: BoardConfig = { rows: 1, cols: 3, mines: 1 };
    const cells = createCells(config).map((cell) => {
      if (cell.index === 0) return { ...cell, isMine: true, state: 'flagged' as const };
      if (cell.index === 1) return { ...cell, state: 'revealed' as const, adjacentMines: 1 };
      return cell;
    });

    expect(findAvailableChord(cells, config)).toBe(1);
  });

  it('ignores a satisfied number with nothing left to reveal', () => {
    // Same as above, but cell 2 is already revealed too - chording cell 1 would be a no-op.
    const config: BoardConfig = { rows: 1, cols: 3, mines: 1 };
    const cells = createCells(config).map((cell) => {
      if (cell.index === 0) return { ...cell, isMine: true, state: 'flagged' as const };
      if (cell.index === 1) return { ...cell, state: 'revealed' as const, adjacentMines: 1 };
      return { ...cell, state: 'revealed' as const };
    });

    expect(findAvailableChord(cells, config)).toBeUndefined();
  });

  it('ignores a revealed number whose flag count does not yet match', () => {
    const config: BoardConfig = { rows: 1, cols: 3, mines: 1 };
    const cells = createCells(config).map((cell) =>
      cell.index === 1 ? { ...cell, state: 'revealed' as const, adjacentMines: 1 } : cell,
    );

    expect(findAvailableChord(cells, config)).toBeUndefined();
  });

  it('returns undefined on a board with no revealed numbers', () => {
    const config: BoardConfig = { rows: 2, cols: 2, mines: 1 };
    const cells = createCells(config);

    expect(findAvailableChord(cells, config)).toBeUndefined();
  });
});

describe('isChordReady', () => {
  it('is true for a revealed number whose flag count matches, even with nothing left to reveal', () => {
    // Unlike findAvailableChord, cursor readiness doesn't require progress -
    // clicking still triggers chord(), it's just a harmless no-op.
    const config: BoardConfig = { rows: 1, cols: 3, mines: 1 };
    const cells = createCells(config).map((cell) => {
      if (cell.index === 0) return { ...cell, isMine: true, state: 'flagged' as const };
      if (cell.index === 1) return { ...cell, state: 'revealed' as const, adjacentMines: 1 };
      return { ...cell, state: 'revealed' as const };
    });

    expect(isChordReady(cells, 1, config)).toBe(true);
  });

  it('is false when the flag count does not match', () => {
    const config: BoardConfig = { rows: 1, cols: 3, mines: 1 };
    const cells = createCells(config).map((cell) =>
      cell.index === 1 ? { ...cell, state: 'revealed' as const, adjacentMines: 1 } : cell,
    );

    expect(isChordReady(cells, 1, config)).toBe(false);
  });

  it('is false for a hidden or blank-revealed cell', () => {
    const config: BoardConfig = { rows: 1, cols: 3, mines: 1 };
    const cells = createCells(config);

    expect(isChordReady(cells, 0, config)).toBe(false); // hidden
    expect(isChordReady(cells, 1, config)).toBe(false); // revealed but adjacentMines 0 by default
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
