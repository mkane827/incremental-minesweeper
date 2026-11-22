import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CurrencyStore } from './currency-store';
import { GameStore } from './game-store';
import { PrestigeStore } from './prestige-store';
import { UpgradesStore } from './upgrades-store';

function createStore(): GameStore {
  return TestBed.inject(GameStore);
}

describe('GameStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    // Fisher-Yates with random() always 0 never swaps, so candidates keep their
    // natural ascending order and mine placement becomes fully deterministic.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    // Timers now run continuously from the moment GameStore is constructed
    // (not just once "playing" starts), so every test needs fake timers to
    // avoid a real 50ms background interval ticking during the test run.
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('starts idle with a fresh, fully hidden board', () => {
    const store = createStore();

    expect(store.status()).toBe('idle');
    expect(store.cells()).toHaveLength(64); // 8x8 base board
    expect(store.cells().every((cell) => cell.state === 'hidden')).toBe(true);
  });

  it('uses the current upgrade levels for new boards', () => {
    localStorage.setItem('ms-upgrades', JSON.stringify({ mineCapacity: 3, boardSize: 2 }));
    const store = createStore();

    // 10 base mines + 3 levels, 8x8 base board + 2 levels
    expect(store.config()).toEqual({ rows: 10, cols: 10, mines: 13 });
    store.newGame();
    expect(store.config()).toEqual({ rows: 10, cols: 10, mines: 13 });
  });

  it('uses the current speed upgrade levels for the sniffer and auto-chord countdowns', () => {
    localStorage.setItem(
      'ms-upgrades',
      JSON.stringify({ mineCapacity: 0, snifferSpeed: 4, autoChordSpeed: 2 }),
    );
    const store = createStore();

    // level 4 -> 6500ms -> ceil 7s; level 2 -> 8000ms -> ceil 8s
    expect(store.secondsUntilSniff()).toBe(7);
    expect(store.secondsUntilAutoChord()).toBe(8);
  });

  it('immediately applies an upgrade bought while idle', () => {
    const store = createStore();
    const appRef = TestBed.inject(ApplicationRef);
    // Every effect fires once automatically right after creation, independent
    // of any real change; let that settle first, same as real app startup,
    // before making a genuine purchase.
    appRef.tick();

    const upgrades = TestBed.inject(UpgradesStore);
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(15);

    expect(store.config().rows).toBe(8);

    upgrades.buyBoardRows();
    appRef.tick(); // flush the reactive apply-while-idle effect

    expect(store.status()).toBe('idle');
    expect(store.config().rows).toBe(9);
    expect(store.cells()).toHaveLength(9 * 8);
  });

  it('does not retroactively change an in-progress board when an upgrade is bought', () => {
    const store = createStore();
    const appRef = TestBed.inject(ApplicationRef);
    appRef.tick();

    const upgrades = TestBed.inject(UpgradesStore);
    const currency = TestBed.inject(CurrencyStore);
    store.newGame({ rows: 3, cols: 3, mines: 1 });
    store.reveal(4); // starts playing

    currency.earn(15);
    upgrades.buyBoardRows();
    appRef.tick();

    expect(store.status()).toBe('playing');
    expect(store.config()).toEqual({ rows: 3, cols: 3, mines: 1 });
  });

  it('newGame resets to a chosen board size', () => {
    const store = createStore();
    store.newGame({ rows: 3, cols: 3, mines: 1 });

    expect(store.config()).toEqual({ rows: 3, cols: 3, mines: 1 });
    expect(store.cells()).toHaveLength(9);
    expect(store.status()).toBe('idle');
    expect(store.elapsedSeconds()).toBe(0);
  });

  it('places mines and starts the game on the first reveal', () => {
    const store = createStore();
    store.newGame({ rows: 3, cols: 3, mines: 1 });

    store.reveal(4); // centre cell; mine is forced to index 0 (see mock above)

    expect(store.status()).toBe('playing');
    expect(store.cells()[4].state).toBe('revealed');
    expect(store.cells()[0].isMine).toBe(true);
  });

  it('ends the game as lost when the revealed cell is a mine', () => {
    const store = createStore();
    store.newGame({ rows: 2, cols: 2, mines: 1 });

    store.reveal(3); // safe, mine is forced onto index 0; cells 0, 1, 2 stay hidden
    store.reveal(0); // mine

    expect(store.status()).toBe('lost');
    expect(store.cells()[0]).toMatchObject({ state: 'revealed', exploded: true });
  });

  it('ignores further reveals once the game is over', () => {
    const store = createStore();
    store.newGame({ rows: 2, cols: 2, mines: 1 });
    store.reveal(3);
    store.reveal(0); // loses

    const before = store.cells();
    store.reveal(1);

    expect(store.cells()).toBe(before);
  });

  it('toggles a hidden cell between hidden and flagged, updating minesRemaining', () => {
    const store = createStore();
    store.newGame({ rows: 2, cols: 2, mines: 1 });

    store.toggleFlag(0);
    expect(store.cells()[0].state).toBe('flagged');
    expect(store.minesRemaining()).toBe(0);

    store.toggleFlag(0);
    expect(store.cells()[0].state).toBe('hidden');
    expect(store.minesRemaining()).toBe(1);
  });

  it('does not flag an already-revealed cell', () => {
    const store = createStore();
    store.newGame({ rows: 1, cols: 3, mines: 1 });
    store.reveal(0); // safe, mine forced onto index 1

    store.toggleFlag(0);

    expect(store.cells()[0].state).toBe('revealed');
  });

  it('does not flag anything once the game is over', () => {
    const store = createStore();
    store.newGame({ rows: 2, cols: 2, mines: 1 });
    store.reveal(3);
    store.reveal(0); // loses

    store.toggleFlag(1);

    expect(store.cells()[1].state).not.toBe('flagged');
  });

  it('chord does nothing until the flagged count matches the adjacent mine count', () => {
    const store = createStore();
    store.newGame({ rows: 3, cols: 3, mines: 1 });
    store.reveal(4); // mine forced onto index 0, cell 4 shows "1"

    store.chord(4);

    expect(store.cells()[1].state).toBe('hidden');
    expect(store.status()).toBe('playing');
  });

  it('chord reveals the remaining neighbours and can win the game', () => {
    const store = createStore();
    store.newGame({ rows: 3, cols: 3, mines: 1 });
    store.reveal(4); // mine forced onto index 0
    store.toggleFlag(0);

    store.chord(4);

    expect(store.status()).toBe('won');
    expect(store.cells().every((cell) => cell.isMine || cell.state === 'revealed')).toBe(true);
  });

  it('chord detonates a mine hidden behind an unrelated flag', () => {
    const store = createStore();
    store.newGame({ rows: 3, cols: 3, mines: 1 });
    store.reveal(4); // mine forced onto index 0
    store.toggleFlag(1); // wrong flag; the real mine at 0 is still hidden

    store.chord(4);

    expect(store.status()).toBe('lost');
    expect(store.cells()[0]).toMatchObject({ state: 'revealed', exploded: true });
    expect(store.cells()[1]).toMatchObject({ state: 'flagged', wrongFlag: true });
  });

  it('auto-flags any mine left unflagged once the board is cleared', () => {
    const store = createStore();
    store.newGame({ rows: 1, cols: 3, mines: 1 });

    store.reveal(0); // safe, mine forced onto index 1
    store.reveal(2); // clears every remaining non-mine cell

    expect(store.status()).toBe('won');
    expect(store.cells()[1].state).toBe('flagged');
  });

  it('does not auto-flag a logically-deducible mine while the mechanic is still locked', () => {
    const store = createStore();
    // 1x6 board so cells 2-5 stay hidden and unrelated to the deduction below -
    // otherwise clearing the board would trigger the separate win-time
    // flagRemainingMines and mask what this test is actually checking.
    store.newGame({ rows: 1, cols: 6, mines: 1 });

    store.reveal(0); // mine forced onto index 1; cell 0's only neighbour is already narrowed to it

    // Cell 0 is now logically satisfied (its one hidden neighbour must be the
    // mine), but auto-flag hasn't been unlocked, so nothing happens.
    expect(store.status()).toBe('playing'); // not won - cells 2-5 are still hidden
    expect(store.cells()[1].state).toBe('hidden');
  });

  it('flags a logically-deducible mine immediately, the instant it becomes provable', () => {
    const upgrades = TestBed.inject(UpgradesStore);
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(150);
    upgrades.buyAutoFlagUnlock();

    const store = createStore();
    store.newGame({ rows: 1, cols: 6, mines: 1 });

    store.reveal(0); // mine forced onto index 1; cell 0 is already logically satisfied

    expect(store.cells()[1].state).toBe('flagged');
    expect(store.cells()[1].autoFlagged).toBe(true);
    expect(store.status()).toBe('playing'); // still not won - cells 2-5 remain hidden
  });

  it('does not let the player remove a flag auto-flag placed', () => {
    const upgrades = TestBed.inject(UpgradesStore);
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(150);
    upgrades.buyAutoFlagUnlock();

    const store = createStore();
    store.newGame({ rows: 1, cols: 6, mines: 1 });
    store.reveal(0); // mine forced onto index 1; auto-flag places the flag immediately

    expect(store.cells()[1].state).toBe('flagged');
    expect(store.cells()[1].autoFlagged).toBe(true);

    store.toggleFlag(1); // misclick attempt - should be a no-op

    expect(store.cells()[1].state).toBe('flagged');
    expect(store.cells()[1].autoFlagged).toBe(true);
  });

  it('lets the player remove their own manually-placed flag normally', () => {
    const store = createStore();
    store.newGame({ rows: 2, cols: 2, mines: 1 });

    store.toggleFlag(0);
    expect(store.cells()[0].state).toBe('flagged');
    expect(store.cells()[0].autoFlagged).toBe(false);

    store.toggleFlag(0);
    expect(store.cells()[0].state).toBe('hidden');
  });

  it('flags every currently-deducible mine at once, in a single cascading pass', () => {
    const upgrades = TestBed.inject(UpgradesStore);
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(150);
    upgrades.buyAutoFlagUnlock();

    const store = createStore();
    // 2x4 board: [0 1 2 3] / [4 5 6 7]. Mines forced onto 0 and 1 (see mock
    // above). Revealing 5 then 4 leaves cell 4 showing "2" with exactly 0 and
    // 1 as its still-hidden neighbours - a single already-satisfied clue that
    // logically proves both mines at once, without clearing the whole board
    // (cells 2, 3, 6, 7 stay hidden, so no win-time flagRemainingMines fires).
    store.newGame({ rows: 2, cols: 4, mines: 2 });
    store.reveal(5);
    store.reveal(4);

    // Both mines flagged in the very same reveal - no waiting for a second
    // move to pick up the one that only became provable once the first was
    // flagged (flagging cell 0 completes cell 4's remaining deduction).
    expect(store.cells()[0].state).toBe('flagged');
    expect(store.cells()[0].autoFlagged).toBe(true);
    expect(store.cells()[1].state).toBe('flagged');
    expect(store.cells()[1].autoFlagged).toBe(true);
  });

  it('does nothing while switched off, then catches up immediately once switched back on', () => {
    const upgrades = TestBed.inject(UpgradesStore);
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(150);
    upgrades.buyAutoFlagUnlock();
    upgrades.setAutoFlagEnabled(false);

    const store = createStore();
    store.newGame({ rows: 1, cols: 6, mines: 1 });
    store.reveal(0); // mine forced onto index 1; cell 0 is already logically satisfied

    expect(store.cells()[1].state).toBe('hidden'); // switched off - no auto-flag

    upgrades.setAutoFlagEnabled(true);
    TestBed.inject(ApplicationRef).tick(); // flush the reactive "just turned on" effect

    expect(store.cells()[1].state).toBe('flagged'); // caught up the instant it was switched back on
    expect(store.cells()[1].autoFlagged).toBe(true);
  });

  it('retroactively flags an already-deducible mine the moment the unlock is bought', () => {
    const currency = TestBed.inject(CurrencyStore);
    const store = createStore();
    store.newGame({ rows: 1, cols: 6, mines: 1 });
    store.reveal(0); // mine forced onto index 1; already logically satisfied, but locked

    expect(store.cells()[1].state).toBe('hidden');

    const upgrades = TestBed.inject(UpgradesStore);
    currency.earn(150);
    upgrades.buyAutoFlagUnlock();
    TestBed.inject(ApplicationRef).tick(); // flush the reactive "just unlocked" effect

    expect(store.cells()[1].state).toBe('flagged'); // caught up on purchase, no extra move needed
  });

  it('stays completely inert while sniffer, auto-flag, auto-chord, and auto-restart are all locked', () => {
    const store = createStore();
    store.newGame({ rows: 3, cols: 3, mines: 1 });

    vi.advanceTimersByTime(20000); // well past every default 10s interval

    expect(store.status()).toBe('idle'); // no autosniffer move - sniffer is locked
    expect(store.cells().every((cell) => cell.state === 'hidden')).toBe(true);
  });

  it("awards currency equal to the board's mine count on a win", () => {
    const store = createStore();
    const currency = TestBed.inject(CurrencyStore);
    store.newGame({ rows: 1, cols: 3, mines: 1 });

    store.reveal(0); // safe, mine forced onto index 1
    store.reveal(2); // clears the board

    expect(store.status()).toBe('won');
    expect(currency.mines()).toBe(1);
  });

  it('awards no currency on a loss', () => {
    const store = createStore();
    const currency = TestBed.inject(CurrencyStore);
    store.newGame({ rows: 2, cols: 2, mines: 1 });

    store.reveal(3);
    store.reveal(0); // loses

    expect(store.status()).toBe('lost');
    expect(currency.mines()).toBe(0);
  });

  it('counts elapsed seconds while playing and stops once the game ends', () => {
    const store = createStore();
    store.newGame({ rows: 2, cols: 2, mines: 1 });

    store.reveal(3); // safe, mine forced onto index 0; index 1 & 2 stay hidden
    vi.advanceTimersByTime(3000);
    expect(store.elapsedSeconds()).toBe(3);

    store.reveal(0); // loses, timer should stop
    vi.advanceTimersByTime(3000);
    expect(store.elapsedSeconds()).toBe(3);
  });

  it('toggles sniffer on a hidden cell', () => {
    const upgrades = TestBed.inject(UpgradesStore);
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(100);
    upgrades.buySnifferUnlock();

    const store = createStore();
    store.newGame({ rows: 2, cols: 2, mines: 1 });

    store.toggleSniffer(0);
    expect(store.cells()[0].hasSniffer).toBe(true);

    store.toggleSniffer(0);
    expect(store.cells()[0].hasSniffer).toBe(false);
  });

  it('resolves a sniffer every 10 seconds while playing', () => {
    const upgrades = TestBed.inject(UpgradesStore);
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(100);
    upgrades.buySnifferUnlock();

    const store = createStore();
    store.newGame({ rows: 2, cols: 2, mines: 1 });

    store.reveal(3); // mine placed at index 0
    store.toggleSniffer(0); // sniffer placed on mine cell 0

    expect(store.cells()[0].state).toBe('hidden');
    expect(store.cells()[0].hasSniffer).toBe(true);

    vi.advanceTimersByTime(10000); // 10 seconds tick

    expect(store.cells()[0].state).toBe('flagged'); // Safely flagged!
    expect(store.cells()[0].hasSniffer).toBe(false);
    expect(store.secondsUntilSniff()).toBe(10);
  });

  it('auto-sniffs a random hidden square when the timer hits zero with no sniffer marked', () => {
    const upgrades = TestBed.inject(UpgradesStore);
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(400);
    upgrades.buySnifferUnlock();
    upgrades.buyAutoSnifferUnlock();

    const store = createStore();
    store.newGame({ rows: 2, cols: 2, mines: 1 });

    store.reveal(3); // starts playing, mine at 0; cells 0, 1, 2 stay hidden
    expect(store.secondsUntilSniff()).toBe(10);

    vi.advanceTimersByTime(10000); // 10 seconds tick with no sniffer marked

    // Autosniffer picks a random hidden cell (index 0, the mine, since
    // Math.random is mocked to 0) - safely flagged, never revealed as a mine.
    expect(store.cells()[0].state).toBe('flagged');
    expect(store.secondsUntilSniff()).toBe(10); // resolved, timer resets instead of freezing
  });

  it('immediately resolves a sniffer placed while the countdown is genuinely frozen at 0', () => {
    const upgrades = TestBed.inject(UpgradesStore);
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(100);
    upgrades.buySnifferUnlock();

    const store = createStore();
    store.newGame({ rows: 2, cols: 2, mines: 1 });

    store.reveal(3); // starts playing, mine at 0; cells 0, 1, 2 stay hidden

    // Flag every remaining square so the autosniffer has no hidden cell to
    // pick - the only way the countdown can genuinely stay frozen at 0.
    store.toggleFlag(0);
    store.toggleFlag(1);
    store.toggleFlag(2);

    vi.advanceTimersByTime(10000);
    expect(store.secondsUntilSniff()).toBe(0); // frozen: nothing hidden to auto-sniff

    // Unflag cell 2 and place a sniffer on it while the countdown sits at 0.
    store.toggleFlag(2);
    store.toggleSniffer(2);

    // Immediately resolved (cell 2 is safe -> revealed) & timer resets to 10.
    expect(store.cells()[2].state).toBe('revealed');
    expect(store.secondsUntilSniff()).toBe(10);
  });

  it('automatically chords an available square after 10 seconds', () => {
    const upgrades = TestBed.inject(UpgradesStore);
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(250);
    upgrades.buyAutoChordUnlock();

    const store = createStore();
    store.newGame({ rows: 3, cols: 3, mines: 1 });

    store.reveal(4); // mine forced onto index 0; cell 4 shows "1"
    store.toggleFlag(0); // flag the mine - a chord at cell 4 is now available

    vi.advanceTimersByTime(10000);

    expect(store.status()).toBe('won');
    expect(store.secondsUntilAutoChord()).toBe(10);
  });

  it('waits at 0 for a chord to become available, then resolves it on the next tick', () => {
    const upgrades = TestBed.inject(UpgradesStore);
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(650);
    upgrades.buySnifferUnlock();
    upgrades.buyAutoSnifferUnlock();
    upgrades.buyAutoChordUnlock();

    const store = createStore();
    // Two mines so the autosniffer flagging the first one (at the 10s mark,
    // alongside the auto-chord tick) doesn't by itself complete the chord.
    store.newGame({ rows: 3, cols: 3, mines: 2 });

    store.reveal(4); // mines forced onto indexes 0 & 1; cell 4 shows "2"

    vi.advanceTimersByTime(10000);
    // The autosniffer has nothing marked, so it auto-flags a random hidden
    // cell - deterministically index 0 (the first mine) - leaving cell 4's
    // flag count at 1, still short of its "2", so no chord is available yet.
    expect(store.cells()[0].state).toBe('flagged');
    expect(store.secondsUntilAutoChord()).toBe(0); // armed, waiting
    expect(store.status()).toBe('playing');

    store.toggleFlag(1); // flag the second mine - a chord at cell 4 is now available

    vi.advanceTimersByTime(1000); // next tick picks it up
    expect(store.status()).toBe('won');
    expect(store.secondsUntilAutoChord()).toBe(10);
  });

  it('ticks the sniffer and auto-chord timers before any move is made', () => {
    const store = createStore();
    store.newGame({ rows: 3, cols: 3, mines: 1 });

    expect(store.status()).toBe('idle');
    expect(store.secondsUntilSniff()).toBe(10);

    vi.advanceTimersByTime(5000);

    expect(store.secondsUntilSniff()).toBe(5);
    expect(store.status()).toBe('idle'); // nothing hidden-and-revealed yet, so no move has happened
  });

  it('lets the autosniffer make the very first move so nobody has to click anything', () => {
    const upgrades = TestBed.inject(UpgradesStore);
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(400);
    upgrades.buySnifferUnlock();
    upgrades.buyAutoSnifferUnlock();

    const store = createStore();
    store.newGame({ rows: 3, cols: 3, mines: 1 });

    vi.advanceTimersByTime(10000); // default sniffer interval, nothing marked

    // Autosniffer picks index 0 (deterministic, see mock above), which is
    // guaranteed safe since placing mines always avoids the triggering cell.
    expect(store.status()).toBe('playing');
    expect(store.cells()[0].state).toBe('revealed');
    expect(store.cells()[1].isMine).toBe(true); // the forced mine, avoided
  });

  it('never auto-restarts while a game is still in progress', () => {
    const store = createStore();
    store.newGame({ rows: 2, cols: 2, mines: 1 });
    store.reveal(3); // starts playing

    vi.advanceTimersByTime(5000); // well under any resolution threshold

    expect(store.status()).toBe('playing'); // no restart happened mid-round
  });

  it('automatically starts a new game once the auto-restart timer elapses', () => {
    const upgrades = TestBed.inject(UpgradesStore);
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(100);
    upgrades.buyAutoRestartUnlock();

    const store = createStore();
    store.newGame({ rows: 1, cols: 3, mines: 1 });

    store.reveal(0); // safe, mine forced onto index 1
    store.reveal(2); // clears the board -> won

    expect(store.status()).toBe('won');
    expect(store.secondsUntilAutoRestart()).toBe(10);

    vi.advanceTimersByTime(10000);

    expect(store.status()).toBe('idle');
    expect(store.cells().every((cell) => cell.state === 'hidden')).toBe(true);
  });

  it('runs a mechanic that was permanently unlocked with prestige points, without ever buying its mine unlock', () => {
    const prestige = TestBed.inject(PrestigeStore);
    const currency = TestBed.inject(CurrencyStore);
    currency.earn(2000); // 1 prestige point
    prestige.claimAvailableGain();
    prestige.buyPermanentAutoRestart();

    const store = createStore();
    store.newGame({ rows: 1, cols: 3, mines: 1 });

    store.reveal(0); // safe, mine forced onto index 1
    store.reveal(2); // clears the board -> won
    expect(store.status()).toBe('won');

    vi.advanceTimersByTime(10000);

    expect(store.status()).toBe('idle'); // auto-restart fired despite no mine-bought unlock
  });
});
