import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { CurrencyStore } from '../../services/currency-store';
import { UpgradesStore } from '../../services/upgrades-store';

@Component({
  selector: 'ms-upgrades-dialog',
  imports: [MatDialogTitle, MatDialogContent, MatDialogActions, MatButton, MatIcon],
  templateUrl: './upgrades-dialog.html',
  styleUrl: './upgrades-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpgradesDialog {
  private readonly dialogRef = inject(MatDialogRef<UpgradesDialog>);

  protected readonly currency = inject(CurrencyStore);
  protected readonly upgrades = inject(UpgradesStore);

  protected buyMineCapacity(): void {
    this.upgrades.buyMineCapacity();
  }

  protected buyBoardRows(): void {
    this.upgrades.buyBoardRows();
  }

  protected buyBoardCols(): void {
    this.upgrades.buyBoardCols();
  }

  protected buySnifferSpeed(): void {
    this.upgrades.buySnifferSpeed();
  }

  protected buyAutoChordSpeed(): void {
    this.upgrades.buyAutoChordSpeed();
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
