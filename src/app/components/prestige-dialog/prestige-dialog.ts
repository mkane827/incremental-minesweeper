import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { CurrencyStore } from '../../services/currency-store';
import { GameStore } from '../../services/game-store';
import { PrestigeStore } from '../../services/prestige-store';
import { UpgradesStore } from '../../services/upgrades-store';

@Component({
  selector: 'ms-prestige-dialog',
  imports: [MatDialogTitle, MatDialogContent, MatDialogActions, MatButton, MatIcon],
  templateUrl: './prestige-dialog.html',
  styleUrl: './prestige-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrestigeDialog {
  private readonly dialogRef = inject(MatDialogRef<PrestigeDialog>);
  private readonly currency = inject(CurrencyStore);
  private readonly upgrades = inject(UpgradesStore);
  private readonly game = inject(GameStore);

  protected readonly prestige = inject(PrestigeStore);
  protected readonly lifetimeMines = this.currency.lifetimeMines;

  /** Requires a second click to actually prestige, since it resets the current run. */
  protected readonly confirming = signal(false);

  protected requestPrestige(): void {
    if (!this.prestige.canPrestige()) {
      return;
    }
    if (!this.confirming()) {
      this.confirming.set(true);
      return;
    }
    this.confirming.set(false);
    if (this.prestige.claimAvailableGain() <= 0) {
      return;
    }
    this.currency.resetSpendable();
    this.upgrades.resetForPrestige();
    this.game.newGame();
  }

  protected cancelConfirm(): void {
    this.confirming.set(false);
  }

  protected buyPermanentChordHighlight(): void {
    this.prestige.buyPermanentChordHighlight();
  }

  protected buyPermanentSniffer(): void {
    this.prestige.buyPermanentSniffer();
  }

  protected buyPermanentAutoFlag(): void {
    this.prestige.buyPermanentAutoFlag();
  }

  protected buyPermanentAutoChord(): void {
    this.prestige.buyPermanentAutoChord();
  }

  protected buyPermanentAutoRestart(): void {
    this.prestige.buyPermanentAutoRestart();
  }

  protected buyPermanentAutoSniffer(): void {
    this.prestige.buyPermanentAutoSniffer();
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
