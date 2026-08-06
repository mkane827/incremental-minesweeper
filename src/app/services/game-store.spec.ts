import { TestBed } from '@angular/core/testing';
import { CurrencyStore } from './currency-store';
import { GameStore } from './game-store';

function createStore(): GameStore {
  return TestBed.inject(GameStore);
}

describe('GameStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    // Fisher-Yates with random() always 0 never swaps, so candidates keep their
    // natural ascending order and mine placement becomes fully deterministic.
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('starts idle with a fresh, fully hidden board', () => {
    const store = createStore();

    expect(store.status()).toBe('idle');
    expect(store.cells()).toHaveLength(64); // 8x8 base board
    expect(store.cells().every((cell) => cell.state === 'hidden')).toBe(true);
  });

  it('uses the current upgrade levels for new boards', () => {
    localStorage.setItem('ms-upgrades', JSON.stringify({ mineCapacity: 3, boardSize: 2 }));
    const store = createStore();

    // 10 base mines + 3 levels, 8x8 base board + 2 levels
    expect(store.config()).toEqual({ rows: 10, cols: 10, mines: 13 });
    store.newGame();
    expect(store.config()).toEqual({ rows: 10, cols: 10, mines: 13 });
  });

  it('newGame resets to a chosen board size', () => {
    const store = createStore();
    store.newGame({ rows: 3, cols: 3, mines: 1 });

    expect(store.config()).toEqual({ rows: 3, cols: 3, mines: 1 });
    expect(store.cells()).toHaveLength(9);
    expect(store.status()).toBe('idle');
    expect(store.elapsedSeconds()).toBe(0);
  });

  it('places mines and starts the game on the first reveal', () => {
    const store = createStore();
    store.newGame({ rows: 3, cols: 3, mines: 1 });

    store.reveal(4); // centre cell; mine is forced to index 0 (see mock above)

    expect(store.status()).toBe('playing');
    expect(store.cells()[4].state).toBe('revealed');
    expect(store.cells()[0].isMine).toBe(true);
  });

  it('ends the game as lost when the revealed cell is a mine', () => {
    const store = createStore();
    // A 1x2 board would auto-win on the safe first click (only one non-mine
    // cell exists), so use a third cell to keep the game open until the mine
    // is clicked on purpose.
    store.newGame({ rows: 1, cols: 3, mines: 1 });

    store.reveal(0); // safe, forces the mine onto index 1, index 2 stays hidden
    store.reveal(1);

    expect(store.status()).toBe('lost');
    expect(store.cells()[1]).toMatchObject({ state: 'revealed', exploded: true });
  });

  it('ignores further reveals once the game is over', () => {
    const store = createStore();
    store.newGame({ rows: 1, cols: 3, mines: 1 });
    store.reveal(0);
    store.reveal(1); // loses

    const before = store.cells();
    store.reveal(2);

    expect(store.cells()).toBe(before);
  });

  it('toggles a hidden cell between hidden and flagged, updating minesRemaining', () => {
    const store = createStore();
    store.newGame({ rows: 2, cols: 2, mines: 1 });

    store.toggleFlag(0);
    expect(store.cells()[0].state).toBe('flagged');
    expect(store.minesRemaining()).toBe(0);

    store.toggleFlag(0);
    expect(store.cells()[0].state).toBe('hidden');
    expect(store.minesRemaining()).toBe(1);
  });

  it('does not flag an already-revealed cell', () => {
    const store = createStore();
    store.newGame({ rows: 1, cols: 3, mines: 1 });
    store.reveal(0); // safe, mine forced onto index 1

    store.toggleFlag(0);

    expect(store.cells()[0].state).toBe('revealed');
  });

  it('does not flag anything once the game is over', () => {
    const store = createStore();
    store.newGame({ rows: 1, cols: 3, mines: 1 });
    store.reveal(0);
    store.reveal(1); // loses

    store.toggleFlag(2);

    expect(store.cells()[2].state).not.toBe('flagged');
  });

  it('chord does nothing until the flagged count matches the adjacent mine count', () => {
    const store = createStore();
    store.newGame({ rows: 3, cols: 3, mines: 1 });
    store.reveal(4); // mine forced onto index 0, cell 4 shows "1"

    store.chord(4);

    expect(store.cells()[1].state).toBe('hidden');
    expect(store.status()).toBe('playing');
  });

  it('chord reveals the remaining neighbours and can win the game', () => {
    const store = createStore();
    store.newGame({ rows: 3, cols: 3, mines: 1 });
    store.reveal(4); // mine forced onto index 0
    store.toggleFlag(0);

    store.chord(4);

    expect(store.status()).toBe('won');
    expect(store.cells().every((cell) => cell.isMine || cell.state === 'revealed')).toBe(true);
  });

  it('chord detonates a mine hidden behind an unrelated flag', () => {
    const store = createStore();
    store.newGame({ rows: 3, cols: 3, mines: 1 });
    store.reveal(4); // mine forced onto index 0
    store.toggleFlag(1); // wrong flag; the real mine at 0 is still hidden

    store.chord(4);

    expect(store.status()).toBe('lost');
    expect(store.cells()[0]).toMatchObject({ state: 'revealed', exploded: true });
    expect(store.cells()[1]).toMatchObject({ state: 'flagged', wrongFlag: true });
  });

  it('auto-flags any mine left unflagged once the board is cleared', () => {
    const store = createStore();
    store.newGame({ rows: 1, cols: 3, mines: 1 });

    store.reveal(0); // safe, mine forced onto index 1
    store.reveal(2); // clears every remaining non-mine cell

    expect(store.status()).toBe('won');
    expect(store.cells()[1].state).toBe('flagged');
  });

  it('awards currency equal to the board\'s mine count on a win', () => {
    const store = createStore();
    const currency = TestBed.inject(CurrencyStore);
    store.newGame({ rows: 1, cols: 3, mines: 1 });

    store.reveal(0); // safe, mine forced onto index 1
    store.reveal(2); // clears the board

    expect(store.status()).toBe('won');
    expect(currency.mines()).toBe(1);
  });

  it('awards no currency on a loss', () => {
    const store = createStore();
    const currency = TestBed.inject(CurrencyStore);
    store.newGame({ rows: 1, cols: 3, mines: 1 });

    store.reveal(0);
    store.reveal(1); // loses

    expect(store.status()).toBe('lost');
    expect(currency.mines()).toBe(0);
  });

  it('counts elapsed seconds while playing and stops once the game ends', () => {
    vi.useFakeTimers();
    const store = createStore();
    store.newGame({ rows: 1, cols: 3, mines: 1 });

    store.reveal(0); // safe, mine forced onto index 1, index 2 stays hidden
    vi.advanceTimersByTime(3000);
    expect(store.elapsedSeconds()).toBe(3);

    store.reveal(1); // loses, timer should stop
    vi.advanceTimersByTime(3000);
    expect(store.elapsedSeconds()).toBe(3);
  });
});
