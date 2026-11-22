import { TestBed } from '@angular/core/testing';
import { CurrencyStore } from './currency-store';
import { prestigePointsForLifetimeMines, PrestigeStore } from './prestige-store';

function createStore(): PrestigeStore {
  return TestBed.inject(PrestigeStore);
}

describe('prestigePointsForLifetimeMines', () => {
  it('is zero below the first threshold', () => {
    expect(prestigePointsForLifetimeMines(0)).toBe(0);
    expect(prestigePointsForLifetimeMines(799)).toBe(0);
  });

  it('reaches 1 point at 800 lifetime mines', () => {
    expect(prestigePointsForLifetimeMines(800)).toBe(1);
  });

  it('scales down as a square root, needing more mines per additional point', () => {
    expect(prestigePointsForLifetimeMines(3200)).toBe(2);
    expect(prestigePointsForLifetimeMines(7200)).toBe(3);
  });
});

describe('PrestigeStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('starts at zero points with nothing permanently unlocked', () => {
    const store = createStore();

    expect(store.points()).toBe(0);
    expect(store.permanentSnifferUnlocked()).toBe(false);
    expect(store.permanentAutoFlagUnlocked()).toBe(false);
    expect(store.permanentAutoChordUnlocked()).toBe(false);
    expect(store.permanentAutoRestartUnlocked()).toBe(false);
    expect(store.permanentAutoSnifferUnlocked()).toBe(false);
    expect(store.canPrestige()).toBe(false);
  });

  it('reports available gain based on lifetime mines and claims it exactly once', () => {
    const store = createStore();
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(2000);

    expect(store.availableGain()).toBe(1);
    expect(store.canPrestige()).toBe(true);

    expect(store.claimAvailableGain()).toBe(1);
    expect(store.points()).toBe(1);
    expect(store.availableGain()).toBe(0);
    expect(store.canPrestige()).toBe(false);

    // Claiming again with no new lifetime mines earned grants nothing.
    expect(store.claimAvailableGain()).toBe(0);
    expect(store.points()).toBe(1);
  });

  it('grants further points once more lifetime mines are earned', () => {
    const store = createStore();
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(800); // 1 point
    store.claimAvailableGain();

    currency.earn(2400); // lifetime now 3200 -> 2 total points, 1 already claimed
    expect(store.availableGain()).toBe(1);
    expect(store.claimAvailableGain()).toBe(1);
    expect(store.points()).toBe(2);
  });

  it('buys a permanent unlock, spending points exactly once', () => {
    const store = createStore();
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(2000);
    store.claimAvailableGain(); // 1 point

    expect(store.canAffordPermanentSniffer()).toBe(true);
    store.buyPermanentSniffer();

    expect(store.permanentSnifferUnlocked()).toBe(true);
    expect(store.points()).toBe(0);

    // No-op: already owned.
    store.buyPermanentSniffer();
    expect(store.points()).toBe(0);
  });

  it('refuses to buy permanent unlocks without enough points', () => {
    const store = createStore();

    store.buyPermanentSniffer();
    store.buyPermanentAutoFlag();
    store.buyPermanentAutoChord();
    store.buyPermanentAutoRestart();

    expect(store.permanentSnifferUnlocked()).toBe(false);
    expect(store.permanentAutoFlagUnlocked()).toBe(false);
    expect(store.permanentAutoChordUnlocked()).toBe(false);
    expect(store.permanentAutoRestartUnlocked()).toBe(false);
  });

  it('blocks the permanent autosniffer until the permanent sniffer is owned', () => {
    const store = createStore();
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(20000); // sqrt(25) = 5 points
    store.claimAvailableGain();
    expect(store.points()).toBe(5);

    expect(store.canAffordPermanentAutoSniffer()).toBe(false);
    store.buyPermanentAutoSniffer();
    expect(store.permanentAutoSnifferUnlocked()).toBe(false);
    expect(store.points()).toBe(5); // nothing spent, sniffer not owned yet

    store.buyPermanentSniffer(); // costs 1
    expect(store.points()).toBe(4);

    expect(store.canAffordPermanentAutoSniffer()).toBe(true); // costs 3, have 4
    store.buyPermanentAutoSniffer();
    expect(store.permanentAutoSnifferUnlocked()).toBe(true);
    expect(store.points()).toBe(1);
  });

  it('persists points and permanent unlocks', () => {
    const store = createStore();
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(20000); // 5 points
    store.claimAvailableGain();
    store.buyPermanentSniffer(); // -1
    store.buyPermanentAutoFlag(); // -2

    const saved = JSON.parse(localStorage.getItem('ms-prestige')!);
    expect(saved.points).toBe(2);
    expect(saved.lifetimePointsClaimed).toBe(5);
    expect(saved.permanentSnifferUnlocked).toBe(true);
    expect(saved.permanentAutoFlagUnlocked).toBe(true);
    expect(saved.permanentAutoChordUnlocked).toBe(false);
  });

  it('loads previously persisted points and unlocks', () => {
    localStorage.setItem(
      'ms-prestige',
      JSON.stringify({
        points: 4,
        lifetimePointsClaimed: 7,
        permanentSnifferUnlocked: true,
        permanentAutoFlagUnlocked: false,
        permanentAutoChordUnlocked: true,
        permanentAutoRestartUnlocked: false,
        permanentAutoSnifferUnlocked: true,
      }),
    );

    const store = createStore();

    expect(store.points()).toBe(4);
    expect(store.permanentSnifferUnlocked()).toBe(true);
    expect(store.permanentAutoFlagUnlocked()).toBe(false);
    expect(store.permanentAutoChordUnlocked()).toBe(true);
    expect(store.permanentAutoSnifferUnlocked()).toBe(true);
  });

  it('never loads permanentAutoSnifferUnlocked as true unless the permanent sniffer is also unlocked', () => {
    localStorage.setItem(
      'ms-prestige',
      JSON.stringify({
        points: 0,
        lifetimePointsClaimed: 0,
        permanentSnifferUnlocked: false,
        permanentAutoSnifferUnlocked: true,
      }),
    );

    const store = createStore();

    expect(store.permanentAutoSnifferUnlocked()).toBe(false);
  });

  it('falls back to zero and nothing unlocked when stored data is malformed', () => {
    localStorage.setItem('ms-prestige', 'not json');

    const store = createStore();

    expect(store.points()).toBe(0);
    expect(store.permanentSnifferUnlocked()).toBe(false);
  });
});
