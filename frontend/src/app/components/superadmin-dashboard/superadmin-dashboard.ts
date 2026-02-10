import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { interval, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// Interfaces for API response
interface UserInfo {
  _id: string;
  fullName: string;
  username: string;
  email?: string;
}

interface CourtReservation {
  _id: string;
  userId: UserInfo;
  date: Date;
  timeSlot: number;
  endTimeSlot: number;
  players: any[];
  status: string;
  totalFee?: number;
  createdAt?: Date;
}

interface PaymentInfo {
  _id: string;
  userId: UserInfo;
  amount: number;
  paymentMethod: string;
  paymentDate: Date;
  description: string;
}

interface FeedbackInfo {
  _id: string;
  userId: UserInfo;
  type: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  createdAt: Date;
}

interface TennisBallPurchase {
  _id: string;
  userId: UserInfo;
  date: Date;
  timeSlot: number;
  tennisBalls: {
    quantity: number;
    costPerCan: number;
    totalCost: number;
  };
  createdAt: Date;
}

interface PageVisit {
  _id: string;
  userId: UserInfo | null;
  page: string;
  path: string;
  timestamp: Date;
}

interface MemberWithCredit {
  _id: string;
  fullName: string;
  username: string;
  email: string;
  creditBalance: number;
}

interface OverdueMemberInfo {
  _id: string;
  userId: UserInfo;
  totalAmount: number;
  paymentCount: number;
  oldestDueDate: Date;
}

interface DashboardData {
  courtStatus: {
    current: CourtReservation | null;
    next: CourtReservation | null;
  };
  recentReservations: CourtReservation[];
  recentPayments: PaymentInfo[];
  latestFeedback: FeedbackInfo[];
  lastTennisBallPurchase: TennisBallPurchase | null;
  recentPageVisits: PageVisit[];
  membersWithOverpayments: MemberWithCredit[];
  overduePayments: OverdueMemberInfo[];
}

@Component({
  selector: 'app-superadmin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatSnackBarModule
  ],
  templateUrl: './superadmin-dashboard.html',
  styleUrls: ['./superadmin-dashboard.component.css']
})
export class SuperadminDashboard implements OnInit, OnDestroy {
  loading = false;
  error: string | null = null;
  dashboardData: DashboardData | null = null;
  previousDashboardData: DashboardData | null = null;
  autoRefreshEnabled = false;
  countdown = 30;
  private refreshInterval$?: Subscription;
  private countdownInterval$?: Subscription;
  private audioContext?: AudioContext;

  // Table columns
  reservationColumns = ['member', 'date', 'time', 'players', 'amount', 'status'];
  overpaymentColumns = ['member', 'email', 'creditBalance', 'actions'];

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private router: Router,
    private location: Location
  ) {}

  ngOnInit() {
    this.loadDashboardData();
  }

  ngOnDestroy() {
    this.stopAutoRefresh();
  }

  loadDashboardData() {
    this.loading = true;
    this.error = null;

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    this.http.get<{ success: boolean; data: DashboardData }>(
      `${environment.apiUrl}/dashboard/superadmin`,
      { headers }
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.dashboardData = response.data;
          this.loading = false;
        }
      },
      error: (error) => {
        console.error('Error loading dashboard data:', error);
        this.error = error.error?.message || 'Failed to load dashboard data';
        this.loading = false;
        this.showMessage('Failed to load dashboard data', 'error');
      }
    });
  }

  refreshData() {
    this.loadDashboardData();
    this.showMessage('Dashboard data refreshed', 'success');
  }

  toggleAutoRefresh(enabled: boolean) {
    this.autoRefreshEnabled = enabled;

    if (enabled) {
      this.countdown = 30;
      this.startAutoRefresh();
      this.showMessage('Auto-refresh enabled (30s)', 'success');
    } else {
      this.stopAutoRefresh();
      this.showMessage('Auto-refresh disabled', 'info');
    }
  }

  private startAutoRefresh() {
    // Countdown timer
    this.countdownInterval$ = interval(1000).subscribe(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        this.countdown = 30;
      }
    });

    // Data refresh every 30 seconds
    this.refreshInterval$ = interval(30000)
      .pipe(switchMap(() => {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        return this.http.get<{ success: boolean; data: DashboardData }>(
          `${environment.apiUrl}/dashboard/superadmin`,
          { headers }
        );
      }))
      .subscribe({
        next: (response) => {
          if (response.success) {
            const newData = response.data;
            
            // Check for new records and play alert
            if (this.dashboardData && this.hasNewRecords(this.dashboardData, newData)) {
              this.playAlertSound();
              this.showMessage('New updates detected!', 'success');
            }
            
            this.previousDashboardData = this.dashboardData;
            this.dashboardData = newData;
            this.countdown = 30;
          }
        },
        error: (error) => {
          console.error('Auto-refresh error:', error);
        }
      });
  }

  private stopAutoRefresh() {
    if (this.refreshInterval$) {
      this.refreshInterval$.unsubscribe();
      this.refreshInterval$ = undefined;
    }
    if (this.countdownInterval$) {
      this.countdownInterval$.unsubscribe();
      this.countdownInterval$ = undefined;
    }
  }

  // Navigation helpers
  goBack() {
    this.location.back();
  }

  navigateToSuggestions() {
    this.router.navigate(['/admin/suggestions']);
  }

  navigateToCreditManagement(userId: string) {
    this.router.navigate(['/admin/credits']);
  }

  navigateToPaymentManagement() {
    this.router.navigate(['/admin/payments']);
  }

  // Helper methods
  getTimeSlotLabel(slot: number): string {
    const hour = slot % 12 || 12;
    const period = slot < 12 ? 'AM' : 'PM';
    return `${hour}${period}`;
  }

  getStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      'confirmed': 'primary',
      'pending': 'accent',
      'completed': 'primary',
      'cancelled': 'warn',
      'open': 'accent',
      'in_review': 'accent',
      'in_progress': 'accent',
      'resolved': 'primary',
      'closed': ''
    };
    return colors[status] || '';
  }

  getPaymentMethodIcon(method: string): string {
    const icons: { [key: string]: string } = {
      'cash': 'payments',
      'bank_transfer': 'account_balance',
      'gcash': 'account_balance_wallet',
      'coins': 'monetization_on'
    };
    return icons[method] || 'payment';
  }

  getPaymentMethodIconPath(method: string): string {
    const paths: { [key: string]: string } = {
      'cash': 'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z',
      'bank_transfer': 'M4 10h16v2H4zm0-4h16v2H4zm0-4h16v2H4zm0-4h16v2H4z',
      'gcash': 'M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
      'coins': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z'
    };
    return paths[method] || 'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z';
  }

  getPriorityColor(priority: string): string {
    const colors: { [key: string]: string } = {
      'urgent': 'warn',
      'high': 'warn',
      'medium': 'accent',
      'low': ''
    };
    return colors[priority] || '';
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  formatTime(date: Date | string): string {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  getDaysOverdue(dueDate: Date | string): number {
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  }

  formatDateTime(date: Date | string): string {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  formatPageName(page: string): string {
    if (!page) return '-';
    // If stored as a path (e.g. old DB records like '/calendar'), convert to readable name
    if (page.startsWith('/')) {
      return page
        .replace(/^\/admin\//, 'Admin - ')
        .replace(/^\//, '')
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
    return page;
  }

  getPlayerNames(players: any[]): string[] {
    if (!players || players.length === 0) return [];

    return players.map(player => {
      if (typeof player === 'string') {
        return player;
      } else if (player.name) {
        return player.name;
      } else if (player.fullName) {
        return player.fullName;
      }
      return 'Unknown';
    });
  }

  private hasNewRecords(oldData: DashboardData, newData: DashboardData): boolean {
    // Check for new reservations
    if (newData.recentReservations.length > oldData.recentReservations.length) {
      const oldIds = new Set(oldData.recentReservations.map(r => r._id));
      const hasNew = newData.recentReservations.some(r => !oldIds.has(r._id));
      if (hasNew) return true;
    }

    // Check for new payments
    if (newData.recentPayments.length > oldData.recentPayments.length) {
      const oldIds = new Set(oldData.recentPayments.map(p => p._id));
      const hasNew = newData.recentPayments.some(p => !oldIds.has(p._id));
      if (hasNew) return true;
    }

    // Check for new feedback
    if (newData.latestFeedback.length > oldData.latestFeedback.length) {
      const oldIds = new Set(oldData.latestFeedback.map(f => f._id));
      const hasNew = newData.latestFeedback.some(f => !oldIds.has(f._id));
      if (hasNew) return true;
    }

    // Check for new page visits
    if (newData.recentPageVisits.length > oldData.recentPageVisits.length) {
      const oldIds = new Set(oldData.recentPageVisits.map(v => v._id));
      const hasNew = newData.recentPageVisits.some(v => !oldIds.has(v._id));
      if (hasNew) return true;
    }

    // Check for court status changes
    if (!oldData.courtStatus.current && newData.courtStatus.current) return true;
    if (!oldData.courtStatus.next && newData.courtStatus.next) return true;

    // Check for new overdue payments
    if (newData.overduePayments && oldData.overduePayments &&
        newData.overduePayments.length > oldData.overduePayments.length) {
      const oldIds = new Set(oldData.overduePayments.map(p => p._id));
      if (newData.overduePayments.some(p => !oldIds.has(p._id))) return true;
    }

    return false;
  }

  private playAlertSound() {
    try {
      // Create audio context if not exists
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const ctx = this.audioContext;
      const now = ctx.currentTime;
      
      // Create oscillator for a pleasant notification sound
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      // Pleasant two-tone notification (like a doorbell)
      oscillator.frequency.setValueAtTime(659.25, now); // E note
      oscillator.frequency.setValueAtTime(783.99, now + 0.1); // G note
      
      gainNode.gain.setValueAtTime(0.3, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      
      oscillator.start(now);
      oscillator.stop(now + 0.3);
    } catch (error) {
      console.error('Failed to play alert sound:', error);
    }
  }

  private showMessage(message: string, type: 'success' | 'error' | 'info' = 'info') {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: type === 'error' ? 'snack-bar-error' : (type === 'success' ? 'snack-bar-success' : '')
    });
  }
}
