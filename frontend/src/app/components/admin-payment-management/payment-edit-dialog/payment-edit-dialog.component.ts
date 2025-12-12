import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpClient, HttpHeaders } from '@angular/common/http';

export interface PaymentEditDialogData {
  payment: any;
}

@Component({
  selector: 'app-payment-edit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="header-content">
          <mat-icon>edit_note</mat-icon>
          <h2>Edit Payment</h2>
        </div>
        <button mat-icon-button (click)="onCancel()" [disabled]="isSubmitting">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-dialog-content>
        <div class="payment-info">
          <div class="info-item">
            <span class="label">Reference</span>
            <span class="value">{{ data.payment.referenceNumber }}</span>
          </div>
          <div class="info-item">
            <span class="label">User</span>
            <span class="value">{{ data.payment.userId.fullName }} <span class="username">@{{ data.payment.userId.username }}</span></span>
          </div>
        </div>

        <form [formGroup]="editForm" class="edit-form">
          <div class="form-row-grid">
            <mat-form-field appearance="outline">
              <mat-label>Amount</mat-label>
              <input matInput type="number" formControlName="amount" min="0.01" step="0.01">
              <span matPrefix>₱&nbsp;</span>
              <mat-error *ngIf="editForm.get('amount')?.hasError('required')">Required</mat-error>
              <mat-error *ngIf="editForm.get('amount')?.hasError('min')">Must be > 0</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Payment Method</mat-label>
              <mat-select formControlName="paymentMethod">
                <mat-option value="cash">Cash</mat-option>
                <mat-option value="bank_transfer">Bank Transfer</mat-option>
                <mat-option value="gcash">GCash</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <div class="form-row-grid">
            <mat-form-field appearance="outline">
              <mat-label>Status</mat-label>
              <mat-select formControlName="status">
                <mat-option value="pending">Pending</mat-option>
                <mat-option value="completed">Completed</mat-option>
                <mat-option value="failed">Failed</mat-option>
                <mat-option value="refunded">Refunded</mat-option>
              </mat-select>
              <mat-hint>Cannot set to "Recorded"</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Payment Date</mat-label>
              <input matInput [matDatepicker]="picker" formControlName="paymentDate">
              <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
              <mat-datepicker #picker></mat-datepicker>
              <mat-hint>Optional</mat-hint>
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Transaction ID</mat-label>
            <input matInput formControlName="transactionId" placeholder="Optional">
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Admin Notes</mat-label>
            <textarea matInput formControlName="notes" rows="3" maxlength="500" placeholder="Add a note about this change"></textarea>
            <mat-hint align="end">{{ editForm.get('notes')?.value?.length || 0 }}/500</mat-hint>
          </mat-form-field>
        </form>
      </mat-dialog-content>

      <mat-dialog-actions>
        <button mat-stroked-button (click)="onCancel()" [disabled]="isSubmitting">
          Cancel
        </button>
        <button mat-flat-button color="primary" (click)="onSave()" [disabled]="editForm.invalid || isSubmitting">
          <mat-spinner *ngIf="isSubmitting" diameter="18"></mat-spinner>
          <span *ngIf="!isSubmitting">Save Changes</span>
          <span *ngIf="isSubmitting">Saving...</span>
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-container {
      min-width: 560px;
      max-width: 600px;
      background: white;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 24px 28px;
      border-bottom: none;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      position: relative;
      overflow: hidden;

      &::before {
        content: '';
        position: absolute;
        top: -50%;
        right: -10%;
        width: 200px;
        height: 200px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 50%;
      }

      .header-content {
        display: flex;
        align-items: center;
        gap: 14px;
        position: relative;
        z-index: 1;

        mat-icon {
          color: white;
          font-size: 28px;
          width: 28px;
          height: 28px;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
        }

        h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: white;
          letter-spacing: 0.3px;
        }
      }

      button[mat-icon-button] {
        position: relative;
        z-index: 1;

        mat-icon {
          color: rgba(255, 255, 255, 0.9);
          font-size: 22px;
          width: 22px;
          height: 22px;
        }

        &:hover mat-icon {
          color: white;
        }
      }
    }

    mat-dialog-content {
      padding: 28px;
      max-height: 520px;
      overflow-y: auto;
      background: #fafbfc;
    }

    .payment-info {
      background: white;
      padding: 18px 20px;
      border-radius: 10px;
      margin-bottom: 24px;
      border: 1px solid #e5e7eb;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);

      .info-item {
        display: flex;
        align-items: baseline;
        gap: 16px;
        padding: 8px 0;

        &:first-child {
          padding-top: 0;
        }

        &:last-child {
          padding-bottom: 0;
          margin-bottom: 0;
        }

        &:not(:last-child) {
          border-bottom: 1px solid #f3f4f6;
        }

        .label {
          font-size: 11px;
          color: #6b7280;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          min-width: 85px;
        }

        .value {
          font-size: 14px;
          color: #111827;
          font-weight: 500;
          flex: 1;

          .username {
            color: #9ca3af;
            font-weight: 400;
            font-size: 13px;
          }
        }
      }
    }

    .edit-form {
      display: flex;
      flex-direction: column;
      gap: 18px;
      background: white;
      padding: 20px;
      border-radius: 10px;
      border: 1px solid #e5e7eb;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .form-row-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .full-width {
      width: 100%;
    }

    mat-form-field {
      font-size: 14px;

      ::ng-deep {
        .mat-mdc-form-field-subscript-wrapper {
          font-size: 11px;
        }

        .mat-mdc-text-field-wrapper {
          padding-bottom: 0;
        }

        .mat-mdc-form-field-focus-overlay {
          background-color: transparent;
        }

        .mdc-text-field--outlined {
          &:not(.mdc-text-field--disabled) {
            .mdc-notched-outline__leading,
            .mdc-notched-outline__notch,
            .mdc-notched-outline__trailing {
              border-color: #e5e7eb;
            }

            &:hover .mdc-notched-outline {
              .mdc-notched-outline__leading,
              .mdc-notched-outline__notch,
              .mdc-notched-outline__trailing {
                border-color: #d1d5db;
              }
            }
          }

          &.mdc-text-field--focused {
            .mdc-notched-outline__leading,
            .mdc-notched-outline__notch,
            .mdc-notched-outline__trailing {
              border-color: #667eea !important;
              border-width: 2px !important;
            }
          }
        }

        .mat-mdc-select-arrow {
          color: #6b7280;
        }
      }
    }

    mat-dialog-actions {
      padding: 20px 28px;
      border-top: 1px solid #e5e7eb;
      gap: 10px;
      display: flex;
      justify-content: flex-end;
      background: white;

      button {
        min-width: 110px;
        height: 40px;
        font-size: 14px;
        font-weight: 600;
        border-radius: 8px;
        text-transform: none;
        letter-spacing: 0.3px;
      }

      button[mat-stroked-button] {
        color: #6b7280;
        border-color: #d1d5db;
        border-width: 1.5px;

        &:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }
      }

      button[mat-flat-button] {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);

        &:hover {
          box-shadow: 0 4px 8px rgba(102, 126, 234, 0.4);
          transform: translateY(-1px);
        }

        &:disabled {
          background: #e5e7eb;
          color: #9ca3af;
          box-shadow: none;
        }
      }
    }

    mat-spinner {
      margin: 0;
      display: inline-block;
      margin-right: 8px;

      ::ng-deep circle {
        stroke: white;
      }
    }

    @media (max-width: 600px) {
      .dialog-container {
        min-width: auto;
        width: 100%;
      }

      .dialog-header {
        padding: 20px 20px;
      }

      mat-dialog-content {
        padding: 20px;
      }

      .form-row-grid {
        grid-template-columns: 1fr;
      }

      mat-dialog-actions {
        padding: 16px 20px;

        button {
          min-width: 90px;
          font-size: 13px;
        }
      }
    }
  `]
})
export class PaymentEditDialogComponent implements OnInit {
  private apiUrl = 'http://localhost:3000/api';
  editForm: FormGroup;
  isSubmitting = false;

  constructor(
    public dialogRef: MatDialogRef<PaymentEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: PaymentEditDialogData,
    private fb: FormBuilder,
    private http: HttpClient,
    private snackBar: MatSnackBar
  ) {
    this.editForm = this.fb.group({
      amount: [data.payment.amount, [Validators.required, Validators.min(0.01)]],
      paymentMethod: [data.payment.paymentMethod, Validators.required],
      status: [data.payment.status, Validators.required],
      paymentDate: [data.payment.paymentDate ? new Date(data.payment.paymentDate) : null],
      transactionId: [data.payment.transactionId || ''],
      notes: ['', Validators.maxLength(500)]
    });
  }

  ngOnInit(): void {
    // Disable status field if payment is recorded
    if (this.data.payment.status === 'record') {
      this.editForm.get('status')?.disable();
    }
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  onSave(): void {
    if (this.editForm.invalid) {
      return;
    }

    this.isSubmitting = true;

    // Use getRawValue to get all values including disabled fields
    const formValue = this.editForm.getRawValue();

    const updateData: any = {
      customAmount: formValue.amount,
      paymentMethod: formValue.paymentMethod,
      status: formValue.status,
      transactionId: formValue.transactionId
    };

    // Only include paymentDate if it's set
    if (formValue.paymentDate) {
      updateData.paymentDate = formValue.paymentDate;
    }

    // Only include notes if provided
    if (formValue.notes && formValue.notes.trim()) {
      updateData.notes = formValue.notes.trim();
    }

    this.http.put<any>(
      `${this.apiUrl}/payments/${this.data.payment._id}`,
      updateData,
      { headers: this.getAuthHeaders() }
    ).subscribe({
      next: (response) => {
        this.snackBar.open('Payment updated successfully', 'Close', { duration: 3000 });
        this.isSubmitting = false;
        this.dialogRef.close({ updated: true });
      },
      error: (error) => {
        this.snackBar.open(
          error.error?.message || error.error?.error || 'Failed to update payment',
          'Close',
          { duration: 5000 }
        );
        this.isSubmitting = false;
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
