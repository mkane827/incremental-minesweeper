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

  it('defaults to z for reveal, x for flag, c for sniffer, and standard mouse clicks', () => {
    const store = createStore();
    expect(store.revealKey()).toBe('z');
    expect(store.flagKey()).toBe('x');
    expect(store.snifferKey()).toBe('c');
    expect(store.primaryClickAction()).toBe('reveal');
    expect(store.secondaryClickAction()).toBe('flag');
  });

  it('accepts a new reveal key and persists it', () => {
    const store = createStore();
    store.setRevealKey('R');

    expect(store.revealKey()).toBe('r');
    expect(JSON.parse(localStorage.getItem('ms-keybindings')!).revealKey).toBe('r');
  });

  it('accepts a new flag key and persists it', () => {
    const store = createStore();
    store.setFlagKey('F');

    expect(store.flagKey()).toBe('f');
  });

  it('accepts a new sniffer key and mouse click actions and persists them', () => {
    const store = createStore();
    store.setSnifferKey('V');
    store.setPrimaryClickAction('sniff');
    store.setSecondaryClickAction('reveal');

    expect(store.snifferKey()).toBe('v');
    expect(store.primaryClickAction()).toBe('sniff');
    expect(store.secondaryClickAction()).toBe('reveal');
  });

  it('rejects a reveal key that collides with flag or sniffer key', () => {
    const store = createStore();
    store.setRevealKey('x');
    expect(store.revealKey()).toBe('z');

    store.setRevealKey('c');
    expect(store.revealKey()).toBe('z');
  });

  it('rejects non-letter input', () => {
    const store = createStore();
    store.setRevealKey('1');
    store.setFlagKey('!');
    store.setSnifferKey('9');

    expect(store.revealKey()).toBe('z');
    expect(store.flagKey()).toBe('x');
    expect(store.snifferKey()).toBe('c');
  });

  it('loads previously persisted bindings on construction', () => {
    localStorage.setItem(
      'ms-keybindings',
      JSON.stringify({
        revealKey: 'q',
        flagKey: 'w',
        snifferKey: 'e',
        primaryClickAction: 'sniff',
        secondaryClickAction: 'flag',
      }),
    );

    const store = createStore();

    expect(store.revealKey()).toBe('q');
    expect(store.flagKey()).toBe('w');
    expect(store.snifferKey()).toBe('e');
    expect(store.primaryClickAction()).toBe('sniff');
  });

  it('falls back to defaults when stored bindings are malformed', () => {
    localStorage.setItem('ms-keybindings', 'not json');

    const store = createStore();

    expect(store.revealKey()).toBe('z');
    expect(store.flagKey()).toBe('x');
    expect(store.snifferKey()).toBe('c');
  });
});
