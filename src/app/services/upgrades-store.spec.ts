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

    expect(store.boardSizeLevel()).toBe(0);
    expect(store.boardRows()).toBe(BASE_ROWS);
    expect(store.boardCols()).toBe(BASE_COLS);
    expect(store.boardSizeCost()).toBe(25);
  });

  it('refuses to buy either upgrade without enough currency', () => {
    const store = createStore();

    expect(store.canAffordMineCapacity()).toBe(false);
    expect(store.canAffordBoardSize()).toBe(false);

    store.buyMineCapacity();
    store.buyBoardSize();

    expect(store.mineCapacityLevel()).toBe(0);
    expect(store.boardSizeLevel()).toBe(0);
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

  it('buys a board size level, spending currency and growing both dimensions by one', () => {
    const store = createStore();
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(25);

    store.buyBoardSize();

    expect(store.boardSizeLevel()).toBe(1);
    expect(store.boardRows()).toBe(BASE_ROWS + 1);
    expect(store.boardCols()).toBe(BASE_COLS + 1);
    expect(currency.mines()).toBe(0);
  });

  it('raises the cost of each upgrade independently after a purchase', () => {
    const store = createStore();
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(10);
    store.buyMineCapacity();

    expect(store.mineCapacityCost()).toBe(12); // round(10 * 1.15^1)
    expect(store.boardSizeCost()).toBe(25); // unaffected by the other track
  });

  it('persists both purchased levels independently', () => {
    const store = createStore();
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(35);
    store.buyMineCapacity();
    store.buyBoardSize();

    expect(JSON.parse(localStorage.getItem('ms-upgrades')!)).toEqual({
      mineCapacity: 1,
      boardSize: 1,
    });
  });

  it('loads previously persisted levels', () => {
    localStorage.setItem('ms-upgrades', JSON.stringify({ mineCapacity: 4, boardSize: 2 }));

    const store = createStore();

    expect(store.mineCapacityLevel()).toBe(4);
    expect(store.maxMines()).toBe(BASE_MAX_MINES + 4);
    expect(store.boardSizeLevel()).toBe(2);
    expect(store.boardRows()).toBe(BASE_ROWS + 2);
  });

  it('falls back to zero levels when stored upgrades are malformed', () => {
    localStorage.setItem('ms-upgrades', 'not json');

    const store = createStore();

    expect(store.mineCapacityLevel()).toBe(0);
    expect(store.boardSizeLevel()).toBe(0);
  });
});
