import { TestBed } from '@angular/core/testing';
import { DEFAULT_CELL_SIZE, DisplayStore } from './display-store';

function createStore(): DisplayStore {
  return TestBed.inject(DisplayStore);
}

describe('DisplayStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('defaults to the medium cell size', () => {
    expect(createStore().cellSize()).toBe(DEFAULT_CELL_SIZE);
  });

  it('accepts a valid cell size and persists it', () => {
    const store = createStore();
    store.setCellSize(58);

    expect(store.cellSize()).toBe(58);
    expect(localStorage.getItem('ms-display')).toBe('58');
  });

  it('ignores a cell size outside the known options', () => {
    const store = createStore();
    store.setCellSize(1000);

    expect(store.cellSize()).toBe(DEFAULT_CELL_SIZE);
  });

  it('loads a previously persisted cell size', () => {
    localStorage.setItem('ms-display', '46');

    expect(createStore().cellSize()).toBe(46);
  });

  it('falls back to the default when the stored value is not a known option', () => {
    localStorage.setItem('ms-display', 'not a number');

    expect(createStore().cellSize()).toBe(DEFAULT_CELL_SIZE);
  });
});
