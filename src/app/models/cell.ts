/** Visual/logical state of a single square. */
export type CellState = 'hidden' | 'revealed' | 'flagged';

/** Overall lifecycle of a round. */
export type GameStatus = 'idle' | 'playing' | 'won' | 'lost';

export interface Cell {
  readonly index: number;
  readonly row: number;
  readonly col: number;
  readonly isMine: boolean;
  /** Number of mines in the eight surrounding squares. */
  readonly adjacentMines: number;
  readonly state: CellState;
  /** The mine the player actually detonated. */
  readonly exploded: boolean;
  /** A flag that turned out to be wrong (only set once the game is lost). */
  readonly wrongFlag: boolean;
  /** Whether a sniffer is active on this hidden square. */
  readonly hasSniffer?: boolean;
  /** A flag placed by the auto-flag timer, not the player - locked in and not player-removable. */
  readonly autoFlagged: boolean;
}

export interface BoardConfig {
  readonly rows: number;
  readonly cols: number;
  readonly mines: number;
}
