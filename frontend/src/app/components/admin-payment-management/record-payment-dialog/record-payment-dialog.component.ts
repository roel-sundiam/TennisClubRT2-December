import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';

export interface RecordPaymentDialogData {
  referenceNumber: string;
  amount: number;
  memberName: string;
  creditBalance: number;
}

@Component({
  selector: 'app-record-payment-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatInputModule,
    MatFormFieldModule,
  ],
  template: `
    <div class="record-dialog">
      <div mat-dialog-title class="dialog-header">
        <mat-icon class="dialog-icon">account_balance_wallet</mat-icon>
        <h2>Record Payment</h2>
      </div>

      <mat-dialog-content class="dialog-content">
        <div class="payment-info">
          <div class="info-row">
            <span class="label">Reference</span>
            <span class="value">{{ data.referenceNumber }}</span>
          </div>
          <div class="info-row">
            <span class="label">Amount Due</span>
            <span class="value amount">₱{{ data.amount | number:'1.2-2' }}</span>
          </div>
          <div class="info-row">
            <span class="label">Member</span>
            <span class="value">{{ data.memberName }}</span>
          </div>
        </div>

        <mat-divider></mat-divider>

        <div class="credit-info">
          <mat-icon class="credit-icon">stars</mat-icon>
          <div class="credit-text">
            <span class="credit-label">Available Credit Balance</span>
            <span class="credit-amount">₱{{ data.creditBalance | number:'1.2-2' }}</span>
          </div>
        </div>

        <div class="credit-input-section">
          <mat-form-field appearance="outline" class="credit-input-field">
            <mat-label>Credit Amount to Apply</mat-label>
            <span matTextPrefix>₱&nbsp;</span>
            <input
              matInput
              type="number"
              [(ngModel)]="creditToApply"
              [min]="0.01"
              [max]="maxCredit"
              step="0.01"
              (input)="onCreditInput()"
            />
            <mat-hint>Max: ₱{{ maxCredit | number:'1.2-2' }}</mat-hint>
          </mat-form-field>
          <p class="credit-error" *ngIf="creditError">{{ creditError }}</p>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-actions" align="end">
        <button mat-button (click)="onCancel()" class="cancel-button">Cancel</button>
        <button mat-stroked-button (click)="onRecordNoCredit()" class="no-credit-button">
          Record (No Credit)
        </button>
        <button
          mat-raised-button
          color="primary"
          (click)="onRecordWithCredit()"
          [disabled]="!isValid()"
          class="with-credit-button"
        >
          <mat-icon>stars</mat-icon>
          Apply ₱{{ creditToApply | number:'1.2-2' }} Credit
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .record-dialog {
      min-width: 420px;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 20px 20px 12px 20px;
      margin: 0;

      h2 {
        margin: 0;
        font-size: 1.2rem;
        font-weight: 500;
        color: #333;
      }

      .dialog-icon {
        font-size: 1.6rem;
        width: 1.6rem;
        height: 1.6rem;
        color: #2196f3;
      }
    }

    .dialog-content {
      padding: 0 20px 16px 20px;
    }

    .payment-info {
      margin-bottom: 16px;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 5px 0;

      .label {
        font-size: 0.85rem;
        color: #888;
      }

      .value {
        font-size: 0.9rem;
        color: #333;
        font-weight: 500;
      }

      .amount {
        font-size: 1rem;
        color: #2196f3;
      }
    }

    .credit-info {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 16px;
      padding: 12px;
      background: #fff8e1;
      border-radius: 8px;
      border: 1px solid #ffe082;

      .credit-icon {
        color: #f9a825;
        font-size: 2rem;
        width: 2rem;
        height: 2rem;
      }

      .credit-text {
        display: flex;
        flex-direction: column;
        gap: 2px;

        .credit-label {
          font-size: 0.8rem;
          color: #888;
        }

        .credit-amount {
          font-size: 1.2rem;
          font-weight: 600;
          color: #f57f17;
        }
      }
    }

    .credit-input-section {
      margin-top: 16px;

      .credit-input-field {
        width: 100%;
      }

      .credit-error {
        margin: 4px 0 0 0;
        font-size: 0.8rem;
        color: #f44336;
      }
    }

    .dialog-actions {
      padding: 12px 20px 16px 20px;
      gap: 8px;

      button {
        height: 38px;
        font-size: 0.85rem;
      }

      .cancel-button {
        color: #666;
      }

      .no-credit-button {
        color: #555;
      }

      .with-credit-button {
        mat-icon {
          font-size: 1rem;
          width: 1rem;
          height: 1rem;
          margin-right: 4px;
          color: #fff8e1;
        }
      }
    }

    @media (max-width: 600px) {
      .record-dialog {
        min-width: 90vw;
      }

      .dialog-actions {
        flex-direction: column-reverse;
        gap: 8px;

        button {
          width: 100%;
          margin: 0;
          height: 40px;
        }
      }
    }
  `]
})
export class RecordPaymentDialogComponent {
  creditToApply: number;
  maxCredit: number;
  creditError = '';

  constructor(
    public dialogRef: MatDialogRef<RecordPaymentDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RecordPaymentDialogData
  ) {
    this.maxCredit = Math.min(data.creditBalance, data.amount);
    this.creditToApply = this.maxCredit;
  }

  onCreditInput(): void {
    this.creditError = '';
    if (this.creditToApply > this.maxCredit) {
      this.creditToApply = this.maxCredit;
    }
    if (this.creditToApply < 0) {
      this.creditToApply = 0;
    }
  }

  isValid(): boolean {
    return this.creditToApply > 0 && this.creditToApply <= this.maxCredit;
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onRecordNoCredit(): void {
    this.dialogRef.close({ applyCredit: false });
  }

  onRecordWithCredit(): void {
    if (!this.isValid()) return;
    this.dialogRef.close({ applyCredit: true, creditAmount: this.creditToApply });
  }
}
