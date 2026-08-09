import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { GameStore } from '../../services/game-store';

// Elements where the space bar already means something else (activate a
// button, flag a cell, type in a field) and shouldn't also start a new game.
const SPACE_EXEMPT_TAGS = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A']);

@Component({
  selector: 'ms-game-header',
  imports: [MatIcon, MatIconButton, MatTooltip],
  templateUrl: './game-header.html',
  styleUrl: './game-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onDocumentKeydown($event)',
  },
})
export class GameHeader {
  private readonly store = inject(GameStore);

  protected readonly minesRemaining = this.store.minesRemaining;
  protected readonly status = this.store.status;
  protected readonly secondsUntilSniff = this.store.secondsUntilSniff;
  protected readonly secondsUntilAutoFlag = this.store.secondsUntilAutoFlag;
  protected readonly secondsUntilAutoChord = this.store.secondsUntilAutoChord;
  protected readonly secondsUntilAutoRestart = this.store.secondsUntilAutoRestart;

  protected readonly elapsed = computed(() => pad(this.store.elapsedSeconds()));
  protected readonly snifferText = computed(() => `${pad2(this.secondsUntilSniff())}s`);
  protected readonly autoFlagText = computed(() => `${pad2(this.secondsUntilAutoFlag())}s`);
  protected readonly autoChordText = computed(() => `${pad2(this.secondsUntilAutoChord())}s`);
  protected readonly autoRestartText = computed(() => `${pad2(this.secondsUntilAutoRestart())}s`);
  protected readonly mineText = computed(() => {
    const remaining = this.minesRemaining();
    return remaining < 0 ? `-${pad(Math.abs(remaining))}` : pad(remaining);
  });

  protected readonly faceIcon = computed(() => {
    switch (this.status()) {
      case 'won':
        return 'sentiment_very_satisfied';
      case 'lost':
        return 'sentiment_very_dissatisfied';
      default:
        return 'mood';
    }
  });

  protected reset(): void {
    this.store.newGame();
  }

  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key !== ' ' || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const target = event.target;
    if (target instanceof HTMLElement && target.closest('[role="dialog"]') !== null) {
      return;
    }

    if (this.store.isOver()) {
      event.preventDefault();
      this.reset();
      return;
    }

    const isExempt =
      target instanceof HTMLElement &&
      (SPACE_EXEMPT_TAGS.has(target.tagName) || target.getAttribute('role') === 'gridcell');
    if (isExempt) {
      return;
    }

    event.preventDefault();
    this.reset();
  }
}

function pad(value: number): string {
  return Math.min(value, 999).toString().padStart(3, '0');
}

function pad2(value: number): string {
  return Math.min(value, 99).toString().padStart(2, '0');
}
