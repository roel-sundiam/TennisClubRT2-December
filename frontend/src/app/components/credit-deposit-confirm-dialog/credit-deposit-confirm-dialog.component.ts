import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface CreditDepositConfirmData {
  amount: number;
  memberName: string;
  memberUsername: string;
  paymentMethod: string;
  createdAt: string;
}

@Component({
  selector: 'app-credit-deposit-confirm-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="confirm-dialog">
      <div class="dialog-header">
        <div class="header-icon">
          <mat-icon>account_balance_wallet</mat-icon>
        </div>
        <h2 mat-dialog-title>Record Credit Deposit</h2>
      </div>

      <mat-dialog-content class="dialog-content">
        <div class="warning-message">
          <mat-icon>info</mat-icon>
          <p>You are about to record this credit deposit. This action will permanently mark it as recorded in the financial reports.</p>
        </div>

        <div class="payment-details">
          <div class="detail-row">
            <span class="label">Member:</span>
            <span class="value">
              <strong>{{ data.memberName }}</strong>
              <small>@{{ data.memberUsername }}</small>
            </span>
          </div>

          <div class="detail-row">
            <span class="label">Amount:</span>
            <span class="value amount">₱{{ data.amount.toFixed(2) }}</span>
          </div>

          <div class="detail-row">
            <span class="label">Payment Method:</span>
            <span class="value">{{ data.paymentMethod }}</span>
          </div>

          <div class="detail-row">
            <span class="label">Request Date:</span>
            <span class="value">{{ formatDate(data.createdAt) }}</span>
          </div>
        </div>

        <div class="confirmation-note">
          <mat-icon>verified</mat-icon>
          <p>Once recorded, this deposit will appear in your financial reports and cannot be easily reversed.</p>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-actions">
        <button mat-button (click)="onCancel()" class="cancel-btn">
          <mat-icon>close</mat-icon>
          Cancel
        </button>
        <button mat-raised-button color="primary" (click)="onConfirm()" class="confirm-btn">
          <mat-icon>check_circle</mat-icon>
          Record Deposit
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .confirm-dialog {
      max-width: 500px;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 24px 24px 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      margin: -24px -24px 0;
      border-radius: 4px 4px 0 0;
    }

    .header-icon {
      width: 48px;
      height: 48px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .header-icon mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: white;
    }

    h2 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }

    .dialog-content {
      padding: 24px;
    }

    .warning-message {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 8px;
      margin-bottom: 24px;
    }

    .warning-message mat-icon {
      color: #ff9800;
      font-size: 24px;
      width: 24px;
      height: 24px;
      flex-shrink: 0;
    }

    .warning-message p {
      margin: 0;
      color: #856404;
      font-size: 14px;
      line-height: 1.5;
    }

    .payment-details {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #e9ecef;
    }

    .detail-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .detail-row:first-child {
      padding-top: 0;
    }

    .label {
      color: #6c757d;
      font-weight: 500;
      font-size: 14px;
    }

    .value {
      font-size: 14px;
      color: #212529;
      text-align: right;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
    }

    .value.amount {
      font-size: 20px;
      font-weight: 700;
      color: #10b981;
    }

    .value strong {
      font-weight: 600;
    }

    .value small {
      color: #6c757d;
      font-size: 12px;
    }

    .confirmation-note {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      background: #e7f3ff;
      border: 1px solid #3b82f6;
      border-radius: 8px;
    }

    .confirmation-note mat-icon {
      color: #3b82f6;
      font-size: 24px;
      width: 24px;
      height: 24px;
      flex-shrink: 0;
    }

    .confirmation-note p {
      margin: 0;
      color: #1e40af;
      font-size: 13px;
      line-height: 1.5;
    }

    .dialog-actions {
      padding: 16px 24px;
      margin: 0 -24px -24px;
      background: #f8f9fa;
      border-top: 1px solid #dee2e6;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    .cancel-btn {
      color: #6c757d;
    }

    .cancel-btn mat-icon,
    .confirm-btn mat-icon {
      margin-right: 8px;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .confirm-btn {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
    }

    .confirm-btn:hover {
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
    }
  `]
})
export class CreditDepositConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<CreditDepositConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CreditDepositConfirmData
  ) {}

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
