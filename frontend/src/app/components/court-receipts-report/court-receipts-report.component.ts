import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormControl, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { CreditService, CreditTransaction } from '../../services/credit.service';
import { PaymentConfirmationDialogComponent, PaymentConfirmationData } from '../payment-confirmation-dialog/payment-confirmation-dialog.component';
import { UnrecordConfirmationDialogComponent, UnrecordDialogData } from '../unrecord-confirmation-dialog/unrecord-confirmation-dialog.component';
import { EditPaymentAmountDialogComponent, EditPaymentAmountData } from '../edit-payment-amount-dialog/edit-payment-amount-dialog.component';
import { CreditDepositConfirmDialogComponent } from '../credit-deposit-confirm-dialog/credit-deposit-confirm-dialog.component';
import { environment } from '../../../environments/environment';

interface PaymentRecord {
  _id: string;
  paymentDate?: string;
  referenceNumber: string;
  amount: number;
  serviceFee?: number;
  courtRevenue?: number;
  paymentMethod: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'record';
  memberName: string;
  memberUsername: string;
  reservationDate: string;
  timeSlot: number;
  timeSlotDisplay: string;
  players: string[];
  isPeakHour: boolean;
  approvedBy?: string;
  approvedAt?: string;
  recordedBy?: string;
  recordedAt?: string;
  userId: {
    _id: string;
    username: string;
    fullName: string;
  };
  // Open Play Event data
  pollId?: {
    _id: string;
    title: string;
    openPlayEvent?: {
      eventDate: Date;
      startTime: number;
      endTime: number;
      confirmedPlayers: Array<{
        _id: string;
        username: string;
        fullName: string;
      }>;
    };
  };
  isOpenPlayEvent: boolean;
  openPlayParticipants: string[];
}

interface PaymentsReportData {
  payments: PaymentRecord[];
  summary: {
    totalPayments: number;
    totalAmount: number;
    pendingPayments: number;
    completedPayments: number;
    recordedPayments: number;
    totalServiceFees: number;
    totalCourtRevenue: number;
  };
  paymentMethodBreakdown: Array<{
    paymentMethod: string;
    count: number;
    totalAmount: number;
  }>;
  period: {
    startDate: string;
    endDate: string;
  };
}

@Component({
  selector: 'app-court-receipts-report',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatSnackBarModule,
    ReactiveFormsModule,
    FormsModule
  ],
  templateUrl: './court-receipts-report.component.html',
  styleUrls: ['./court-receipts-report.component.css']
})
export class CourtReceiptsReportComponent implements OnInit {
  reportData: PaymentsReportData | null = null;
  loading = false;
  processingPaymentId: string | null = null;
  processing: string[] = [];
  
  // Recorded payments modal
  showRecordedModal = false;
  loadingRecordedPayments = false;
  recordedPayments: PaymentRecord[] = [];
  
  // Credit deposits data
  creditDeposits: CreditTransaction[] = [];
  loadingCreditDeposits = false;
  
  // Amount editing
  updatingPayment = false;

  // Tab management for native HTML tabs
  activeTab: 'active' | 'credits' | 'archived' = 'active';

  private apiUrl = environment.apiUrl;
  
  dateRangeForm = new FormGroup({
    startDate: new FormControl<string | null>(null),
    endDate: new FormControl<string | null>(null)
  });

  private baseUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private router: Router,
    private authService: AuthService,
    private creditService: CreditService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    // Set default date range to show payments from 2026 to today
    const endDate = new Date();
    const startDate = new Date('2026-01-01');

    this.dateRangeForm.patchValue({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });
  }

  ngOnInit(): void {
    // Check if user has financial access (treasurer, admin, or superadmin)
    if (!this.authService.hasFinancialAccess()) {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.loadReport();
    this.loadCreditDeposits();
  }


  // Tab filtering methods
  getActivePayments(): PaymentRecord[] {
    if (!this.reportData) return [];
    return this.reportData.payments.filter(p => 
      p.status === 'completed'
    );
  }

  getCreditDeposits(): CreditTransaction[] {
    return this.creditDeposits;
  }

  getArchivedPayments(): PaymentRecord[] {
    if (!this.reportData) return [];
    return this.reportData.payments.filter(p =>
      p.status === 'record' || p.status === 'refunded' || p.status === 'failed'
    );
  }

  // Calculate subtotal for active payments
  getActivePaymentsSubtotal(): number {
    const activePayments = this.getActivePayments();
    return activePayments.reduce((sum, payment) => sum + payment.amount, 0);
  }

  loadReport(): void {
    this.loading = true;
    this.loadCreditDeposits();

    const params: any = {};
    if (this.dateRangeForm.value.startDate) {
      params.startDate = new Date(this.dateRangeForm.value.startDate).toISOString();
    }
    if (this.dateRangeForm.value.endDate) {
      // Set to end of day for the end date
      const endDate = new Date(this.dateRangeForm.value.endDate);
      endDate.setHours(23, 59, 59, 999);
      params.endDate = endDate.toISOString();
    }
    // Fetch all payments without limit
    params.limit = 999999;

    this.http.get<{success: boolean, data: PaymentRecord[]}>(`${this.baseUrl}/payments`, { params })
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            // Transform the payments data to match our interface
            this.reportData = {
              payments: response.data.map((payment: any) => {
                const reservation = payment.reservationId || {};
                const poll = payment.pollId || {};
                const openPlayEvent = poll.openPlayEvent || {};

                // Determine payment type
                const isOpenPlayEvent = !!payment.pollId;
                const isManualPayment = payment.metadata?.isManualPayment;

                let players: string[] = [];
                let reservationDate: string;
                let timeSlot: number;
                let timeSlotDisplay: string;
                let openPlayParticipants: string[] = [];

                if (isManualPayment) {
                  // Manual payment
                  players = payment.metadata.playerNames || [];
                  reservationDate = payment.metadata.courtUsageDate || new Date().toISOString();
                  timeSlot = payment.metadata.startTime || 0;
                  const endTime = payment.metadata.endTime || (timeSlot + 1);
                  timeSlotDisplay = `${timeSlot}:00-${endTime}:00`;
                } else if (isOpenPlayEvent) {
                  // Open Play event
                  reservationDate = openPlayEvent.eventDate || new Date().toISOString();
                  timeSlot = openPlayEvent.startTime || 18;
                  timeSlotDisplay = `${openPlayEvent.startTime || 18}:00-${openPlayEvent.endTime || 20}:00`;
                  openPlayParticipants = (openPlayEvent.confirmedPlayers || []).map((p: any) => p.fullName);
                  players = openPlayParticipants; // For backward compatibility
                } else {
                  // Court reservation
                  // Map player objects to their names
                  const playersArray = reservation.players || [];
                  players = playersArray.map((p: any) => {
                    if (typeof p === 'string') return p;
                    // New format: objects with 'name' property
                    if (p.name) return p.name;
                    // Fallback to user object properties
                    return p.fullName || p.username || 'Unknown Player';
                  });
                  reservationDate = reservation.date || new Date().toISOString();
                  timeSlot = reservation.timeSlot || 0;
                  const endTimeSlot = reservation.endTimeSlot || (timeSlot + 1);
                  timeSlotDisplay = `${timeSlot}:00-${endTimeSlot}:00`;
                }
                
                return {
                  ...payment,
                  memberName: payment.userId?.fullName || 'Unknown',
                  memberUsername: payment.userId?.username || 'unknown',
                  reservationDate,
                  timeSlot,
                  timeSlotDisplay,
                  players,
                  openPlayParticipants,
                  isOpenPlayEvent,
                  isPeakHour: payment.metadata?.isPeakHour || false
                };
              }),
              summary: {
                totalPayments: response.data.filter((p: any) => p.status === 'completed' || p.status === 'record').length,
                totalAmount: response.data.filter((p: any) => p.status === 'completed' || p.status === 'record').reduce((sum: number, p: any) => sum + p.amount, 0),
                pendingPayments: response.data.filter((p: any) => p.status === 'pending').length,
                completedPayments: response.data.filter((p: any) => p.status === 'completed').length,
                recordedPayments: response.data.filter((p: any) => p.status === 'record').length,
                totalServiceFees: response.data.filter((p: any) => p.status === 'completed' || p.status === 'record').reduce((sum: number, p: any) => sum + (p.amount * 0.20), 0),
                totalCourtRevenue: response.data.filter((p: any) => p.status === 'completed' || p.status === 'record').reduce((sum: number, p: any) => sum + (p.amount * 0.80), 0)
              },
              paymentMethodBreakdown: this.calculatePaymentMethodBreakdown(response.data),
              period: {
                startDate: params.startDate || '',
                endDate: params.endDate || ''
              }
            };
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading payments report:', error);
          this.showMessage('Failed to load payments data', 'error');
          this.loading = false;
        }
      });
  }

  resetDateRange(): void {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    this.dateRangeForm.patchValue({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });

    this.loadReport();
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  formatDateTime(dateString: string): string {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  formatTime(timeSlot: number): string {
    return `${timeSlot}:00`;
  }

  formatPaymentMethod(method: string): string {
    const methodMap: {[key: string]: string} = {
      'cash': 'Cash',
      'bank_transfer': 'Bank Transfer',
      'gcash': 'GCash',
      'credit': 'Account Credit'
    };
    return methodMap[method] || method || 'N/A';
  }

  getStatusLabel(status: string): string {
    const statusLabels: {[key: string]: string} = {
      'pending': 'Pending',
      'completed': 'Approved',
      'record': 'Recorded',
      'refunded': 'Refunded',
      'failed': 'Failed'
    };
    return statusLabels[status] || status;
  }

  private calculatePaymentMethodBreakdown(payments: any[]): Array<{paymentMethod: string, count: number, totalAmount: number}> {
    const breakdown = new Map<string, {count: number, totalAmount: number}>();
    
    payments
      .filter(p => p.status === 'completed' || p.status === 'record')
      .forEach(payment => {
        const method = payment.paymentMethod || 'unknown';
        if (!breakdown.has(method)) {
          breakdown.set(method, { count: 0, totalAmount: 0 });
        }
        const current = breakdown.get(method)!;
        current.count++;
        current.totalAmount += payment.amount;
      });
    
    return Array.from(breakdown.entries()).map(([paymentMethod, data]) => ({
      paymentMethod,
      ...data
    }));
  }

  approvePayment(payment: PaymentRecord): void {
    const dialogData: PaymentConfirmationData = {
      action: 'approve',
      paymentId: payment._id,
      memberName: payment.memberName,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      referenceNumber: payment.referenceNumber,
      reservationDate: this.formatDate(payment.reservationDate),
      timeSlot: payment.timeSlotDisplay
    };

    const dialogRef = this.dialog.open(PaymentConfirmationDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
      data: dialogData,
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.executeApprovePayment(payment._id);
      }
    });
  }

  private executeApprovePayment(paymentId: string): void {
    this.processing.push(paymentId);

    this.http.put<any>(`${this.apiUrl}/payments/${paymentId}`, { status: 'completed' })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.showMessage('Payment approved successfully', 'success');
            this.loadReport();
          } else {
            this.showMessage(response.message || 'Failed to approve payment', 'error');
          }
          this.processing = this.processing.filter(id => id !== paymentId);
        },
        error: (error) => {
          console.error('Error approving payment:', error);
          this.showMessage('Error approving payment', 'error');
          this.processing = this.processing.filter(id => id !== paymentId);
        }
      });
  }

  recordPayment(payment: PaymentRecord): void {
    const dialogData: PaymentConfirmationData = {
      action: 'record',
      paymentId: payment._id,
      memberName: payment.memberName,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      referenceNumber: payment.referenceNumber,
      reservationDate: this.formatDate(payment.reservationDate),
      timeSlot: payment.timeSlotDisplay,
      existingPaymentDate: payment.paymentDate
    };

    const dialogRef = this.dialog.open(PaymentConfirmationDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
      data: dialogData,
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.executeRecordPayment(payment._id);
      }
    });
  }

  private executeRecordPayment(paymentId: string): void {
    this.processing.push(paymentId);

    this.http.put<any>(`${this.apiUrl}/payments/${paymentId}/record`, {})
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.showMessage('Payment recorded successfully', 'success');
            this.loadReport();
          } else {
            this.showMessage(response.message || 'Failed to record payment', 'error');
          }
          this.processing = this.processing.filter(id => id !== paymentId);
        },
        error: (error) => {
          console.error('Error recording payment:', error);
          this.showMessage('Error recording payment', 'error');
          this.processing = this.processing.filter(id => id !== paymentId);
        }
      });
  }

  cancelPayment(payment: PaymentRecord): void {
    const dialogData: PaymentConfirmationData = {
      action: 'cancel',
      paymentId: payment._id,
      memberName: payment.memberName,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      referenceNumber: payment.referenceNumber,
      reservationDate: this.formatDate(payment.reservationDate),
      timeSlot: payment.timeSlotDisplay
    };

    const dialogRef = this.dialog.open(PaymentConfirmationDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
      data: dialogData,
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.confirmed) {
        this.executeCancelPayment(payment._id);
      }
    });
  }

  private executeCancelPayment(paymentId: string): void {
    this.processing.push(paymentId);

    this.http.put<any>(`${this.apiUrl}/payments/${paymentId}`, { status: 'pending' })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.showMessage('Payment set to pending', 'success');
            this.loadReport();
          } else {
            this.showMessage(response.message || 'Failed to update payment', 'error');
          }
          this.processing = this.processing.filter(id => id !== paymentId);
        },
        error: (error) => {
          console.error('Error updating payment:', error);
          this.showMessage('Error updating payment', 'error');
          this.processing = this.processing.filter(id => id !== paymentId);
        }
      });
  }

  failPayment(payment: PaymentRecord): void {
    const dialogData: PaymentConfirmationData = {
      action: 'fail',
      paymentId: payment._id,
      memberName: payment.memberName,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      referenceNumber: payment.referenceNumber,
      reservationDate: this.formatDate(payment.reservationDate),
      timeSlot: payment.timeSlotDisplay
    };

    const dialogRef = this.dialog.open(PaymentConfirmationDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
      data: dialogData,
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.confirmed) {
        this.executeFailPayment(payment._id);
      }
    });
  }

  private executeFailPayment(paymentId: string): void {
    this.processing.push(paymentId);

    this.http.put<any>(`${this.apiUrl}/payments/${paymentId}`, { status: 'failed' })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.showMessage('Payment marked as failed', 'success');
            this.loadReport();
          } else {
            this.showMessage(response.message || 'Failed to update payment', 'error');
          }
          this.processing = this.processing.filter(id => id !== paymentId);
        },
        error: (error) => {
          console.error('Error marking payment as failed:', error);
          this.showMessage('Error updating payment', 'error');
          this.processing = this.processing.filter(id => id !== paymentId);
        }
      });
  }

  revertToCompleted(payment: PaymentRecord): void {
    const dialogData: PaymentConfirmationData = {
      action: 'complete',
      paymentId: payment._id,
      memberName: payment.memberName,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      referenceNumber: payment.referenceNumber,
      reservationDate: this.formatDate(payment.reservationDate),
      timeSlot: payment.timeSlotDisplay
    };

    const dialogRef = this.dialog.open(PaymentConfirmationDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
      data: dialogData,
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.confirmed) {
        this.executeRevertToCompleted(payment._id);
      }
    });
  }

  private executeRevertToCompleted(paymentId: string): void {
    this.processing.push(paymentId);

    this.http.put<any>(`${this.apiUrl}/payments/${paymentId}`, { status: 'completed' })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.showMessage('Payment marked as completed', 'success');
            this.loadReport();
          } else {
            this.showMessage(response.message || 'Failed to update payment', 'error');
          }
          this.processing = this.processing.filter(id => id !== paymentId);
        },
        error: (error) => {
          console.error('Error marking payment as completed:', error);
          this.showMessage('Error updating payment', 'error');
          this.processing = this.processing.filter(id => id !== paymentId);
        }
      });
  }

  unrecordPayment(paymentId: string): void {
    // Find the payment to get its details
    const payment = this.reportData?.payments.find(p => p._id === paymentId);
    if (!payment) return;
    
    const dialogData: UnrecordDialogData = {
      paymentId: paymentId,
      memberName: payment.memberName,
      amount: payment.amount,
      referenceNumber: payment.referenceNumber,
      description: `${payment.memberName} - ₱${payment.amount.toFixed(2)} (${payment.referenceNumber})`
    };

    const dialogRef = this.dialog.open(UnrecordConfirmationDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
      data: dialogData,
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.executeUnrecordPayment(paymentId);
      }
    });
  }

  private executeUnrecordPayment(paymentId: string): void {
    this.processing.push(paymentId);

    this.http.put<any>(`${this.apiUrl}/payments/${paymentId}/unrecord`, {})
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.showMessage('Payment unrecorded successfully', 'success');
            this.loadReport();
          } else {
            this.showMessage(response.message || 'Failed to unrecord payment', 'error');
          }
          this.processing = this.processing.filter(id => id !== paymentId);
        },
        error: (error) => {
          console.error('Error unrecording payment:', error);
          this.showMessage('Error unrecording payment', 'error');
          this.processing = this.processing.filter(id => id !== paymentId);
        }
      });
  }

  openRecordedPaymentsModal(): void {
    this.showRecordedModal = true;
    this.loadRecordedPayments();
  }

  closeRecordedModal(): void {
    this.showRecordedModal = false;
  }

  private loadRecordedPayments(): void {
    this.loadingRecordedPayments = true;

    const params: any = { status: 'record' };
    if (this.dateRangeForm.value.startDate) {
      params.startDate = new Date(this.dateRangeForm.value.startDate).toISOString();
    }
    if (this.dateRangeForm.value.endDate) {
      const endDate = new Date(this.dateRangeForm.value.endDate);
      endDate.setHours(23, 59, 59, 999);
      params.endDate = endDate.toISOString();
    }

    this.http.get<{success: boolean, data: PaymentRecord[]}>(`${this.baseUrl}/payments`, { params })
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.recordedPayments = response.data.map((payment: any) => {
              const reservation = payment.reservationId || {};
              return {
                ...payment,
                memberName: payment.userId?.fullName || 'Unknown',
                reservationDate: reservation.date || new Date().toISOString(),
                timeSlot: reservation.timeSlot || 0,
                timeSlotDisplay: `${reservation.timeSlot || 0}:00-${(reservation.endTimeSlot || reservation.timeSlot + 1) || 1}:00`
              };
            });
          }
          this.loadingRecordedPayments = false;
        },
        error: (error) => {
          console.error('Error loading recorded payments:', error);
          this.showMessage('Failed to load recorded payments', 'error');
          this.loadingRecordedPayments = false;
        }
      });
  }

  exportToCSV(): void {
    if (!this.reportData || this.reportData.payments.length === 0) {
      this.showMessage('No data to export', 'warning');
      return;
    }

    const headers = ['Payment Date', 'Reference #', 'Member', 'Username', 'Reservation Date', 'Time Slot', 'Payment Method', 'Amount', 'Status'];
    const rows = this.reportData.payments.map(p => [
      p.paymentDate ? this.formatDate(p.paymentDate) : 'Not paid',
      p.referenceNumber,
      p.memberName,
      p.memberUsername,
      this.formatDate(p.reservationDate),
      p.timeSlotDisplay,
      this.formatPaymentMethod(p.paymentMethod),
      p.amount.toFixed(2),
      this.getStatusLabel(p.status)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `payments_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportRecordedToCSV(): void {
    if (this.recordedPayments.length === 0) {
      this.showMessage('No recorded payments to export', 'warning');
      return;
    }

    const headers = ['Timestamp', 'Member', 'Date', 'Start Time', 'End Time', 'Payment Method', 'Amount'];
    const rows = this.recordedPayments.map(p => [
      this.formatDateTime(p.recordedAt || p.paymentDate || ''),
      p.memberName,
      this.formatDate(p.reservationDate),
      this.formatTime(p.timeSlot),
      this.formatTime(p.timeSlot + 1),
      this.formatPaymentMethod(p.paymentMethod),
      p.amount.toFixed(2)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `recorded_payments_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  goBack(): void {
    this.router.navigate(['/admin']);
  }

  private showMessage(message: string, type: 'success' | 'error' | 'warning'): void {
    console.log(`[${type.toUpperCase()}]`, message);
    // Using MatSnackBar for consistency with existing dialogs
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
  }

  // Credit deposits methods
  loadCreditDeposits(): void {
    this.loadingCreditDeposits = true;

    const startDate = this.dateRangeForm.value.startDate
      ? new Date(this.dateRangeForm.value.startDate).toISOString()
      : undefined;
    const endDate = this.dateRangeForm.value.endDate
      ? (() => {
          const date = new Date(this.dateRangeForm.value.endDate);
          date.setHours(23, 59, 59, 999);
          return date.toISOString();
        })()
      : undefined;

    this.creditService.getAllCreditDeposits(1, 100, undefined, startDate, endDate).subscribe({
      next: (response) => {
        // Filter for pending or completed deposits only (exclude recorded ones)
        this.creditDeposits = response.data.transactions.filter(t =>
          t.status === 'pending' || t.status === 'completed'
        );
        this.loadingCreditDeposits = false;
      },
      error: (error) => {
        console.error('Error loading credit deposits:', error);
        this.loadingCreditDeposits = false;
      }
    });
  }

  recordCreditDeposit(deposit: CreditTransaction): void {
    // Create a simple confirmation dialog
    const dialogRef = this.dialog.open(CreditDepositConfirmDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
      data: {
        amount: deposit.amount,
        memberName: this.getUserFullName(deposit.userId),
        memberUsername: this.getUserUsername(deposit.userId),
        paymentMethod: this.getPaymentMethodLabel(deposit.metadata?.paymentMethod || ''),
        createdAt: deposit.createdAt
      },
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.executeRecordCreditDeposit(deposit._id);
      }
    });
  }

  private executeRecordCreditDeposit(depositId: string): void {
    this.processing.push(depositId);

    this.creditService.recordCreditDeposit(depositId).subscribe({
      next: (response) => {
        this.showMessage('Credit deposit recorded successfully', 'success');
        this.loadCreditDeposits();
        this.loadReport();
        this.processing = this.processing.filter(id => id !== depositId);
      },
      error: (error) => {
        console.error('Error recording credit deposit:', error);
        this.showMessage('Failed to record credit deposit', 'error');
        this.processing = this.processing.filter(id => id !== depositId);
      }
    });
  }

  getUserFullName(userId: string | { fullName: string }): string {
    if (typeof userId === 'string') {
      return 'Unknown User';
    }
    return userId.fullName;
  }

  getUserUsername(userId: string | { username: string }): string {
    if (typeof userId === 'string') {
      return 'unknown';
    }
    return userId.username;
  }

  getPaymentMethodLabel(method: string): string {
    const methodMap: {[key: string]: string} = {
      'cash': 'Cash',
      'bank_transfer': 'Bank Transfer',
      'gcash': 'GCash'
    };
    return methodMap[method] || method || 'N/A';
  }

  formatTimeFromDate(dateString: string): string {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  // Amount editing methods
  handleAmountClick(payment: PaymentRecord): void {
    // Only allow admins to edit amounts
    if (!this.authService.isAdmin()) {
      this.snackBar.open('Only admins can edit payment amounts', 'Close', {
        duration: 3000
      });
      return;
    }

    // Check payment status restrictions
    if (payment.status === 'record') {
      this.snackBar.open('Recorded payments cannot be edited. Use unrecord feature first.', 'Close', {
        duration: 4000
      });
      return;
    }

    if (payment.status === 'refunded') {
      this.snackBar.open('Refunded payments cannot be edited.', 'Close', {
        duration: 4000
      });
      return;
    }

    // Allow editing pending, completed, and failed payments
    if (!['pending', 'completed', 'failed'].includes(payment.status)) {
      this.snackBar.open(`Cannot edit ${payment.status} payments.`, 'Close', {
        duration: 4000
      });
      return;
    }

    // If we get here, the payment can be edited
    this.openEditAmountModal(payment);
  }

  openEditAmountModal(payment: PaymentRecord): void {
    const dialogData: EditPaymentAmountData = {
      paymentId: payment._id,
      memberName: payment.memberName,
      currentAmount: payment.amount,
      reservationDate: payment.reservationDate,
      timeSlot: payment.timeSlotDisplay
    };

    const dialogRef = this.dialog.open(EditPaymentAmountDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
      data: dialogData,
      disableClose: false,
      panelClass: 'edit-amount-dialog'
    });

    dialogRef.afterClosed().subscribe(newAmount => {
      if (newAmount && newAmount !== payment.amount) {
        this.updatePaymentAmount(payment, newAmount);
      }
    });
  }

  canEditPayment(payment: PaymentRecord): boolean {
    if (!this.authService.isAdmin()) {
      return false;
    }
    
    // Admins can edit pending, completed, and failed payments
    return ['pending', 'completed', 'failed'].includes(payment.status);
  }

  getAmountTitle(payment: PaymentRecord): string {
    if (!this.authService.isAdmin()) {
      return 'Only admins can edit payment amounts';
    }
    
    if (this.canEditPayment(payment)) {
      return 'Click to edit amount';
    }
    
    const titles: {[key: string]: string} = {
      'record': 'Payment recorded in financial reports - use unrecord feature first',
      'refunded': 'Refunded payments cannot be edited'
    };
    return titles[payment.status] || 'Amount cannot be edited';
  }

  private updatePaymentAmount(payment: PaymentRecord, newAmount: number): void {
    this.updatingPayment = true;

    const updateData = {
      customAmount: newAmount
    };

    this.http.put<any>(`${this.apiUrl}/payments/${payment._id}`, updateData)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.snackBar.open('Payment amount updated successfully', 'Close', {
              duration: 3000
            });
            
            // Update the payment in the local data
            if (this.reportData && this.reportData.payments) {
              const paymentIndex = this.reportData.payments.findIndex(p => p._id === payment._id);
              if (paymentIndex !== -1) {
                this.reportData.payments[paymentIndex].amount = newAmount;
              }
            }
          } else {
            this.snackBar.open(response.message || 'Failed to update payment amount', 'Close', {
              duration: 3000
            });
          }
        },
        error: (error) => {
          console.error('Error updating payment amount:', error);
          this.snackBar.open('Error updating payment amount', 'Close', {
            duration: 3000
          });
        },
        complete: () => {
          this.updatingPayment = false;
        }
      });
  }
}
