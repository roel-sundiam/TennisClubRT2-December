import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface Reservation {
  _id: string;
  date: string;
  timeSlot: number;
  endTimeSlot: number;
  duration: number;
  players: any[];
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no-show' | 'blocked';
  paymentStatus: 'pending' | 'paid' | 'overdue' | 'not_applicable';
  totalFee: number;
  paymentIds?: string[];
  userId: {
    _id: string;
    fullName: string;
    username: string;
  };
  createdAt: string;
}

@Component({
  selector: 'app-admin-reservation-management',
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
    MatMenuModule
  ],
  templateUrl: './admin-reservation-management.component.html',
  styleUrl: './admin-reservation-management.component.scss'
})
export class AdminReservationManagementComponent implements OnInit {
  private apiUrl = environment.apiUrl;

  allReservations: Reservation[] = [];
  filteredReservations: Reservation[] = [];
  paginatedReservations: Reservation[] = [];

  filterStatus = 'all';
  filterPaymentStatus = 'all';
  searchMember = '';
  filterDate: Date | null = null;
  filterDateString = ''; // For native date input

  displayedColumns = ['date', 'time', 'member', 'players', 'status', 'fee', 'paymentStatus', 'actions'];

  pageSize = 100;
  pageIndex = 0;
  pageSizeOptions = [50, 100, 200];

  isLoading = false;

  expandedReservationId: string | null = null;
  reservationPaymentsCache = new Map<string, any[]>();
  loadingPaymentsForId: string | null = null;

  summary = { total: 0, pending: 0, confirmed: 0, cancelled: 0, completed: 0, pendingPayment: 0 };

  constructor(
    private http: HttpClient,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadReservations();
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  loadReservations(): void {
    this.isLoading = true;
    this.http.get<any>(
      `${this.apiUrl}/reservations?limit=999999`,
      { headers: this.getAuthHeaders() }
    ).subscribe({
      next: (response) => {
        const excluded = new Set(['blocked', 'cancelled', 'completed', 'no-show']);
        this.allReservations = (response.data || []).filter((r: Reservation) => !excluded.has(r.status));
        this.applyFilters();
        this.calculateSummary();
        this.isLoading = false;
      },
      error: () => {
        this.snackBar.open('Failed to load reservations', 'Close', { duration: 3000 });
        this.isLoading = false;
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.allReservations];

    if (this.filterStatus !== 'all') {
      filtered = filtered.filter(r => r.status === this.filterStatus);
    }

    if (this.filterPaymentStatus !== 'all') {
      filtered = filtered.filter(r => r.paymentStatus === this.filterPaymentStatus);
    }

    if (this.searchMember.trim()) {
      const term = this.searchMember.trim().toLowerCase();
      filtered = filtered.filter(r => {
        const name = r.userId?.fullName?.toLowerCase() || '';
        const username = r.userId?.username?.toLowerCase() || '';
        return name.includes(term) || username.includes(term);
      });
    }

    if (this.filterDate) {
      const dateStr = this.filterDate.toISOString().split('T')[0];
      filtered = filtered.filter(r => r.date.startsWith(dateStr));
    }

    // Sort: date ascending
    filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    this.filteredReservations = filtered;
    this.pageIndex = 0;
    this.updatePage();
  }

  updatePage(): void {
    const start = this.pageIndex * this.pageSize;
    this.paginatedReservations = this.filteredReservations.slice(start, start + this.pageSize);
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.updatePage();
  }

  calculateSummary(): void {
    this.summary = {
      total: this.allReservations.length,
      pending: this.allReservations.filter(r => r.status === 'pending').length,
      confirmed: this.allReservations.filter(r => r.status === 'confirmed').length,
      cancelled: this.allReservations.filter(r => r.status === 'cancelled').length,
      completed: this.allReservations.filter(r => r.status === 'completed').length,
      pendingPayment: this.allReservations.filter(r => r.paymentStatus === 'pending').length
    };
  }

  resetFilters(): void {
    this.filterStatus = 'all';
    this.filterPaymentStatus = 'all';
    this.searchMember = '';
    this.filterDate = null;
    this.filterDateString = '';
    this.applyFilters();
  }

  onDateFilterChange(): void {
    if (this.filterDateString) {
      this.filterDate = new Date(this.filterDateString + 'T00:00:00');
    } else {
      this.filterDate = null;
    }
    this.applyFilters();
  }

  getPaymentDisplayText(status: string): string {
    const map: Record<string, string> = {
      pending: 'Pending',
      paid: 'Paid',
      overdue: 'Overdue',
      not_applicable: 'N/A'
    };
    return map[status] || status;
  }

  canEdit(reservation: Reservation): boolean {
    return reservation.status === 'pending' || reservation.status === 'confirmed' || reservation.status === 'no-show';
  }

  editReservation(reservation: Reservation): void {
    this.router.navigate(['/reservations'], {
      queryParams: { edit: reservation._id, from: 'admin' }
    });
  }

  getTimeDisplay(reservation: Reservation): string {
    const end = reservation.endTimeSlot || (reservation.timeSlot + (reservation.duration || 1));
    return `${reservation.timeSlot}:00 - ${end}:00`;
  }

  getDateDisplay(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  }

  getMemberName(reservation: Reservation): string {
    return reservation.userId?.fullName || reservation.userId?.username || 'Unknown';
  }

  getPlayerCount(reservation: Reservation): number {
    return reservation.players?.length || 0;
  }

  getPlayerNames(reservation: Reservation): string {
    if (!reservation.players?.length) return '—';
    return reservation.players.map((p: any) => {
      const name = typeof p === 'string' ? p : (p.name || '');
      const tag = p.isGuest ? ' (Guest)' : '';
      return name + tag;
    }).join(', ');
  }

  getStatusDisplay(status: string): string {
    return status === 'no-show' ? 'completed' : status;
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      pending: 'status-pending',
      confirmed: 'status-confirmed',
      cancelled: 'status-cancelled',
      completed: 'status-completed',
      'no-show': 'status-completed'
    };
    return map[status] || '';
  }

  getPaymentStatusClass(status: string): string {
    const map: Record<string, string> = {
      pending: 'pay-pending',
      paid: 'pay-paid',
      overdue: 'pay-overdue',
      not_applicable: 'pay-na'
    };
    return map[status] || '';
  }

  togglePayments(r: Reservation): void {
    if (this.expandedReservationId === r._id) {
      this.expandedReservationId = null;
      return;
    }
    this.expandedReservationId = r._id;
    if (!this.reservationPaymentsCache.has(r._id)) {
      this.loadPaymentsFor(r._id, r.paymentIds);
    }
  }

  loadPaymentsFor(reservationId: string, paymentIds?: string[]): void {
    this.loadingPaymentsForId = reservationId;
    const url = paymentIds && paymentIds.length > 0
      ? `${this.apiUrl}/payments?paymentIds=${paymentIds.join(',')}&limit=100`
      : `${this.apiUrl}/payments?reservationId=${reservationId}&limit=100`;
    this.http.get<any>(url, { headers: this.getAuthHeaders() }).subscribe({
      next: (res) => {
        this.reservationPaymentsCache.set(reservationId, res.data || []);
        this.loadingPaymentsForId = null;
      },
      error: () => {
        this.reservationPaymentsCache.set(reservationId, []);
        this.loadingPaymentsForId = null;
      }
    });
  }

  getReservationPayments(reservationId: string): any[] {
    return this.reservationPaymentsCache.get(reservationId) || [];
  }

  getPaymentMethodDisplay(method: string): string {
    const map: Record<string, string> = {
      cash: 'Cash',
      bank_transfer: 'Bank Transfer',
      gcash: 'GCash',
      coins: 'Coins'
    };
    return map[method] || method;
  }

  getPaymentStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'Unpaid',
      completed: 'Paid',
      failed: 'Failed',
      refunded: 'Refunded',
      record: 'Recorded'
    };
    return map[status] || status;
  }

  getPaymentRowClass(status: string): string {
    const map: Record<string, string> = {
      pending: 'pay-pending',
      completed: 'pay-paid',
      failed: 'pay-overdue',
      refunded: 'pay-na',
      record: 'pay-paid'
    };
    return map[status] || '';
  }

}
