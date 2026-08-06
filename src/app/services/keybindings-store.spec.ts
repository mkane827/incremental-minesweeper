import { TestBed } from '@angular/core/testing';
import { KeybindingsStore } from './keybindings-store';

function createStore(): KeybindingsStore {
  return TestBed.inject(KeybindingsStore);
}

describe('KeybindingsStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('defaults to z for reveal and x for flag', () => {
    const store = createStore();
    expect(store.revealKey()).toBe('z');
    expect(store.flagKey()).toBe('x');
  });

  it('accepts a new reveal key and persists it', () => {
    const store = createStore();
    store.setRevealKey('R');

    expect(store.revealKey()).toBe('r');
    expect(JSON.parse(localStorage.getItem('ms-keybindings')!)).toEqual({
      revealKey: 'r',
      flagKey: 'x',
    });
  });

  it('accepts a new flag key and persists it', () => {
    const store = createStore();
    store.setFlagKey('F');

    expect(store.flagKey()).toBe('f');
  });

  it('rejects a reveal key that collides with the current flag key', () => {
    const store = createStore();
    store.setRevealKey('x');

    expect(store.revealKey()).toBe('z');
  });

  it('rejects a flag key that collides with the current reveal key', () => {
    const store = createStore();
    store.setFlagKey('z');

    expect(store.flagKey()).toBe('x');
  });

  it('rejects non-letter input', () => {
    const store = createStore();
    store.setRevealKey('1');
    store.setFlagKey('!');

    expect(store.revealKey()).toBe('z');
    expect(store.flagKey()).toBe('x');
  });

  it('loads previously persisted bindings on construction', () => {
    localStorage.setItem('ms-keybindings', JSON.stringify({ revealKey: 'q', flagKey: 'w' }));

    const store = createStore();

    expect(store.revealKey()).toBe('q');
    expect(store.flagKey()).toBe('w');
  });

  it('falls back to defaults when stored bindings are malformed', () => {
    localStorage.setItem('ms-keybindings', 'not json');

    const store = createStore();

    expect(store.revealKey()).toBe('z');
    expect(store.flagKey()).toBe('x');
  });
});
