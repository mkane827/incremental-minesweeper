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

  it('earns and persists mines', () => {
    const store = createStore();
    store.earn(10);

    expect(store.mines()).toBe(10);
    expect(localStorage.getItem('ms-currency')).toBe('10');
  });

  it('ignores non-positive earn amounts', () => {
    const store = createStore();
    store.earn(0);
    store.earn(-5);

    expect(store.mines()).toBe(0);
  });

  it('spends when the balance covers the cost', () => {
    const store = createStore();
    store.earn(10);

    expect(store.spend(6)).toBe(true);
    expect(store.mines()).toBe(4);
  });

  it('refuses to spend more than the balance and leaves it untouched', () => {
    const store = createStore();
    store.earn(5);

    expect(store.spend(6)).toBe(false);
    expect(store.mines()).toBe(5);
  });

  it('loads a previously persisted balance', () => {
    localStorage.setItem('ms-currency', '42');

    expect(createStore().mines()).toBe(42);
  });

  it('falls back to zero when stored balance is malformed', () => {
    localStorage.setItem('ms-currency', 'not a number');

    expect(createStore().mines()).toBe(0);
  });
});
