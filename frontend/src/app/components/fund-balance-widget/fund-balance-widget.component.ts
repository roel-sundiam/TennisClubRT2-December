import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FundBalanceService, FundBalanceRollup } from '../../services/fund-balance.service';

@Component({
  selector: 'app-fund-balance-widget',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './fund-balance-widget.component.html',
  styleUrl: './fund-balance-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FundBalanceWidgetComponent {
  expanded = false;
  loading = false;
  loaded = false;
  error = false;
  data: FundBalanceRollup | null = null;

  constructor(
    private fundBalanceService: FundBalanceService,
    private cdr: ChangeDetectorRef
  ) {}

  toggleExpanded(): void {
    this.expanded = !this.expanded;

    if (this.expanded && !this.loaded && !this.loading) {
      this.loading = true;
      this.error = false;
      this.cdr.markForCheck();

      this.fundBalanceService.getRollup().subscribe({
        next: (rollup) => {
          this.data = rollup;
          this.loaded = true;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error loading fund balance rollup:', err);
          this.error = true;
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
    }
  }

  formatCurrency(amount: number): string {
    return amount.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
}
