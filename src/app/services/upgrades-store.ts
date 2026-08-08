import { computed, inject, Injectable, signal } from '@angular/core';
import { CurrencyStore } from './currency-store';

const STORAGE_KEY = 'ms-upgrades';

export const BASE_ROWS = 8;
export const BASE_COLS = 8;
export const BASE_MAX_MINES = 10;

const MINE_CAPACITY_BASE_COST = 10;
const MINE_CAPACITY_COST_GROWTH = 1.15;

const BOARD_ROWS_BASE_COST = 15;
const BOARD_ROWS_COST_GROWTH = 1.2;

const BOARD_COLS_BASE_COST = 15;
const BOARD_COLS_COST_GROWTH = 1.2;

interface StoredUpgrades {
  readonly mineCapacity: number;
  readonly boardRows?: number;
  readonly boardCols?: number;
  readonly boardSize?: number;
}

/** Meta-progression: upgrades bought with banked mines that persist between games. */
@Injectable({ providedIn: 'root' })
export class UpgradesStore {
  private readonly currency = inject(CurrencyStore);

  private readonly stored = this.load();
  private readonly _mineCapacityLevel = signal(this.stored.mineCapacity);
  private readonly _boardRowsLevel = signal(this.stored.boardRows);
  private readonly _boardColsLevel = signal(this.stored.boardCols);

  readonly mineCapacityLevel = this._mineCapacityLevel.asReadonly();
  readonly boardRowsLevel = this._boardRowsLevel.asReadonly();
  readonly boardColsLevel = this._boardColsLevel.asReadonly();

  /** The mine count every new board is generated with. */
  readonly maxMines = computed(() => BASE_MAX_MINES + this._mineCapacityLevel());

  /** The board dimensions every new game is generated with. */
  readonly boardRows = computed(() => BASE_ROWS + this._boardRowsLevel());
  readonly boardCols = computed(() => BASE_COLS + this._boardColsLevel());

  readonly mineCapacityCost = computed(() =>
    Math.round(MINE_CAPACITY_BASE_COST * MINE_CAPACITY_COST_GROWTH ** this._mineCapacityLevel()),
  );
  readonly boardRowsCost = computed(() =>
    Math.round(BOARD_ROWS_BASE_COST * BOARD_ROWS_COST_GROWTH ** this._boardRowsLevel()),
  );
  readonly boardColsCost = computed(() =>
    Math.round(BOARD_COLS_BASE_COST * BOARD_COLS_COST_GROWTH ** this._boardColsLevel()),
  );

  readonly canAffordMineCapacity = computed(
    () => this.currency.mines() >= this.mineCapacityCost(),
  );
  readonly canAffordBoardRows = computed(() => this.currency.mines() >= this.boardRowsCost());
  readonly canAffordBoardCols = computed(() => this.currency.mines() >= this.boardColsCost());

  /** Spends the current cost and bumps max mines by one, if affordable. */
  buyMineCapacity(): void {
    if (!this.currency.spend(this.mineCapacityCost())) {
      return;
    }
    this._mineCapacityLevel.update((value) => value + 1);
    this.persist();
  }

  /** Spends the current cost and grows the board by one row, if affordable. */
  buyBoardRows(): void {
    if (!this.currency.spend(this.boardRowsCost())) {
      return;
    }
    this._boardRowsLevel.update((value) => value + 1);
    this.persist();
  }

  /** Spends the current cost and grows the board by one column, if affordable. */
  buyBoardCols(): void {
    if (!this.currency.spend(this.boardColsCost())) {
      return;
    }
    this._boardColsLevel.update((value) => value + 1);
    this.persist();
  }

  private persist(): void {
    const value: StoredUpgrades = {
      mineCapacity: this._mineCapacityLevel(),
      boardRows: this._boardRowsLevel(),
      boardCols: this._boardColsLevel(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }

  private load(): { mineCapacity: number; boardRows: number; boardCols: number } {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { mineCapacity: 0, boardRows: 0, boardCols: 0 };
    }

    try {
      const parsed = JSON.parse(raw);
      const mineCapacity = Number(parsed.mineCapacity);
      let boardRows = Number(parsed.boardRows);
      let boardCols = Number(parsed.boardCols);
      const legacyBoardSize = Number(parsed.boardSize);

      if (!Number.isFinite(boardRows) || boardRows < 0) {
        boardRows = Number.isFinite(legacyBoardSize) && legacyBoardSize >= 0 ? legacyBoardSize : 0;
      }
      if (!Number.isFinite(boardCols) || boardCols < 0) {
        boardCols = Number.isFinite(legacyBoardSize) && legacyBoardSize >= 0 ? legacyBoardSize : 0;
      }

      return {
        mineCapacity: Number.isFinite(mineCapacity) && mineCapacity >= 0 ? mineCapacity : 0,
        boardRows,
        boardCols,
      };
    } catch {
      return { mineCapacity: 0, boardRows: 0, boardCols: 0 };
    }
  }
}
