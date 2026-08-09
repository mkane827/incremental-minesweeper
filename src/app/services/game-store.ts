import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { BoardConfig, Cell, GameStatus } from '../models/cell';
import {
  createCells,
  findAvailableChord,
  findFlaggableMine,
  flagRemainingMines,
  floodReveal,
  isCleared,
  neighborIndexes,
  placeMines,
  revealMines,
} from './board.util';
import { CurrencyStore } from './currency-store';
import { UpgradesStore } from './upgrades-store';

const MAX_ELAPSED_MS = 999_000;

/**
 * UI refresh cadence for the countdowns. Correctness does NOT depend on this
 * firing reliably - every check compares against a real wall-clock deadline
 * (`Date.now() + intervalMs`), so a throttled background tab (browsers
 * routinely clamp `setInterval` there) just means the UI updates in bursts
 * instead of smoothly; timers still resolve at the right real-world moment
 * instead of running in slow motion.
 */
const TICK_MS = 100;

/**
 * Single source of truth for a round of minesweeper.
 *
 * All state lives in signals and every mutation replaces the cell array with a
 * new one (and new objects for the cells that changed), so `OnPush` children
 * bound to a single cell re-render only when that cell actually moves.
 */
@Injectable({ providedIn: 'root' })
export class GameStore {
  private readonly destroyRef = inject(DestroyRef);
  private readonly currency = inject(CurrencyStore);
  private readonly upgrades = inject(UpgradesStore);
  private timerId: ReturnType<typeof setInterval> | null = null;

  private readonly _config = signal<BoardConfig>(this.currentMaxConfig());
  private readonly _cells = signal<readonly Cell[]>(createCells(this._config()));
  private readonly _status = signal<GameStatus>('idle');
  private readonly _elapsedMs = signal(0);
  private readonly _nowMs = signal(Date.now());
  private readonly _snifferDeadline = signal(Date.now() + this.upgrades.snifferIntervalMs());
  private readonly _autoChordDeadline = signal(Date.now() + this.upgrades.autoChordIntervalMs());
  private readonly _autoRestartDeadline = signal(
    Date.now() + this.upgrades.autoRestartIntervalMs(),
  );
  private readonly _autoFlagDeadline = signal(Date.now() + this.upgrades.autoFlagIntervalMs());

  readonly config = this._config.asReadonly();
  readonly cells = this._cells.asReadonly();
  readonly status = this._status.asReadonly();

  readonly elapsedSeconds = computed(() => Math.floor(this._elapsedMs() / 1000));
  readonly secondsUntilSniff = computed(() =>
    Math.max(0, Math.ceil((this._snifferDeadline() - this._nowMs()) / 1000)),
  );
  readonly secondsUntilAutoChord = computed(() =>
    Math.max(0, Math.ceil((this._autoChordDeadline() - this._nowMs()) / 1000)),
  );
  readonly secondsUntilAutoRestart = computed(() =>
    Math.max(0, Math.ceil((this._autoRestartDeadline() - this._nowMs()) / 1000)),
  );
  readonly secondsUntilAutoFlag = computed(() =>
    Math.max(0, Math.ceil((this._autoFlagDeadline() - this._nowMs()) / 1000)),
  );

  readonly flagCount = computed(
    () => this._cells().filter((cell) => cell.state === 'flagged').length,
  );

  /** Mines the player still has to account for (can go negative). */
  readonly minesRemaining = computed(() => this._config().mines - this.flagCount());

  readonly isOver = computed(() => {
    const status = this._status();
    return status === 'won' || status === 'lost';
  });

  readonly revealedCount = computed(
    () => this._cells().filter((cell) => cell.state === 'revealed').length,
  );

  constructor() {
    this.destroyRef.onDestroy(() => this.stopTimer());
    this.startTimer();

    // A round that hasn't started yet has nothing "locked in" - if any
    // upgrade changes while idle, immediately regenerate so the still-unstarted
    // board (and its timers) reflect the purchase right away. Every effect
    // always fires once automatically on creation regardless of whether a
    // dependency ever changes; that first run must be skipped; otherwise it'd
    // reset an idle countdown's progress for no reason the instant the game loads.
    let firstEffectRun = true;
    effect(() => {
      this.upgrades.boardRows();
      this.upgrades.boardCols();
      this.upgrades.maxMines();
      this.upgrades.snifferIntervalMs();
      this.upgrades.autoChordIntervalMs();
      this.upgrades.autoRestartIntervalMs();
      this.upgrades.autoFlagIntervalMs();
      untracked(() => {
        if (firstEffectRun) {
          firstEffectRun = false;
          return;
        }
        if (this._status() === 'idle') {
          this.newGame();
        }
      });
    });
  }

  /** Starts a fresh round, optionally with a different board size. */
  newGame(config: BoardConfig = this.currentMaxConfig()): void {
    const now = Date.now();
    this._config.set(config);
    this._cells.set(createCells(config));
    this._status.set('idle');
    this._elapsedMs.set(0);
    this._snifferDeadline.set(now + this.upgrades.snifferIntervalMs());
    this._autoChordDeadline.set(now + this.upgrades.autoChordIntervalMs());
    this._autoRestartDeadline.set(now + this.upgrades.autoRestartIntervalMs());
    this._autoFlagDeadline.set(now + this.upgrades.autoFlagIntervalMs());
  }

  /** Left click: uncover a square (or chord, if it is already a number). */
  reveal(index: number): void {
    if (this.isOver()) {
      return;
    }

    const before = this._cells()[index];
    if (!before || before.state !== 'hidden') {
      return;
    }

    // Mines are laid on the first click (whether by the player or the
    // autosniffer) so the opening move is never fatal.
    this.ensureMinesPlaced(index);

    const cells = this._cells();
    const config = this._config();

    if (cells[index].isMine) {
      this._cells.set(revealMines(cells, index));
      this.finish('lost');
      return;
    }

    const next = floodReveal(cells, index, config);
    this._cells.set(next);
    this.settle(next);
  }

  /** Right click: cycle a square between hidden and flagged. */
  toggleFlag(index: number): void {
    if (this.isOver()) {
      return;
    }

    const cells = this._cells();
    const target = cells[index];
    if (!target || target.state === 'revealed') {
      return;
    }

    const next = cells.slice();
    next[index] = {
      ...target,
      state: target.state === 'flagged' ? 'hidden' : 'flagged',
      hasSniffer: false,
    };
    this._cells.set(next);
  }

  /** Places or removes a sniffer (🐶) on a hidden square. */
  toggleSniffer(index: number): void {
    if (this.isOver() || !this.upgrades.snifferUnlocked()) {
      return;
    }

    const cells = this._cells();
    const target = cells[index];
    if (!target || target.state !== 'hidden') {
      return;
    }

    if (target.hasSniffer) {
      const next = cells.slice();
      next[index] = { ...target, hasSniffer: false };
      this._cells.set(next);
      return;
    }

    // Placing a sniffer once the deadline has already passed resolves it immediately.
    const now = Date.now();
    if (now >= this._snifferDeadline()) {
      this.resolveSnifferAtIndex(index);
      this._snifferDeadline.set(now + this.upgrades.snifferIntervalMs());
    } else {
      const next = cells.slice();
      next[index] = { ...target, hasSniffer: true };
      this._cells.set(next);
    }
  }

  /**
   * Clicking a revealed number whose flag count already matches uncovers the
   * rest of its neighbours in one go.
   */
  chord(index: number): void {
    if (this._status() !== 'playing') {
      return;
    }

    const cells = this._cells();
    const target = cells[index];
    if (!target || target.state !== 'revealed' || target.adjacentMines === 0) {
      return;
    }

    const config = this._config();
    const neighbors = neighborIndexes(index, config);
    const flagged = neighbors.filter((n) => cells[n].state === 'flagged').length;
    if (flagged !== target.adjacentMines) {
      return;
    }

    const toReveal = neighbors.filter((n) => cells[n].state === 'hidden');
    const detonated = toReveal.find((n) => cells[n].isMine);
    if (detonated !== undefined) {
      this._cells.set(revealMines(cells, detonated));
      this.finish('lost');
      return;
    }

    let next = cells;
    for (const n of toReveal) {
      next = floodReveal(next, n, config);
    }
    this._cells.set(next);
    this.settle(next);
  }

  /** Lays mines around `safeIndex` and starts the round, if it hasn't already. */
  private ensureMinesPlaced(safeIndex: number): void {
    if (this._status() !== 'idle') {
      return;
    }
    const next = placeMines(this._cells(), this._config(), safeIndex);
    this._cells.set(next);
    this._status.set('playing');
  }

  private settle(cells: readonly Cell[]): void {
    if (isCleared(cells)) {
      this._cells.set(flagRemainingMines(cells));
      this.finish('won');
    }
  }

  private finish(status: Extract<GameStatus, 'won' | 'lost'>): void {
    this._status.set(status);
    // Starts fresh from the actual moment the round ends, not from newGame()
    // time - a round that took a while to play still gets a full countdown.
    this._autoRestartDeadline.set(Date.now() + this.upgrades.autoRestartIntervalMs());
    if (status === 'won') {
      this.currency.earn(this._config().mines);
    }
  }

  private currentMaxConfig(): BoardConfig {
    return {
      rows: this.upgrades.boardRows(),
      cols: this.upgrades.boardCols(),
      mines: this.upgrades.maxMines(),
    };
  }

  /** Runs for the lifetime of the store - sniffer/auto-flag/auto-chord/auto-restart all key off it. */
  private startTimer(): void {
    this.stopTimer();
    let lastTickAt = Date.now();

    this.timerId = setInterval(() => {
      const now = Date.now();
      const deltaMs = now - lastTickAt;
      lastTickAt = now;
      this._nowMs.set(now);

      if (this._status() === 'playing') {
        this._elapsedMs.update((ms) => Math.min(ms + deltaMs, MAX_ELAPSED_MS));
      }

      if (this.isOver()) {
        if (this.upgrades.autoRestartUnlocked() && now >= this._autoRestartDeadline()) {
          this.newGame();
        }
        return;
      }

      // Sniffer first (it can reveal or flag), then auto-flag, then
      // auto-chord last so it sees any flags placed earlier in this tick.
      if (
        this.upgrades.snifferUnlocked() &&
        now >= this._snifferDeadline() &&
        this.tryResolveSniffer()
      ) {
        this._snifferDeadline.set(now + this.upgrades.snifferIntervalMs());
      }
      if (
        this.upgrades.autoFlagUnlocked() &&
        now >= this._autoFlagDeadline() &&
        this.tryAutoFlag()
      ) {
        this._autoFlagDeadline.set(now + this.upgrades.autoFlagIntervalMs());
      }
      if (
        this.upgrades.autoChordUnlocked() &&
        now >= this._autoChordDeadline() &&
        this.tryAutoChord()
      ) {
        this._autoChordDeadline.set(now + this.upgrades.autoChordIntervalMs());
      }
    }, TICK_MS);
  }

  private stopTimer(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private resolveSnifferAtIndex(index: number): void {
    if (this.isOver()) {
      return;
    }

    this.ensureMinesPlaced(index);

    const cells = this._cells();
    const target = cells[index];
    if (!target) {
      return;
    }

    if (target.isMine) {
      const next = cells.slice();
      next[index] = {
        ...target,
        state: 'flagged',
        hasSniffer: false,
      };
      this._cells.set(next);
      this.settle(next);
    } else {
      let next = cells.slice();
      next[index] = { ...target, hasSniffer: false };
      next = floodReveal(next, index, this._config());
      this._cells.set(next);
      this.settle(next);
    }
  }

  /**
   * Resolves one marked sniffer if any are placed; otherwise, if the
   * auto-sniffer add-on is unlocked, resolves a random hidden square instead.
   * Returns whether a square was resolved.
   */
  private tryResolveSniffer(): boolean {
    const cells = this._cells();
    const snifferIndexes = cells
      .filter((cell) => cell.state === 'hidden' && cell.hasSniffer)
      .map((cell) => cell.index);

    const candidates =
      snifferIndexes.length > 0
        ? snifferIndexes
        : this.upgrades.autoSnifferUnlocked()
          ? cells.filter((cell) => cell.state === 'hidden').map((cell) => cell.index)
          : [];

    if (candidates.length === 0) {
      return false;
    }

    const randomIndex = candidates[Math.floor(Math.random() * candidates.length)];
    this.resolveSnifferAtIndex(randomIndex);
    return true;
  }

  /** Flags one logically-deducible mine, if any. Returns whether one was found. */
  private tryAutoFlag(): boolean {
    const index = findFlaggableMine(this._cells(), this._config());
    if (index === undefined) {
      return false;
    }
    const cells = this._cells();
    const next = cells.slice();
    next[index] = { ...cells[index], state: 'flagged' };
    this._cells.set(next);
    return true;
  }

  /** Chords one available square, if any. Returns whether one was found. */
  private tryAutoChord(): boolean {
    const index = findAvailableChord(this._cells(), this._config());
    if (index === undefined) {
      return false;
    }
    this.chord(index);
    return true;
  }
}
