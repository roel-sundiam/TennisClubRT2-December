import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatNativeDateModule } from '@angular/material/core';
import { FormsModule } from '@angular/forms';

export interface PaymentConfirmationData {
  action: 'approve' | 'record' | 'cancel' | 'fail' | 'complete';
  paymentId: string;
  referenceNumber: string;
  memberName: string;
  amount: number;
  paymentMethod: string;
  reservationDate: string;
  timeSlot: string;
  existingPaymentDate?: string;
}

export interface PaymentConfirmationResult {
  confirmed: boolean;
  paymentDate?: Date;
}

@Component({
  selector: 'app-payment-confirmation-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatInputModule,
    MatFormFieldModule,
    MatNativeDateModule,
    FormsModule
  ],
  template: `
    <div class="confirmation-dialog" [ngClass]="getActionClass()">
      <div class="dialog-header" mat-dialog-title>
        <div class="header-icon">
          <mat-icon>{{getActionIcon()}}</mat-icon>
        </div>
        <div class="header-copy">
          <span class="eyebrow">Payment workflow</span>
          <h2>{{getActionTitle()}}</h2>
        </div>
      </div>

      <div mat-dialog-content class="dialog-content">
        <p class="confirmation-message">{{getConfirmationMessage()}}</p>

        <div class="payment-details">
          <div class="details-heading">
            <span>Payment summary</span>
            <strong>&#8369;{{data.amount.toFixed(2)}}</strong>
          </div>

          <div class="detail-row">
            <span class="detail-label">Payment Reference</span>
            <span class="detail-value">{{data.referenceNumber}}</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">Member</span>
            <span class="detail-value">{{data.memberName}}</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">Amount</span>
            <span class="detail-value amount">&#8369;{{data.amount.toFixed(2)}}</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">Payment Method</span>
            <span class="detail-value">{{formatPaymentMethod(data.paymentMethod)}}</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">Reservation</span>
            <span class="detail-value">{{data.reservationDate}} at {{data.timeSlot}}</span>
          </div>
        </div>

        <div class="payment-date-section" *ngIf="data.action === 'record'">
          <div class="section-label">
            <mat-icon>event</mat-icon>
            <span>Statement date</span>
          </div>

          <mat-form-field appearance="fill" class="payment-date-field">
            <mat-label>Payment Date</mat-label>
            <input matInput [matDatepicker]="picker" [(ngModel)]="selectedPaymentDate" required>
            <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
            <mat-datepicker #picker></mat-datepicker>
            <mat-hint>Choose which year this payment should appear in.</mat-hint>
          </mat-form-field>
        </div>

        <div class="warning-message" *ngIf="data.action === 'record'">
          <mat-icon>info</mat-icon>
          <span>The payment will appear in the financial statement for the year of the Payment Date selected above.</span>
        </div>

        <div class="warning-message danger-message" *ngIf="data.action === 'cancel'">
          <mat-icon>warning</mat-icon>
          <span>This payment will be set to pending status. The member will need to pay again.</span>
        </div>

        <div class="warning-message danger-message" *ngIf="data.action === 'fail'">
          <mat-icon>error</mat-icon>
          <span>This payment will be marked as failed and moved to the Archived Payments tab. This indicates the payment processing failed.</span>
        </div>

        <div class="warning-message success-message" *ngIf="data.action === 'complete'">
          <mat-icon>check_circle</mat-icon>
          <span>This payment will be marked as completed and moved back to the Active Payments tab.</span>
        </div>
      </div>

      <div mat-dialog-actions class="dialog-actions">
        <button mat-stroked-button (click)="onCancel()" class="cancel-button">
          <mat-icon>close</mat-icon>
          Cancel
        </button>
        <button
          mat-raised-button
          [color]="getConfirmButtonColor()"
          (click)="onConfirm()"
          class="confirm-button">
          <mat-icon>{{getActionIcon()}}</mat-icon>
          {{getActionTitle()}}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .confirmation-dialog {
      width: 100%;
      max-width: 500px;
      box-sizing: border-box;
      overflow: hidden;
      background: #ffffff;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: -24px -24px 0;
      padding: 18px 20px;
      background: linear-gradient(135deg, #0f766e 0%, #14532d 100%);
      color: #ffffff;
      border-bottom: 1px solid rgba(255, 255, 255, 0.18);
    }

    .approve-action .dialog-header,
    .complete-action .dialog-header {
      background: linear-gradient(135deg, #0f766e 0%, #1d4ed8 100%);
    }

    .cancel-action .dialog-header,
    .fail-action .dialog-header {
      background: linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%);
    }

    .header-icon {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      flex: 0 0 44px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.16);
      border: 1px solid rgba(255, 255, 255, 0.28);
    }

    .header-icon mat-icon {
      font-size: 26px;
      width: 26px;
      height: 26px;
    }

    .header-copy {
      min-width: 0;
    }

    .eyebrow {
      display: block;
      margin-bottom: 2px;
      color: rgba(255, 255, 255, 0.78);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    h2 {
      margin: 0;
      color: #ffffff;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 0;
    }

    .dialog-content {
      padding: 18px 0 14px;
      color: #111827;
      overflow-x: hidden;
    }

    .confirmation-message {
      margin: 0 0 14px;
      color: #374151;
      font-size: 14px;
      line-height: 1.45;
    }

    .payment-details {
      overflow: hidden;
      margin-bottom: 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }

    .details-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
    }

    .details-heading span {
      color: #475569;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    .details-heading strong {
      color: #0f766e;
      font-size: 18px;
      font-weight: 800;
      white-space: nowrap;
    }

    .detail-row {
      display: grid;
      grid-template-columns: minmax(130px, 0.42fr) minmax(0, 1fr);
      gap: 12px;
      align-items: start;
      padding: 10px 14px;
      border-bottom: 1px solid #e2e8f0;
    }

    .detail-row:last-child {
      border-bottom: none;
    }

    .detail-label {
      color: #64748b;
      font-size: 13px;
      font-weight: 700;
    }

    .detail-value {
      min-width: 0;
      overflow-wrap: anywhere;
      color: #111827;
      font-size: 13px;
      font-weight: 800;
      text-align: right;
    }

    .detail-value.amount {
      color: #0f766e;
      font-size: 14px;
    }

    .payment-date-section {
      margin: 14px 0;
      padding: 12px 14px 8px;
      background: #ffffff;
      border: 1px solid #dbeafe;
      border-radius: 8px;
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
    }

    .section-label {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      color: #0f766e;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    .section-label mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .payment-date-field {
      width: 100%;
    }

    .warning-message {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      background: #fff7ed;
      border: 1px solid #fed7aa;
      border-radius: 8px;
      color: #9a3412;
      font-size: 13px;
      line-height: 1.45;
    }

    .warning-message mat-icon {
      flex: 0 0 auto;
      color: #ea580c;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .danger-message {
      background: #fef2f2;
      border-color: #fecaca;
      color: #991b1b;
    }

    .danger-message mat-icon {
      color: #dc2626;
    }

    .success-message {
      background: #ecfdf5;
      border-color: #a7f3d0;
      color: #047857;
    }

    .success-message mat-icon {
      color: #059669;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin: 0 -24px -24px;
      padding: 12px 20px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }

    .cancel-button {
      min-height: 40px;
      border-color: #cbd5e1;
      color: #475569;
      font-weight: 700;
    }

    .cancel-button:hover {
      background-color: #f1f5f9;
    }

    .confirm-button {
      min-width: 148px;
      min-height: 40px;
      border-radius: 6px;
      font-weight: 800;
      box-shadow: 0 10px 22px rgba(15, 118, 110, 0.24);
    }

    .cancel-button mat-icon,
    .confirm-button mat-icon {
      margin-right: 4px;
    }

    :host ::ng-deep .payment-date-field .mat-mdc-text-field-wrapper {
      border-radius: 8px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
    }

    :host ::ng-deep .payment-date-field .mat-mdc-form-field-focus-overlay {
      background: transparent;
    }

    :host ::ng-deep .payment-date-field .mdc-line-ripple {
      display: none;
    }

    :host ::ng-deep .payment-date-field .mat-mdc-form-field-subscript-wrapper {
      padding: 0 4px;
      color: #64748b;
    }

    @media (max-width: 600px) {
      .confirmation-dialog {
        width: 100%;
        max-width: none;
      }

      .dialog-header {
        padding: 16px;
      }

      h2 {
        font-size: 22px;
      }

      .detail-row {
        grid-template-columns: 1fr;
        gap: 4px;
      }

      .detail-value {
        text-align: left;
      }

      .dialog-actions {
        flex-direction: column-reverse;
        gap: 8px;
      }

      .cancel-button,
      .confirm-button {
        width: 100%;
      }
    }
  `]
})
export class PaymentConfirmationDialogComponent {
  selectedPaymentDate: Date;

  constructor(
    public dialogRef: MatDialogRef<PaymentConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: PaymentConfirmationData
  ) {
    this.selectedPaymentDate = data.existingPaymentDate
      ? new Date(data.existingPaymentDate)
      : new Date('2026-01-01');
  }

  getActionTitle(): string {
    if (this.data.action === 'approve') return 'Approve Payment';
    if (this.data.action === 'cancel') return 'Set to Pending';
    if (this.data.action === 'fail') return 'Mark as Failed';
    if (this.data.action === 'complete') return 'Mark as Completed';
    return 'Record Payment';
  }

  getConfirmationMessage(): string {
    if (this.data.action === 'approve') {
      return 'Review and approve this payment so it can move forward for recording.';
    } else if (this.data.action === 'cancel') {
      return 'Move this payment back to pending status. The member will need to pay again.';
    } else if (this.data.action === 'fail') {
      return 'Mark this payment as failed when the payment process did not complete successfully.';
    } else if (this.data.action === 'complete') {
      return 'Mark this payment as completed and move it back to the Active Payments tab.';
    } else {
      return 'Record this payment as fully processed in the system.';
    }
  }

  getActionIcon(): string {
    if (this.data.action === 'approve' || this.data.action === 'complete') return 'check_circle';
    if (this.data.action === 'cancel') return 'cancel';
    if (this.data.action === 'fail') return 'error';
    return 'verified';
  }

  getActionClass(): string {
    return `${this.data.action}-action`;
  }

  getConfirmButtonColor(): string {
    if (this.data.action === 'approve' || this.data.action === 'complete') return 'primary';
    if (this.data.action === 'cancel' || this.data.action === 'fail') return 'warn';
    return 'accent';
  }

  formatPaymentMethod(method: string): string {
    const methodMap: {[key: string]: string} = {
      cash: 'Cash',
      bank_transfer: 'Bank Transfer',
      gcash: 'GCash',
      coins: 'Coins'
    };
    return methodMap[method] || method;
  }

  onCancel(): void {
    this.dialogRef.close({ confirmed: false });
  }

  onConfirm(): void {
    this.dialogRef.close({
      confirmed: true,
      paymentDate: this.data.action === 'record' ? this.selectedPaymentDate : undefined
    });
  }
}
