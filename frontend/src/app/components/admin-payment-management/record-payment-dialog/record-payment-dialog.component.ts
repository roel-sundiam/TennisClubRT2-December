import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

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
  ],
  template: `
    <div class="record-dialog">
      <div class="dialog-hero">
        <div class="hero-icon">
          <mat-icon>verified</mat-icon>
        </div>
        <div class="hero-copy">
          <p class="eyebrow">Financial Reports</p>
          <h2>Record Payment</h2>
          <p>Confirm this payment and optionally apply available member credit.</p>
        </div>
      </div>

      <mat-dialog-content class="dialog-content">
        <section class="summary-panel">
          <div class="summary-item">
            <span class="label">Reference</span>
            <strong class="value reference">{{ data.referenceNumber }}</strong>
          </div>
          <div class="summary-item">
            <span class="label">Member</span>
            <strong class="value">{{ data.memberName }}</strong>
          </div>
          <div class="summary-item amount-due">
            <span class="label">Amount Due</span>
            <strong class="value amount">&#8369;{{ data.amount | number:'1.2-2' }}</strong>
          </div>
        </section>

        <section class="credit-panel">
          <div class="credit-card">
            <div class="credit-icon">
              <mat-icon>account_balance_wallet</mat-icon>
            </div>
            <div class="credit-text">
              <span>Available Credit Balance</span>
              <strong>&#8369;{{ data.creditBalance | number:'1.2-2' }}</strong>
            </div>
          </div>

          <label class="credit-field">
            <span class="field-label">Credit Amount to Apply</span>
            <div class="amount-input-wrap">
              <span class="currency-prefix">&#8369;</span>
              <input
                type="number"
                [(ngModel)]="creditToApply"
                [min]="0.01"
                [max]="maxCredit"
                step="0.01"
                inputmode="decimal"
                (input)="onCreditInput()"
              />
            </div>
            <span class="field-hint">Maximum credit allowed: &#8369;{{ maxCredit | number:'1.2-2' }}</span>
          </label>
          <p class="credit-error" *ngIf="creditError">{{ creditError }}</p>
        </section>
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-actions">
        <button mat-button (click)="onCancel()" class="cancel-button">
          Cancel
        </button>
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
          <mat-icon>check_circle</mat-icon>
          Apply &#8369;{{ creditToApply | number:'1.2-2' }} Credit
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .record-dialog {
      width: min(520px, 92vw);
      overflow: hidden;
      background: #ffffff;
      color: #172033;
    }

    .dialog-hero {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 22px 24px 18px;
      color: #ffffff;
      background:
        linear-gradient(135deg, rgba(15, 76, 92, 0.97), rgba(26, 117, 103, 0.94)),
        #0f4c5c;
    }

    .hero-icon {
      width: 46px;
      height: 46px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      background: rgba(255, 255, 255, 0.16);
      border: 1px solid rgba(255, 255, 255, 0.28);
      border-radius: 8px;

      mat-icon {
        width: 26px;
        height: 26px;
        font-size: 26px;
      }
    }

    .hero-copy {
      min-width: 0;

      .eyebrow {
        margin: 0 0 4px;
        color: rgba(255, 255, 255, 0.72);
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      h2 {
        margin: 0;
        color: #ffffff;
        font-size: 1.35rem;
        font-weight: 850;
        line-height: 1.15;
      }

      p:last-child {
        margin: 7px 0 0;
        color: rgba(255, 255, 255, 0.82);
        font-size: 0.87rem;
        line-height: 1.4;
      }
    }

    .dialog-content {
      padding: 18px 24px 6px;
    }

    .summary-panel {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 16px;
    }

    .summary-item {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 5px;
      padding: 13px;
      background: #fbfdff;
      border: 1px solid #dce5ef;
      border-radius: 8px;

      &.amount-due {
        grid-column: 1 / -1;
        background: #f4fbf9;
        border-color: #cce8e2;
      }

      .label {
        color: #64748b;
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .value {
        color: #172033;
        font-size: 0.94rem;
        font-weight: 800;
        overflow-wrap: anywhere;

        &.reference {
          font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
          font-size: 0.86rem;
        }
      }

      .amount {
        color: #0f4c5c;
        font-size: 1.45rem;
        line-height: 1;
      }
    }

    .credit-panel {
      padding: 14px;
      background: #f8fafc;
      border: 1px solid #dce5ef;
      border-radius: 8px;
    }

    .credit-card {
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr);
      gap: 11px;
      align-items: center;
      margin-bottom: 14px;

      .credit-icon {
        width: 42px;
        height: 42px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #0f4c5c;
        background: #eef7f5;
        border: 1px solid #cce8e2;
        border-radius: 8px;

        mat-icon {
          width: 23px;
          height: 23px;
          font-size: 23px;
        }
      }

      .credit-text {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;

        span {
          color: #64748b;
          font-size: 0.78rem;
          font-weight: 750;
        }

        strong {
          color: #145e53;
          font-size: 1.25rem;
          font-weight: 850;
          line-height: 1.1;
        }
      }
    }

    .credit-field {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }

    .field-label {
      color: #253349;
      font-size: 0.82rem;
      font-weight: 800;
    }

    .amount-input-wrap {
      min-height: 46px;
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr);
      align-items: center;
      background: #ffffff;
      border: 1px solid #cfd9e6;
      border-radius: 7px;
      transition: border-color 150ms ease, box-shadow 150ms ease;

      &:focus-within {
        border-color: #1a7567;
        box-shadow: 0 0 0 3px rgba(26, 117, 103, 0.13);
      }

      .currency-prefix {
        color: #64748b;
        font-weight: 800;
        text-align: center;
      }

      input {
        width: 100%;
        min-width: 0;
        height: 44px;
        padding: 0 12px 0 0;
        color: #172033;
        background: transparent;
        border: 0;
        font: inherit;
        font-size: 1rem;
        font-weight: 750;

        &:focus {
          outline: none;
        }
      }
    }

    .field-hint {
      color: #64748b;
      font-size: 0.76rem;
    }

    .credit-error {
      margin: 6px 0 0;
      color: #b42318;
      font-size: 0.78rem;
      font-weight: 750;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 16px 24px 22px;
      border-top: 1px solid #e7edf4;

      button {
        min-height: 38px;
        border-radius: 7px;
        font-size: 0.85rem;
        font-weight: 750;
      }

      .cancel-button {
        color: #516073;
      }

      .no-credit-button {
        color: #0f4c5c;
        border-color: #cfd9e6;
      }

      .with-credit-button {
        background: #0f4c5c;

        mat-icon {
          width: 18px;
          height: 18px;
          margin-right: 4px;
          font-size: 18px;
        }
      }
    }

    @media (max-width: 600px) {
      .record-dialog {
        width: 92vw;
      }

      .dialog-hero,
      .dialog-content,
      .dialog-actions {
        padding-left: 16px;
        padding-right: 16px;
      }

      .summary-panel {
        grid-template-columns: 1fr;
      }

      .dialog-actions {
        flex-direction: column-reverse;
        gap: 8px;

        button {
          width: 100%;
          margin: 0;
          min-height: 40px;
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
