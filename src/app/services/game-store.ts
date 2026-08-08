import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { BoardConfig, Cell, GameStatus } from '../models/cell';
import {
  autoFlag,
  createCells,
  findAvailableChord,
  flagRemainingMines,
  floodReveal,
  isCleared,
  neighborIndexes,
  placeMines,
  revealMines,
} from './board.util';
import { CurrencyStore } from './currency-store';
import { UpgradesStore } from './upgrades-store';

const MAX_ELAPSED = 999;

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
  private readonly _elapsedSeconds = signal(0);
  private readonly _secondsUntilSniff = signal(this.upgrades.snifferIntervalSeconds());
  private readonly _secondsUntilAutoChord = signal(this.upgrades.autoChordIntervalSeconds());

  readonly config = this._config.asReadonly();
  readonly cells = this._cells.asReadonly();
  readonly status = this._status.asReadonly();
  readonly elapsedSeconds = this._elapsedSeconds.asReadonly();
  readonly secondsUntilSniff = this._secondsUntilSniff.asReadonly();
  readonly secondsUntilAutoChord = this._secondsUntilAutoChord.asReadonly();

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
  }

  /** Starts a fresh round, optionally with a different board size. */
  newGame(config: BoardConfig = this.currentMaxConfig()): void {
    this.stopTimer();
    this._config.set(config);
    this._cells.set(createCells(config));
    this._status.set('idle');
    this._elapsedSeconds.set(0);
    this._secondsUntilSniff.set(this.upgrades.snifferIntervalSeconds());
    this._secondsUntilAutoChord.set(this.upgrades.autoChordIntervalSeconds());
  }

  /** Left click: uncover a square (or chord, if it is already a number). */
  reveal(index: number): void {
    if (this.isOver()) {
      return;
    }

    let cells = this._cells();
    const target = cells[index];
    if (!target || target.state !== 'hidden') {
      return;
    }

    const config = this._config();

    // Mines are laid on the first click so the opening move is never fatal.
    if (this._status() === 'idle') {
      cells = placeMines(cells, config, index);
      this._status.set('playing');
      this.startTimer();
    }

    if (cells[index].isMine) {
      this._cells.set(revealMines(cells, index));
      this.finish('lost');
      return;
    }

    const next = autoFlag(floodReveal(cells, index, config), config);
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
    if (this.isOver()) {
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

    // Placing a sniffer when the timer is sitting at 0 immediately resolves it.
    if (this._secondsUntilSniff() === 0 && this._status() === 'playing') {
      this.resolveSnifferAtIndex(index);
      this._secondsUntilSniff.set(this.upgrades.snifferIntervalSeconds());
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
    next = autoFlag(next, config);
    this._cells.set(next);
    this.settle(next);
  }

  private settle(cells: readonly Cell[]): void {
    if (isCleared(cells)) {
      this._cells.set(flagRemainingMines(cells));
      this.finish('won');
    }
  }

  private finish(status: Extract<GameStatus, 'won' | 'lost'>): void {
    this._status.set(status);
    this.stopTimer();
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

  private startTimer(): void {
    this.stopTimer();
    this.timerId = setInterval(() => {
      this._elapsedSeconds.update((value) => Math.min(value + 1, MAX_ELAPSED));
      this._secondsUntilSniff.update((seconds) => {
        const next = seconds > 0 ? seconds - 1 : 0;
        if (next === 0) {
          return this.tryResolveSniffer() ? this.upgrades.snifferIntervalSeconds() : 0;
        }
        return next;
      });
      this._secondsUntilAutoChord.update((seconds) => {
        const next = seconds > 0 ? seconds - 1 : 0;
        if (next === 0) {
          return this.tryAutoChord() ? this.upgrades.autoChordIntervalSeconds() : 0;
        }
        return next;
      });
    }, 1000);
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
      next = autoFlag(floodReveal(next, index, this._config()), this._config());
      this._cells.set(next);
      this.settle(next);
    }
  }

  /**
   * Resolves one marked sniffer if any are placed; otherwise auto-sniffs a
   * random hidden square. Returns whether a square was resolved.
   */
  private tryResolveSniffer(): boolean {
    const cells = this._cells();
    const snifferIndexes = cells
      .filter((cell) => cell.state === 'hidden' && cell.hasSniffer)
      .map((cell) => cell.index);

    const candidates =
      snifferIndexes.length > 0
        ? snifferIndexes
        : cells.filter((cell) => cell.state === 'hidden').map((cell) => cell.index);

    if (candidates.length === 0) {
      return false;
    }

    const randomIndex = candidates[Math.floor(Math.random() * candidates.length)];
    this.resolveSnifferAtIndex(randomIndex);
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
