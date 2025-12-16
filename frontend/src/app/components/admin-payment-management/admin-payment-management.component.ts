import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { PaymentEditDialogComponent } from './payment-edit-dialog/payment-edit-dialog.component';
import { environment } from '../../../environments/environment';

interface Payment {
  _id: string;
  referenceNumber: string;
  userId: {
    _id: string;
    fullName: string;
    username: string;
  };
  amount: number;
  currency: string;
  paymentMethod: 'cash' | 'bank_transfer' | 'gcash';
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'record';
  paymentType: 'court_usage' | 'membership_fee' | 'tournament_entry';
  paymentDate?: Date;
  dueDate: Date;
  membershipYear?: number;
  reservationId?: {
    _id: string;
    date: Date;
    timeSlot: number;
  };
  notes?: string;
  recordedBy?: {
    _id: string;
    fullName: string;
    username: string;
  };
  recordedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface PaymentSummary {
  total: number;
  totalAmount: number;
  pending: number;
  completed: number;
  recorded: number;
  failed: number;
  refunded: number;
}

@Component({
  selector: 'app-admin-payment-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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
    MatPaginatorModule,
    MatChipsModule,
    MatTooltipModule,
    MatMenuModule,
    MatDialogModule
  ],
  templateUrl: './admin-payment-management.component.html',
  styleUrl: './admin-payment-management.component.scss'
})
export class AdminPaymentManagementComponent implements OnInit {
  private apiUrl = environment.apiUrl;

  // Data
  payments: Payment[] = [];
  filteredPayments: Payment[] = [];
  paginatedPayments: Payment[] = [];

  // Filters
  filterStatus: string = 'all';
  filterMethod: string = 'all';
  filterType: string = 'all';
  searchTerm: string = '';
  dateRangeStart: Date | null = null;
  dateRangeEnd: Date | null = null;

  // Table
  displayedColumns = ['reference', 'user', 'amount', 'method', 'status', 'type', 'paymentDate', 'actions'];

  // Pagination
  pageSize = 100;
  pageIndex = 0;
  pageSizeOptions = [10, 20, 50, 100];

  // State
  isLoading = false;

  // Summary
  summary: PaymentSummary = {
    total: 0,
    totalAmount: 0,
    pending: 0,
    completed: 0,
    recorded: 0,
    failed: 0,
    refunded: 0
  };

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadPayments();
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  loadPayments(): void {
    this.isLoading = true;

    this.http.get<any>(
      `${this.apiUrl}/payments`,
      { headers: this.getAuthHeaders() }
    ).subscribe({
      next: (response) => {
        this.payments = response.data || [];
        this.applyFilters();
        this.calculateSummary();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading payments:', error);
        this.snackBar.open('Failed to load payments', 'Close', { duration: 3000 });
        this.isLoading = false;
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.payments];

    // Status filter
    if (this.filterStatus !== 'all') {
      filtered = filtered.filter(p => p.status === this.filterStatus);
    }

    // Method filter
    if (this.filterMethod !== 'all') {
      filtered = filtered.filter(p => p.paymentMethod === this.filterMethod);
    }

    // Type filter
    if (this.filterType !== 'all') {
      filtered = filtered.filter(p => p.paymentType === this.filterType);
    }

    // Search filter
    if (this.searchTerm) {
      const search = this.searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.userId.fullName.toLowerCase().includes(search) ||
        p.userId.username.toLowerCase().includes(search) ||
        p.referenceNumber.toLowerCase().includes(search)
      );
    }

    // Date range filter
    if (this.dateRangeStart) {
      filtered = filtered.filter(p => {
        if (!p.paymentDate) return false;
        return new Date(p.paymentDate) >= this.dateRangeStart!;
      });
    }

    if (this.dateRangeEnd) {
      filtered = filtered.filter(p => {
        if (!p.paymentDate) return false;
        return new Date(p.paymentDate) <= this.dateRangeEnd!;
      });
    }

    // Sort by status: pending → completed → recorded → failed → refunded
    const statusOrder: { [key: string]: number } = {
      'pending': 1,
      'completed': 2,
      'record': 3,
      'failed': 4,
      'refunded': 5
    };

    filtered.sort((a, b) => {
      const orderA = statusOrder[a.status] || 999;
      const orderB = statusOrder[b.status] || 999;

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      // Secondary sort by date (newest first)
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    this.filteredPayments = filtered;
    this.pageIndex = 0; // Reset to first page
    this.updatePaginatedPayments();
  }

  updatePaginatedPayments(): void {
    const startIndex = this.pageIndex * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedPayments = this.filteredPayments.slice(startIndex, endIndex);
  }

  onPageChange(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.pageIndex = event.pageIndex;
    this.updatePaginatedPayments();
  }

  clearFilters(): void {
    this.filterStatus = 'all';
    this.filterMethod = 'all';
    this.filterType = 'all';
    this.searchTerm = '';
    this.dateRangeStart = null;
    this.dateRangeEnd = null;
    this.applyFilters();
  }

  calculateSummary(): void {
    this.summary = {
      total: this.payments.length,
      totalAmount: this.payments.reduce((sum, p) => sum + p.amount, 0),
      pending: this.payments.filter(p => p.status === 'pending').length,
      completed: this.payments.filter(p => p.status === 'completed').length,
      recorded: this.payments.filter(p => p.status === 'record').length,
      failed: this.payments.filter(p => p.status === 'failed').length,
      refunded: this.payments.filter(p => p.status === 'refunded').length
    };
  }

  openEditDialog(payment: Payment): void {
    if (payment.status === 'record') {
      this.snackBar.open('Recorded payments cannot be edited. Unrecord first.', 'Close', { duration: 3000 });
      return;
    }

    const dialogRef = this.dialog.open(PaymentEditDialogComponent, {
      width: '600px',
      data: { payment },
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === 'updated' || (result && result.updated)) {
        this.loadPayments();
      }
    });
  }

  recordPayment(payment: Payment): void {
    if (payment.status !== 'completed') {
      this.snackBar.open('Only completed payments can be recorded', 'Close', { duration: 3000 });
      return;
    }

    if (confirm(`Record payment ${payment.referenceNumber} in financial reports?`)) {
      this.http.put<any>(
        `${this.apiUrl}/payments/${payment._id}/record`,
        {},
        { headers: this.getAuthHeaders() }
      ).subscribe({
        next: (response) => {
          this.snackBar.open('Payment recorded successfully', 'Close', { duration: 3000 });
          this.loadPayments();
        },
        error: (error) => {
          this.snackBar.open(error.error?.message || 'Failed to record payment', 'Close', { duration: 5000 });
        }
      });
    }
  }

  unrecordPayment(payment: Payment): void {
    if (payment.status !== 'record') {
      this.snackBar.open('Only recorded payments can be unrecorded', 'Close', { duration: 3000 });
      return;
    }

    if (confirm(`Unrecord payment ${payment.referenceNumber}? This will remove it from financial reports.`)) {
      this.http.put<any>(
        `${this.apiUrl}/payments/${payment._id}/unrecord`,
        {},
        { headers: this.getAuthHeaders() }
      ).subscribe({
        next: (response) => {
          this.snackBar.open('Payment unrecorded successfully', 'Close', { duration: 3000 });
          this.loadPayments();
        },
        error: (error) => {
          this.snackBar.open(error.error?.message || 'Failed to unrecord payment', 'Close', { duration: 5000 });
        }
      });
    }
  }

  getStatusChipClass(status: string): string {
    switch (status) {
      case 'pending': return 'status-chip-pending';
      case 'completed': return 'status-chip-completed';
      case 'record': return 'status-chip-recorded';
      case 'failed': return 'status-chip-failed';
      case 'refunded': return 'status-chip-refunded';
      default: return '';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'pending': return 'schedule';
      case 'completed': return 'check_circle';
      case 'record': return 'lock';
      case 'failed': return 'cancel';
      case 'refunded': return 'undo';
      default: return 'help';
    }
  }

  getMethodIcon(method: string): string {
    switch (method) {
      case 'cash': return 'payments';
      case 'bank_transfer': return 'account_balance';
      case 'gcash': return 'phone_android';
      default: return 'payment';
    }
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  formatAmount(amount: number, currency: string = 'PHP'): string {
    if (currency === 'PHP') {
      return `₱${amount.toFixed(2)}`;
    }
    return `$${amount.toFixed(2)}`;
  }

  getPaymentTypeLabel(type: string): string {
    switch (type) {
      case 'court_usage': return 'Court';
      case 'membership_fee': return 'Membership';
      case 'tournament_entry': return 'Tournament';
      default: return type;
    }
  }

  isRecorded(payment: Payment): boolean {
    return payment.status === 'record';
  }

  canEdit(payment: Payment): boolean {
    return payment.status !== 'record';
  }

  canRecord(payment: Payment): boolean {
    return payment.status === 'completed';
  }

  canUnrecord(payment: Payment): boolean {
    return payment.status === 'record';
  }

  isOverdue(payment: Payment): boolean {
    // Only show overdue for pending or failed payments
    if (payment.status !== 'pending' && payment.status !== 'failed') {
      return false;
    }

    // Check if payment is past due date
    if (!payment.dueDate) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to midnight for accurate comparison

    const dueDate = new Date(payment.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    return dueDate < today;
  }
}
