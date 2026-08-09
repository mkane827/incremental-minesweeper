import { TestBed } from '@angular/core/testing';
import { CurrencyStore } from './currency-store';
import {
  BASE_COLS,
  BASE_MAX_MINES,
  BASE_ROWS,
  BASE_TIMER_MS,
  MIN_TIMER_MS,
  timerIntervalMs,
  UpgradesStore,
} from './upgrades-store';

function createStore(): UpgradesStore {
  return TestBed.inject(UpgradesStore);
}

describe('timerIntervalMs', () => {
  it('starts at the 10s base with no levels purchased', () => {
    expect(timerIntervalMs(0)).toBe(BASE_TIMER_MS);
  });

  it('steps down by a full second per level through the first phase (10s -> 7s)', () => {
    expect(timerIntervalMs(1)).toBe(9000);
    expect(timerIntervalMs(2)).toBe(8000);
    expect(timerIntervalMs(3)).toBe(7000);
  });

  it('steps down by half a second per level through the second phase (7s -> 5s)', () => {
    expect(timerIntervalMs(4)).toBe(6500);
    expect(timerIntervalMs(5)).toBe(6000);
    expect(timerIntervalMs(6)).toBe(5500);
    expect(timerIntervalMs(7)).toBe(5000);
  });

  it('steps down by a quarter second per level through the third phase (5s -> 3s)', () => {
    expect(timerIntervalMs(8)).toBe(4750);
    expect(timerIntervalMs(11)).toBe(4000);
    expect(timerIntervalMs(15)).toBe(3000);
  });

  it('steps down by a fifth of a second per level from 3s onward, unbounded', () => {
    expect(timerIntervalMs(16)).toBe(2800);
    expect(timerIntervalMs(17)).toBe(2600);
    expect(timerIntervalMs(20)).toBe(2000);
  });

  it('never goes below the hard floor', () => {
    expect(timerIntervalMs(1000)).toBe(MIN_TIMER_MS);
  });
});

describe('UpgradesStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('starts unupgraded at the base mine count, board size, and timers', () => {
    const store = createStore();

    expect(store.mineCapacityLevel()).toBe(0);
    expect(store.maxMines()).toBe(BASE_MAX_MINES);
    expect(store.mineCapacityCost()).toBe(10);

    expect(store.boardRowsLevel()).toBe(0);
    expect(store.boardRows()).toBe(BASE_ROWS);
    expect(store.boardRowsCost()).toBe(15);

    expect(store.boardColsLevel()).toBe(0);
    expect(store.boardCols()).toBe(BASE_COLS);
    expect(store.boardColsCost()).toBe(15);

    expect(store.snifferSpeedLevel()).toBe(0);
    expect(store.snifferIntervalMs()).toBe(BASE_TIMER_MS);
    expect(store.snifferSpeedCost()).toBe(20);
    expect(store.isSnifferSpeedMaxed()).toBe(false);

    expect(store.autoChordSpeedLevel()).toBe(0);
    expect(store.autoChordIntervalMs()).toBe(BASE_TIMER_MS);
    expect(store.autoChordSpeedCost()).toBe(20);
    expect(store.isAutoChordSpeedMaxed()).toBe(false);

    expect(store.autoRestartSpeedLevel()).toBe(0);
    expect(store.autoRestartIntervalMs()).toBe(BASE_TIMER_MS);
    expect(store.autoRestartSpeedCost()).toBe(20);
    expect(store.isAutoRestartSpeedMaxed()).toBe(false);

    expect(store.autoFlagSpeedLevel()).toBe(0);
    expect(store.autoFlagIntervalMs()).toBe(BASE_TIMER_MS);
    expect(store.autoFlagSpeedCost()).toBe(20);
    expect(store.isAutoFlagSpeedMaxed()).toBe(false);
  });

  it('reports mine density as a fraction of the board and flags it at the cap', () => {
    const store = createStore();
    const currency = TestBed.inject(CurrencyStore);

    // 10 mines / 64 cells
    expect(store.mineDensity()).toBeCloseTo(10 / 64);

    for (let i = 0; i < 22; i++) {
      currency.earn(store.mineCapacityCost());
      store.buyMineCapacity();
    }

    expect(store.mineDensity()).toBeCloseTo(0.5);
  });

  it('caps mine capacity at 50% density of the current board and unblocks after growing it', () => {
    const store = createStore();
    const currency = TestBed.inject(CurrencyStore);

    // 8x8 board -> 32-mine density cap.
    expect(store.mineDensityCapMines()).toBe(32);
    expect(store.isMineCapacityMaxed()).toBe(false);

    for (let i = 0; i < 22; i++) {
      // 10 base + 22 levels = 32
      currency.earn(store.mineCapacityCost());
      store.buyMineCapacity();
    }

    expect(store.maxMines()).toBe(32);
    expect(store.isMineCapacityMaxed()).toBe(true);
    expect(store.canAffordMineCapacity()).toBe(false);

    const levelAtCap = store.mineCapacityLevel();
    currency.earn(1_000_000);
    store.buyMineCapacity();
    expect(store.mineCapacityLevel()).toBe(levelAtCap); // blocked despite having currency

    // Growing the board raises the cap and unblocks further purchases.
    currency.earn(store.boardRowsCost());
    store.buyBoardRows();
    expect(store.mineDensityCapMines()).toBe(Math.floor(9 * 8 * 0.5)); // 36
    expect(store.isMineCapacityMaxed()).toBe(false);

    store.buyMineCapacity();
    expect(store.maxMines()).toBe(33);
  });

  it('refuses to buy upgrades without enough currency', () => {
    const store = createStore();

    expect(store.canAffordMineCapacity()).toBe(false);
    expect(store.canAffordBoardRows()).toBe(false);
    expect(store.canAffordBoardCols()).toBe(false);
    expect(store.canAffordSnifferSpeed()).toBe(false);
    expect(store.canAffordAutoChordSpeed()).toBe(false);
    expect(store.canAffordAutoRestartSpeed()).toBe(false);
    expect(store.canAffordAutoFlagSpeed()).toBe(false);

    store.buyMineCapacity();
    store.buyBoardRows();
    store.buyBoardCols();
    store.buySnifferSpeed();
    store.buyAutoChordSpeed();
    store.buyAutoRestartSpeed();
    store.buyAutoFlagSpeed();

    expect(store.mineCapacityLevel()).toBe(0);
    expect(store.boardRowsLevel()).toBe(0);
    expect(store.boardColsLevel()).toBe(0);
    expect(store.snifferSpeedLevel()).toBe(0);
    expect(store.autoChordSpeedLevel()).toBe(0);
    expect(store.autoRestartSpeedLevel()).toBe(0);
    expect(store.autoFlagSpeedLevel()).toBe(0);
  });

  it('buys a mine capacity level, spending currency and raising max mines by one', () => {
    const store = createStore();
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(10);

    store.buyMineCapacity();

    expect(store.mineCapacityLevel()).toBe(1);
    expect(store.maxMines()).toBe(BASE_MAX_MINES + 1);
    expect(currency.mines()).toBe(0);
  });

  it('buys board row and col levels independently', () => {
    const store = createStore();
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(15);

    store.buyBoardRows();

    expect(store.boardRowsLevel()).toBe(1);
    expect(store.boardRows()).toBe(BASE_ROWS + 1);
    expect(store.boardColsLevel()).toBe(0);
    expect(store.boardCols()).toBe(BASE_COLS);
    expect(currency.mines()).toBe(0);

    currency.earn(15);
    store.buyBoardCols();

    expect(store.boardRowsLevel()).toBe(1);
    expect(store.boardColsLevel()).toBe(1);
    expect(store.boardCols()).toBe(BASE_COLS + 1);
    expect(currency.mines()).toBe(0);
  });

  it('buys sniffer, auto-flag, auto-chord, and auto-restart speed levels independently', () => {
    const store = createStore();
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(20);

    store.buySnifferSpeed();

    expect(store.snifferSpeedLevel()).toBe(1);
    expect(store.snifferIntervalMs()).toBe(9000);
    expect(store.autoChordSpeedLevel()).toBe(0);
    expect(store.autoRestartSpeedLevel()).toBe(0);
    expect(store.autoFlagSpeedLevel()).toBe(0);
    expect(currency.mines()).toBe(0);

    currency.earn(20);
    store.buyAutoChordSpeed();
    currency.earn(20);
    store.buyAutoRestartSpeed();
    currency.earn(20);
    store.buyAutoFlagSpeed();

    expect(store.snifferSpeedLevel()).toBe(1);
    expect(store.autoChordSpeedLevel()).toBe(1);
    expect(store.autoChordIntervalMs()).toBe(9000);
    expect(store.autoRestartSpeedLevel()).toBe(1);
    expect(store.autoRestartIntervalMs()).toBe(9000);
    expect(store.autoFlagSpeedLevel()).toBe(1);
    expect(store.autoFlagIntervalMs()).toBe(9000);
    expect(currency.mines()).toBe(0);
  });

  it('raises the cost of each upgrade independently after a purchase', () => {
    const store = createStore();
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(15);
    store.buyBoardRows();

    expect(store.boardRowsCost()).toBe(18); // round(15 * 1.2^1)
    expect(store.boardColsCost()).toBe(15); // unaffected
    expect(store.mineCapacityCost()).toBe(10); // unaffected

    currency.earn(20);
    store.buySnifferSpeed();

    expect(store.snifferSpeedCost()).toBe(25); // round(20 * 1.25^1)
    expect(store.autoChordSpeedCost()).toBe(20); // unaffected
    expect(store.autoRestartSpeedCost()).toBe(20); // unaffected
    expect(store.autoFlagSpeedCost()).toBe(20); // unaffected
  });

  it('persists purchased levels independently', () => {
    const store = createStore();
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(120); // 10 + 15 + 15 + 20 + 20 + 20 + 20
    store.buyMineCapacity();
    store.buyBoardRows();
    store.buyBoardCols();
    store.buySnifferSpeed();
    store.buyAutoChordSpeed();
    store.buyAutoRestartSpeed();
    store.buyAutoFlagSpeed();

    expect(JSON.parse(localStorage.getItem('ms-upgrades')!)).toEqual({
      mineCapacity: 1,
      boardRows: 1,
      boardCols: 1,
      snifferSpeed: 1,
      autoChordSpeed: 1,
      autoRestartSpeed: 1,
      autoFlagSpeed: 1,
    });
  });

  it('loads previously persisted levels', () => {
    localStorage.setItem(
      'ms-upgrades',
      JSON.stringify({
        mineCapacity: 4,
        boardRows: 2,
        boardCols: 3,
        snifferSpeed: 1,
        autoChordSpeed: 5,
        autoRestartSpeed: 7,
        autoFlagSpeed: 2,
      }),
    );

    const store = createStore();

    expect(store.mineCapacityLevel()).toBe(4);
    expect(store.maxMines()).toBe(BASE_MAX_MINES + 4);
    expect(store.boardRowsLevel()).toBe(2);
    expect(store.boardRows()).toBe(BASE_ROWS + 2);
    expect(store.boardColsLevel()).toBe(3);
    expect(store.boardCols()).toBe(BASE_COLS + 3);
    expect(store.snifferSpeedLevel()).toBe(1);
    expect(store.snifferIntervalMs()).toBe(9000);
    expect(store.autoChordSpeedLevel()).toBe(5);
    expect(store.autoChordIntervalMs()).toBe(timerIntervalMs(5));
    expect(store.autoRestartSpeedLevel()).toBe(7);
    expect(store.autoRestartIntervalMs()).toBe(timerIntervalMs(7));
    expect(store.autoFlagSpeedLevel()).toBe(2);
    expect(store.autoFlagIntervalMs()).toBe(timerIntervalMs(2));
  });

  it('migrates legacy boardSize saved data to equal row and column levels', () => {
    localStorage.setItem('ms-upgrades', JSON.stringify({ mineCapacity: 2, boardSize: 3 }));

    const store = createStore();

    expect(store.mineCapacityLevel()).toBe(2);
    expect(store.boardRowsLevel()).toBe(3);
    expect(store.boardColsLevel()).toBe(3);
  });

  it('falls back to zero levels when stored upgrades are malformed', () => {
    localStorage.setItem('ms-upgrades', 'not json');

    const store = createStore();

    expect(store.mineCapacityLevel()).toBe(0);
    expect(store.boardRowsLevel()).toBe(0);
    expect(store.boardColsLevel()).toBe(0);
    expect(store.snifferSpeedLevel()).toBe(0);
    expect(store.autoChordSpeedLevel()).toBe(0);
    expect(store.autoRestartSpeedLevel()).toBe(0);
    expect(store.autoFlagSpeedLevel()).toBe(0);
  });
});
