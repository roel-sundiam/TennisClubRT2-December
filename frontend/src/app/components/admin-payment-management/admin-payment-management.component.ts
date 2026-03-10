import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
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
import { MatTabsModule } from '@angular/material/tabs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { PaymentEditDialogComponent } from './payment-edit-dialog/payment-edit-dialog.component';
import { MemberService, Member } from '../../services/member.service';
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
  description?: string;
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

interface OverdueMemberSummary {
  userId: string;
  fullName: string;
  username: string;
  totalOverdueAmount: number;
  overdueCount: number;
  oldestOverdueDays: number;
  payments: Payment[];
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
    MatDialogModule,
    MatTabsModule,
    MatCheckboxModule,
    MatListModule,
    MatDividerModule,
  ],
  templateUrl: './admin-payment-management.component.html',
  styleUrl: './admin-payment-management.component.scss',
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
  ],
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
  reservationDateStart: Date | null = null;
  reservationDateEnd: Date | null = null;

  // Table
  displayedColumns = [
    'reference',
    'user',
    'amount',
    'method',
    'status',
    'type',
    'reservationDate',
    'paymentDate',
    'actions',
  ];
  overdueDisplayedColumns = [
    'fullName',
    'overdueCount',
    'totalOverdueAmount',
    'oldestOverdueDays',
    'actions',
  ];

  // Pagination
  pageSize = 100;
  pageIndex = 0;
  pageSizeOptions = [10, 20, 50, 100];

  // State
  isLoading = false;

  // Tabs
  selectedTabIndex = 0;

  // Overdue Report
  overdueSummaries: OverdueMemberSummary[] = [];

  // Assign Expense Panel
  showAssignExpensePanel = false;
  assignExpenseLoading = false;
  membersForExpense: Member[] = [];
  filteredMembersForExpense: Member[] = [];
  selectedMemberIds = new Set<string>();
  memberSearchTerm = '';
  assignExpenseForm = {
    title: '',
    description: '',
    amount: null as number | null,
    dueDate: null as Date | null,
  };

  // Summary
  summary: PaymentSummary = {
    total: 0,
    totalAmount: 0,
    pending: 0,
    completed: 0,
    recorded: 0,
    failed: 0,
    refunded: 0,
  };

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private memberService: MemberService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.loadPayments();
    this.route.queryParams.subscribe((params) => {
      if (params['action'] === 'assign-expense') {
        this.showAssignExpensePanel = true;
        this.loadMembersForExpense();
      }
    });
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }

  loadPayments(): void {
    this.isLoading = true;

    // Fetch all payments without limit (client-side pagination handles display)
    this.http
      .get<any>(`${this.apiUrl}/payments?limit=999999`, { headers: this.getAuthHeaders() })
      .subscribe({
        next: (response) => {
          this.payments = response.data || [];
          this.applyFilters();
          this.calculateSummary();
          this.calculateOverdueSummaries();
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading payments:', error);
          this.snackBar.open('Failed to load payments', 'Close', { duration: 3000 });
          this.isLoading = false;
        },
      });
  }

  applyFilters(): void {
    let filtered = [...this.payments];

    // Status filter
    if (this.filterStatus !== 'all') {
      filtered = filtered.filter((p) => p.status === this.filterStatus);
    }

    // Method filter
    if (this.filterMethod !== 'all') {
      filtered = filtered.filter((p) => p.paymentMethod === this.filterMethod);
    }

    // Type filter
    if (this.filterType !== 'all') {
      filtered = filtered.filter((p) => p.paymentType === this.filterType);
    }

    // Search filter
    if (this.searchTerm) {
      const search = this.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          (p.userId?.fullName || '').toLowerCase().includes(search) ||
          (p.userId?.username || '').toLowerCase().includes(search) ||
          p.referenceNumber.toLowerCase().includes(search) ||
          (p.description || '').toLowerCase().includes(search),
      );
    }

    // Reservation date range filter
    if (this.reservationDateStart) {
      filtered = filtered.filter((p) => {
        if (!p.reservationId?.date) return false;
        return new Date(p.reservationId.date) >= this.reservationDateStart!;
      });
    }

    if (this.reservationDateEnd) {
      const endOfDay = new Date(this.reservationDateEnd);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter((p) => {
        if (!p.reservationId?.date) return false;
        return new Date(p.reservationId.date) <= endOfDay;
      });
    }

    // Sort by status: pending → completed → recorded → failed → refunded
    const statusOrder: { [key: string]: number } = {
      pending: 1,
      completed: 2,
      record: 3,
      failed: 4,
      refunded: 5,
    };

    filtered.sort((a, b) => {
      const orderA = statusOrder[a.status] || 999;
      const orderB = statusOrder[b.status] || 999;

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      // Secondary sort by reservation date (oldest first)
      // Payments without reservation date go to the end
      const dateA = a.reservationId?.date
        ? new Date(a.reservationId.date).getTime()
        : Number.MAX_SAFE_INTEGER;
      const dateB = b.reservationId?.date
        ? new Date(b.reservationId.date).getTime()
        : Number.MAX_SAFE_INTEGER;
      return dateA - dateB;
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
    this.reservationDateStart = null;
    this.reservationDateEnd = null;
    this.applyFilters();
  }

  getActiveFiltersCount(): number {
    let count = 0;
    if (this.filterStatus !== 'all') count++;
    if (this.filterMethod !== 'all') count++;
    if (this.filterType !== 'all') count++;
    if (this.searchTerm) count++;
    if (this.reservationDateStart) count++;
    if (this.reservationDateEnd) count++;
    return count;
  }

  calculateSummary(): void {
    this.summary = {
      total: this.payments.length,
      totalAmount: this.payments.reduce((sum, p) => sum + p.amount, 0),
      pending: this.payments.filter((p) => p.status === 'pending').length,
      completed: this.payments.filter((p) => p.status === 'completed').length,
      recorded: this.payments.filter((p) => p.status === 'record').length,
      failed: this.payments.filter((p) => p.status === 'failed').length,
      refunded: this.payments.filter((p) => p.status === 'refunded').length,
    };
  }

  calculateOverdueSummaries(): void {
    // Get all overdue payments
    const overduePayments = this.payments.filter((p) => this.isOverdue(p));

    // Group by user
    const memberMap = new Map<string, OverdueMemberSummary>();

    overduePayments.forEach((payment) => {
      const userId = payment.userId._id;

      if (!memberMap.has(userId)) {
        memberMap.set(userId, {
          userId: userId,
          fullName: payment.userId.fullName,
          username: payment.userId.username,
          totalOverdueAmount: 0,
          overdueCount: 0,
          oldestOverdueDays: 0,
          payments: [],
        });
      }

      const summary = memberMap.get(userId)!;
      summary.totalOverdueAmount += payment.amount;
      summary.overdueCount++;
      summary.payments.push(payment);

      // Calculate days overdue for this payment
      const daysOverdue = this.getDaysOverdue(payment);
      if (daysOverdue > summary.oldestOverdueDays) {
        summary.oldestOverdueDays = daysOverdue;
      }
    });

    // Convert map to array and sort by total overdue amount (descending)
    this.overdueSummaries = Array.from(memberMap.values()).sort(
      (a, b) => b.totalOverdueAmount - a.totalOverdueAmount,
    );
  }

  openEditDialog(payment: Payment): void {
    if (payment.status === 'record') {
      this.snackBar.open('Recorded payments cannot be edited. Unrecord first.', 'Close', {
        duration: 3000,
      });
      return;
    }

    const dialogRef = this.dialog.open(PaymentEditDialogComponent, {
      width: '600px',
      data: { payment },
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result) => {
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
      this.http
        .put<any>(
          `${this.apiUrl}/payments/${payment._id}/record`,
          {},
          { headers: this.getAuthHeaders() },
        )
        .subscribe({
          next: (response) => {
            this.snackBar.open('Payment recorded successfully', 'Close', { duration: 3000 });
            this.loadPayments();
          },
          error: (error) => {
            this.snackBar.open(error.error?.message || 'Failed to record payment', 'Close', {
              duration: 5000,
            });
          },
        });
    }
  }

  unrecordPayment(payment: Payment): void {
    if (payment.status !== 'record') {
      this.snackBar.open('Only recorded payments can be unrecorded', 'Close', { duration: 3000 });
      return;
    }

    if (
      confirm(
        `Unrecord payment ${payment.referenceNumber}? This will remove it from financial reports.`,
      )
    ) {
      this.http
        .put<any>(
          `${this.apiUrl}/payments/${payment._id}/unrecord`,
          {},
          { headers: this.getAuthHeaders() },
        )
        .subscribe({
          next: (response) => {
            this.snackBar.open('Payment unrecorded successfully', 'Close', { duration: 3000 });
            this.loadPayments();
          },
          error: (error) => {
            this.snackBar.open(error.error?.message || 'Failed to unrecord payment', 'Close', {
              duration: 5000,
            });
          },
        });
    }
  }

  getStatusChipClass(status: string): string {
    switch (status) {
      case 'pending':
        return 'status-chip-pending';
      case 'completed':
        return 'status-chip-completed';
      case 'record':
        return 'status-chip-recorded';
      case 'failed':
        return 'status-chip-failed';
      case 'refunded':
        return 'status-chip-refunded';
      default:
        return '';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'pending':
        return 'schedule';
      case 'completed':
        return 'check_circle';
      case 'record':
        return 'lock';
      case 'failed':
        return 'cancel';
      case 'refunded':
        return 'undo';
      default:
        return 'help';
    }
  }

  getMethodIcon(method: string): string {
    switch (method) {
      case 'cash':
        return 'payments';
      case 'bank_transfer':
        return 'account_balance';
      case 'gcash':
        return 'phone_android';
      default:
        return 'payment';
    }
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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
      case 'court_usage':
        return 'Court';
      case 'membership_fee':
        return 'Membership';
      case 'tournament_entry':
        return 'Tournament';
      default:
        return type;
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
    // Only show overdue for pending payments
    // Failed, cancelled, refunded, or completed payments should not be considered overdue
    if (payment.status !== 'pending') {
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

  getDaysOverdue(payment: Payment): number {
    if (!this.isOverdue(payment)) {
      return 0;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = new Date(payment.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - dueDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  viewMemberOverdueDetails(member: OverdueMemberSummary): void {
    // Switch to All Payments tab
    this.selectedTabIndex = 0;

    // Small delay to ensure tab switch completes before filtering
    setTimeout(() => {
      // Filter to show only this member's overdue payments
      this.searchTerm = member.username;
      this.filterStatus = 'pending'; // Show pending overdue payments
      this.applyFilters();

      this.snackBar.open(
        `Showing ${member.overdueCount} overdue payment(s) for ${member.fullName}`,
        'Close',
        { duration: 4000 },
      );
    }, 100);
  }

  getTotalOverdueAmount(): number {
    return this.overdueSummaries.reduce((sum, member) => sum + member.totalOverdueAmount, 0);
  }

  getTotalOverdueCount(): number {
    return this.overdueSummaries.reduce((sum, member) => sum + member.overdueCount, 0);
  }

  // ---- Assign Expense ----

  toggleAssignExpensePanel(): void {
    this.showAssignExpensePanel = !this.showAssignExpensePanel;
    if (this.showAssignExpensePanel && this.membersForExpense.length === 0) {
      this.loadMembersForExpense();
    }
    if (!this.showAssignExpensePanel) {
      this.resetAssignExpenseForm();
    }
  }

  loadMembersForExpense(): void {
    this.memberService.getMembers({ approved: true, active: true, includeAll: true }).subscribe({
      next: (response) => {
        this.membersForExpense = (response.data || []).sort((a, b) =>
          (a.fullName || a.username).localeCompare(b.fullName || b.username),
        );
        this.filteredMembersForExpense = [...this.membersForExpense];
      },
      error: () => {
        this.snackBar.open('Failed to load members', 'Close', { duration: 3000 });
      },
    });
  }

  filterMembersForExpense(): void {
    const term = this.memberSearchTerm.toLowerCase();
    this.filteredMembersForExpense = this.membersForExpense.filter(
      (m) =>
        (m.fullName || '').toLowerCase().includes(term) || m.username.toLowerCase().includes(term),
    );
  }

  toggleMemberSelection(memberId: string): void {
    if (this.selectedMemberIds.has(memberId)) {
      this.selectedMemberIds.delete(memberId);
    } else {
      this.selectedMemberIds.add(memberId);
    }
  }

  isMemberSelected(memberId: string): boolean {
    return this.selectedMemberIds.has(memberId);
  }

  selectAllMembers(): void {
    this.filteredMembersForExpense.forEach((m) => this.selectedMemberIds.add(m._id));
  }

  clearMemberSelection(): void {
    this.selectedMemberIds.clear();
  }

  resetAssignExpenseForm(): void {
    this.assignExpenseForm = { title: '', description: '', amount: null, dueDate: null };
    this.selectedMemberIds.clear();
    this.memberSearchTerm = '';
    this.filteredMembersForExpense = [...this.membersForExpense];
  }

  submitAssignExpense(): void {
    if (!this.assignExpenseForm.title?.trim()) {
      this.snackBar.open('Expense title is required', 'Close', { duration: 3000 });
      return;
    }
    if (!this.assignExpenseForm.amount || this.assignExpenseForm.amount <= 0) {
      this.snackBar.open('Amount must be greater than 0', 'Close', { duration: 3000 });
      return;
    }
    if (!this.assignExpenseForm.dueDate) {
      this.snackBar.open('Due date is required', 'Close', { duration: 3000 });
      return;
    }
    if (this.selectedMemberIds.size === 0) {
      this.snackBar.open('Please select at least one member', 'Close', { duration: 3000 });
      return;
    }

    this.assignExpenseLoading = true;

    const payload = {
      title: this.assignExpenseForm.title.trim(),
      description: this.assignExpenseForm.description?.trim() || '',
      amount: this.assignExpenseForm.amount,
      dueDate: this.assignExpenseForm.dueDate,
      memberIds: Array.from(this.selectedMemberIds),
    };

    this.http
      .post<any>(`${this.apiUrl}/payments/assign-expense`, payload, {
        headers: this.getAuthHeaders(),
      })
      .subscribe({
        next: (response) => {
          this.assignExpenseLoading = false;
          const { count, skipped } = response.data;
          let msg = `${count} pending payment(s) created for "${payload.title}"`;
          if (skipped?.length > 0) {
            msg += `. ${skipped.length} skipped (already assigned).`;
          }
          this.snackBar.open(msg, 'Close', { duration: 6000 });
          this.showAssignExpensePanel = false;
          this.resetAssignExpenseForm();
          this.loadPayments();
        },
        error: (error) => {
          this.assignExpenseLoading = false;
          this.snackBar.open(error.error?.message || 'Failed to assign expense', 'Close', {
            duration: 5000,
          });
        },
      });
  }

  // Helper methods for modern native HTML template

  // Expose Math to template for pagination
  Math = Math;

  // Format Date object to YYYY-MM-DD string for native date input
  formatDateForInput(date: Date | null): string {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Handle date input change for reservation date start filter
  onDateFromChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.reservationDateStart = input.value ? new Date(input.value) : null;
    this.applyFilters();
  }

  // Handle date input change for reservation date end filter
  onDateToChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.reservationDateEnd = input.value ? new Date(input.value) : null;
    this.applyFilters();
  }

  // Format payment method for display
  formatPaymentMethod(method: string): string {
    switch (method) {
      case 'cash':
        return 'Cash';
      case 'bank_transfer':
        return 'Bank Transfer';
      case 'gcash':
        return 'GCash';
      default:
        return method;
    }
  }

  // Pagination navigation methods
  goToFirstPage(): void {
    this.pageIndex = 0;
    this.updatePaginatedPayments();
  }

  goToPreviousPage(): void {
    if (this.pageIndex > 0) {
      this.pageIndex--;
      this.updatePaginatedPayments();
    }
  }

  goToNextPage(): void {
    if (this.pageIndex < this.getTotalPages() - 1) {
      this.pageIndex++;
      this.updatePaginatedPayments();
    }
  }

  goToLastPage(): void {
    this.pageIndex = Math.max(0, this.getTotalPages() - 1);
    this.updatePaginatedPayments();
  }

  // Calculate total number of pages
  getTotalPages(): number {
    return Math.ceil(this.filteredPayments.length / this.pageSize);
  }

  // Handle page size change
  onPageSizeChange(): void {
    this.pageIndex = 0; // Reset to first page when changing page size
    this.updatePaginatedPayments();
  }
}
