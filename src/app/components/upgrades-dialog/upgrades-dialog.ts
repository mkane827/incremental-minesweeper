import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { CurrencyStore } from '../../services/currency-store';
import { MAX_MINE_DENSITY, timerIntervalMs, UpgradesStore } from '../../services/upgrades-store';

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

  protected readonly mineDensityPercent = computed(() =>
    Math.round(this.upgrades.mineDensity() * 100),
  );
  protected readonly isMineDensityHigh = computed(
    () => this.upgrades.mineDensity() >= MAX_MINE_DENSITY,
  );

  protected readonly snifferSeconds = computed(() => this.upgrades.snifferIntervalMs() / 1000);
  protected readonly nextSnifferSeconds = computed(
    () => timerIntervalMs(this.upgrades.snifferSpeedLevel() + 1) / 1000,
  );

  protected readonly autoChordSeconds = computed(() => this.upgrades.autoChordIntervalMs() / 1000);
  protected readonly nextAutoChordSeconds = computed(
    () => timerIntervalMs(this.upgrades.autoChordSpeedLevel() + 1) / 1000,
  );

  protected readonly autoRestartSeconds = computed(
    () => this.upgrades.autoRestartIntervalMs() / 1000,
  );
  protected readonly nextAutoRestartSeconds = computed(
    () => timerIntervalMs(this.upgrades.autoRestartSpeedLevel() + 1) / 1000,
  );

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

  protected buyAutoRestartSpeed(): void {
    this.upgrades.buyAutoRestartSpeed();
  }

  protected buyChordHighlightUnlock(): void {
    this.upgrades.buyChordHighlightUnlock();
  }

  protected buySnifferUnlock(): void {
    this.upgrades.buySnifferUnlock();
  }

  protected buyAutoFlagUnlock(): void {
    this.upgrades.buyAutoFlagUnlock();
  }

  protected buyAutoChordUnlock(): void {
    this.upgrades.buyAutoChordUnlock();
  }

  protected buyAutoRestartUnlock(): void {
    this.upgrades.buyAutoRestartUnlock();
  }

  protected buyAutoSnifferUnlock(): void {
    this.upgrades.buyAutoSnifferUnlock();
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
