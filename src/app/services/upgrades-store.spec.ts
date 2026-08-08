import { TestBed } from '@angular/core/testing';
import { CurrencyStore } from './currency-store';
import {
  BASE_COLS,
  BASE_MAX_MINES,
  BASE_ROWS,
  BASE_TIMER_SECONDS,
  MIN_TIMER_SECONDS,
  UpgradesStore,
} from './upgrades-store';

function createStore(): UpgradesStore {
  return TestBed.inject(UpgradesStore);
}

describe('UpgradesStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('starts unupgraded at the base mine count and board size', () => {
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
    expect(store.snifferIntervalSeconds()).toBe(BASE_TIMER_SECONDS);
    expect(store.snifferSpeedCost()).toBe(20);
    expect(store.isSnifferSpeedMaxed()).toBe(false);

    expect(store.autoChordSpeedLevel()).toBe(0);
    expect(store.autoChordIntervalSeconds()).toBe(BASE_TIMER_SECONDS);
    expect(store.autoChordSpeedCost()).toBe(20);
    expect(store.isAutoChordSpeedMaxed()).toBe(false);
  });

  it('refuses to buy upgrades without enough currency', () => {
    const store = createStore();

    expect(store.canAffordMineCapacity()).toBe(false);
    expect(store.canAffordBoardRows()).toBe(false);
    expect(store.canAffordBoardCols()).toBe(false);
    expect(store.canAffordSnifferSpeed()).toBe(false);
    expect(store.canAffordAutoChordSpeed()).toBe(false);

    store.buyMineCapacity();
    store.buyBoardRows();
    store.buyBoardCols();
    store.buySnifferSpeed();
    store.buyAutoChordSpeed();

    expect(store.mineCapacityLevel()).toBe(0);
    expect(store.boardRowsLevel()).toBe(0);
    expect(store.boardColsLevel()).toBe(0);
    expect(store.snifferSpeedLevel()).toBe(0);
    expect(store.autoChordSpeedLevel()).toBe(0);
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

  it('buys sniffer and auto-chord speed levels independently, shaving a second off each timer', () => {
    const store = createStore();
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(20);

    store.buySnifferSpeed();

    expect(store.snifferSpeedLevel()).toBe(1);
    expect(store.snifferIntervalSeconds()).toBe(BASE_TIMER_SECONDS - 1);
    expect(store.autoChordSpeedLevel()).toBe(0);
    expect(store.autoChordIntervalSeconds()).toBe(BASE_TIMER_SECONDS);
    expect(currency.mines()).toBe(0);

    currency.earn(20);
    store.buyAutoChordSpeed();

    expect(store.snifferSpeedLevel()).toBe(1);
    expect(store.autoChordSpeedLevel()).toBe(1);
    expect(store.autoChordIntervalSeconds()).toBe(BASE_TIMER_SECONDS - 1);
    expect(currency.mines()).toBe(0);
  });

  it('caps speed upgrades at the timer floor and stops accepting purchases', () => {
    const store = createStore();
    const currency = TestBed.inject(CurrencyStore);
    const levelsToFloor = BASE_TIMER_SECONDS - MIN_TIMER_SECONDS;

    for (let i = 0; i < levelsToFloor; i++) {
      currency.earn(store.snifferSpeedCost());
      store.buySnifferSpeed();
    }

    expect(store.snifferIntervalSeconds()).toBe(MIN_TIMER_SECONDS);
    expect(store.isSnifferSpeedMaxed()).toBe(true);
    expect(store.canAffordSnifferSpeed()).toBe(false);

    const levelBeforeExtraPurchase = store.snifferSpeedLevel();
    currency.earn(1000);
    store.buySnifferSpeed();

    expect(store.snifferSpeedLevel()).toBe(levelBeforeExtraPurchase); // no-op past the floor
    expect(store.snifferIntervalSeconds()).toBe(MIN_TIMER_SECONDS);
    expect(currency.mines()).toBe(1000); // nothing spent
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
  });

  it('persists purchased levels independently', () => {
    const store = createStore();
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(80); // 10 + 15 + 15 + 20 + 20
    store.buyMineCapacity();
    store.buyBoardRows();
    store.buyBoardCols();
    store.buySnifferSpeed();
    store.buyAutoChordSpeed();

    expect(JSON.parse(localStorage.getItem('ms-upgrades')!)).toEqual({
      mineCapacity: 1,
      boardRows: 1,
      boardCols: 1,
      snifferSpeed: 1,
      autoChordSpeed: 1,
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
    expect(store.snifferIntervalSeconds()).toBe(BASE_TIMER_SECONDS - 1);
    expect(store.autoChordSpeedLevel()).toBe(5);
    expect(store.autoChordIntervalSeconds()).toBe(BASE_TIMER_SECONDS - 5);
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
  });
});
