import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import {
  MatDialog,
  MatDialogModule,
  MAT_DIALOG_DATA,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface User {
  _id: string;
  fullName: string;
  username: string;
  email: string;
  membershipYearsPaid?: number[];
  lastMembershipPaymentDate?: Date;
}

interface MembershipPayment {
  _id: string;
  userId: {
    _id: string;
    fullName: string;
    username: string;
    email: string;
    membershipYearsPaid: number[];
  };
  membershipYear: number;
  amount: number;
  paymentMethod: string;
  paymentDate: Date;
  notes?: string;
  recordedBy?: {
    _id: string;
    fullName: string;
    username: string;
  };
  recordedAt: Date;
  createdAt: Date;
}

@Component({
  selector: 'app-admin-membership-payments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDialogModule,
    MatTooltipModule,
  ],
  template: `
    <div class="modern-membership-container">
      <!-- Modern Header -->
      <div class="modern-header">
        <div class="header-icon-wrapper">
          <mat-icon>card_membership</mat-icon>
        </div>
        <div class="header-text">
          <h1 class="header-title">Annual Membership Payments</h1>
          <p class="header-subtitle">
            Record and track membership fee payments for {{ currentYear }}
          </p>
        </div>
      </div>

      <!-- Content Grid -->
      <div class="modern-content-grid">
        <!-- Payment Form Card -->
        <div class="modern-form-card">
          <div class="card-header">
            <div class="card-header-icon add-icon">
              <mat-icon>add_circle</mat-icon>
            </div>
            <div class="card-header-text">
              <h2 class="card-title">Record New Payment</h2>
              <p class="card-subtitle">Add a membership fee payment for a member</p>
            </div>
          </div>

          <form [formGroup]="paymentForm" (ngSubmit)="recordPayment()" class="modern-payment-form">
            <!-- Member Selection -->
            <div class="form-group full-width">
              <label class="form-label">
                <mat-icon class="label-icon">person</mat-icon>
                <span>Select Member <span class="required-mark">*</span></span>
              </label>
              <select class="modern-select" formControlName="userId" (change)="onMemberSelected()">
                <option value="" disabled>Choose a member...</option>
                <option *ngFor="let user of members" [value]="user._id">
                  {{ user.fullName }} ({{ user.username }})
                  <span *ngIf="user.membershipYearsPaid && user.membershipYearsPaid.length > 0">
                    - Paid: {{ user.membershipYearsPaid.join(', ') }}
                  </span>
                </option>
              </select>
              <div
                class="error-message"
                *ngIf="
                  paymentForm.get('userId')?.touched &&
                  paymentForm.get('userId')?.hasError('required')
                "
              >
                <mat-icon>error</mat-icon>
                <span>Please select a member</span>
              </div>
            </div>

            <!-- Year and Amount Row -->
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">
                  <mat-icon class="label-icon">calendar_today</mat-icon>
                  <span>Membership Year <span class="required-mark">*</span></span>
                </label>
                <select class="modern-select" formControlName="membershipYear">
                  <option [value]="2024">2024</option>
                  <option [value]="2025">2025</option>
                  <option [value]="2026">2026</option>
                  <option [value]="2027">2027</option>
                  <option [value]="2028">2028</option>
                </select>
                <div
                  class="error-message"
                  *ngIf="
                    paymentForm.get('membershipYear')?.touched &&
                    paymentForm.get('membershipYear')?.hasError('required')
                  "
                >
                  <mat-icon>error</mat-icon>
                  <span>Please select a year</span>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">
                  <mat-icon class="label-icon">payments</mat-icon>
                  <span>Amount <span class="required-mark">*</span></span>
                </label>
                <div class="input-with-prefix">
                  <span class="prefix">₱</span>
                  <input
                    type="number"
                    class="modern-input with-prefix"
                    formControlName="amount"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
                <div
                  class="error-message"
                  *ngIf="
                    paymentForm.get('amount')?.touched &&
                    paymentForm.get('amount')?.hasError('required')
                  "
                >
                  <mat-icon>error</mat-icon>
                  <span>Amount is required</span>
                </div>
                <div
                  class="error-message"
                  *ngIf="
                    paymentForm.get('amount')?.touched && paymentForm.get('amount')?.hasError('min')
                  "
                >
                  <mat-icon>error</mat-icon>
                  <span>Amount cannot be negative</span>
                </div>
              </div>
            </div>

            <!-- Payment Method and Date Row -->
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">
                  <mat-icon class="label-icon">credit_card</mat-icon>
                  <span>Payment Method <span class="required-mark">*</span></span>
                </label>
                <select class="modern-select" formControlName="paymentMethod">
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="gcash">GCash</option>
                </select>
                <div
                  class="error-message"
                  *ngIf="
                    paymentForm.get('paymentMethod')?.touched &&
                    paymentForm.get('paymentMethod')?.hasError('required')
                  "
                >
                  <mat-icon>error</mat-icon>
                  <span>Please select a payment method</span>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">
                  <mat-icon class="label-icon">event</mat-icon>
                  <span>Payment Date <span class="required-mark">*</span></span>
                </label>
                <input
                  type="date"
                  class="modern-input"
                  formControlName="paymentDate"
                  [value]="formatDateForInput(paymentForm.get('paymentDate')?.value)"
                  (change)="onDateChange($event)"
                />
              </div>
            </div>

            <!-- Notes -->
            <div class="form-group full-width">
              <label class="form-label">
                <mat-icon class="label-icon">notes</mat-icon>
                <span>Notes (Optional)</span>
              </label>
              <textarea
                class="modern-textarea"
                formControlName="notes"
                rows="3"
                maxlength="500"
                placeholder="Add any additional notes..."
              ></textarea>
              <div class="char-counter">{{ paymentForm.get('notes')?.value?.length || 0 }}/500</div>
            </div>

            <!-- Form Actions -->
            <div class="form-actions">
              <button type="button" class="modern-btn cancel-btn" (click)="resetForm()">
                <mat-icon>refresh</mat-icon>
                <span>Reset</span>
              </button>
              <button
                type="submit"
                class="modern-btn submit-btn"
                [disabled]="!paymentForm.valid || isSubmitting"
                [class.submitting]="isSubmitting"
              >
                <mat-icon>{{ isSubmitting ? 'hourglass_empty' : 'save' }}</mat-icon>
                <span>{{ isSubmitting ? 'Recording...' : 'Record Payment' }}</span>
              </button>
            </div>
          </form>
        </div>

        <!-- Payment History Card -->
        <div class="modern-history-card">
          <div class="card-header">
            <div class="card-header-icon history-icon">
              <mat-icon>history</mat-icon>
            </div>
            <div class="card-header-text">
              <h2 class="card-title">Payment History</h2>
              <p class="card-subtitle">View and filter recorded payments</p>
            </div>
          </div>

          <!-- Filters -->
          <div class="modern-toolbar">
            <div class="filter-group">
              <label class="filter-label">
                <mat-icon class="label-icon">filter_list</mat-icon>
                <span>Filter by Year</span>
              </label>
              <select class="modern-select" [(ngModel)]="filterYear" (change)="loadPayments()">
                <option [value]="null">All Years</option>
                <option [value]="2024">2024</option>
                <option [value]="2025">2025</option>
                <option [value]="2026">2026</option>
                <option [value]="2027">2027</option>
                <option [value]="2028">2028</option>
              </select>
            </div>
          </div>

          <!-- Loading State -->
          <div *ngIf="isLoading" class="modern-loading">
            <mat-icon class="spin">hourglass_empty</mat-icon>
            <p class="loading-text">Loading payments...</p>
          </div>

          <!-- Payments Table -->
          <div *ngIf="!isLoading && payments.length > 0" class="payments-content">
            <div class="modern-table-wrapper">
              <table class="modern-table">
                <thead>
                  <tr>
                    <th>
                      <div class="header-content">
                        <mat-icon>person</mat-icon>
                        <span>Member</span>
                      </div>
                    </th>
                    <th>
                      <div class="header-content">
                        <mat-icon>calendar_today</mat-icon>
                        <span>Year</span>
                      </div>
                    </th>
                    <th>
                      <div class="header-content">
                        <mat-icon>payments</mat-icon>
                        <span>Amount</span>
                      </div>
                    </th>
                    <th>
                      <div class="header-content">
                        <mat-icon>credit_card</mat-icon>
                        <span>Method</span>
                      </div>
                    </th>
                    <th>
                      <div class="header-content">
                        <mat-icon>event</mat-icon>
                        <span>Date</span>
                      </div>
                    </th>
                    <th class="col-actions">
                      <div class="header-content">
                        <mat-icon>settings</mat-icon>
                        <span>Actions</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let payment of payments" class="payment-row">
                    <td>
                      <div class="member-cell">
                        <strong class="member-name">{{ payment.userId.fullName }}</strong>
                        <small class="member-username">{{ payment.userId.username }}</small>
                      </div>
                    </td>
                    <td>
                      <span class="year-badge">{{ payment.membershipYear }}</span>
                    </td>
                    <td>
                      <strong *ngIf="payment.amount > 0" class="amount-value"
                        >₱{{ payment.amount.toFixed(2) }}</strong
                      >
                      <span *ngIf="payment.amount === 0" class="waived-badge">WAIVED</span>
                    </td>
                    <td>
                      <span class="method-text">{{
                        formatPaymentMethod(payment.paymentMethod)
                      }}</span>
                    </td>
                    <td>
                      <span class="date-text">{{ payment.paymentDate | date: 'MMM d, yyyy' }}</span>
                    </td>
                    <td class="col-actions">
                      <div class="action-buttons">
                        <button
                          type="button"
                          class="action-btn edit-btn"
                          (click)="editPayment(payment)"
                          matTooltip="Edit payment"
                        >
                          <mat-icon>edit</mat-icon>
                        </button>
                        <button
                          type="button"
                          class="action-btn delete-btn"
                          (click)="deletePayment(payment)"
                          matTooltip="Delete payment"
                        >
                          <mat-icon>delete</mat-icon>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Summary Section -->
            <div class="summary-section">
              <h4 class="summary-title">Payment Summary</h4>
              <div class="summary-grid">
                <div class="summary-card">
                  <mat-icon class="summary-icon">receipt</mat-icon>
                  <div class="summary-content">
                    <p class="summary-label">Total Payments</p>
                    <p class="summary-value">{{ summary.count }}</p>
                  </div>
                </div>
                <div class="summary-card" *ngIf="summary.waivedCount > 0">
                  <mat-icon class="summary-icon">card_giftcard</mat-icon>
                  <div class="summary-content">
                    <p class="summary-label">Waived</p>
                    <p class="summary-value">{{ summary.waivedCount }}</p>
                  </div>
                </div>
                <div class="summary-card total-card">
                  <mat-icon class="summary-icon">payments</mat-icon>
                  <div class="summary-content">
                    <p class="summary-label">Total Collected</p>
                    <p class="summary-value amount">
                      ₱{{
                        summary.totalAmount.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      }}
                    </p>
                    <p class="summary-sublabel" *ngIf="summary.waivedCount > 0">
                      Excluding {{ summary.waivedCount }} waived
                    </p>
                  </div>
                </div>
                <div class="summary-card" *ngIf="summary.years.length > 0">
                  <mat-icon class="summary-icon">calendar_today</mat-icon>
                  <div class="summary-content">
                    <p class="summary-label">Years</p>
                    <p class="summary-value years">{{ summary.years.join(', ') }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div *ngIf="!isLoading && payments.length === 0" class="modern-empty-state">
            <div class="empty-illustration">
              <mat-icon>receipt_long</mat-icon>
            </div>
            <h3 class="empty-title">No Payments Found</h3>
            <p class="empty-message">
              Payments will appear here once recorded. Start by adding a new payment using the form
              on the left.
            </p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      /* Modern Membership Container */
      .modern-membership-container {
        padding: 1.5rem;
        max-width: 1600px;
        margin: 0 auto;
        background: #f8f9fa;
        min-height: calc(100vh - 100px);
        animation: fadeIn 0.3s ease;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* Modern Header */
      .modern-header {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        padding: 2rem;
        background: white;
        border-radius: 16px;
        margin-bottom: 1.5rem;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
        border-left: 6px solid #667eea;
      }

      .header-icon-wrapper {
        width: 80px;
        height: 80px;
        border-radius: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 8px 16px rgba(102, 126, 234, 0.3);
        flex-shrink: 0;

        mat-icon {
          font-size: 48px;
          width: 48px;
          height: 48px;
          color: white;
        }
      }

      .header-text {
        flex: 1;
      }

      .header-title {
        margin: 0 0 0.5rem;
        font-size: 2rem;
        font-weight: 700;
        color: #212529;
      }

      .header-subtitle {
        margin: 0;
        font-size: 1rem;
        color: #6c757d;
        line-height: 1.5;
      }

      /* Content Grid */
      .modern-content-grid {
        display: grid;
        grid-template-columns: 1fr 1.5fr;
        gap: 1.5rem;
        align-items: start;
      }

      /* Modern Cards */
      .modern-form-card,
      .modern-history-card {
        background: white;
        border-radius: 16px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
        overflow: hidden;
      }

      .card-header {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        padding: 2rem;
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        border-bottom: 2px solid #dee2e6;
      }

      .card-header-icon {
        width: 70px;
        height: 70px;
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        &.add-icon {
          background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
          box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
        }

        &.history-icon {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        mat-icon {
          font-size: 36px;
          width: 36px;
          height: 36px;
          color: white;
        }
      }

      .card-header-text {
        flex: 1;
      }

      .card-title {
        margin: 0 0 0.5rem;
        font-size: 1.5rem;
        font-weight: 600;
        color: #212529;
      }

      .card-subtitle {
        margin: 0;
        font-size: 0.95rem;
        color: #6c757d;
        line-height: 1.4;
      }

      /* Modern Payment Form */
      .modern-payment-form {
        padding: 2rem;
      }

      .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.5rem;
        margin-bottom: 1.5rem;
      }

      .form-group {
        display: flex;
        flex-direction: column;

        &.full-width {
          grid-column: 1 / -1;
        }
      }

      .form-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.95rem;
        font-weight: 600;
        color: #495057;
        margin-bottom: 0.5rem;

        .label-icon {
          font-size: 1.1rem;
          width: 1.1rem;
          height: 1.1rem;
          color: #6c757d;
        }

        .required-mark {
          color: #dc3545;
          font-weight: 700;
        }
      }

      /* Modern Inputs */
      .modern-input {
        width: 100%;
        padding: 0.875rem 1rem;
        font-size: 0.95rem;
        font-family: inherit;
        color: #495057;
        background-color: #fff;
        border: 2px solid #e0e0e0;
        border-radius: 10px;
        transition: all 0.2s ease;

        &:hover {
          border-color: #667eea;
          background-color: #f8f9fa;
        }

        &:focus {
          outline: none;
          border-color: #667eea;
          background-color: #fff;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        &.with-prefix {
          padding-left: 2.5rem;
        }

        &.input-error {
          border-color: #dc3545;

          &:focus {
            box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.1);
          }
        }

        &::placeholder {
          color: #adb5bd;
        }
      }

      /* Input with Prefix */
      .input-with-prefix {
        position: relative;

        .prefix {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          font-size: 0.95rem;
          font-weight: 600;
          color: #667eea;
          pointer-events: none;
        }
      }

      /* Modern Select */
      .modern-select {
        width: 100%;
        padding: 0.875rem 2.5rem 0.875rem 1rem;
        font-size: 0.95rem;
        font-family: inherit;
        color: #495057;
        background-color: #fff;
        background-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"><path fill="%23495057" d="M10.293 3.293L6 7.586 1.707 3.293A1 1 0 00.293 4.707l5 5a1 1 0 001.414 0l5-5a1 1 0 10-1.414-1.414z"/></svg>');
        background-repeat: no-repeat;
        background-position: right 0.75rem center;
        background-size: 12px;
        border: 2px solid #e0e0e0;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s ease;
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;

        &:hover {
          border-color: #667eea;
          background-color: #f8f9fa;
        }

        &:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        option {
          padding: 0.5rem;
          font-size: 0.95rem;
        }
      }

      /* Modern Textarea */
      .modern-textarea {
        width: 100%;
        padding: 0.875rem 1rem;
        font-size: 0.95rem;
        font-family: inherit;
        color: #495057;
        background-color: #fff;
        border: 2px solid #e0e0e0;
        border-radius: 10px;
        transition: all 0.2s ease;
        resize: vertical;
        min-height: 80px;

        &:hover {
          border-color: #667eea;
          background-color: #f8f9fa;
        }

        &:focus {
          outline: none;
          border-color: #667eea;
          background-color: #fff;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        &::placeholder {
          color: #adb5bd;
        }
      }

      /* Character Counter */
      .char-counter {
        font-size: 0.8rem;
        color: #6c757d;
        text-align: right;
        margin-top: 0.25rem;
      }

      /* Error Messages */
      .error-message {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        font-size: 0.85rem;
        color: #dc3545;
        margin-top: 0.5rem;
        animation: slideDown 0.2s ease;

        mat-icon {
          font-size: 1rem;
          width: 1rem;
          height: 1rem;
        }
      }

      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateY(-5px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* Form Actions */
      .form-actions {
        display: flex;
        gap: 1rem;
        justify-content: flex-end;
        padding-top: 1.5rem;
        border-top: 2px solid #e9ecef;
        margin-top: 1.5rem;
      }

      .modern-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.875rem 2rem;
        font-size: 0.95rem;
        font-weight: 600;
        font-family: inherit;
        border: 2px solid;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s ease;

        mat-icon {
          font-size: 1.2rem;
          width: 1.2rem;
          height: 1.2rem;
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        &:not(:disabled):active {
          transform: translateY(1px);
        }
      }

      .cancel-btn {
        background: white;
        color: #6c757d;
        border-color: #dee2e6;

        &:hover:not(:disabled) {
          background: #f8f9fa;
          border-color: #adb5bd;
          color: #495057;
          transform: translateY(-1px);
        }
      }

      .submit-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-color: #667eea;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        min-width: 200px;

        &:hover:not(:disabled) {
          background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
          box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
          transform: translateY(-2px);
        }

        &.submitting {
          mat-icon {
            animation: spin 1s linear infinite;
          }
        }
      }

      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      /* Modern Toolbar */
      .modern-toolbar {
        padding: 1.5rem 2rem;
        border-bottom: 2px solid #e9ecef;
      }

      .filter-group {
        min-width: 240px;

        .filter-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: #495057;
          margin-bottom: 0.5rem;

          .label-icon {
            font-size: 1.1rem;
            width: 1.1rem;
            height: 1.1rem;
            color: #6c757d;
          }
        }
      }

      /* Modern Loading */
      .modern-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 4rem 2rem;

        mat-icon {
          font-size: 3rem;
          width: 3rem;
          height: 3rem;
          color: #667eea;

          &.spin {
            animation: spin 2s linear infinite;
          }
        }

        .loading-text {
          margin-top: 1.5rem;
          color: #6c757d;
          font-size: 1rem;
          font-weight: 500;
        }
      }

      /* Payments Content */
      .payments-content {
        padding: 0 2rem 2rem;
      }

      /* Modern Table */
      .modern-table-wrapper {
        background: white;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        border: 1px solid #e9ecef;
        margin-bottom: 1.5rem;
      }

      .modern-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.95rem;

        thead {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-bottom: 2px solid #dee2e6;

          tr {
            th {
              padding: 1rem 1.25rem;
              text-align: left;
              font-weight: 600;
              color: #495057;
              font-size: 0.875rem;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              white-space: nowrap;

              .header-content {
                display: flex;
                align-items: center;
                gap: 0.5rem;

                mat-icon {
                  font-size: 1.1rem;
                  width: 1.1rem;
                  height: 1.1rem;
                  color: #6c757d;
                }
              }

              &.col-actions {
                text-align: center;

                .header-content {
                  justify-content: center;
                }
              }
            }
          }
        }

        tbody {
          tr.payment-row {
            border-bottom: 1px solid #e9ecef;
            transition: all 0.2s ease;

            &:hover {
              background-color: #f0f8ff;
              transform: scale(1.002);
              box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
            }

            &:last-child {
              border-bottom: none;
            }

            td {
              padding: 1rem 1.25rem;
              vertical-align: middle;
              color: #495057;

              .member-cell {
                display: flex;
                flex-direction: column;
                gap: 0.25rem;

                .member-name {
                  font-weight: 500;
                  color: #212529;
                }

                .member-username {
                  font-size: 0.85rem;
                  color: #6c757d;
                }
              }

              .year-badge {
                display: inline-block;
                padding: 0.4rem 0.875rem;
                background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
                color: #1565c0;
                border-radius: 16px;
                font-size: 0.85rem;
                font-weight: 600;
                border: 1px solid #90caf9;
              }

              .amount-value {
                font-weight: 700;
                color: #212529;
              }

              .waived-badge {
                display: inline-block;
                padding: 0.4rem 0.875rem;
                background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
                color: #2e7d32;
                border-radius: 16px;
                font-size: 0.75rem;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                border: 1px solid #81c784;
              }

              .method-text {
                color: #495057;
              }

              .date-text {
                color: #6c757d;
              }

              &.col-actions {
                .action-buttons {
                  display: flex;
                  gap: 0.5rem;
                  justify-content: center;

                  .action-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    padding: 0;
                    border: 1px solid;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    background: white;

                    mat-icon {
                      font-size: 1.1rem;
                      width: 1.1rem;
                      height: 1.1rem;
                    }

                    &.edit-btn {
                      color: #1976d2;
                      border-color: #1976d2;

                      &:hover {
                        background: #1976d2;
                        color: white;
                        transform: translateY(-2px);
                        box-shadow: 0 4px 8px rgba(25, 118, 210, 0.3);
                      }
                    }

                    &.delete-btn {
                      color: #dc3545;
                      border-color: #dc3545;

                      &:hover {
                        background: #dc3545;
                        color: white;
                        transform: translateY(-2px);
                        box-shadow: 0 4px 8px rgba(220, 53, 69, 0.3);
                      }
                    }

                    &:active {
                      transform: translateY(0);
                    }
                  }
                }
              }
            }
          }
        }
      }

      /* Summary Section */
      .summary-section {
        background: #f8f9fa;
        border-radius: 12px;
        padding: 2rem;
      }

      .summary-title {
        margin: 0 0 1.5rem;
        font-size: 1.25rem;
        font-weight: 600;
        color: #212529;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
      }

      .summary-card {
        display: flex;
        align-items: center;
        gap: 1rem;
        background: white;
        padding: 1.25rem;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        transition: all 0.2s ease;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
        }

        &.total-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;

          .summary-icon,
          .summary-label,
          .summary-value,
          .summary-sublabel {
            color: white !important;
          }
        }

        .summary-icon {
          font-size: 2.5rem;
          width: 2.5rem;
          height: 2.5rem;
          color: #667eea;
        }

        .summary-content {
          flex: 1;
        }

        .summary-label {
          margin: 0;
          font-size: 0.75rem;
          color: #6c757d;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .summary-value {
          margin: 0.25rem 0 0;
          font-size: 1.75rem;
          font-weight: 700;
          color: #212529;

          &.amount {
            font-size: 2rem;
            letter-spacing: -0.5px;
          }

          &.years {
            font-size: 1.1rem;
            font-weight: 600;
          }
        }

        .summary-sublabel {
          margin: 0.25rem 0 0;
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.8);
          font-weight: 400;
          font-style: italic;
        }
      }

      /* Modern Empty State */
      .modern-empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 4rem 2rem;
        text-align: center;

        .empty-illustration {
          margin-bottom: 1.5rem;

          mat-icon {
            font-size: 5rem;
            width: 5rem;
            height: 5rem;
            color: #e0e0e0;
          }
        }

        .empty-title {
          font-size: 1.5rem;
          color: #495057;
          margin: 0 0 0.75rem;
          font-weight: 600;
        }

        .empty-message {
          font-size: 1rem;
          color: #6c757d;
          margin: 0;
          max-width: 400px;
          line-height: 1.6;
        }
      }

      /* Responsive Design */
      @media (max-width: 1200px) {
        .modern-content-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 768px) {
        .modern-membership-container {
          padding: 1rem;
        }

        .modern-header {
          flex-direction: column;
          text-align: center;
          padding: 1.5rem;

          .header-icon-wrapper {
            width: 70px;
            height: 70px;

            mat-icon {
              font-size: 40px;
              width: 40px;
              height: 40px;
            }
          }

          .header-title {
            font-size: 1.5rem;
          }
        }

        .card-header {
          flex-direction: column;
          text-align: center;
          padding: 1.5rem;

          .card-header-icon {
            width: 60px;
            height: 60px;

            mat-icon {
              font-size: 30px;
              width: 30px;
              height: 30px;
            }
          }

          .card-title {
            font-size: 1.25rem;
          }
        }

        .modern-payment-form {
          padding: 1.5rem;
        }

        .form-row {
          grid-template-columns: 1fr;
          gap: 1.25rem;
        }

        .form-actions {
          flex-direction: column;

          .modern-btn {
            width: 100%;
            justify-content: center;
          }
        }

        .modern-toolbar {
          padding: 1rem;
        }

        .payments-content {
          padding: 0 1rem 1rem;
        }

        .modern-table-wrapper {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .modern-table {
          min-width: 800px;
        }

        .summary-section {
          padding: 1.5rem;
        }

        .summary-grid {
          grid-template-columns: 1fr;
        }
      }

      /* Print Styles */
      @media print {
        .modern-header,
        .modern-toolbar,
        .form-actions,
        .action-buttons {
          display: none !important;
        }

        .modern-table-wrapper {
          box-shadow: none !important;
          border: 1px solid #000;
        }

        .modern-table tbody tr.payment-row {
          page-break-inside: avoid;

          &:hover {
            background: white;
            transform: none;
            box-shadow: none;
          }
        }
      }
    `,
  ],
})
export class AdminMembershipPaymentsComponent implements OnInit {
  paymentForm: FormGroup;
  members: User[] = [];
  payments: MembershipPayment[] = [];
  isLoading = false;
  isSubmitting = false;
  filterYear: number | null = null;
  currentYear = new Date().getFullYear();
  displayedColumns: string[] = ['member', 'year', 'amount', 'method', 'date', 'actions'];
  summary = {
    count: 0,
    totalAmount: 0,
    waivedCount: 0,
    years: [] as number[],
  };

  private apiUrl = environment.apiUrl;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
  ) {
    this.paymentForm = this.fb.group({
      userId: ['', Validators.required],
      membershipYear: [2026, Validators.required],
      amount: [0, [Validators.required, Validators.min(0)]],
      paymentMethod: ['cash', Validators.required],
      paymentDate: [new Date(), Validators.required],
      notes: ['', Validators.maxLength(500)],
    });
  }

  ngOnInit(): void {
    this.loadMembers();
    this.loadPayments();
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }

  loadMembers(): void {
    // Request maximum allowed members (100 per page)
    // If you have more than 100 members, we'll need to implement pagination or increase backend limit
    this.http
      .get<any>(`${this.apiUrl}/members?limit=100`, { headers: this.getAuthHeaders() })
      .subscribe({
        next: (response) => {
          this.members = response.data || response;
          console.log('Loaded members:', this.members.length);

          // If we got 100 members, there might be more - load additional pages
          if (this.members.length === 100) {
            this.loadAdditionalMembers(2);
          }
        },
        error: (error) => {
          console.error('Error loading members:', error);
          this.snackBar.open('Failed to load members', 'Close', { duration: 3000 });
        },
      });
  }

  loadAdditionalMembers(page: number): void {
    this.http
      .get<any>(`${this.apiUrl}/members?limit=100&page=${page}`, { headers: this.getAuthHeaders() })
      .subscribe({
        next: (response) => {
          const additionalMembers = response.data || response;
          if (additionalMembers.length > 0) {
            this.members = [...this.members, ...additionalMembers];
            console.log('Total members loaded:', this.members.length);

            // If we got 100 more members, load next page
            if (additionalMembers.length === 100) {
              this.loadAdditionalMembers(page + 1);
            }
          }
        },
        error: (error) => {
          console.error('Error loading additional members:', error);
        },
      });
  }

  loadPayments(): void {
    this.isLoading = true;
    let url = `${this.apiUrl}/payments/membership-fees`;

    if (this.filterYear !== null) {
      url += `?year=${this.filterYear}`;
    }

    this.http.get<any>(url, { headers: this.getAuthHeaders() }).subscribe({
      next: (response) => {
        this.payments = response.data.payments || [];
        this.summary = response.data.summary || { count: 0, totalAmount: 0, years: [] };
        this.isLoading = false;
        console.log('Loaded payments:', this.payments.length);
      },
      error: (error) => {
        console.error('Error loading payments:', error);
        this.snackBar.open('Failed to load payments', 'Close', { duration: 3000 });
        this.isLoading = false;
      },
    });
  }

  onMemberSelected(): void {
    const userId = this.paymentForm.get('userId')?.value;
    const member = this.members.find((m) => m._id === userId);

    if (member && member.membershipYearsPaid && member.membershipYearsPaid.length > 0) {
      const paidYears = member.membershipYearsPaid;
      console.log(`Member has paid for years: ${paidYears.join(', ')}`);
    }
  }

  recordPayment(): void {
    if (this.paymentForm.invalid) {
      return;
    }

    this.isSubmitting = true;
    const formValue = this.paymentForm.value;
    const editingPaymentId = (this.paymentForm as any).editingPaymentId;

    // Format the payment date to ISO string
    const paymentData = {
      ...formValue,
      paymentDate:
        formValue.paymentDate instanceof Date
          ? formValue.paymentDate.toISOString()
          : formValue.paymentDate,
    };

    // Check if we're editing an existing payment
    const request = editingPaymentId
      ? this.http.patch<any>(
          `${this.apiUrl}/payments/membership-fees/${editingPaymentId}`,
          paymentData,
          { headers: this.getAuthHeaders() },
        )
      : this.http.post<any>(`${this.apiUrl}/payments/membership-fee`, paymentData, {
          headers: this.getAuthHeaders(),
        });

    request.subscribe({
      next: (response) => {
        const message = editingPaymentId
          ? 'Membership payment updated successfully'
          : 'Membership payment recorded successfully';
        this.snackBar.open(response.message || message, 'Close', { duration: 3000 });
        this.isSubmitting = false;
        this.resetForm();
        delete (this.paymentForm as any).editingPaymentId; // Clear editing state
        this.loadPayments();
        this.loadMembers(); // Reload to get updated membershipYearsPaid
      },
      error: (error) => {
        console.error('Error recording/updating payment:', error);
        const errorMessage =
          error.error?.message ||
          `Failed to ${editingPaymentId ? 'update' : 'record'} membership payment`;
        this.snackBar.open(errorMessage, 'Close', { duration: 5000 });
        this.isSubmitting = false;
      },
    });
  }

  resetForm(): void {
    this.paymentForm.reset({
      userId: '',
      membershipYear: 2026,
      amount: 0,
      paymentMethod: 'cash',
      paymentDate: new Date(),
      notes: '',
    });
  }

  formatPaymentMethod(method: string): string {
    const methodMap: { [key: string]: string } = {
      cash: 'Cash',
      bank_transfer: 'Bank Transfer',
      gcash: 'GCash',
    };
    return methodMap[method] || method;
  }

  formatDateForInput(date: any): string {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  }

  onDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const dateValue = input.value;
    if (dateValue) {
      this.paymentForm.patchValue({
        paymentDate: new Date(dateValue + 'T00:00:00'),
      });
    }
  }

  editPayment(payment: MembershipPayment): void {
    // Populate form with payment data for editing
    this.paymentForm.patchValue({
      userId: payment.userId._id,
      membershipYear: payment.membershipYear,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      paymentDate: new Date(payment.paymentDate),
      notes: payment.notes || '',
    });

    // Store the payment ID for updating
    (this.paymentForm as any).editingPaymentId = payment._id;

    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.snackBar.open(`Editing payment for ${payment.userId.fullName}`, 'Close', {
      duration: 3000,
    });
  }

  deletePayment(payment: MembershipPayment): void {
    const dialogRef = this.dialog.open(DeleteConfirmationDialog, {
      width: '500px',
      data: {
        memberName: payment.userId.fullName,
        year: payment.membershipYear,
        amount: payment.amount,
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) {
        return;
      }

      const headers = new HttpHeaders({
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      });

      this.http
        .delete(`${this.apiUrl}/payments/membership-fees/${payment._id}`, { headers })
        .subscribe({
          next: (response: any) => {
            this.snackBar.open(response.message || 'Payment deleted successfully', 'Close', {
              duration: 3000,
            });
            this.loadPayments(); // Reload the list
          },
          error: (error) => {
            console.error('Error deleting payment:', error);
            this.snackBar.open(error.error?.message || 'Failed to delete payment', 'Close', {
              duration: 5000,
            });
          },
        });
    });
  }
}

// Delete Confirmation Dialog Component
@Component({
  selector: 'delete-confirmation-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="modern-delete-dialog">
      <div class="dialog-icon-wrapper">
        <div class="icon-circle">
          <mat-icon class="warning-icon">warning</mat-icon>
        </div>
      </div>

      <h2 class="dialog-title">Delete Payment?</h2>
      <p class="dialog-message">Are you sure you want to delete this membership payment?</p>

      <div class="payment-details">
        <div class="detail-row">
          <span class="label">Member</span>
          <span class="value">{{ data.memberName }}</span>
        </div>
        <div class="detail-row">
          <span class="label">Year</span>
          <span class="value">{{ data.year }}</span>
        </div>
        <div class="detail-row">
          <span class="label">Amount</span>
          <span class="value">₱{{ data.amount.toFixed(2) }}</span>
        </div>
      </div>

      <div class="warning-banner">
        <mat-icon>error_outline</mat-icon>
        <span
          >This will remove {{ data.year }} from the member's paid years and cannot be undone.</span
        >
      </div>

      <div class="dialog-actions">
        <button type="button" class="modern-btn cancel-btn" (click)="onCancel()">
          <mat-icon>close</mat-icon>
          <span>Cancel</span>
        </button>
        <button type="button" class="modern-btn delete-btn" (click)="onConfirm()">
          <mat-icon>delete</mat-icon>
          <span>Delete Payment</span>
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .modern-delete-dialog {
        padding: 2rem;
        text-align: center;
        max-width: 500px;
      }

      .dialog-icon-wrapper {
        display: flex;
        justify-content: center;
        margin-bottom: 1.5rem;
      }

      .icon-circle {
        width: 100px;
        height: 100px;
        border-radius: 50%;
        background: linear-gradient(135deg, #fff3cd 0%, #ffe69c 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 16px rgba(255, 152, 0, 0.3);
        animation: iconPulse 2s ease-in-out infinite;
      }

      @keyframes iconPulse {
        0%,
        100% {
          box-shadow: 0 4px 16px rgba(255, 152, 0, 0.3);
        }
        50% {
          box-shadow: 0 8px 24px rgba(255, 152, 0, 0.5);
        }
      }

      .warning-icon {
        font-size: 60px;
        width: 60px;
        height: 60px;
        color: #ff9800;
      }

      .dialog-title {
        margin: 0 0 0.75rem;
        font-size: 1.75rem;
        font-weight: 700;
        color: #212529;
      }

      .dialog-message {
        margin: 0 0 1.5rem;
        font-size: 1rem;
        color: #6c757d;
        line-height: 1.5;
      }

      .payment-details {
        background: #f8f9fa;
        border-radius: 12px;
        padding: 1.25rem;
        margin-bottom: 1.5rem;
        text-align: left;
      }

      .detail-row {
        display: flex;
        justify-content: space-between;
        padding: 0.75rem 0;
        border-bottom: 1px solid #e9ecef;

        &:last-child {
          border-bottom: none;
        }
      }

      .label {
        font-weight: 600;
        color: #6c757d;
        font-size: 0.9rem;
      }

      .value {
        font-weight: 600;
        color: #212529;
        font-size: 0.95rem;
      }

      .warning-banner {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        background: #fff3cd;
        border-left: 4px solid #ff9800;
        padding: 1rem;
        border-radius: 8px;
        color: #856404;
        font-size: 0.9rem;
        margin-bottom: 1.5rem;
        text-align: left;

        mat-icon {
          font-size: 1.5rem;
          width: 1.5rem;
          height: 1.5rem;
          color: #ff9800;
          flex-shrink: 0;
        }
      }

      .dialog-actions {
        display: flex;
        gap: 1rem;
        justify-content: center;
      }

      .modern-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.875rem 2rem;
        font-size: 0.95rem;
        font-weight: 600;
        font-family: inherit;
        border: 2px solid;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s ease;
        min-width: 160px;
        justify-content: center;

        mat-icon {
          font-size: 1.2rem;
          width: 1.2rem;
          height: 1.2rem;
        }

        &:active {
          transform: translateY(1px);
        }
      }

      .cancel-btn {
        background: white;
        color: #6c757d;
        border-color: #dee2e6;

        &:hover {
          background: #f8f9fa;
          border-color: #adb5bd;
          color: #495057;
          transform: translateY(-1px);
        }
      }

      .delete-btn {
        background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
        color: white;
        border-color: #dc3545;
        box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);

        &:hover {
          background: linear-gradient(135deg, #c82333 0%, #bd2130 100%);
          box-shadow: 0 6px 16px rgba(220, 53, 69, 0.4);
          transform: translateY(-2px);
        }
      }
    `,
  ],
})
export class DeleteConfirmationDialog {
  constructor(
    public dialogRef: MatDialogRef<DeleteConfirmationDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { memberName: string; year: number; amount: number },
  ) {}

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
