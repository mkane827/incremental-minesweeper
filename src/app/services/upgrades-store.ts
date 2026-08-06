import { computed, inject, Injectable, signal } from '@angular/core';
import { CurrencyStore } from './currency-store';

const STORAGE_KEY = 'ms-upgrades';

export const BASE_ROWS = 8;
export const BASE_COLS = 8;
export const BASE_MAX_MINES = 10;

const MINE_CAPACITY_BASE_COST = 10;
const MINE_CAPACITY_COST_GROWTH = 1.15;

const BOARD_SIZE_BASE_COST = 25;
const BOARD_SIZE_COST_GROWTH = 1.2;

interface StoredUpgrades {
  readonly mineCapacity: number;
  readonly boardSize: number;
}

/** Meta-progression: upgrades bought with banked mines that persist between games. */
@Injectable({ providedIn: 'root' })
export class UpgradesStore {
  private readonly currency = inject(CurrencyStore);

  private readonly stored = this.load();
  private readonly _mineCapacityLevel = signal(this.stored.mineCapacity);
  private readonly _boardSizeLevel = signal(this.stored.boardSize);

  readonly mineCapacityLevel = this._mineCapacityLevel.asReadonly();
  readonly boardSizeLevel = this._boardSizeLevel.asReadonly();

  /** The mine count every new board is generated with. */
  readonly maxMines = computed(() => BASE_MAX_MINES + this._mineCapacityLevel());

  /** The board dimensions every new game is generated with. */
  readonly boardRows = computed(() => BASE_ROWS + this._boardSizeLevel());
  readonly boardCols = computed(() => BASE_COLS + this._boardSizeLevel());

  readonly mineCapacityCost = computed(() =>
    Math.round(MINE_CAPACITY_BASE_COST * MINE_CAPACITY_COST_GROWTH ** this._mineCapacityLevel()),
  );
  readonly boardSizeCost = computed(() =>
    Math.round(BOARD_SIZE_BASE_COST * BOARD_SIZE_COST_GROWTH ** this._boardSizeLevel()),
  );

  readonly canAffordMineCapacity = computed(
    () => this.currency.mines() >= this.mineCapacityCost(),
  );
  readonly canAffordBoardSize = computed(() => this.currency.mines() >= this.boardSizeCost());

  /** Spends the current cost and bumps max mines by one, if affordable. */
  buyMineCapacity(): void {
    if (!this.currency.spend(this.mineCapacityCost())) {
      return;
    }
    this._mineCapacityLevel.update((value) => value + 1);
    this.persist();
  }

  /** Spends the current cost and grows the board by one row and column, if affordable. */
  buyBoardSize(): void {
    if (!this.currency.spend(this.boardSizeCost())) {
      return;
    }
    this._boardSizeLevel.update((value) => value + 1);
    this.persist();
  }

  private persist(): void {
    const value: StoredUpgrades = {
      mineCapacity: this._mineCapacityLevel(),
      boardSize: this._boardSizeLevel(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }

  private load(): StoredUpgrades {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { mineCapacity: 0, boardSize: 0 };
    }

    try {
      const parsed = JSON.parse(raw);
      const mineCapacity = Number(parsed.mineCapacity);
      const boardSize = Number(parsed.boardSize);
      return {
        mineCapacity: Number.isFinite(mineCapacity) && mineCapacity >= 0 ? mineCapacity : 0,
        boardSize: Number.isFinite(boardSize) && boardSize >= 0 ? boardSize : 0,
      };
    } catch {
      return { mineCapacity: 0, boardSize: 0 };
    }
  }
}
