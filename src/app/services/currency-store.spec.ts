import { TestBed } from '@angular/core/testing';
import { CurrencyStore } from './currency-store';

function createStore(): CurrencyStore {
  return TestBed.inject(CurrencyStore);
}

describe('CurrencyStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('starts at zero', () => {
    expect(createStore().mines()).toBe(0);
  });

  it('earns and persists mines, tracking lifetime earnings too', () => {
    const store = createStore();
    store.earn(10);

    expect(store.mines()).toBe(10);
    expect(store.lifetimeMines()).toBe(10);
    expect(JSON.parse(localStorage.getItem('ms-currency')!)).toEqual({
      mines: 10,
      lifetimeMines: 10,
    });
  });

  it('ignores non-positive earn amounts', () => {
    const store = createStore();
    store.earn(0);
    store.earn(-5);

    expect(store.mines()).toBe(0);
  });

  it('spends when the balance covers the cost, without touching lifetime earnings', () => {
    const store = createStore();
    store.earn(10);

    expect(store.spend(6)).toBe(true);
    expect(store.mines()).toBe(4);
    expect(store.lifetimeMines()).toBe(10);
  });

  it('resets the spendable balance for a prestige, keeping lifetime earnings intact', () => {
    const store = createStore();
    store.earn(10);

    store.resetSpendable();

    expect(store.mines()).toBe(0);
    expect(store.lifetimeMines()).toBe(10);

    store.earn(5);
    expect(store.mines()).toBe(5);
    expect(store.lifetimeMines()).toBe(15);
  });

  it('refuses to spend more than the balance and leaves it untouched', () => {
    const store = createStore();
    store.earn(5);

    expect(store.spend(6)).toBe(false);
    expect(store.mines()).toBe(5);
  });

  it('loads a previously persisted balance in the current object format', () => {
    localStorage.setItem('ms-currency', JSON.stringify({ mines: 42, lifetimeMines: 100 }));

    const store = createStore();
    expect(store.mines()).toBe(42);
    expect(store.lifetimeMines()).toBe(100);
  });

  it('loads a legacy bare-number balance, treating it as lifetime earnings too', () => {
    localStorage.setItem('ms-currency', '42');

    const store = createStore();
    expect(store.mines()).toBe(42);
    expect(store.lifetimeMines()).toBe(42);
  });

  it('falls back to zero when stored balance is malformed', () => {
    localStorage.setItem('ms-currency', 'not a number');

    const store = createStore();
    expect(store.mines()).toBe(0);
    expect(store.lifetimeMines()).toBe(0);
  });
});
