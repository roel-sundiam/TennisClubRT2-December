import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
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
import { HttpClient, HttpHeaders } from '@angular/common/http';

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
    MatNativeDateModule
  ],
  template: `
    <div class="membership-payments-container">
      <!-- Header Section -->
      <div class="page-header">
        <div class="header-content">
          <div class="header-icon">
            <mat-icon>card_membership</mat-icon>
          </div>
          <div class="header-text">
            <h1>Annual Membership Payments</h1>
            <p>Record and track membership fee payments for {{ currentYear }}</p>
          </div>
        </div>
      </div>

      <!-- Main Content Grid -->
      <div class="content-grid">
        <!-- Left Column: Payment Form -->
        <mat-card class="form-card">
          <mat-card-header>
            <div class="card-header-content">
              <mat-icon class="card-icon">add_circle</mat-icon>
              <div>
                <mat-card-title>Record New Payment</mat-card-title>
                <mat-card-subtitle>Add a membership fee payment for a member</mat-card-subtitle>
              </div>
            </div>
          </mat-card-header>
          <mat-card-content>
            <form [formGroup]="paymentForm" (ngSubmit)="recordPayment()" class="modern-form">
              <div class="form-row">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Select Member</mat-label>
                  <mat-select formControlName="userId" (selectionChange)="onMemberSelected()">
                    <mat-option *ngFor="let user of members" [value]="user._id">
                      {{ user.fullName }} ({{ user.username }})
                      <span *ngIf="user.membershipYearsPaid && user.membershipYearsPaid.length > 0" class="years-paid">
                        - Paid: {{ user.membershipYearsPaid.join(', ') }}
                      </span>
                    </mat-option>
                  </mat-select>
                  <mat-error *ngIf="paymentForm.get('userId')?.hasError('required')">
                    Please select a member
                  </mat-error>
                </mat-form-field>
              </div>

              <div class="form-row">
                <mat-form-field appearance="outline" class="half-width">
                  <mat-label>Membership Year</mat-label>
                  <mat-select formControlName="membershipYear">
                    <mat-option [value]="2024">2024</mat-option>
                    <mat-option [value]="2025">2025</mat-option>
                    <mat-option [value]="2026">2026</mat-option>
                    <mat-option [value]="2027">2027</mat-option>
                    <mat-option [value]="2028">2028</mat-option>
                  </mat-select>
                  <mat-error *ngIf="paymentForm.get('membershipYear')?.hasError('required')">
                    Please select a year
                  </mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline" class="half-width">
                  <mat-label>Amount (₱)</mat-label>
                  <input matInput type="number" formControlName="amount" min="0" step="0.01">
                  <mat-error *ngIf="paymentForm.get('amount')?.hasError('required')">
                    Amount is required
                  </mat-error>
                  <mat-error *ngIf="paymentForm.get('amount')?.hasError('min')">
                    Amount must be greater than 0
                  </mat-error>
                </mat-form-field>
              </div>

              <div class="form-row">
                <mat-form-field appearance="outline" class="half-width">
                  <mat-label>Payment Method</mat-label>
                  <mat-select formControlName="paymentMethod">
                    <mat-option value="cash">Cash</mat-option>
                    <mat-option value="bank_transfer">Bank Transfer</mat-option>
                    <mat-option value="gcash">GCash</mat-option>
                  </mat-select>
                  <mat-error *ngIf="paymentForm.get('paymentMethod')?.hasError('required')">
                    Please select a payment method
                  </mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline" class="half-width">
                  <mat-label>Payment Date</mat-label>
                  <input matInput [matDatepicker]="picker" formControlName="paymentDate">
                  <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
                  <mat-datepicker #picker></mat-datepicker>
                </mat-form-field>
              </div>

              <div class="form-row">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Notes (Optional)</mat-label>
                  <textarea matInput formControlName="notes" rows="3" maxlength="500"></textarea>
                  <mat-hint align="end">{{ paymentForm.get('notes')?.value?.length || 0 }}/500</mat-hint>
                </mat-form-field>
              </div>

              <div class="form-actions">
                <button mat-raised-button color="primary" type="submit" [disabled]="!paymentForm.valid || isSubmitting" class="submit-btn">
                  <mat-icon>{{ isSubmitting ? 'hourglass_empty' : 'save' }}</mat-icon>
                  <span>{{ isSubmitting ? 'Recording...' : 'Record Payment' }}</span>
                </button>
                <button mat-stroked-button type="button" (click)="resetForm()" class="reset-btn">
                  <mat-icon>refresh</mat-icon>
                  <span>Reset</span>
                </button>
              </div>
            </form>
          </mat-card-content>
        </mat-card>

        <!-- Right Column: Payment History -->
        <mat-card class="history-card">
          <mat-card-header>
            <div class="card-header-content">
              <mat-icon class="card-icon">history</mat-icon>
              <div>
                <mat-card-title>Payment History</mat-card-title>
                <mat-card-subtitle>View and filter recorded payments</mat-card-subtitle>
              </div>
            </div>
          </mat-card-header>
          <mat-card-content>

            <!-- Filters -->
            <div class="filters">
              <mat-form-field appearance="outline">
                <mat-label>Filter by Year</mat-label>
                <mat-select [(ngModel)]="filterYear" (selectionChange)="loadPayments()">
                  <mat-option [value]="null">All Years</mat-option>
                  <mat-option [value]="2024">2024</mat-option>
                  <mat-option [value]="2025">2025</mat-option>
                  <mat-option [value]="2026">2026</mat-option>
                  <mat-option [value]="2027">2027</mat-option>
                  <mat-option [value]="2028">2028</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <!-- Loading Spinner -->
            <div *ngIf="isLoading" class="loading-spinner">
              <mat-spinner diameter="50"></mat-spinner>
              <p>Loading payments...</p>
            </div>

            <!-- Payments Table -->
            <div *ngIf="!isLoading && payments.length > 0" class="table-container">
              <table mat-table [dataSource]="payments" class="payments-table">
                <!-- Member Column -->
                <ng-container matColumnDef="member">
                  <th mat-header-cell *matHeaderCellDef>Member</th>
                  <td mat-cell *matCellDef="let payment">
                    {{ payment.userId.fullName }}<br>
                    <small class="text-muted">{{ payment.userId.username }}</small>
                  </td>
                </ng-container>

                <!-- Year Column -->
                <ng-container matColumnDef="year">
                  <th mat-header-cell *matHeaderCellDef>Year</th>
                  <td mat-cell *matCellDef="let payment">
                    <strong>{{ payment.membershipYear }}</strong>
                  </td>
                </ng-container>

                <!-- Amount Column -->
                <ng-container matColumnDef="amount">
                  <th mat-header-cell *matHeaderCellDef>Amount</th>
                  <td mat-cell *matCellDef="let payment">
                    <strong>₱{{ payment.amount.toFixed(2) }}</strong>
                  </td>
                </ng-container>

                <!-- Payment Method Column -->
                <ng-container matColumnDef="method">
                  <th mat-header-cell *matHeaderCellDef>Method</th>
                  <td mat-cell *matCellDef="let payment">
                    {{ formatPaymentMethod(payment.paymentMethod) }}
                  </td>
                </ng-container>

                <!-- Payment Date Column -->
                <ng-container matColumnDef="date">
                  <th mat-header-cell *matHeaderCellDef>Payment Date</th>
                  <td mat-cell *matCellDef="let payment">
                    {{ payment.paymentDate | date:'MMM d, yyyy' }}
                  </td>
                </ng-container>

                <!-- Recorded By Column -->
                <ng-container matColumnDef="recordedBy">
                  <th mat-header-cell *matHeaderCellDef>Recorded By</th>
                  <td mat-cell *matCellDef="let payment">
                    {{ payment.recordedBy?.fullName || 'Unknown' }}<br>
                    <small class="text-muted">{{ payment.recordedAt | date:'short' }}</small>
                  </td>
                </ng-container>

                <!-- Notes Column -->
                <ng-container matColumnDef="notes">
                  <th mat-header-cell *matHeaderCellDef>Notes</th>
                  <td mat-cell *matCellDef="let payment">
                    <span class="notes-text">{{ payment.notes || '-' }}</span>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
              </table>

              <!-- Summary -->
              <div class="summary-section">
                <h4>Summary</h4>
                <p><strong>Total Payments:</strong> {{ summary.count }}</p>
                <p><strong>Total Amount:</strong> ₱{{ summary.totalAmount.toFixed(2) }}</p>
                <p *ngIf="summary.years.length > 0"><strong>Years:</strong> {{ summary.years.join(', ') }}</p>
              </div>
            </div>

            <!-- No Data -->
            <div *ngIf="!isLoading && payments.length === 0" class="no-data">
              <mat-icon>receipt_long</mat-icon>
              <p>No membership payments found</p>
              <small>Payments will appear here once recorded</small>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    /* Container & Layout */
    .membership-payments-container {
      padding: 24px;
      max-width: 1600px;
      margin: 0 auto;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
    }

    /* Page Header */
    .page-header {
      background: white;
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 24px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    }

    .header-content {
      display: flex;
      align-items: center;
      gap: 24px;
    }

    .header-icon {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      width: 80px;
      height: 80px;
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 16px rgba(102, 126, 234, 0.3);
    }

    .header-icon mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
    }

    .header-text h1 {
      margin: 0 0 8px 0;
      font-size: 32px;
      font-weight: 700;
      color: #2d3748;
    }

    .header-text p {
      margin: 0;
      font-size: 16px;
      color: #718096;
    }

    /* Content Grid */
    .content-grid {
      display: grid;
      grid-template-columns: 1fr 1.5fr;
      gap: 24px;
      align-items: start;
    }

    .form-row {
      display: flex;
      gap: 16px;
      margin-bottom: 8px;
    }

    .full-width {
      width: 100%;
    }

    .half-width {
      flex: 1;
    }

    .form-actions {
      display: flex;
      gap: 12px;
      margin-top: 16px;
    }

    .payment-history-section {
      margin-top: 30px;
    }

    .payment-history-section h3 {
      margin-bottom: 20px;
      color: #1976d2;
    }

    .filters {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
    }

    .filters mat-form-field {
      width: 200px;
    }

    .loading-spinner {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
    }

    .loading-spinner p {
      margin-top: 16px;
      color: #666;
    }

    .table-container {
      overflow-x: auto;
      margin-top: 20px;
    }

    .payments-table {
      width: 100%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .payments-table th {
      background-color: #f5f5f5;
      font-weight: 600;
    }

    .text-muted {
      color: #666;
      font-size: 0.85em;
    }

    .years-paid {
      color: #4caf50;
      font-size: 0.85em;
      margin-left: 8px;
    }

    .notes-text {
      display: block;
      max-width: 200px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .summary-section {
      margin-top: 24px;
      padding: 16px;
      background: #e3f2fd;
      border-radius: 8px;
    }

    /* Modern Cards */
    .form-card, .history-card {
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      border: none;
      height: fit-content;
    }

    .card-header-content {
      display: flex;
      align-items: center;
      gap: 16px;
      width: 100%;
    }

    .card-icon {
      color: #667eea;
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    /* Modern Form */
    .modern-form {
      margin-top: 16px;
    }

    .form-actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
    }

    .submit-btn {
      flex: 1;
      height: 48px;
      font-size: 16px;
      font-weight: 600;
      border-radius: 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .submit-btn:disabled {
      background: #e2e8f0;
      color: #a0aec0;
    }

    .reset-btn {
      height: 48px;
      border-radius: 12px;
      border: 2px solid #e2e8f0;
    }

    /* Table Styles */
    .payments-table {
      width: 100%;
      border-radius: 12px;
      overflow: hidden;
    }

    .payments-table th {
      background: #f7fafc;
      color: #2d3748;
      font-weight: 600;
      padding: 16px;
    }

    .payments-table td {
      padding: 16px;
      border-bottom: 1px solid #e2e8f0;
    }

    .payments-table tr:hover {
      background: #f7fafc;
    }

    /* Summary Section */
    .summary-section {
      margin-top: 24px;
      padding: 24px;
      background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
      border-radius: 12px;
      border: 2px solid #667eea30;
    }

    .summary-section h4 {
      margin: 0 0 16px 0;
      color: #2d3748;
      font-weight: 700;
    }

    .summary-section p {
      margin: 8px 0;
      color: #4a5568;
      font-size: 15px;
    }

    /* No Data State */
    .no-data {
      text-align: center;
      padding: 60px 20px;
      color: #a0aec0;
    }

    .no-data mat-icon {
      font-size: 80px;
      width: 80px;
      height: 80px;
      color: #cbd5e0;
      margin-bottom: 16px;
    }

    .no-data p {
      font-size: 18px;
      margin: 8px 0;
      color: #718096;
    }

    .no-data small {
      color: #a0aec0;
    }

    /* Responsive Design */
    @media (max-width: 1200px) {
      .content-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 768px) {
      .membership-payments-container {
        padding: 16px;
      }

      .page-header {
        padding: 20px;
      }

      .header-icon {
        width: 60px;
        height: 60px;
      }

      .header-icon mat-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
      }

      .header-text h1 {
        font-size: 24px;
      }

      .form-row {
        flex-direction: column;
      }

      .half-width {
        width: 100%;
      }

      .filters {
        flex-direction: column;
      }

      .filters mat-form-field {
        width: 100%;
      }
    }
  `]
})
export class AdminMembershipPaymentsComponent implements OnInit {
  paymentForm: FormGroup;
  members: User[] = [];
  payments: MembershipPayment[] = [];
  isLoading = false;
  isSubmitting = false;
  filterYear: number | null = null;
  currentYear = new Date().getFullYear();
  displayedColumns: string[] = ['member', 'year', 'amount', 'method', 'date', 'recordedBy', 'notes'];
  summary = {
    count: 0,
    totalAmount: 0,
    years: [] as number[]
  };

  private apiUrl = 'http://localhost:3000/api';

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private snackBar: MatSnackBar
  ) {
    this.paymentForm = this.fb.group({
      userId: ['', Validators.required],
      membershipYear: [2026, Validators.required],
      amount: [0, [Validators.required, Validators.min(0.01)]],
      paymentMethod: ['cash', Validators.required],
      paymentDate: [new Date(), Validators.required],
      notes: ['', Validators.maxLength(500)]
    });
  }

  ngOnInit(): void {
    this.loadMembers();
    this.loadPayments();
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  loadMembers(): void {
    // Request maximum allowed members (100 per page)
    // If you have more than 100 members, we'll need to implement pagination or increase backend limit
    this.http.get<any>(`${this.apiUrl}/members?limit=100`, { headers: this.getAuthHeaders() })
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
        }
      });
  }

  loadAdditionalMembers(page: number): void {
    this.http.get<any>(`${this.apiUrl}/members?limit=100&page=${page}`, { headers: this.getAuthHeaders() })
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
        }
      });
  }

  loadPayments(): void {
    this.isLoading = true;
    let url = `${this.apiUrl}/payments/membership-fees`;

    if (this.filterYear !== null) {
      url += `?year=${this.filterYear}`;
    }

    this.http.get<any>(url, { headers: this.getAuthHeaders() })
      .subscribe({
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
        }
      });
  }

  onMemberSelected(): void {
    const userId = this.paymentForm.get('userId')?.value;
    const member = this.members.find(m => m._id === userId);

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

    // Format the payment date to ISO string
    const paymentData = {
      ...formValue,
      paymentDate: formValue.paymentDate instanceof Date
        ? formValue.paymentDate.toISOString()
        : formValue.paymentDate
    };

    this.http.post<any>(`${this.apiUrl}/payments/membership-fee`, paymentData, { headers: this.getAuthHeaders() })
      .subscribe({
        next: (response) => {
          this.snackBar.open(response.message || 'Membership payment recorded successfully', 'Close', { duration: 3000 });
          this.isSubmitting = false;
          this.resetForm();
          this.loadPayments();
          this.loadMembers(); // Reload to get updated membershipYearsPaid
        },
        error: (error) => {
          console.error('Error recording payment:', error);
          const errorMessage = error.error?.message || 'Failed to record membership payment';
          this.snackBar.open(errorMessage, 'Close', { duration: 5000 });
          this.isSubmitting = false;
        }
      });
  }

  resetForm(): void {
    this.paymentForm.reset({
      userId: '',
      membershipYear: 2026,
      amount: 0,
      paymentMethod: 'cash',
      paymentDate: new Date(),
      notes: ''
    });
  }

  formatPaymentMethod(method: string): string {
    const methodMap: { [key: string]: string } = {
      'cash': 'Cash',
      'bank_transfer': 'Bank Transfer',
      'gcash': 'GCash'
    };
    return methodMap[method] || method;
  }
}
