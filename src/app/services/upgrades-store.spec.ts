import { TestBed } from '@angular/core/testing';
import { CurrencyStore } from './currency-store';
import { BASE_COLS, BASE_MAX_MINES, BASE_ROWS, UpgradesStore } from './upgrades-store';

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
  });

  it('refuses to buy upgrades without enough currency', () => {
    const store = createStore();

    expect(store.canAffordMineCapacity()).toBe(false);
    expect(store.canAffordBoardRows()).toBe(false);
    expect(store.canAffordBoardCols()).toBe(false);

    store.buyMineCapacity();
    store.buyBoardRows();
    store.buyBoardCols();

    expect(store.mineCapacityLevel()).toBe(0);
    expect(store.boardRowsLevel()).toBe(0);
    expect(store.boardColsLevel()).toBe(0);
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

  it('raises the cost of each upgrade independently after a purchase', () => {
    const store = createStore();
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(15);
    store.buyBoardRows();

    expect(store.boardRowsCost()).toBe(18); // round(15 * 1.2^1)
    expect(store.boardColsCost()).toBe(15); // unaffected
    expect(store.mineCapacityCost()).toBe(10); // unaffected
  });

  it('persists purchased levels independently', () => {
    const store = createStore();
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(40);
    store.buyMineCapacity();
    store.buyBoardRows();
    store.buyBoardCols();

    expect(JSON.parse(localStorage.getItem('ms-upgrades')!)).toEqual({
      mineCapacity: 1,
      boardRows: 1,
      boardCols: 1,
    });
  });

  it('loads previously persisted levels', () => {
    localStorage.setItem(
      'ms-upgrades',
      JSON.stringify({ mineCapacity: 4, boardRows: 2, boardCols: 3 }),
    );

    const store = createStore();

    expect(store.mineCapacityLevel()).toBe(4);
    expect(store.maxMines()).toBe(BASE_MAX_MINES + 4);
    expect(store.boardRowsLevel()).toBe(2);
    expect(store.boardRows()).toBe(BASE_ROWS + 2);
    expect(store.boardColsLevel()).toBe(3);
    expect(store.boardCols()).toBe(BASE_COLS + 3);
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
  });
});
