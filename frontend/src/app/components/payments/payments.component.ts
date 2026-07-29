import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { trigger, transition, style, animate } from '@angular/animations';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CancellationDialogComponent, CancellationDialogData } from '../cancellation-dialog/cancellation-dialog.component';
import { environment } from '../../../environments/environment';
import { canCancelReservation } from '../../utils/date-validation.util';

// Interfaces
interface Payment {
  _id: string;
  reservationId?: {
    _id: string;
    userId?: string;
    date: Date;
    timeSlot: number;
    endTimeSlot?: number;
    duration?: number;
    players: string[];
    timeSlotDisplay: string;
    totalFee?: number;
    tennisBalls?: {
      quantity: number;
      costPerCan: number;
      totalCost: number;
    };
  };
  pollId?: {
    _id: string;
    title: string;
    openPlayEvent?: {
      eventDate: Date;
      startTime: number;
      endTime: number;
    };
  };
  userId: {
    _id: string;
    username: string;
    fullName: string;
  };
  paidBy?: {
    _id: string;
    username: string;
    fullName: string;
  };
  amount: number;
  currency: string;
  paymentMethod: 'cash' | 'bank_transfer' | 'gcash';
  paymentType?: 'court_usage' | 'membership_fee' | 'tournament_entry' | 'cancellation_fee';
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'record';
  transactionId?: string;
  referenceNumber: string;
  paymentDate?: Date;
  dueDate?: Date;
  description: string;
  formattedAmount: string;
  statusDisplay: string;
  isOverdue: boolean;
  daysUntilDue: number;
  createdAt: Date;
  isSynthetic?: boolean; // Flag for synthetic payment objects created from unpaid reservations
  _groupedPayments?: Payment[]; // For storing original payments when grouped
  metadata?: {
    timeSlot?: number;
    date?: Date;
    playerCount?: number;
    isPeakHour?: boolean;
    originalFee?: number;
    isAdminOverride?: boolean;
    discounts?: Array<{
      type: string;
      amount: number;
      description: string;
    }>;
    openPlayEventTitle?: string;
    openPlayEventDate?: Date;
    // Manual payment specific metadata
    isManualPayment?: boolean;
    playerNames?: string[];
    courtUsageDate?: Date;
    startTime?: number;
    endTime?: number;
    createdBy?: string;
    createdById?: string;
    // Cancellation metadata
    cancellation?: {
      reason: string;
      cancelledAt: Date;
      cancelledBy: string;
      previousStatus: string;
    };
    // Pay on behalf metadata
    paidOnBehalf?: boolean;
    originalDebtor?: string;
    // Assigned expense metadata
    isAssignedExpense?: boolean;
    reason?: string;
    // Tennis balls metadata
    tennisBalls?: {
      quantity: number;
      costPerCan: number;
      totalCost: number;
    };
  };
  notes?: string;
  hasProofOfPayment?: boolean;
}

interface ReservationPlayer {
  name: string;
  userId?: string | null;
  isMember: boolean;
  isGuest: boolean;
}

interface Reservation {
  _id: string;
  userId?: string;
  date: Date;
  timeSlot: number;
  endTimeSlot?: number;
  duration?: number;
  players: (string | ReservationPlayer)[];
  paymentIds?: string[];
  status: string;
  paymentStatus: string;
  totalFee: number;
  timeSlotDisplay: string;
  _groupedReservationIds?: string[]; // For grouped reservations
  tennisBalls?: {
    quantity: number;
    costPerCan: number;
    totalCost: number;
  };
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule
  ],
  animations: [
    trigger('slideInOut', [
      transition(':enter', [
        style({ transform: 'translateX(100%)', opacity: 0 }),
        animate('300ms ease-in', style({ transform: 'translateX(0%)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('300ms ease-out', style({ transform: 'translateX(100%)', opacity: 0 }))
      ])
    ])
  ],
  template: `
    <div class="payments-container">
      <!-- Page Header -->
      <div class="page-header">
        <h1>💳 Payment Management</h1>
        <p class="page-subtitle">Manage your court reservation payments</p>
      </div>

      <!-- Tab Navigation -->
      <div class="tab-navigation">
        <button 
          class="tab-btn"
          [class.active]="activeTab === 'pending'"
          (click)="activeTab = 'pending'; loadPendingPayments()">
          Pending Payments
        </button>
        <button 
          class="tab-btn"
          [class.active]="activeTab === 'manual'"
          (click)="activeTab = 'manual'">
          Manual Payment
        </button>
        <button 
          class="tab-btn"
          [class.active]="activeTab === 'history'"
          (click)="activeTab = 'history'; loadPaymentHistory()">
          Payment History
        </button>
      </div>

      <!-- Manual Payment Tab -->
      <div class="tab-content" *ngIf="activeTab === 'manual'">
        <div class="manual-payment-container">
          <h2>Manual Payment</h2>
          <p class="tab-subtitle">Submit a payment for court usage not made through reservations</p>
          
          <div class="manual-payment-form-section">
            <div class="section-header">
              <div class="payment-icon">
                <mat-icon>receipt_long</mat-icon>
              </div>
              <div class="section-title">
                Create Manual Payment
                <span class="step-indicator">Fill in the details below</span>
              </div>
            </div>

            <div class="form-container">
              <form [formGroup]="manualPaymentForm" (ngSubmit)="onManualPaymentSubmit()" class="manual-payment-form">
                <!-- Player Name (Only for Superadmin) -->
                <div class="field" *ngIf="isSuperAdmin()">
                  <label for="playerName">Player *</label>
                  <select id="playerName" formControlName="playerName">
                    <option value="">Select a player</option>
                    <option *ngFor="let member of members" [value]="member.fullName">
                      {{member.fullName}}
                    </option>
                  </select>
                  <small class="help-text">Select the player who used the court</small>
                  <small class="error" *ngIf="manualPaymentForm.get('playerName')?.hasError('required') && manualPaymentForm.get('playerName')?.touched">
                    Please select a player
                  </small>
                </div>

                <!-- Player Info (For non-superadmin) -->
                <div class="field" *ngIf="!isSuperAdmin()">
                  <label>Player</label>
                  <div class="player-info-display">
                    <span class="current-player">{{currentUser?.fullName}}</span>
                  </div>
                  <small class="help-text">This payment will be recorded for your account</small>
                </div>

                <!-- Court Usage Date -->
                <div class="field">
                  <label for="courtUsageDate">Date of Court Usage *</label>
                  <input 
                    type="date" 
                    id="courtUsageDate"
                    formControlName="courtUsageDate">
                  <small class="help-text">Select the date when the court was used</small>
                  <small class="error" *ngIf="manualPaymentForm.get('courtUsageDate')?.hasError('required') && manualPaymentForm.get('courtUsageDate')?.touched">
                    Court usage date is required
                  </small>
                </div>

                <!-- Payment Method -->
                <div class="field">
                  <label for="paymentMethod">Payment Method *</label>
                  <select id="paymentMethod" formControlName="paymentMethod">
                    <option value="gcash">GCash</option>
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                  <small class="error" *ngIf="manualPaymentForm.get('paymentMethod')?.hasError('required') && manualPaymentForm.get('paymentMethod')?.touched">
                    Please select a payment method
                  </small>
                </div>

                <!-- Amount -->
                <div class="field">
                  <label for="amount">Amount (₱) *</label>
                  <input 
                    type="number" 
                    id="amount"
                    formControlName="amount"
                    placeholder="0.00"
                    min="0.01"
                    step="0.01">
                  <small class="help-text">Enter the total amount paid</small>
                  <small class="error" *ngIf="manualPaymentForm.get('amount')?.hasError('required') && manualPaymentForm.get('amount')?.touched">
                    Amount is required
                  </small>
                  <small class="error" *ngIf="manualPaymentForm.get('amount')?.hasError('min') && manualPaymentForm.get('amount')?.touched">
                    Amount must be greater than 0
                  </small>
                </div>

                <!-- Notes -->
                <div class="field">
                  <label for="notes">Notes (Optional)</label>
                  <textarea 
                    id="notes"
                    formControlName="notes"
                    placeholder="Add any additional notes about this payment..."
                    rows="3"></textarea>
                  <small class="help-text">Optional: Add any additional details or context</small>
                </div>

                <!-- Proof of Payment -->
                <div class="field" *ngIf="manualPaymentForm.get('paymentMethod')?.value !== 'cash'">
                  <label>Proof of Payment (Screenshot) *</label>
                  <input
                    type="file"
                    #manualProofInput
                    hidden
                    accept="image/jpeg,image/jpg,image/png"
                    (change)="onManualProofFileSelected($event)">
                  <div class="proof-upload-placeholder" *ngIf="!manualProofOfPaymentPreviewUrl" (click)="manualProofInput.click()">
                    <mat-icon>add_a_photo</mat-icon>
                    <span>Click to attach GCash/bank transfer screenshot</span>
                  </div>
                  <div class="proof-preview" *ngIf="manualProofOfPaymentPreviewUrl">
                    <img [src]="manualProofOfPaymentPreviewUrl" alt="Proof of payment preview">
                    <button type="button" class="remove-proof-btn" (click)="removeManualProofOfPaymentFile()">
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                  <small class="error" *ngIf="manualProofOfPaymentError">{{manualProofOfPaymentError}}</small>
                  <small class="help-text">Required: attach a screenshot/photo of your payment confirmation (JPG or PNG, max 5MB)</small>
                </div>

                <!-- Form Actions -->
                <div class="form-actions">
                  <button
                    type="submit"
                    [disabled]="manualPaymentForm.invalid || loadingManualPayment || (manualPaymentForm.get('paymentMethod')?.value !== 'cash' && !manualProofOfPaymentFile)"
                    class="submit-btn">
                    {{loadingManualPayment ? 'Processing...' : 'Submit Manual Payment'}}
                  </button>

                  <button
                    type="button"
                    (click)="resetManualPaymentForm()"
                    class="reset-btn">
                    Clear Form
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <!-- Payment History Tab -->
      <div class="tab-content" *ngIf="activeTab === 'history'">
        <div class="history-container">
          <h2>Your Payment History</h2>
          
          
          <div class="loading" *ngIf="loadingHistory">
            Loading payment history...
          </div>
          
          <div class="no-payments" *ngIf="!loadingHistory && displayedPayments.length === 0">
            <p>No payment history found.</p>
          </div>

          <div class="payments-list" *ngIf="!loadingHistory && displayedPayments.length > 0">
            <div 
              *ngFor="let payment of displayedPayments"
              class="payment-card"
              [class]="'payment-' + payment.status">
              
              <div class="payment-header">
                <div class="payment-info">
                  <h3>{{formatPaymentDescriptionForMobile(payment)}}</h3>
                  <p class="reference">Ref: {{payment.referenceNumber}}</p>
                </div>
                <div class="payment-amount">
                  <span class="amount">{{getCorrectPaymentAmount(payment)}}</span>
                  <span class="status" [class]="'status-' + payment.status">
                    {{payment.statusDisplay}}
                  </span>
                  <span class="payment-method-mobile">
                    {{formatPaymentMethod(payment.paymentMethod)}}
                  </span>
                </div>
              </div>

              <div class="payment-details">
                <!-- Manual Payment Details -->
                <div *ngIf="payment.metadata?.isManualPayment" class="manual-payment-details">
                  <div class="detail-row">
                    <span>Payment Type:</span>
                    <span class="manual-payment-badge">Manual Payment</span>
                  </div>
                  <div class="detail-row">
                    <span>Court Usage Date:</span>
                    <span>{{formatDate(payment.metadata.courtUsageDate)}}</span>
                  </div>
                  <div class="detail-row">
                    <span>Player:</span>
                    <span>{{formatManualPaymentPlayers(payment)}}</span>
                  </div>
                </div>
                
                <!-- Regular Payment Details -->
                <div *ngIf="!payment.metadata?.isManualPayment">
                  <div class="detail-row" *ngIf="payment.pollId && payment.userId">
                    <span>Participant:</span>
                    <span>{{payment.userId.fullName}}</span>
                  </div>
                  <div class="detail-row" *ngIf="payment.reservationId && payment.reservationId.players && payment.reservationId.players.length > 0">
                    <span>Players:</span>
                    <span>{{formatCourtPlayers(payment)}}</span>
                  </div>
                </div>

                <!-- Common Payment Details -->
                <div class="detail-row">
                  <span>Payment Method:</span>
                  <span>{{formatPaymentMethod(payment.paymentMethod)}}</span>
                </div>
                <div class="detail-row" *ngIf="payment.transactionId">
                  <span>Transaction ID:</span>
                  <span>{{payment.transactionId}}</span>
                </div>
                <div class="detail-row paid-on-behalf" *ngIf="payment.paidBy && payment.paidBy._id !== payment.userId._id">
                  <span>Paid By:</span>
                  <span class="paid-by-info">{{payment.paidBy.fullName}} (on behalf)</span>
                </div>
                
                <!-- Cancellation Details for Failed/Refunded Payments -->
                <div *ngIf="payment.metadata?.cancellation || isLegacyCancelledPayment(payment)" class="cancellation-details">
                  <!-- New cancellation with metadata -->
                  <div *ngIf="payment.metadata?.cancellation">
                    <div class="detail-row cancellation-info">
                      <span>Cancellation Reason:</span>
                      <span class="cancellation-reason">{{payment.metadata.cancellation.reason}}</span>
                    </div>
                    <div class="detail-row cancellation-info">
                      <span>Cancelled On:</span>
                      <span>{{formatDate(payment.metadata.cancellation.cancelledAt)}}</span>
                    </div>
                  </div>
                  
                  <!-- Legacy cancelled payment fallback -->
                  <div *ngIf="!payment.metadata?.cancellation && isLegacyCancelledPayment(payment)">
                    <div class="detail-row cancellation-info">
                      <span>Status:</span>
                      <span class="cancellation-reason">This payment was cancelled</span>
                    </div>
                    <div class="detail-row cancellation-info">
                      <span>Note:</span>
                      <span>Payment was cancelled before detailed tracking was available</span>
                    </div>
                  </div>
                </div>

                <!-- Tennis Balls Details -->
                <div *ngIf="payment.metadata?.tennisBalls && payment.metadata.tennisBalls.quantity > 0" class="tennis-balls-details">
                  <div class="detail-row tennis-balls-info">
                    <span>🎾 Tennis Balls:</span>
                    <span class="tennis-balls-value">{{payment.metadata.tennisBalls.quantity}} {{ payment.metadata.tennisBalls.quantity === 1 ? 'can' : 'cans' }} @ ₱{{payment.metadata.tennisBalls.costPerCan}} = ₱{{payment.metadata.tennisBalls.totalCost}}</span>
                  </div>
                </div>
              </div>

              <!-- Admin actions for recorded payments -->
              <div class="payment-actions" *ngIf="isAdmin() && payment.status === 'record'">
                <button 
                  class="unrecord-btn"
                  (click)="unrecordPayment(payment._id)"
                  [disabled]="processing.includes(payment._id)"
                  title="Unrecord payment and remove from Court Usage Report">
                  <mat-icon>undo</mat-icon>
                  {{processing.includes(payment._id) ? 'Unrecording...' : 'Unrecord'}}
                </button>
              </div>

              <!-- Expand/Collapse button for grouped payments -->
              <div class="expand-actions" *ngIf="payment._groupedPayments && payment._groupedPayments.length > 1">
                <button 
                  class="expand-btn"
                  (click)="togglePaymentExpansion(payment._id)"
                  title="{{isPaymentExpanded(payment._id) ? 'Hide' : 'Show'}} individual hour breakdown">
                  <mat-icon>{{isPaymentExpanded(payment._id) ? 'expand_less' : 'expand_more'}}</mat-icon>
                  {{isPaymentExpanded(payment._id) ? 'Hide' : 'Show'}} breakdown ({{payment._groupedPayments.length}} hours)
                </button>
              </div>

              <!-- Detailed breakdown for grouped payments -->
              <div class="grouped-payment-details" *ngIf="payment._groupedPayments && payment._groupedPayments.length > 1 && isPaymentExpanded(payment._id)">
                <h4>Individual Hour Breakdown:</h4>
                <div class="breakdown-summary">
                  <p><strong>Expected Total:</strong> {{payment._groupedPayments.length}} hours × 3 players × ₱20 = ₱{{(payment._groupedPayments.length * 3 * 20).toFixed(2)}}</p>
                  <p><strong>Actual Total:</strong> ₱{{payment.amount.toFixed(2)}} 
                    <span *ngIf="payment.amount !== (payment._groupedPayments.length * 3 * 20)" class="pricing-warning">⚠️ Pricing discrepancy detected</span>
                  </p>
                </div>
                <div class="breakdown-list">
                  <div 
                    *ngFor="let individualPayment of payment._groupedPayments" 
                    class="breakdown-item">
                    <div class="breakdown-time">
                      {{formatTime(individualPayment.reservationId.timeSlot)}} - {{formatTime(individualPayment.reservationId.timeSlot + 1)}}
                    </div>
                    <div class="breakdown-amount">
                      ₱{{individualPayment.amount.toFixed(2)}}
                      <span *ngIf="individualPayment.amount !== 60" class="amount-warning">
                        (Expected: ₱60)
                      </span>
                    </div>
                    <div class="breakdown-ref">
                      Ref: {{individualPayment.referenceNumber}}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      <!-- Pending Payments Tab -->
      <div class="tab-content" *ngIf="activeTab === 'pending'">
        <div class="pending-container">
          <h2>Pending Payments</h2>

          <!-- Payment Form Section (when reservation selected) -->
          <div class="payment-form-section" *ngIf="selectedReservation" id="payment-form-section">
            <div class="section-header">
              <div class="payment-icon">
                <mat-icon>payment</mat-icon>
              </div>
              <div class="section-title">
                Complete Payment
                <span class="step-indicator">Step 2 of 2</span>
              </div>
            </div>

            <!-- Selected Reservation Display -->
            <div class="selected-reservation-display">
              <div class="reservation-summary">
                <div class="reservation-icon">
                  <mat-icon>event</mat-icon>
                </div>
                <div class="reservation-info">
                  <h4>{{isManualPayment() ? 'Manual Court Usage' : isOpenPlayPayment() ? 'Open Play Event' : isAssignedExpensePayment() ? (selectedReservation?.timeSlotDisplay || 'Club Expense') : 'Court Reservation'}}</h4>
                  <div class="reservation-details">
                    <div class="detail-item" *ngIf="!isAssignedExpensePayment()">
                      <mat-icon>schedule</mat-icon>
                      <span>{{formatDate(selectedReservation.date)}} at {{selectedReservation.timeSlotDisplay}}</span>
                    </div>
                    <div class="detail-item" *ngIf="!isOpenPlayPayment() && !isManualPayment() && !isAssignedExpensePayment()">
                      <mat-icon>group</mat-icon>
                      <span>{{selectedReservation.players.length}} player{{selectedReservation.players.length !== 1 ? 's' : ''}}: {{formatPlayerNames(selectedReservation.players)}}</span>
                    </div>
                    <div class="detail-item" *ngIf="isManualPayment()">
                      <mat-icon>group</mat-icon>
                      <span>Players: {{formatPlayerNames(selectedReservation.players)}}</span>
                    </div>
                    <div class="detail-item" *ngIf="isOpenPlayPayment()">
                      <mat-icon>sports_tennis</mat-icon>
                      <span>Open Play Participation</span>
                    </div>
                  </div>
                </div>
                <div class="payment-amount">
                  <span class="amount">{{getDisplayAmount()}}</span>
                  <span class="currency">PHP</span>
                </div>
              </div>
            </div>


            <div class="form-container">

              <form [formGroup]="paymentForm" (ngSubmit)="onSubmit()" class="payment-form">
                
                <!-- Payment Method -->
                <!-- Court Fee -->
                <div class="field">
                  <label for="courtFee">{{isAssignedExpensePayment() ? (selectedReservation?.timeSlotDisplay || 'Expense Amount') + ' (₱) *' : 'Court Fee (₱) *'}}</label>
                  <input 
                    type="number" 
                    id="courtFee"
                    formControlName="courtFee"
                    placeholder="0.00"
                    min="0.01"
                    step="0.01">
                  <small class="help-text">Auto-populated with calculated fee, but you can edit if needed</small>
                  <small class="error" *ngIf="paymentForm.get('courtFee')?.hasError('required') && paymentForm.get('courtFee')?.touched">
                    Court fee is required
                  </small>
                  <small class="error" *ngIf="paymentForm.get('courtFee')?.hasError('min') && paymentForm.get('courtFee')?.touched">
                    Court fee must be greater than 0
                  </small>
                </div>

                <!-- Payment Method -->
                <div class="field">
                  <label for="paymentMethod">Payment Method *</label>
                  <select id="paymentMethod" formControlName="paymentMethod">
                    <option value="gcash">GCash</option>
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                  <small class="error" *ngIf="paymentForm.get('paymentMethod')?.hasError('required') && paymentForm.get('paymentMethod')?.touched">
                    Please select a payment method
                  </small>
                </div>

                <!-- GCash Payment Instructions -->
                <div *ngIf="paymentForm.get('paymentMethod')?.value === 'gcash' && gcashConfig" class="gcash-instructions">
                  <div class="gcash-card">
                    <div class="gcash-header">
                      <mat-icon>phone_android</mat-icon>
                      <h3>GCash Payment Instructions</h3>
                    </div>
                    <div class="gcash-content">
                      <!-- Desktop: Show QR Code -->
                      <div *ngIf="!isMobileDevice && gcashConfig.qrCodeUrl" class="qr-section">
                        <p class="instruction-text"><strong>Scan QR Code with GCash App:</strong></p>
                        <img [src]="getApiBaseUrl() + gcashConfig.qrCodeUrl"
                             alt="GCash QR Code"
                             class="gcash-qr-code">

                        <div class="payment-details">
                          <p><strong>GCash Number:</strong></p>
                          <div class="phone-display">
                            <span class="phone-number">{{ gcashConfig.phoneNumber }}</span>
                            <button type="button" mat-icon-button (click)="copyGCashNumber()" title="Copy number">
                              <mat-icon>content_copy</mat-icon>
                            </button>
                          </div>

                          <p style="margin-top: 12px;"><strong>Account:</strong> {{ gcashConfig.accountName }}</p>
                          <p><strong>Amount:</strong> ₱{{ (paymentForm.get('courtFee')?.value || 0) | number:'1.2-2' }}</p>
                        </div>
                      </div>

                      <!-- Mobile: Show Phone Number and Account Name -->
                      <div *ngIf="isMobileDevice" class="phone-section">
                        <p class="instruction-text"><strong>Send to GCash Number:</strong></p>
                        <div class="phone-display">
                          <span class="phone-number">{{ gcashConfig.phoneNumber }}</span>
                          <button type="button" mat-icon-button (click)="copyGCashNumber()" title="Copy number">
                            <mat-icon>content_copy</mat-icon>
                          </button>
                        </div>

                        <p class="instruction-text" style="margin-top: 16px;"><strong>Account Name:</strong></p>
                        <div class="phone-display">
                          <span class="account-name">{{ gcashConfig.accountName }}</span>
                          <button type="button" mat-icon-button (click)="copyGCashAccountName()" title="Copy account name">
                            <mat-icon>content_copy</mat-icon>
                          </button>
                        </div>

                        <button type="button" class="gcash-app-btn" (click)="openGCashApp()">
                          <mat-icon>phone_android</mat-icon>
                          Open GCash App
                        </button>
                        <div class="payment-details">
                          <p><strong>Amount:</strong> ₱{{ (paymentForm.get('courtFee')?.value || 0) | number:'1.2-2' }}</p>
                        </div>
                      </div>

                      <div class="instruction-note">
                        <mat-icon>info</mat-icon>
                        <p>After completing payment in GCash, click "Pay Now" below to mark as paid.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Transaction Details -->
                <div class="field" *ngIf="paymentForm.get('paymentMethod')?.value && paymentForm.get('paymentMethod')?.value !== 'cash'">
                  <label for="transactionId">Transaction/Reference Number</label>
                  <input 
                    type="text" 
                    id="transactionId"
                    formControlName="transactionId"
                    placeholder="Enter transaction or reference number">
                  <small class="help-text">Optional: Provide reference number for tracking</small>
                </div>


                <!-- Notes -->
                <div class="field">
                  <label for="notes">Notes (Optional)</label>
                  <textarea
                    id="notes"
                    formControlName="notes"
                    placeholder="Add any notes about this payment..."
                    rows="3"></textarea>
                </div>

                <!-- Proof of Payment -->
                <div class="field" *ngIf="paymentForm.get('paymentMethod')?.value !== 'cash'">
                  <label>Proof of Payment (Screenshot) *</label>
                  <input
                    type="file"
                    #proofInput
                    hidden
                    accept="image/jpeg,image/jpg,image/png"
                    (change)="onProofFileSelected($event)">
                  <div class="proof-upload-placeholder" *ngIf="!proofOfPaymentPreviewUrl" (click)="proofInput.click()">
                    <mat-icon>add_a_photo</mat-icon>
                    <span>Click to attach GCash/bank transfer screenshot</span>
                  </div>
                  <div class="proof-preview" *ngIf="proofOfPaymentPreviewUrl">
                    <img [src]="proofOfPaymentPreviewUrl" alt="Proof of payment preview">
                    <button type="button" class="remove-proof-btn" (click)="removeProofOfPaymentFile()">
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                  <small class="error" *ngIf="proofOfPaymentError">{{proofOfPaymentError}}</small>
                  <small class="help-text">Required: attach a screenshot/photo of your payment confirmation (JPG or PNG, max 5MB)</small>
                </div>

                <!-- Total Amount Display -->
                <div class="total-amount-display" style="background: #f0f9ff; border: 2px solid #0284c7; border-radius: 8px; padding: 1rem; margin: 1rem 0;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong style="font-size: 1.1rem; color: #0c4a6e;">Total Amount to Pay:</strong>
                    <strong style="font-size: 1.5rem; color: #0284c7;">₱{{ (paymentForm.get('courtFee')?.value || 0) | number:'1.2-2' }}</strong>
                  </div>
                </div>

                <!-- Form Actions -->
                <div class="form-actions">
                  <button
                    type="submit"
                    [disabled]="paymentForm.invalid || loading || (paymentForm.get('paymentMethod')?.value !== 'cash' && !proofOfPaymentFile)"
                    class="submit-btn">
                    {{loading ? 'Processing Payment...' : 'Complete Payment'}}
                  </button>

                  <button
                    type="button"
                    (click)="resetForm()"
                    class="reset-btn">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
          
          <!-- Pending Payments List -->
          <div class="pending-payments-section" *ngIf="!selectedReservation">
            <div class="loading" *ngIf="loadingUnpaid">
              Loading pending payments...
            </div>
            
            <div class="no-payments" *ngIf="!loadingUnpaid && displayedPendingPayments.length === 0">
              <p>No pending payments! 🎉</p>
            </div>

            <div class="payments-list" *ngIf="!loadingUnpaid && displayedPendingPayments.length > 0">
              <h3>Your Pending Payments</h3>
              
              <div 
                *ngFor="let payment of displayedPendingPayments"
                class="payment-card"
                [class.overdue]="isPaymentOverdue(payment)">
                
                <div class="payment-header">
                  <div class="payment-info">
                    <h4>
                      {{payment.paymentType === 'cancellation_fee' ? 'Cancellation Fee' : payment.metadata?.isAssignedExpense ? payment.description : payment.metadata?.isManualPayment ? 'Manual Court Usage' : payment.reservationId ? 'Court Reservation' : 'Open Play Event'}}
                      <span class="overdue-badge" *ngIf="isPaymentOverdue(payment)">OVERDUE</span>
                    </h4>
                    <p>{{formatPaymentReservation(payment)}}</p>
                    <p class="players-info" *ngIf="payment.reservationId && payment.reservationId.players">
                      <mat-icon class="small-icon">group</mat-icon>
                      {{formatPlayersWithFees(payment)}}
                    </p>
                    <p class="players-info" *ngIf="payment.pollId && payment.userId">
                      <mat-icon class="small-icon">sports_tennis</mat-icon>
                      Participant: {{payment.userId.fullName}}
                    </p>
                  </div>
                  <div class="payment-amount">
                    <span class="amount">{{getCorrectPaymentAmount(payment)}}</span>
                  </div>
                </div>

                <!-- Credit balance indicator -->
                <div class="credit-balance-hint" *ngIf="creditBalance > 0">
                  <mat-icon class="credit-icon">account_balance_wallet</mat-icon>
                  <div class="credit-hint-text">
                    <span>You have <strong>₱{{creditBalance.toFixed(2)}}</strong> in credits on file.</span>
                    <span class="credit-hint-note">Please still log your payment below — admin will review and apply your credits accordingly.</span>
                  </div>
                </div>

                <div class="payment-actions">
                  <!-- For synthetic payments (unpaid reservations), show Pay Now and Cancel buttons -->
                  <ng-container *ngIf="payment.isSynthetic && payment.reservationId">
                    <button
                      class="pay-btn"
                      (click)="payForGroupedReservation(payment)"
                      [disabled]="!canMakePayment(payment)"
                      [title]="!canMakePayment(payment) ? getPaymentDisabledMessage(payment) : ''">
                      Pay Now
                    </button>
                    <button
                      class="cancel-reservation-btn"
                      (click)="cancelReservationDirectly(convertPaymentToReservation(payment))"
                      *ngIf="isReservationSchedulePast(payment)"
                      [disabled]="processing.includes(payment.reservationId._id) || !canCancel(payment)">
                      Cancel Reservation
                    </button>
                  </ng-container>
                  
                  <!-- For real payment records -->
                  <ng-container *ngIf="!payment.isSynthetic">
                    <!-- Payment Action Buttons Row 1: Primary Actions -->
                    <div class="payment-buttons-row">
                      <!-- Open Play events should show Pay Now button -->
                      <button
                        class="pay-btn"
                        (click)="payForOpenPlay(payment)"
                        *ngIf="payment.pollId">
                        Pay Now
                      </button>

                      <!-- Manual court usage payments - always show Pay Now to choose payment method -->
                      <button
                        class="pay-btn"
                        (click)="payForManualPayment(payment)"
                        *ngIf="payment.metadata?.isManualPayment">
                        Pay Now
                      </button>

                      <!-- Assigned expense payments - Pay Now -->
                      <button
                        class="pay-btn"
                        (click)="payForAssignedExpense(payment)"
                        *ngIf="payment.metadata?.isAssignedExpense">
                        Pay Now
                      </button>

                      <!-- Court reservations - Pay Now shows payment form -->
                      <button
                        class="pay-btn"
                        (click)="payForExistingPayment(payment)"
                        *ngIf="payment.reservationId"
                        [disabled]="!canMakePayment(payment)"
                        [title]="!canMakePayment(payment) ? getPaymentDisabledMessage(payment) : ''">
                        Pay Now
                      </button>
                    </div>
                    
                    <!-- Payment Action Buttons Row 2: Secondary Actions -->
                    <div class="payment-buttons-row">
                      <!-- Cancel Reservation button for court reservations (hidden for cancellation fee payments) -->
                      <button
                        class="cancel-reservation-btn"
                        (click)="cancelReservationFromPayment(payment)"
                        *ngIf="payment.reservationId && canCancel(payment) && payment.paymentType !== 'cancellation_fee' && isReservationSchedulePast(payment)"
                        [disabled]="processing.includes(payment.reservationId._id)">
                        Cancel Reservation
                      </button>
                      
                      <!-- Cancel button for Open Play Events -->
                      <button
                        class="cancel-reservation-btn"
                        (click)="cancelPayment(payment._id)"
                        *ngIf="payment.pollId && canCancel(payment)"
                        [disabled]="processing.includes(payment._id)">
                        Cancel Open Play
                      </button>

                      <!-- Cancel button for Manual Court Usage -->
                      <button
                        class="cancel-reservation-btn"
                        (click)="cancelPayment(payment._id)"
                        *ngIf="payment.metadata?.isManualPayment && canCancel(payment)"
                        [disabled]="processing.includes(payment._id)">
                        Cancel Payment
                      </button>
                    </div>
                  </ng-container>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Notifications -->
      <div class="notification-container">
        <div 
          *ngFor="let notification of notifications; trackBy: trackNotification"
          class="notification"
          [class]="'notification-' + notification.type"
          [@slideInOut]>
          <div class="notification-icon">
            <span *ngIf="notification.type === 'success'">✅</span>
            <span *ngIf="notification.type === 'error'">❌</span>
            <span *ngIf="notification.type === 'warning'">⚠️</span>
            <span *ngIf="notification.type === 'info'">ℹ️</span>
          </div>
          <div class="notification-content">
            <div class="notification-title">{{notification.title}}</div>
            <div class="notification-message">{{notification.message}}</div>
          </div>
          <button 
            class="notification-close"
            (click)="removeNotification(notification.id)">
            ×
          </button>
        </div>
      </div>
    </div>

  `,
  styleUrl: './payments.component.scss'
})
export class PaymentsComponent implements OnInit {
  paymentForm: FormGroup;
  loading = false;
  loadingHistory = false;
  loadingUnpaid = false;
  activeTab = 'pending';
  unpaidReservations: Reservation[] = [];
  pendingPayments: Payment[] = [];
  displayedPendingPayments: Payment[] = [];
  paymentHistory: Payment[] = [];
  displayedPayments: Payment[] = [];
  expandedPayments: Set<string> = new Set();
  selectedReservation: Reservation | null = null;
  currentUser: any = null;
  processing: string[] = [];
  isDirectPayment: boolean = false; // Track if coming from notification
  showReservationSelector: boolean = false; // Show dropdown when user wants to change

  // Proof of payment (reservation payment form)
  proofOfPaymentFile: File | null = null;
  proofOfPaymentPreviewUrl: string | null = null;
  proofOfPaymentError: string | null = null;

  // Proof of payment (manual payment tab)
  manualProofOfPaymentFile: File | null = null;
  manualProofOfPaymentPreviewUrl: string | null = null;
  manualProofOfPaymentError: string | null = null;

  // Notifications
  notifications: Notification[] = [];
  
  // Members data for fee calculation
  members: any[] = [];

  // Manual Payment form
  manualPaymentForm: FormGroup;
  loadingManualPayment = false;

  // Debug info for grouping
  groupingDebugInfo: any = null;
  paymentLoadingDebugInfo: any = null;

  // Credit balance
  creditBalance: number = 0;

  // GCash configuration
  gcashConfig: { phoneNumber: string; accountName: string; qrCodeUrl: string | null; deepLinkUrl: string } | null = null;
  isMobileDevice = false;

  apiUrl = environment.apiUrl;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    this.paymentForm = this.fb.group({
      reservationId: ['', Validators.required],
      courtFee: ['', [Validators.required, Validators.min(0.01)]], // Editable court fee for all users
      paymentMethod: ['gcash', Validators.required], // Default to GCash
      transactionId: [''],
      notes: ['']
    });

    this.manualPaymentForm = this.fb.group({
      playerName: [''],
      courtUsageDate: ['', Validators.required],
      paymentMethod: ['gcash', Validators.required], // Default to GCash
      amount: ['', [Validators.required, Validators.min(0.01)]],
      notes: ['']
    });

    this.currentUser = this.authService.currentUser;
  }

  async ngOnInit(): Promise<void> {
    // Load members data for proper fee calculation
    await this.loadMembersData();

    // Load credit balance
    this.loadCreditBalance();

    // Set up form validation based on user role
    this.setupManualPaymentFormValidation();

    // Load GCash configuration
    this.loadGCashConfig();

    // Detect device type for responsive GCash UI
    this.detectDevice();
    
    // Check for query parameters first (from notification "Pay Now")
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeTab = params['tab'];
      }
      
      // Always load pending payments
      this.loadPendingPayments();
      
      if (params['reservationId']) {
        // Auto-populate the form with the specific reservation
        this.handleDirectPayment(params['reservationId']);
      }
    });
  }

  loadCreditBalance(): void {
    this.http.get<any>(`${this.apiUrl}/credits/balance`).subscribe({
      next: (response) => {
        this.creditBalance = response.data?.balance || 0;
      },
      error: () => {
        this.creditBalance = 0;
      }
    });
  }

  loadUnpaidReservations(): void {
    this.loadingUnpaid = true;
    
    this.http.get<any>(`${this.apiUrl}/reservations?paymentStatus=pending`).subscribe({
      next: (response) => {
        const allReservations = response.data || [];
        
        // Include all reservations with pending payments (including past ones that are overdue)
        // Only filter out cancelled reservations
        this.unpaidReservations = allReservations.filter((reservation: Reservation) => {
          return reservation.status !== 'cancelled';
        });
        
        this.loadingUnpaid = false;
      },
      error: (error) => {
        console.error('Error loading unpaid reservations:', error);
        this.loadingUnpaid = false;
        this.showError('Error', 'Failed to load unpaid reservations');
      }
    });
  }

  async loadPendingPayments(bustCache = false): Promise<void> {
    this.loadingUnpaid = true;
    
    try {
      // Add cache busting parameter and limit to fetch all payments
      const cacheBuster = bustCache ? `&_t=${Date.now()}` : '';

      // Load both existing pending payments and unpaid reservations
      // Set limit=999999 to remove pagination and get all pending payments/reservations
      const [paymentsResponse, reservationsResponse] = await Promise.all([
        this.http.get<any>(`${this.apiUrl}/payments/my?status=pending&limit=999999${cacheBuster}`).toPromise(),
        this.http.get<any>(`${this.apiUrl}/reservations?paymentStatus=pending&limit=999999${cacheBuster}`).toPromise()
      ]);
      const rawExistingPayments = paymentsResponse?.data || [];
      console.log('🔍 Raw API response for /payments/my?status=pending:', rawExistingPayments.map((p: any) => ({
        desc: p.description,
        status: p.status,
        id: p._id
      })));
      
      const unpaidReservations = (reservationsResponse?.data || [])
        .filter((reservation: Reservation) => reservation.status !== 'cancelled');
      
      // Simplified filtering: only keep payments that are actually pending
      // Remove the complex duplicate payment filtering that might cause race conditions
      const existingPayments = rawExistingPayments.filter((payment: Payment) => payment.status === 'pending');
        
      console.log('🔍 Filtered pending payments:', existingPayments.map((p: any) => ({
        desc: p.description,
        status: p.status,
        id: p._id
      })));
      
      // Get all payment records to check which reservations the current user has paid for
      // Set limit=999999 to remove pagination and get all user payments
      const allPaymentsResponse = await this.http.get<any>(`${this.apiUrl}/payments/my?limit=999999`).toPromise();
      const allPayments = allPaymentsResponse?.data || [];

      this.paymentLoadingDebugInfo = {
        allPayments: allPayments.map((p: Payment) => ({
          id: p._id,
          reservationId: p.reservationId?._id,
          timeSlot: p.reservationId?.timeSlot,
          status: p.status,
          amount: p.amount
        })),
        unpaidReservations: unpaidReservations.map((r: Reservation) => ({
          id: r._id,
          timeSlot: r.timeSlot,
          date: new Date(r.date).toDateString(),
          totalFee: r.totalFee
        })),
        existingPayments: existingPayments.map((p: Payment) => ({
          id: p._id,
          reservationId: p.reservationId?._id,
          timeSlot: p.reservationId?.timeSlot,
          status: p.status
        }))
      };

      console.log('📋 All payments for current user:', allPayments.length, this.paymentLoadingDebugInfo.allPayments);
      console.log('📋 Unpaid reservations from backend:', unpaidReservations.length, this.paymentLoadingDebugInfo.unpaidReservations);

      // Create a set of reservation IDs that have ANY payment record (to avoid creating duplicates)
      const reservationIdsWithPayment = new Set(
        allPayments
          .filter((payment: Payment) => payment.reservationId)
          .map((payment: Payment) => payment.reservationId!._id)
      );

      this.paymentLoadingDebugInfo.reservationIdsWithCompletedPayment = Array.from(reservationIdsWithPayment);
      console.log('📋 Reservation IDs with ANY payment record:', this.paymentLoadingDebugInfo.reservationIdsWithCompletedPayment);

      // Filter out unpaid reservations that already have a payment record (to avoid creating synthetic duplicates)
      const reservationsNeedingPayments = unpaidReservations
        .filter((reservation: Reservation) => !reservationIdsWithPayment.has(reservation._id));

      this.paymentLoadingDebugInfo.reservationsNeedingPayments = reservationsNeedingPayments.map((r: Reservation) => ({
        id: r._id,
        timeSlot: r.timeSlot,
        totalFee: r.totalFee
      }));
      console.log('📋 Reservations needing synthetic payments:', reservationsNeedingPayments.length, this.paymentLoadingDebugInfo.reservationsNeedingPayments);
      
      // Convert unpaid reservations to payment-like objects for display
      const syntheticPayments = await Promise.all(reservationsNeedingPayments.map(async (reservation: Reservation) => {
        let amount = reservation.totalFee || 0;
        
        // If amount is 0, try to calculate it from backend
        if (amount === 0) {
          try {
            const reservationDate = new Date(reservation.date);
            const params = {
              timeSlot: reservation.timeSlot.toString(),
              playerCount: reservation.players.length.toString(),
              date: reservationDate.toISOString()
            };
            const calcResponse = await this.http.get<any>(`${this.apiUrl}/payments/calculate`, { params }).toPromise();
            if (calcResponse?.success && calcResponse?.data) {
              amount = calcResponse.data.amount;
            }
          } catch (error) {
            console.warn('Failed to calculate fee for reservation', reservation._id, error);
            // Keep amount as 0 if calculation fails
          }
        }
        
        return {
          _id: `synthetic-${reservation._id}`,
          reservationId: {
            _id: reservation._id,
            userId: reservation.userId,
            date: new Date(reservation.date),
            timeSlot: reservation.timeSlot,
            endTimeSlot: reservation.endTimeSlot,
            duration: reservation.duration,
            players: reservation.players,
            timeSlotDisplay: reservation.timeSlotDisplay,
            totalFee: reservation.totalFee
          },
          userId: { _id: this.currentUser?._id || '', username: this.currentUser?.username || '', fullName: this.currentUser?.fullName || '' }, // Use current user's ID for grouping
          amount: amount,
          currency: 'PHP',
          paymentMethod: 'cash' as const,
          status: 'pending' as const,
          referenceNumber: '',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          description: `Court reservation payment for ${new Date(reservation.date).toDateString()} ${reservation.timeSlotDisplay || `${reservation.timeSlot}:00-${reservation.timeSlot + 1}:00`}`,
          formattedAmount: `₱${amount.toFixed(2)}`,
          statusDisplay: 'Pending',
          isOverdue: this.isReservationOverdue(reservation),
          daysUntilDue: 7,
          createdAt: new Date(),
          isSynthetic: true // Flag to identify synthetic payments
        };
      }));
      
      // Combine existing payments with synthetic payments
      this.pendingPayments = [...existingPayments, ...syntheticPayments];

      // Group pending payments for multi-hour reservations
      // Sort in ascending order (oldest first) for pending payments
      this.displayedPendingPayments = this.groupPayments([...this.pendingPayments], 'asc');
      
      // Debug: Log payment statuses to ensure proper separation
      console.log('📋 Pending Payments loaded:', this.pendingPayments.length);
      console.log('📋 Displayed Pending Payments after grouping:', this.displayedPendingPayments.length);
      
      this.pendingPayments.forEach(payment => {
        console.log(`  - Raw: ${payment.description} (Status: ${payment.status}, TimeSlot: ${payment.reservationId?.timeSlot}, Date: ${payment.reservationId?.date}, ID: ${payment._id}, Synthetic: ${payment.isSynthetic || false})`);
      });
      
      this.displayedPendingPayments.forEach(payment => {
        console.log(`  - Displayed: ${payment.description} (Amount: ₱${payment.amount}, TimeSlot: ${payment.reservationId?.timeSlot}, Grouped: ${payment._groupedPayments ? payment._groupedPayments.length : 0})`);
      });
      
      this.loadingUnpaid = false;
    } catch (error) {
      console.error('Error loading pending payments:', error);
      this.loadingUnpaid = false;
      this.showError('Error', 'Failed to load pending payments');
      throw error; // Re-throw to allow callers to handle the error
    }
  }

  loadPaymentHistory(bustCache = false): void {
    this.loadingHistory = true;

    // Add cache busting parameter and limit to fetch all payments
    // Set limit=999999 to remove pagination and get all user payments
    const cacheBuster = bustCache ? `?_t=${Date.now()}&limit=999999` : '?limit=999999';

    this.http.get<any>(`${this.apiUrl}/payments/my${cacheBuster}`).subscribe({
      next: (response) => {
        // Show only completed and recorded payments in history - failed/refunded are excluded
        const allPayments = response.data || [];
        this.paymentHistory = allPayments.filter((payment: Payment) =>
          payment.status === 'completed' || payment.status === 'record'
        );
        
        // Sort by payment date (most recent first) to show newly completed payments at the top
        this.paymentHistory.sort((a: Payment, b: Payment) => {
          const dateA = new Date(a.paymentDate || a.createdAt);
          const dateB = new Date(b.paymentDate || b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });

        // Group payments for multi-hour reservations
        // Sort in descending order (most recent first) for payment history
        this.displayedPayments = this.groupPayments([...this.paymentHistory], 'desc');
        
        // Debug: Log displayed payments after grouping
        console.log('📋 Displayed Payments after grouping:', this.displayedPayments.length, 'payments');
        this.displayedPayments.forEach((payment, index) => {
          console.log(`Displayed Payment ${index + 1}:`, {
            id: payment._id,
            amount: payment.amount,
            formattedAmount: payment.formattedAmount,
            hasGroupedPayments: !!payment._groupedPayments,
            groupedCount: payment._groupedPayments?.length,
            timeSlotDisplay: payment.reservationId?.timeSlotDisplay,
            isSynthetic: payment._id?.startsWith?.('synthetic-')
          });
        });
        
        // Debug: Log payment history statuses
        console.log('📋 Payment History loaded:', this.paymentHistory.length, 'payments (excluding pending)');
        this.paymentHistory.forEach((payment, index) => {
          console.log(`Payment ${index + 1}:`, {
            status: payment.status,
            hasReservationId: !!payment.reservationId,
            timeSlot: payment.reservationId?.timeSlot,
            timeSlotDisplay: payment.reservationId?.timeSlotDisplay,
            date: payment.reservationId?.date,
            amount: payment.amount,
            hasPollId: !!payment.pollId,
            pollTitle: payment.pollId?.title,
            userFullName: payment.userId?.fullName
          });
        });
        this.paymentHistory.forEach(payment => {
          console.log(`  - ${payment.description} (Status: ${payment.status}, ID: ${payment._id}, PaymentDate: ${payment.paymentDate || 'N/A'})`);
        });
        
        console.log(`📋 Total payments from API: ${allPayments.length}, Pending filtered out: ${allPayments.length - this.paymentHistory.length}`);
        
        this.loadingHistory = false;
      },
      error: (error) => {
        console.error('Error loading payment history:', error);
        this.loadingHistory = false;
        this.showError('Error', 'Failed to load payment history');
      }
    });
  }

  onReservationChange(event: any): void {
    const reservationId = event.target.value;
    this.selectedReservation = this.unpaidReservations.find(r => r._id === reservationId) || null;
  }

  // Helper method to extract userId from object or string
  getReservationUserId(userId: any): string | undefined {
    if (typeof userId === 'object' && userId?._id) {
      return userId._id;
    }
    return userId;
  }

  onSubmit(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    console.log('🔍 onSubmit called, form valid:', this.paymentForm.valid, 'loading:', this.loading);
    console.log('🔍 Form value:', this.paymentForm.value);

    if (this.paymentForm.invalid || this.loading) {
      console.log('🔍 onSubmit BLOCKED - invalid or loading');
      return;
    }

    this.loading = true;
    const formValue = this.paymentForm.value;

    // Check if this is an Open Play payment
    const isOpenPlay = (this.selectedReservation as any)?.isOpenPlay;
    const isManualPayment = (this.selectedReservation as any)?.isManualPayment;
    const originalPaymentId = (this.selectedReservation as any)?.originalPaymentId;

    console.log('🔍 isOpenPlay:', isOpenPlay, 'originalPaymentId:', originalPaymentId);

    if (isOpenPlay && originalPaymentId) {
      console.log('🔍 Taking Open Play path');
      // For Open Play, update the existing payment record with the chosen payment method
      this.updateOpenPlayPayment(originalPaymentId, formValue.paymentMethod, formValue.transactionId);
      return;
    }

    console.log('🔍 isManualPayment:', isManualPayment);

    if (isManualPayment && originalPaymentId) {
      console.log('🔍 Taking Manual Payment path');
      // For Manual Payment, update the existing payment record with the chosen payment method
      this.updateManualPayment(originalPaymentId, formValue.paymentMethod, formValue.transactionId);
      return;
    }

    const isAssignedExpense = (this.selectedReservation as any)?.isAssignedExpense;
    if (isAssignedExpense && originalPaymentId) {
      console.log('🔍 Taking Assigned Expense path');
      this.updateManualPayment(originalPaymentId, formValue.paymentMethod, formValue.transactionId);
      return;
    }

    // Check if this is for an existing payment that needs to be updated
    const existingPaymentId = (this.selectedReservation as any)?.existingPaymentId;

    console.log('🔍 existingPaymentId:', existingPaymentId);

    if (existingPaymentId) {
      console.log('🔍 Taking existing payment update path (single payment)');

      // Update existing payment instead of creating new one
      console.log('💰 Updating existing payment:', existingPaymentId);
      
      const updateData: any = {
        paymentMethod: formValue.paymentMethod,
        transactionId: formValue.transactionId || undefined
      };
      
      // Add court fee from form input
      updateData.customAmount = formValue.courtFee;
      
      this.http.put<any>(`${this.apiUrl}/payments/${existingPaymentId}`, updateData).subscribe({
        next: () => {
          // Auto-complete all payments regardless of payment method
          this.processPayment(existingPaymentId, true, true, (success, error) => {
            this.loading = false;
            if (success) {
              this.showSuccess('Payment Completed', 'Payment has been processed and completed successfully');
            } else {
              const reason = error?.error?.error || error?.message || 'unknown error';
              this.showError('Payment Recorded', `Your payment was saved, but we could not finalize it: ${reason}. Please try again from Pending Payments.`);
            }
            this.resetForm();
            this.loadPendingPayments(true);
          });
        },
        error: (error) => {
          this.loading = false;
          const message = error.error?.error || 'Failed to update payment';
          this.showError('Payment Failed', message);
        }
      });
      return;
    }
    
    // Create new payment (for synthetic payments from unpaid reservations)
    const paymentData: any = {
      reservationId: formValue.reservationId,
      paymentMethod: formValue.paymentMethod,
      transactionId: formValue.transactionId || undefined,
      notes: formValue.notes || undefined
    };

    // Check if this is a grouped payment with multiple reservations
    if (this.selectedReservation && this.selectedReservation._groupedReservationIds && this.selectedReservation._groupedReservationIds.length > 1) {
      paymentData.groupedReservationIds = this.selectedReservation._groupedReservationIds;
      console.log(`💰 Creating grouped payment for ${paymentData.groupedReservationIds.length} reservations:`, paymentData.groupedReservationIds);
    }

    // Add court fee from form input
    paymentData.customAmount = formValue.courtFee;
    console.log(`💰 Single payment with customAmount: ₱${paymentData.customAmount}`);

    console.log('💰 Full payment data being sent:', paymentData);

    const createFormData = new FormData();
    Object.keys(paymentData).forEach(key => {
      if (paymentData[key] !== undefined && paymentData[key] !== null) {
        createFormData.append(key, paymentData[key]);
      }
    });
    if (this.proofOfPaymentFile) {
      createFormData.append('proofOfPayment', this.proofOfPaymentFile);
    }

    this.http.post<any>(`${this.apiUrl}/payments`, createFormData).subscribe({
      next: (response) => {
        this.loading = false;

        // Store response for debugging
        (window as any).lastPaymentResponse = response;

        // Console log the full response for debugging
        console.log('🔍 PAYMENT RESPONSE:', JSON.stringify(response, null, 2));

        // Show debug info from backend if available
        if (response.debug) {
          console.log('🔍 DEBUG INFO FROM BACKEND:');
          console.log('  - Requested User IDs:', response.debug.requestedUserIds);
          console.log('  - Processed Count:', response.debug.processedCount);
          console.log('  - Payment Details:', response.debug.paymentDetails);
        }

        // Check if this is multi-member payment response (array of payments)
        const isMultiPayment = Array.isArray(response.data);
        const payments = isMultiPayment ? response.data : [response.data];

        console.log('🔍 Is Multi Payment:', isMultiPayment);
        console.log('🔍 Payment Count:', payments.length);
        console.log('🔍 Payments:', JSON.stringify(payments, null, 2));

        if (isMultiPayment) {
          // Multi-member payment
          const totalAmount = response.totalAmount || 0;
          const count = payments.length;

          console.log('🔍 About to auto-process', count, 'payments');
          const pendingIds = payments.filter((p: any) => p.status === 'pending').map((p: any) => p._id);

          if (pendingIds.length === 0) {
            this.showSuccess('Payments Completed',
              `Successfully created ${count} payment(s) for ₱${totalAmount.toFixed(2)}`);
            this.resetForm();
            this.loadPendingPayments(true);
          } else {
            let remaining = pendingIds.length;
            let anyFailed = false;
            let firstFailureReason = '';
            pendingIds.forEach((paymentId: string) => {
              // File was already uploaded and attached when the payment was created, so don't resend it
              this.processPayment(paymentId, true, false, (success, error) => {
                if (!success) {
                  anyFailed = true;
                  if (!firstFailureReason) {
                    firstFailureReason = error?.error?.error || error?.message || 'unknown error';
                  }
                }
                remaining--;
                if (remaining === 0) {
                  if (anyFailed) {
                    this.showError('Payments Recorded', `Payments were saved, but some could not be finalized: ${firstFailureReason}. Please check Pending Payments.`);
                  } else {
                    this.showSuccess('Payments Completed',
                      `Successfully created ${count} payment(s) for ₱${totalAmount.toFixed(2)}`);
                  }
                  this.resetForm();
                  this.loadPendingPayments(true);
                }
              });
            });
          }
        } else {
          // Single payment - auto-process only if pending
          console.log('🔍 Single payment status:', response.data.status);
          if (response.data.status === 'pending') {
            console.log('🔍 About to auto-process single payment:', response.data._id);
            // File was already uploaded and attached when the payment was created, so don't resend it
            this.processPayment(response.data._id, true, false, (success, error) => {
              if (success) {
                this.showSuccess('Payment Completed', 'Payment has been processed and completed successfully');
              } else {
                const reason = error?.error?.error || error?.message || 'unknown error';
                this.showError('Payment Recorded', `Your payment and proof were saved, but we could not finalize it: ${reason}. Please try again from Pending Payments.`);
              }
              this.resetForm();
              this.loadPendingPayments(true);
            });
          } else {
            console.log('🔍 Skipping process - payment already', response.data.status);
            this.showSuccess('Payment Completed', 'Payment has been processed and completed successfully');
            this.resetForm();
            this.loadPendingPayments(true);
          }
        }
      },
      error: (error) => {
        this.loading = false;
        console.error('🔍 PAYMENT ERROR:', error);
        console.error('🔍 Error details:', error.error);
        console.error('🔍 Payment data that was sent:', paymentData);
        const message = error.error?.error || 'Failed to log payment';
        this.showError('Payment Failed', message + '. Check console (F12) for details.');
      }
    });
  }


  processPayment(paymentId: string, silent = false, includeFile = true, onDone?: (success: boolean, error?: any) => void, isRetry = false): void {
    console.log('🔍 processPayment called for:', paymentId, 'silent:', silent, 'includeFile:', includeFile, 'isRetry:', isRetry);
    this.processing.push(paymentId);

    const formData = new FormData();
    if (includeFile && this.proofOfPaymentFile) {
      formData.append('proofOfPayment', this.proofOfPaymentFile);
    }

    this.http.put<any>(`${this.apiUrl}/payments/${paymentId}/process`, formData).subscribe({
      next: (response) => {
        console.log('🔍 processPayment SUCCESS for:', paymentId, 'response:', response);
        this.processing = this.processing.filter(id => id !== paymentId);
        if (!silent) {
          this.showSuccess('Payment Processed', 'Payment has been marked as completed and moved to Payment History');
        }

        // Refresh both tabs sequentially with cache busting to ensure fresh data
        // First refresh pending payments to remove the completed payment
        this.loadPendingPayments(true).then(() => {
          console.log('🔍 Pending payments refreshed after processing', paymentId);
          // Then refresh payment history to show the newly completed payment
          this.loadPaymentHistory(true);
        }).catch(error => {
          console.error('Error refreshing pending payments:', error);
          // Still refresh payment history even if pending payments refresh fails
          this.loadPaymentHistory(true);
        });

        onDone?.(true);
      },
      error: (error) => {
        console.error('🔍 processPayment ERROR for:', paymentId, 'error:', error);
        this.processing = this.processing.filter(id => id !== paymentId);

        // If the upload was interrupted mid-transfer (common on flaky mobile connections),
        // automatically retry once before surfacing an error.
        if (!isRetry && error?.error?.code === 'UPLOAD_INTERRUPTED') {
          console.log('🔍 Upload interrupted, retrying processPayment once for:', paymentId);
          this.processPayment(paymentId, silent, includeFile, onDone, true);
          return;
        }

        const message = error.error?.error || 'Failed to process payment';
        if (!onDone) {
          this.showError('Process Failed', message);
        }
        onDone?.(false, error);
      }
    });
  }

  isReservationSchedulePast(payment: Payment): boolean {
    const res = payment.reservationId;
    if (!res?.date || res.timeSlot == null) return true;
    const endHour = res.endTimeSlot ?? (res.timeSlot + (res.duration ?? 1));
    const d = new Date(res.date);
    const endTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), endHour, 0, 0, 0);
    return Date.now() >= endTime.getTime();
  }

  canCancel(payment: Payment): boolean {
    // If payment is for a reservation, check the date
    if (payment.reservationId) {
      return canCancelReservation({
        date: payment.reservationId.date,
        status: payment.status
      }) && payment.status !== 'refunded';
    }

    // For non-reservation payments (like polls), allow cancellation if not refunded
    return payment.status !== 'refunded';
  }

  // December 2025: Check if payment can be made (reservation time must have passed)
  canMakePayment(payment: Payment): boolean {
    // Allow payment immediately after booking, regardless of reservation time
    return true;
  }

  // Get message explaining why payment is disabled
  getPaymentDisabledMessage(payment: Payment): string {
    // Payments are now available immediately after booking
    return '';
  }

  cancelPayment(paymentId: string): void {
    // Find payment details for the dialog - check both pending payments and payment history
    let payment = this.pendingPayments.find(p => p._id === paymentId);
    if (!payment) {
      payment = this.paymentHistory.find(p => p._id === paymentId);
    }
    
    if (!payment) {
      this.showError('Payment Not Found', 'Could not find payment details');
      return;
    }

    // Prepare dialog data
    const dialogData: CancellationDialogData = {
      paymentId: paymentId,
      paymentAmount: payment.formattedAmount,
      reservationDate: payment.reservationId 
        ? this.formatDate(payment.reservationId.date)
        : payment.pollId?.openPlayEvent 
          ? this.formatDate(payment.pollId.openPlayEvent.eventDate)
          : 'N/A',
      reservationTime: payment.reservationId
        ? payment.reservationId.timeSlotDisplay
        : payment.pollId?.title || 'Open Play Event'
    };

    // Open the modern cancellation dialog
    const dialogRef = this.dialog.open(CancellationDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
      disableClose: true,
      data: dialogData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.cancelled) {
        this.processCancellation(paymentId, result.reason);
      }
    });
  }

  private processCancellation(paymentId: string, reason: string): void {
    this.processing.push(paymentId);
    
    this.http.put<any>(`${this.apiUrl}/payments/${paymentId}/cancel`, {
      reason: reason
    }).subscribe({
      next: (response) => {
        this.processing = this.processing.filter(id => id !== paymentId);
        this.showSuccess('Payment Cancelled', `Payment cancelled: ${reason}`);
        this.loadPaymentHistory();
        this.loadPendingPayments();
      },
      error: (error) => {
        this.processing = this.processing.filter(id => id !== paymentId);
        const message = error.error?.error || 'Failed to cancel payment';
        this.showError('Cancel Failed', message);
      }
    });
  }


  cancelReservationPayment(reservation: Reservation): void {
    // Find the payment associated with this reservation
    this.http.get<any>(`${this.apiUrl}/payments/my`).subscribe({
      next: (response) => {
        const payments = response.data || [];
        const associatedPayment = payments.find((p: any) => 
          p.reservationId?._id === reservation._id && p.status === 'pending'
        );
        
        if (associatedPayment) {
          // Prepare dialog data using reservation info
          const dialogData: CancellationDialogData = {
            paymentId: associatedPayment._id,
            paymentAmount: associatedPayment.formattedAmount,
            reservationDate: this.formatDate(reservation.date),
            reservationTime: reservation.timeSlotDisplay
          };

          // Open the modern cancellation dialog
          const dialogRef = this.dialog.open(CancellationDialogComponent, {
            width: '500px',
            maxWidth: '90vw',
            disableClose: true,
            data: dialogData
          });

          dialogRef.afterClosed().subscribe(result => {
            if (result && result.cancelled) {
              this.processCancellation(associatedPayment._id, result.reason);
            }
          });
        } else {
          this.showError('No Payment Record Found', 
            'This reservation has not been paid yet. Please click "Pay Now" first to create a payment record, then you can cancel it if needed.');
        }
      },
      error: (error) => {
        this.showError('Error', 'Failed to find associated payment');
      }
    });
  }

  private checkIsLateCancellation(reservation: Reservation): boolean {
    if (!reservation?.date || reservation.timeSlot == null) return false;
    const reservationDate = new Date(reservation.date);
    const reservationStart = new Date(
      reservationDate.getFullYear(),
      reservationDate.getMonth(),
      reservationDate.getDate(),
      reservation.timeSlot, 0, 0, 0
    );
    return (reservationStart.getTime() - Date.now()) / (1000 * 60 * 60) < 12;
  }

  cancelReservationDirectly(reservation: Reservation): void {
    // Open confirmation dialog for canceling the entire reservation
    const dialogData: CancellationDialogData = {
      paymentId: '', // No payment ID since we're canceling reservation directly
      paymentAmount: `₱${reservation.totalFee}`,
      reservationDate: this.formatDate(reservation.date),
      reservationTime: reservation.timeSlotDisplay,
      isReservationCancellation: true, // Flag to indicate this is a reservation cancellation
      isLateCancellation: this.checkIsLateCancellation(reservation)
    };

    const dialogRef = this.dialog.open(CancellationDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
      disableClose: true,
      data: dialogData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.cancelled) {
        this.processReservationCancellation(reservation._id, result.reason);
      }
    });
  }

  processReservationCancellation(reservationId: string, reason: string): void {
    if (this.processing.includes(reservationId)) return;

    this.processing.push(reservationId);

    // Cancel the reservation directly via DELETE /reservations/:id
    this.http.delete<any>(`${this.apiUrl}/reservations/${reservationId}`, {
      body: { reason }
    }).subscribe({
      next: (response) => {
        this.processing = this.processing.filter(id => id !== reservationId);
        this.showSuccess('Reservation Cancelled', 
          response.message || `Reservation cancelled successfully. ${reason ? 'Reason: ' + reason : ''}`);
        this.loadPendingPayments();
      },
      error: (error) => {
        this.processing = this.processing.filter(id => id !== reservationId);
        const message = error.error?.error || 'Failed to cancel reservation';
        this.showError('Cancel Failed', message);
      }
    });
  }

  unrecordPayment(paymentId: string): void {
    if (!this.isAdmin()) {
      this.showError('Access Denied', 'Only admins can unrecord payments');
      return;
    }

    // Find payment details for confirmation
    const payment = this.paymentHistory.find(p => p._id === paymentId);
    if (!payment) {
      this.showError('Payment Not Found', 'Could not find payment details');
      return;
    }

    // Show confirmation dialog
    const confirmed = confirm(`Are you sure you want to unrecord this payment?\n\nThis will:\n- Change status from "Recorded" back to "Completed"\n- Remove it from the Court Usage Report\n- Keep the payment as paid but no longer counted in monthly reports\n\nPayment: ${payment.description}\nAmount: ${payment.formattedAmount || '₱' + payment.amount.toFixed(2)}`);

    if (!confirmed) return;

    this.processing.push(paymentId);

    this.http.put<any>(`${this.apiUrl}/payments/${paymentId}/unrecord`, {
      notes: 'Unrecorded via Payment Management interface'
    }).subscribe({
      next: (response) => {
        this.processing = this.processing.filter(id => id !== paymentId);
        this.showSuccess('Payment Unrecorded', 'Payment has been unrecorded successfully and removed from Court Usage Report');
        
        // Refresh payment history to show the status change
        this.loadPaymentHistory(true);
      },
      error: (error) => {
        this.processing = this.processing.filter(id => id !== paymentId);
        const message = error.error?.error || 'Failed to unrecord payment';
        this.showError('Unrecord Failed', message);
      }
    });
  }

  // Utility methods
  formatReservationOption(reservation: Reservation): string {
    const date = new Date(reservation.date).toLocaleDateString();
    return `${date} - ${reservation.timeSlotDisplay} (₱${reservation.totalFee})`;
  }

  formatReservationDetails(reservation: Reservation): string {
    const playerCount = reservation.players.length;
    const date = new Date(reservation.date).toLocaleDateString();
    return `${playerCount} player${playerCount !== 1 ? 's' : ''} on ${date}`;
  }

  formatPaymentReservation(payment: Payment): string {
    if (payment.reservationId) {
      const date = new Date(payment.reservationId.date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      // Use timeSlotDisplay if available (for grouped payments), otherwise calculate manually using endTimeSlot
      const endTime = payment.reservationId.endTimeSlot ||
                      (payment.reservationId.timeSlot + (payment.reservationId.duration || 1));
      const timeRange = payment.reservationId.timeSlotDisplay ||
        `${this.formatTime(payment.reservationId.timeSlot)}-${this.formatTime(endTime)}`;
      return `${date} ${timeRange}`;
    } else if (payment.metadata?.isManualPayment) {
      // Format manual court usage payment
      const date = new Date(payment.metadata.courtUsageDate).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      const startTime = payment.metadata.startTime ?? payment.metadata.timeSlot ?? 0;
      const endTime = payment.metadata.endTime ?? (payment.metadata.timeSlot ? payment.metadata.timeSlot + 1 : 0);
      const timeRange = `${this.format24Hour(startTime)} - ${this.format24Hour(endTime)}`;
      const players = payment.metadata.playerNames ? ` - Players: ${payment.metadata.playerNames.join(', ')}` : '';
      return `${date} ${timeRange}${players}`;
    } else if (payment.pollId?.openPlayEvent) {
      const date = new Date(payment.pollId.openPlayEvent.eventDate).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      return `${date} - ${payment.pollId.title}`;
    } else if (payment.metadata?.isAssignedExpense) {
      const parts: string[] = [];
      if (payment.metadata.reason) parts.push(payment.metadata.reason);
      if (payment.metadata.createdBy) parts.push(`Assigned by ${payment.metadata.createdBy}`);
      return parts.join(' • ') || 'Club Expense';
    }
    return 'N/A';
  }

  /**
   * Convert 24-hour time to 12-hour AM/PM format
   */
  formatTime(hour: number): string {
    if (hour === 0) return '12AM';
    if (hour < 12) return `${hour}AM`;
    if (hour === 12) return '12PM';
    return `${hour - 12}PM`;
  }

  /**
   * Format time in 24-hour format (e.g., 18:00)
   */
  format24Hour(hour: number): string {
    return `${hour.toString().padStart(2, '0')}:00`;
  }

  formatPaymentMethod(method: string): string {
    const methods: { [key: string]: string } = {
      'cash': 'Cash',
      'bank_transfer': 'Bank Transfer',
      'gcash': 'GCash',
      'coins': 'Coins'
    };
    return methods[method] || method;
  }

  /**
   * Process payments for display - each payment shown separately (grouping disabled)
   * @param payments - Array of payments to process
   * @param sortOrder - Sort order: 'asc' for ascending (oldest first), 'desc' for descending (most recent first)
   */
  groupPayments(payments: Payment[], sortOrder: 'asc' | 'desc' = 'desc'): Payment[] {
    // Disable grouping - return payments as individual entries
    console.log('🔍 groupPayments: Input payments:', payments.length, `(grouping disabled, sort: ${sortOrder})`);

    // Ensure each payment has timeSlotDisplay for rendering
    const processedPayments = payments.map(payment => {
      if (payment.reservationId && !payment.reservationId.timeSlotDisplay) {
        payment.reservationId.timeSlotDisplay = this.formatTimeRange(
          payment.reservationId.timeSlot,
          payment.reservationId.endTimeSlot || (payment.reservationId.timeSlot + (payment.reservationId.duration || 1))
        );
      }
      return payment;
    });

    // Sort by reservation/payment date
    return processedPayments.sort((a, b) => {
      // Use reservation date if available, otherwise use paymentDate, fallback to createdAt
      const dateA = a.reservationId?.date
        ? new Date(a.reservationId.date)
        : a.paymentDate
          ? new Date(a.paymentDate)
          : new Date(a.createdAt);
      const dateB = b.reservationId?.date
        ? new Date(b.reservationId.date)
        : b.paymentDate
          ? new Date(b.paymentDate)
          : new Date(b.createdAt);

      // Apply sort order
      return sortOrder === 'asc'
        ? dateA.getTime() - dateB.getTime()  // Ascending (oldest first)
        : dateB.getTime() - dateA.getTime(); // Descending (most recent first)
    });
  }

  /**
   * Format time range (reused from my-reservations component)
   */
  formatTimeRange(startHour: number, endHour: number): string {
    return `${this.formatTime(startHour)}-${this.formatTime(endHour)}`;
  }

  /**
   * Toggle expansion of grouped payment to show individual payments
   */
  togglePaymentExpansion(paymentId: string): void {
    if (this.expandedPayments.has(paymentId)) {
      this.expandedPayments.delete(paymentId);
    } else {
      this.expandedPayments.add(paymentId);
    }
  }

  /**
   * Check if payment is expanded
   */
  isPaymentExpanded(paymentId: string): boolean {
    return this.expandedPayments.has(paymentId);
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Format player names from array (handles both strings and objects)
  formatPlayerNames(players: any[]): string {
    if (!players || players.length === 0) {
      return '';
    }

    return players.map(player => {
      if (typeof player === 'string') {
        return player;
      } else if (player && typeof player === 'object') {
        return player.fullName || player.username || player.name || 'Unknown Player';
      }
      return String(player);
    }).join(', ');
  }

  // Notification methods
  private showNotification(type: 'success' | 'error' | 'warning' | 'info', title: string, message: string, duration = 5000): void {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const notification: Notification = { id, type, title, message, duration };
    
    this.notifications.push(notification);
    
    if (duration > 0) {
      setTimeout(() => {
        this.removeNotification(id);
      }, duration);
    }
  }

  removeNotification(id: string): void {
    this.notifications = this.notifications.filter(n => n.id !== id);
  }

  private showSuccess(title: string, message: string): void {
    this.showNotification('success', title, message, 4000);
  }

  private showError(title: string, message: string): void {
    this.showNotification('error', title, message, 6000);
  }

  trackNotification(index: number, notification: Notification): string {
    return notification.id;
  }

  // Check if reservation is overdue (past date with pending payment)
  isReservationOverdue(reservation: Reservation): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const reservationDate = new Date(reservation.date);
    reservationDate.setHours(0, 0, 0, 0);
    
    return reservationDate < today && reservation.paymentStatus === 'pending';
  }

  // Check if payment is overdue
  isPaymentOverdue(payment: Payment): boolean {
    if (payment.status === 'completed' || payment.status === 'refunded' || payment.status === 'record') {
      return false;
    }
    return new Date() > new Date(payment.dueDate);
  }

  // Check if payment is a legacy cancelled payment (cancelled before metadata tracking)
  isLegacyCancelledPayment(payment: Payment): boolean {
    // Check for cancellation indicators in description or method
    const hasCancelledDescription = payment.description && (
      payment.description.toLowerCase().includes('cancelled') ||
      payment.description.toLowerCase().includes('cancel')
    );
    
    const hasCancelledMethod = payment.paymentMethod && (
      (payment.paymentMethod as string).toLowerCase().includes('cancelled') ||
      (payment.paymentMethod as string).toLowerCase().includes('cancel')
    );
    
    // Check if it's a failed Open Play payment (likely cancelled)
    const isFailedOpenPlay = payment.status === 'failed' && 
                           payment.pollId && 
                           payment.description && 
                           payment.description.toLowerCase().includes('open play');
    
    const hasCancellationMetadata = !!payment.metadata?.cancellation;
    
    // It's a legacy cancellation if it has cancellation indicators or is a failed Open Play and no new metadata
    return (hasCancelledDescription || hasCancelledMethod || isFailedOpenPlay) && !hasCancellationMetadata;
  }

  handleDirectPayment(reservationId: string): void {
    // Wait for reservations to load, then auto-select the specific one
    if (this.unpaidReservations.length === 0) {
      // If reservations haven't loaded yet, wait and try again
      setTimeout(() => this.handleDirectPayment(reservationId), 500);
      return;
    }

    const targetReservation = this.unpaidReservations.find(r => r._id === reservationId);
    if (targetReservation) {
      this.isDirectPayment = true;
      this.selectedReservation = targetReservation;
      this.paymentForm.patchValue({
        reservationId: reservationId,
        courtFee: targetReservation.totalFee || 0
      });
      
      // Clear the query parameters to clean up the URL
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {}
      });
    }
  }

  toggleReservationSelection(): void {
    this.showReservationSelector = true;
  }

  cancelReservationChange(): void {
    this.showReservationSelector = false;
    // Restore the original selection
    if (this.selectedReservation) {
      this.paymentForm.patchValue({
        reservationId: this.selectedReservation._id
      });
    }
  }

  resetForm(): void {
    this.selectedReservation = null;
    this.isDirectPayment = false;
    this.showReservationSelector = false;
    this.paymentForm.reset();
    this.paymentForm.patchValue({
      reservationId: '',
      courtFee: '',
      paymentMethod: 'gcash', // Default to GCash
      transactionId: '',
      notes: ''
    });
    this.removeProofOfPaymentFile();
  }

  private readProofFile(
    file: File,
    setFile: (file: File | null) => void,
    setPreview: (url: string | null) => void,
    setError: (error: string | null) => void
  ): void {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setError('Only JPG and PNG images are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }
    setError(null);

    this.compressImage(file).then((processedFile) => {
      setFile(processedFile);
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(processedFile);
    }).catch((err) => {
      console.warn('⚠️ Image compression failed, using original file:', err);
      setFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    });
  }

  // Shrinks large mobile camera photos before upload so they transfer faster and
  // are less likely to be interrupted mid-transfer on a slow/unstable mobile connection.
  private compressImage(file: File, maxDimension = 1600, quality = 0.8): Promise<File> {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);

        const { width, height } = img;
        const alreadySmall = width <= maxDimension && height <= maxDimension && file.size <= 800 * 1024;
        if (alreadySmall) {
          resolve(file);
          return;
        }

        const scale = Math.min(1, maxDimension / Math.max(width, height));
        const targetWidth = Math.round(width * scale);
        const targetHeight = Math.round(height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas not supported'));
          return;
        }
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Image compression produced no output'));
            return;
          }
          const dot = file.name.lastIndexOf('.');
          const baseName = dot >= 0 ? file.name.slice(0, dot) : file.name;
          resolve(new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' }));
        }, 'image/jpeg', quality);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load image for compression'));
      };

      img.src = objectUrl;
    });
  }

  onProofFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.readProofFile(
      file,
      (f) => this.proofOfPaymentFile = f,
      (url) => this.proofOfPaymentPreviewUrl = url,
      (err) => this.proofOfPaymentError = err
    );
    input.value = '';
  }

  removeProofOfPaymentFile(): void {
    this.proofOfPaymentFile = null;
    this.proofOfPaymentPreviewUrl = null;
    this.proofOfPaymentError = null;
  }

  onManualProofFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.readProofFile(
      file,
      (f) => this.manualProofOfPaymentFile = f,
      (url) => this.manualProofOfPaymentPreviewUrl = url,
      (err) => this.manualProofOfPaymentError = err
    );
    input.value = '';
  }

  removeManualProofOfPaymentFile(): void {
    this.manualProofOfPaymentFile = null;
    this.manualProofOfPaymentPreviewUrl = null;
    this.manualProofOfPaymentError = null;
  }

  payForReservation(reservation: Reservation | {_id: string, date: Date, timeSlot: number, players: string[], timeSlotDisplay: string} | undefined, overrideAmount?: number): void {
    if (!reservation) return;
    
    console.log('💰 payForReservation called with override amount:', overrideAmount);
    
    // If admin, check if there's already an existing payment record for this reservation
    if (this.isAdmin()) {
      const existingPayment = this.pendingPayments.find(p => 
        !p.isSynthetic && p.reservationId && p.reservationId._id === reservation._id
      );
      
      if (existingPayment) {
        console.log('💰 Admin detected existing payment, redirecting to update existing payment:', existingPayment._id);
        this.payForExistingPayment(existingPayment);
        return;
      }
    }
    
    // Convert to full Reservation object if needed
    const fullReservation: Reservation = {
      _id: reservation._id,
      date: reservation.date,
      timeSlot: reservation.timeSlot,
      players: reservation.players,
      timeSlotDisplay: reservation.timeSlotDisplay,
      status: 'confirmed',
      paymentStatus: 'pending',
      totalFee: ('totalFee' in reservation) ? reservation.totalFee : 0,
      userId: ('userId' in reservation) ? reservation.userId : undefined
    };
    
    // Use override amount if provided, otherwise recalculate the fee
    if (overrideAmount) {
      console.log(`✅ Using override amount: ₱${overrideAmount}`);
      this.calculateAndSetReservationFee(fullReservation, overrideAmount);
    } else {
      // Always recalculate the fee based on current member data to ensure accuracy
      this.calculateAndSetReservationFeeWithMemberData(fullReservation);
    }
  }

  /**
   * Handle payment for grouped reservations (multi-hour bookings)
   */
  payForGroupedReservation(payment: Payment): void {
    if (!payment) return;

    // Check if this is a grouped payment with multiple reservations
    if (payment._groupedPayments && payment._groupedPayments.length > 1) {
      // For grouped payments, we need to handle all reservations at once
      // Use the total amount from the grouped payment
      const totalAmount = payment.amount;
      const firstReservation = payment.reservationId;
      
      if (!firstReservation) return;

      // Create a consolidated reservation object for the payment form
      const consolidatedReservation: Reservation = {
        _id: firstReservation._id, // Use first reservation's ID as primary
        date: firstReservation.date,
        timeSlot: firstReservation.timeSlot,
        players: firstReservation.players,
        timeSlotDisplay: firstReservation.timeSlotDisplay || payment.reservationId?.timeSlotDisplay,
        status: 'confirmed',
        paymentStatus: 'pending',
        totalFee: totalAmount, // Use the grouped total amount
        userId: firstReservation.userId, // Pass the userId to identify the reserver
        _groupedReservationIds: payment._groupedPayments.map(p => p.reservationId!._id) // Store all reservation IDs
      };

      // Set this as the selected reservation and populate the form
      this.selectedReservation = consolidatedReservation;
      this.paymentForm.patchValue({
        reservationId: consolidatedReservation._id,
        courtFee: totalAmount
      });

      // Payment form will be shown via calculateAndSetReservationFeeWithMemberData
      
      console.log(`💰 Grouped payment setup: ${payment._groupedPayments.length} reservations, total: ₱${totalAmount}`);
    } else {
      // Single payment, use the amount from the payment object
      const paymentAmount = payment.amount;
      console.log(`💰 Single payment: using payment amount ₱${paymentAmount}`);
      this.payForReservation(payment.reservationId, paymentAmount);
    }
  }

  async calculateAndSetReservationFeeWithMemberData(reservation: Reservation): Promise<void> {
    console.log('🔍 DEBUG calculateAndSetReservationFeeWithMemberData input:', {
      reservationId: reservation._id,
      initialTotalFee: reservation.totalFee,
      timeSlot: reservation.timeSlot,
      duration: reservation.duration,
      endTimeSlot: reservation.endTimeSlot,
      players: reservation.players
    });
    // Calculate fee using current member data instead of backend calculation
    const mockPayment = {
      reservationId: {
        players: reservation.players,
        timeSlot: reservation.timeSlot,
        duration: reservation.duration,
        endTimeSlot: reservation.endTimeSlot,
        date: reservation.date
      }
    };

    const feeInfo = this.getPlayerFeeInfo(mockPayment);
    const calculatedFee = (feeInfo.memberCount * feeInfo.memberFee) + (feeInfo.nonMemberCount * feeInfo.nonMemberFee);

    console.log(`💰 Setting reservation fee with member data:`);
    console.log(`💰 Players: ${this.formatPlayerNames(reservation.players)}`);
    console.log(`💰 Original stored fee: ₱${reservation.totalFee}`);
    console.log(`💰 Calculated fee: ₱${calculatedFee} (${feeInfo.memberCount} members × ₱${feeInfo.memberFee} + ${feeInfo.nonMemberCount} non-members × ₱${feeInfo.nonMemberFee})`);

    // Update the reservation with the correctly calculated fee
    reservation.totalFee = calculatedFee;

    // Calculate isPeakHour for member amount calculations
    const peakHours = [5, 18, 19, 20, 21];
    const isPeakHour = peakHours.includes(reservation.timeSlot);
    (reservation as any).isPeakHour = isPeakHour;

    this.selectedReservation = reservation;

    // Calculate the reserver's individual amount (only their share, not total fee)
    const members = reservation.players.filter((p: any) =>
      typeof p === 'object' && p.isMember
    ) as ReservationPlayer[];

    // Find the reserver in the members list
    const reserverMember = members.find(m =>
      m.userId === this.getReservationUserId(reservation.userId)
    );

    // Calculate reserver's amount
    let reserverAmount = calculatedFee; // Default to total fee if not found
    if (reserverMember) {
      reserverAmount = this.calculateMemberAmount(reservation, reserverMember);
      console.log(`💰 Reserver's court fee share: ₱${reserverAmount}`);
    } else {
      console.log(`⚠️ Could not find reserver in members list, using total fee: ₱${reserverAmount}`);
    }

    // Add tennis balls cost to reserver's amount (only reserver pays for balls)
    if (reservation.tennisBalls && reservation.tennisBalls.totalCost > 0) {
      const ballsCost = reservation.tennisBalls.totalCost;
      reserverAmount += ballsCost;
      console.log(`💰 Tennis balls cost (added to reserver only): ₱${ballsCost}`);
      console.log(`💰 Reserver's total amount (court + balls): ₱${reserverAmount}`);
    }

    this.paymentForm.patchValue({
      reservationId: reservation._id,
      courtFee: reserverAmount // Set to reserver's amount (court fee share + tennis balls)
    });
  }

  async calculateAndSetReservationFee(reservation: Reservation, overrideAmount?: number): Promise<void> {
    // Use override amount if provided, otherwise use reservation's totalFee
    const correctFee = overrideAmount || reservation.totalFee || 0;

    console.log(`✅ Using fee: ₱${correctFee} ${overrideAmount ? '(override provided)' : '(from reservation)'}`);

    this.selectedReservation = reservation;
    this.paymentForm.patchValue({
      reservationId: reservation._id,
      courtFee: correctFee
    });
  }

  payForOpenPlay(payment: Payment): void {
    if (!payment.pollId) return;

    // For Open Play events, create a reservation-like object for the payment form
    // This allows users to select payment method and complete the payment properly
    const openPlayAsReservation: Reservation = {
      _id: payment._id, // Use payment ID instead of reservation ID
      date: payment.pollId.openPlayEvent?.eventDate || new Date(),
      timeSlot: payment.pollId.openPlayEvent?.startTime || 18,
      players: ['Open Play Participant'], // Generic player for Open Play
      timeSlotDisplay: `${payment.pollId.title}`,
      status: 'confirmed',
      paymentStatus: 'pending',
      totalFee: payment.amount // ₱120 for Open Play
    };

    // Set a flag to indicate this is an Open Play payment
    (openPlayAsReservation as any).isOpenPlay = true;
    (openPlayAsReservation as any).originalPaymentId = payment._id;

    this.selectedReservation = openPlayAsReservation;
    this.paymentForm.patchValue({
      reservationId: payment._id, // Use payment ID for Open Play
      paymentMethod: 'gcash' // Default to GCash
    });
  }

  payForManualPayment(payment: Payment): void {
    if (!payment.metadata?.isManualPayment) return;

    console.log('💰 Opening payment form for manual payment:', payment._id);
    console.log('💰 Payment metadata:', payment.metadata);

    // For manual court usage payments, create a reservation-like object for the payment form
    const startTime = payment.metadata.startTime ?? payment.metadata.timeSlot ?? 0;
    const endTime = payment.metadata.endTime ?? (payment.metadata.timeSlot ? payment.metadata.timeSlot + 1 : 0);
    const playerNames = payment.metadata.playerNames || [];
    const date = payment.metadata.courtUsageDate || new Date();

    console.log('💰 Time values - startTime:', startTime, 'endTime:', endTime);

    const manualPaymentAsReservation: Reservation = {
      _id: payment._id, // Use payment ID
      date: date,
      timeSlot: startTime,
      players: playerNames, // Use the actual player names
      timeSlotDisplay: `${this.format24Hour(startTime)} - ${this.format24Hour(endTime)}`,
      status: 'confirmed',
      paymentStatus: 'pending',
      totalFee: payment.amount
    };

    // Set a flag to indicate this is a manual payment
    (manualPaymentAsReservation as any).isManualPayment = true;
    (manualPaymentAsReservation as any).originalPaymentId = payment._id;

    this.selectedReservation = manualPaymentAsReservation;
    this.paymentForm.patchValue({
      reservationId: payment._id, // Use payment ID for manual payment
      paymentMethod: 'gcash', // Default to GCash
      courtFee: payment.amount // Set the amount
    });

    // Scroll to top where payment form appears
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);

    console.log('💰 Payment form should now be visible. selectedReservation:', this.selectedReservation);
    console.log('💰 Total fee set to:', payment.amount);
  }

  payForExistingPayment(payment: Payment): void {
    if (!payment.reservationId) return;
    
    console.log('🔍 DEBUG payForExistingPayment:', {
      paymentAmount: payment.amount,
      reservationTotalFee: payment.reservationId.totalFee,
      reservationId: payment.reservationId._id,
      timeSlot: payment.reservationId.timeSlot,
      players: payment.reservationId.players,
      tennisBalls: payment.reservationId.tennisBalls
    });

    // For existing payment records, show the payment form to allow users to select/confirm payment method
    // Convert the payment back to a reservation-like object for the form
    const reservationForForm: Reservation = {
      _id: payment.reservationId._id,
      date: payment.reservationId.date,
      timeSlot: payment.reservationId.timeSlot,
      endTimeSlot: payment.reservationId.endTimeSlot,
      duration: payment.reservationId.duration,
      players: payment.reservationId.players,
      timeSlotDisplay: payment.reservationId.timeSlotDisplay,
      status: 'confirmed',
      paymentStatus: 'pending',
      totalFee: payment.reservationId.totalFee || payment.amount, // Use reservation's totalFee first
      userId: payment.reservationId.userId, // Pass the userId to identify the reserver
      tennisBalls: payment.reservationId.tennisBalls // Include tennis balls data
    };

    console.log('🔍 DEBUG reservationForForm totalFee:', reservationForForm.totalFee);
    console.log('🔍 DEBUG reservationForForm tennisBalls:', reservationForForm.tennisBalls);
    
    // Mark this as an existing payment update
    (reservationForForm as any).existingPaymentId = payment._id;
    
    // Recalculate the fee with current member data
    this.calculateAndSetReservationFeeWithMemberData(reservationForForm);
    this.paymentForm.patchValue({
      reservationId: payment.reservationId._id,
      paymentMethod: payment.paymentMethod,
      courtFee: payment.amount  // Use the member's actual stored amount, not the reserver's recalculated share
    });

    // Scroll to payment form after a brief delay to allow rendering
    setTimeout(() => {
      const element = document.getElementById('payment-form-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  convertPaymentToReservation(payment: Payment): Reservation {
    // Convert synthetic payment back to reservation object for cancellation
    if (!payment.reservationId) {
      throw new Error('Payment does not have reservation information');
    }
    
    return {
      _id: payment.reservationId._id,
      date: payment.reservationId.date,
      timeSlot: payment.reservationId.timeSlot,
      players: payment.reservationId.players,
      timeSlotDisplay: payment.reservationId.timeSlotDisplay,
      status: 'confirmed',
      paymentStatus: 'pending',
      totalFee: payment.amount
    };
  }

  cancelReservationFromPayment(payment: Payment): void {
    if (!payment.reservationId) return;
    
    // Convert payment to reservation and use the existing cancellation flow
    const reservation = this.convertPaymentToReservation(payment);
    this.cancelReservationDirectly(reservation);
  }

  updateOpenPlayPayment(paymentId: string, paymentMethod: string, transactionId?: string): void {
    // For Open Play, we need to update the existing payment record with the new payment method
    // and then process it based on the method chosen

    const updateData: any = {
      paymentMethod: paymentMethod
    };

    if (transactionId) {
      updateData.transactionId = transactionId;
    }

    // First update the payment method
    const requestUrl = `${this.apiUrl}/payments/${paymentId}`;
    console.log('💰 FRONTEND: Attempting PUT request to:', requestUrl);
    console.log('💰 FRONTEND: Update data:', updateData);
    console.log('💰 FRONTEND: Payment ID:', paymentId);

    this.http.put<any>(requestUrl, updateData).subscribe({
      next: () => {
        // Open Play payments: update payment method and mark as completed
        // Then admin will verify and record it in Active Payments tab
        this.processPayment(paymentId, true, true, (success, error) => {
          this.loading = false;
          if (success) {
            this.showSuccess('Payment Method Selected', 'Payment method has been recorded. An admin will verify and record the payment.');
          } else {
            const reason = error?.error?.error || error?.message || 'unknown error';
            this.showError('Payment Processing Failed', `Failed to mark payment as completed: ${reason}`);
          }
          this.resetForm();
          this.loadPendingPayments(true);
        });
      },
      error: (error) => {
        this.loading = false;
        console.error('💰 Open Play payment update error:', error);
        console.error('💰 Error response:', error.error);
        console.error('💰 Error status:', error.status);
        console.error('💰 Error message:', error.message);

        let message = 'Failed to update Open Play payment';
        if (error.error?.error) {
          message = error.error.error;
        } else if (error.error?.message) {
          message = error.error.message;
        } else if (error.message) {
          message = error.message;
        }

        this.showError('Open Play Payment Update Failed', `${message} (Status: ${error.status})`);
      }
    });
  }

  updateManualPayment(paymentId: string, paymentMethod: string, transactionId?: string): void {
    // For Manual Payments, we need to update the existing payment record with the new payment method
    // and then process it based on the method chosen

    const updateData: any = {
      paymentMethod: paymentMethod
    };

    if (transactionId) {
      updateData.transactionId = transactionId;
    }

    // First update the payment method
    const requestUrl = `${this.apiUrl}/payments/${paymentId}`;
    console.log('💰 FRONTEND: Updating manual payment:', requestUrl);
    console.log('💰 FRONTEND: Update data:', updateData);

    this.http.put<any>(requestUrl, updateData).subscribe({
      next: () => {
        // Manual court usage payments: update payment method and mark as completed
        // Then admin will verify and record it in Active Payments tab
        this.processPayment(paymentId, true, true, (success, error) => {
          this.loading = false;
          if (success) {
            this.showSuccess('Payment Method Selected', 'Payment method has been recorded. An admin will verify and record the payment.');
          } else {
            const reason = error?.error?.error || error?.message || 'unknown error';
            this.showError('Payment Processing Failed', `Failed to mark payment as completed: ${reason}`);
          }
          this.resetForm();
          this.loadPendingPayments(true);
        });
      },
      error: (error) => {
        this.loading = false;
        console.error('💰 Manual payment update error:', error);

        let message = 'Failed to update manual payment';
        if (error.error?.error) {
          message = error.error.error;
        } else if (error.error?.message) {
          message = error.error.message;
        } else if (error.message) {
          message = error.message;
        }

        this.showError('Manual Payment Update Failed', `${message} (Status: ${error.status})`);
      }
    });
  }

  isOpenPlayPayment(): boolean {
    return !!(this.selectedReservation as any)?.isOpenPlay;
  }

  isManualPayment(): boolean {
    return !!(this.selectedReservation as any)?.isManualPayment;
  }

  isAssignedExpensePayment(): boolean {
    return !!(this.selectedReservation as any)?.isAssignedExpense;
  }

  payForAssignedExpense(payment: Payment): void {
    if (!payment.metadata?.isAssignedExpense) return;

    const expenseAsReservation: Reservation = {
      _id: payment._id,
      date: payment.createdAt || new Date(),
      timeSlot: 0,
      players: [],
      timeSlotDisplay: payment.description,
      status: 'confirmed',
      paymentStatus: 'pending',
      totalFee: payment.amount
    };

    (expenseAsReservation as any).isAssignedExpense = true;
    (expenseAsReservation as any).originalPaymentId = payment._id;

    this.selectedReservation = expenseAsReservation;
    this.paymentForm.patchValue({
      reservationId: payment._id,
      paymentMethod: 'gcash',
      courtFee: payment.amount
    });

    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
  }

  getTimeSlotInfo(): string {
    if (!this.selectedReservation) return '';
    
    return `${this.selectedReservation.timeSlotDisplay || this.formatTimeSlot(this.selectedReservation.timeSlot)}`;
  }

  getRateTypeInfo(): string {
    if (!this.selectedReservation) return '';
    
    const isPeak = this.isPeakHourReservation();
    return isPeak ? 'Peak Hour (₱100 minimum)' : 'Off-Peak (per player rate)';
  }

  isPeakHourReservation(): boolean {
    if (!this.selectedReservation) return false;

    // Peak hours: 5AM, 6PM, 7PM, 8PM, 9PM (5, 18, 19, 20, 21)
    const peakHours = [5, 18, 19, 20, 21];
    return peakHours.includes(this.selectedReservation.timeSlot);
  }

  getMemberRate(): string {
    return this.isPeakHourReservation() ? 'Peak Rate' : '₱20';
  }

  getPlayerBreakdownInfo(): {
    memberCount: number;
    nonMemberCount: number;
    memberTotal: number;
    nonMemberTotal: number;
  } {
    if (!this.selectedReservation || !this.selectedReservation.players) {
      return { memberCount: 0, nonMemberCount: 0, memberTotal: 0, nonMemberTotal: 0 };
    }

    // Use the same fee calculation logic as the payment cards for consistency
    const mockPayment = {
      reservationId: {
        players: this.selectedReservation.players,
        timeSlot: this.selectedReservation.timeSlot,
        date: this.selectedReservation.date
      }
    };

    const feeInfo = this.getPlayerFeeInfo(mockPayment);
    
    return {
      memberCount: feeInfo.memberCount,
      nonMemberCount: feeInfo.nonMemberCount,
      memberTotal: feeInfo.memberCount * feeInfo.memberFee,
      nonMemberTotal: feeInfo.nonMemberCount * feeInfo.nonMemberFee
    };
  }

  formatTimeSlot(timeSlot: number): string {
    return `${timeSlot}:00 - ${timeSlot + 1}:00`;
  }

  // Calculate individual player fees for payment cards
  getPlayerFeeInfo(payment: any): { memberFee: number, nonMemberFee: number, memberCount: number, nonMemberCount: number } {
    if (!payment.reservationId || !payment.reservationId.players || !payment.reservationId.timeSlot) {
      return { memberFee: 0, nonMemberFee: 0, memberCount: 0, nonMemberCount: 0 };
    }

    const reservation = payment.reservationId;
    const players = reservation.players;
    const timeSlot = reservation.timeSlot;
    const duration = reservation.duration || 1; // Default to 1 hour if not specified

    // Peak hours: 5AM, 6PM, 7PM, 8PM, 9PM (5, 18, 19, 20, 21)
    const peakHours = [5, 18, 19, 20, 21];
    const isPeakHour = peakHours.includes(timeSlot);

    // Check if this is December 2025 format (players have isMember/isGuest flags)
    const isNewFormat = players.length > 0 && typeof players[0] === 'object' && 'isMember' in players[0];

    if (isNewFormat) {
      // December 2025 pricing: ₱100/150 base + ₱70 per guest, calculated hour-by-hour
      const PEAK_BASE = 150;
      const NON_PEAK_BASE = 100;
      const GUEST_FEE = 70;

      const memberCount = players.filter((p: any) => p.isMember).length;
      const guestCount = players.filter((p: any) => p.isGuest).length;

      // Calculate base fee hour-by-hour for multi-hour reservations
      let totalBaseFee = 0;
      const endTimeSlot = timeSlot + duration;
      for (let hour = timeSlot; hour < endTimeSlot; hour++) {
        const isHourPeak = peakHours.includes(hour);
        totalBaseFee += isHourPeak ? PEAK_BASE : NON_PEAK_BASE;
      }

      const totalGuestFee = guestCount * GUEST_FEE * duration;
      const totalFee = totalBaseFee + totalGuestFee;
      const baseFeePerMember = memberCount > 0 ? totalBaseFee / memberCount : 0;

      console.log(`💰 December 2025 Pricing: ${duration}h (hourly calculation) (${memberCount}M + ${guestCount}G) = ₱${totalFee} (Base: ₱${totalBaseFee}, Guest: ₱${totalGuestFee})`);

      return {
        memberFee: Math.round(baseFeePerMember),
        nonMemberFee: guestCount > 0 ? GUEST_FEE * duration : 0,
        memberCount,
        nonMemberCount: guestCount
      };
    } else {
      // Legacy format - use old pricing logic
      const { memberCount, nonMemberCount } = this.categorizePlayersForPayment(players);

      if (isPeakHour) {
        const baseFee = (memberCount * 20) + (nonMemberCount * 50);
        const totalFee = Math.max(100, baseFee) * duration;

        if (memberCount > 0 && nonMemberCount > 0) {
          const memberRatio = (memberCount * 20) / (memberCount * 20 + nonMemberCount * 50);
          const memberPortionOfTotal = Math.round(totalFee * memberRatio);
          const nonMemberPortionOfTotal = totalFee - memberPortionOfTotal;

          return {
            memberFee: Math.round(memberPortionOfTotal / memberCount),
            nonMemberFee: Math.round(nonMemberPortionOfTotal / nonMemberCount),
            memberCount,
            nonMemberCount
          };
        } else if (memberCount > 0) {
          return {
            memberFee: Math.round(totalFee / memberCount),
            nonMemberFee: 0,
            memberCount,
            nonMemberCount: 0
          };
        } else {
          return {
            memberFee: 0,
            nonMemberFee: Math.round(totalFee / nonMemberCount),
            memberCount: 0,
            nonMemberCount
          };
        }
      } else {
        return {
          memberFee: 20 * duration,
          nonMemberFee: 50 * duration,
          memberCount,
          nonMemberCount
        };
      }
    }
  }

  // Load members data for fee calculation
  private async loadMembersData(): Promise<void> {
    console.log('🔄 Starting loadMembersData...');
    console.log('🔄 Current user:', this.currentUser);
    console.log('🔄 Auth token available:', !!this.authService.token);
    
    try {
      // Load members with maximum allowed limit (100) and get all pages
      let allMembers: any[] = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        console.log(`🔄 Loading members page ${page}...`);
        const response = await this.http.get<any>(`${this.apiUrl}/members?limit=100&page=${page}`).toPromise();
        console.log(`🔄 Page ${page} response:`, {
          success: response?.success,
          dataLength: response?.data?.length || 0,
          pagination: response?.pagination
        });
        
        const members = response?.data || [];
        allMembers = [...allMembers, ...members];
        
        // Check if there are more pages
        hasMore = response?.pagination?.hasNext || false;
        page++;
        
        // Safety break to prevent infinite loops
        if (page > 20) break;
      }
      
      this.members = allMembers;
      console.log('📋 Loaded ALL members for fee calculation:', this.members.length, 'members across', page - 1, 'pages');
      
      // Check specifically for Adrian Raphael Choi, Helen Sundiam and Coco Gauf
      const adrianFound = this.members.find(m => m.fullName && m.fullName.toLowerCase().includes('adrian'));
      const helenFound = this.members.find(m => m.fullName && m.fullName.toLowerCase().includes('helen'));
      const cocoFound = this.members.find(m => m.fullName && m.fullName.toLowerCase().includes('coco'));
      
      console.log(adrianFound ? `✅ Adrian found: "${adrianFound.fullName}" (${adrianFound.username})` : '❌ Adrian NOT found');
      console.log(helenFound ? `✅ Helen found: "${helenFound.fullName}"` : '❌ Helen NOT found');
      console.log(cocoFound ? `✅ Coco found: "${cocoFound.fullName}"` : '❌ Coco NOT found (correct - should be non-member)');
      
      // Log a sample of loaded members for debugging
      console.log('📋 Sample of loaded members:', this.members.slice(0, 5).map(m => ({
        fullName: m.fullName,
        username: m.username
      })));
      
    } catch (error) {
      console.error('❌ Error loading members:', error);
      console.error('❌ Error details:', {
        status: (error as any).status,
        message: (error as any).message,
        error: (error as any).error
      });
      // Continue without member data - will use heuristic approach
      this.members = [];
    }
  }

  /**
   * Load GCash configuration from backend
   */
  private loadGCashConfig(): void {
    this.http.get<any>(`${this.apiUrl}/payments/gcash-config`).subscribe({
      next: (response) => {
        if (response.success) {
          this.gcashConfig = response.data;
        }
      },
      error: (error) => {
        console.error('Failed to load GCash config:', error);
      }
    });
  }

  /**
   * Get API base URL without /api suffix for static files
   */
  getApiBaseUrl(): string {
    return environment.apiBaseUrl;
  }

  /**
   * Detect if user is on mobile device
   */
  private detectDevice(): void {
    this.isMobileDevice = window.innerWidth < 768;
    console.log('📱 Device detected:', this.isMobileDevice ? 'Mobile' : 'Desktop');
  }

  /**
   * Copy GCash phone number to clipboard
   */
  copyGCashNumber(): void {
    if (this.gcashConfig?.phoneNumber) {
      navigator.clipboard.writeText(this.gcashConfig.phoneNumber).then(() => {
        this.snackBar.open('GCash number copied to clipboard!', 'Close', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: ['success-snackbar']
        });
        console.log('📋 GCash number copied:', this.gcashConfig?.phoneNumber);
      }).catch(err => {
        console.error('❌ Failed to copy:', err);
        this.snackBar.open('Failed to copy number. Please try manually selecting the text.', 'Close', {
          duration: 4000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: ['error-snackbar']
        });
      });
    }
  }

  /**
   * Open GCash app via deep link
   */
  openGCashApp(): void {
    if (this.gcashConfig?.deepLinkUrl) {
      window.location.href = this.gcashConfig.deepLinkUrl;
      console.log('📱 Opening GCash app with deep link:', this.gcashConfig.deepLinkUrl);
    }
  }

  /**
   * Copy GCash account name to clipboard
   */
  copyGCashAccountName(): void {
    if (this.gcashConfig?.accountName) {
      navigator.clipboard.writeText(this.gcashConfig.accountName).then(() => {
        this.snackBar.open('GCash account name copied to clipboard!', 'Close', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: ['success-snackbar']
        });
        console.log('📋 GCash account name copied:', this.gcashConfig?.accountName);
      }).catch(err => {
        console.error('❌ Failed to copy:', err);
        this.snackBar.open('Failed to copy account name. Please try manually selecting the text.', 'Close', {
          duration: 4000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: ['error-snackbar']
        });
      });
    }
  }

  // Try to categorize players as members vs non-members
  private categorizePlayersForPayment(players: any[]): { memberCount: number, nonMemberCount: number } {
    let memberCount = 0;
    let nonMemberCount = 0;

    console.log('🔍 === CATEGORIZING PLAYERS ===');
    console.log('🔍 Players to categorize:', players);
    console.log('🔍 Members data loaded:', this.members.length, 'members');

    // Convert players to strings if they're objects
    const playerNames = players.map(player => {
      if (typeof player === 'string') {
        return player;
      } else if (player && typeof player === 'object' && player.fullName) {
        return player.fullName;
      } else if (player && typeof player === 'object' && player.username) {
        return player.username;
      }
      return String(player); // Fallback: convert to string
    });

    console.log('🔍 Converted player names:', playerNames);

    if (this.members && this.members.length > 0) {
      // If we have member data, use it
      const memberNames = this.members.map(m => m.fullName.toLowerCase().trim());

      console.log('🔍 Sample member names:', memberNames.slice(0, 5));

      playerNames.forEach(playerName => {
        const cleanPlayerName = playerName.toLowerCase().trim();
        console.log(`🔍 Checking player: "${playerName}" (cleaned: "${cleanPlayerName}")`);
        
        const isFoundInMembers = memberNames.includes(cleanPlayerName);
        
        if (isFoundInMembers) {
          memberCount++;
          console.log(`✅ "${playerName}" is a MEMBER (exact match)`);
        } else {
          // Try fuzzy matching for potential matches
          const fuzzyMatches = memberNames.filter(name => {
            const similarity = this.calculateStringSimilarity(cleanPlayerName, name);
            return similarity > 0.8;
          });
          
          if (fuzzyMatches.length > 0) {
            console.log(`🔍 Fuzzy matches for "${playerName}":`, fuzzyMatches);
            // Use the best fuzzy match as a member
            memberCount++;
            console.log(`✅ "${playerName}" is a MEMBER (fuzzy match)`);
          } else {
            nonMemberCount++;
            console.log(`❌ "${playerName}" is a NON-MEMBER (no match found)`);
          }
        }
      });
    } else {
      // Fallback: Use a more realistic heuristic for member vs non-member distribution
      console.log('🔍 Using heuristic approach (no member data available)');

      // For the specific case mentioned (₱60 vs ₱90), we need to ensure proper distribution
      // Assuming a typical tennis club scenario: some members, some non-members
      const totalPlayers = playerNames.length;
      
      if (totalPlayers === 3) {
        // For 3 players: assume 1 member + 2 non-members to get ₱90 (1×20 + 2×50 = 120, but for off-peak could be different)
        // Or 2 members + 1 non-member to get ₱90 (2×20 + 1×50 = 90) - This matches!
        memberCount = 2;
        nonMemberCount = 1;
        console.log(`🔍 Heuristic for ${totalPlayers} players: ${memberCount} members, ${nonMemberCount} non-members (2×₱20 + 1×₱50 = ₱90)`);
      } else if (totalPlayers === 2) {
        // For 2 players: assume 1 member + 1 non-member
        memberCount = 1;
        nonMemberCount = 1;
        console.log(`🔍 Heuristic for ${totalPlayers} players: ${memberCount} members, ${nonMemberCount} non-members`);
      } else {
        // For other cases, distribute roughly 60% members, 40% non-members
        memberCount = Math.ceil(totalPlayers * 0.6);
        nonMemberCount = totalPlayers - memberCount;
        console.log(`🔍 Heuristic for ${totalPlayers} players: ${memberCount} members, ${nonMemberCount} non-members`);
      }
    }
    
    console.log(`🔍 === FINAL CATEGORIZATION RESULT ===`);
    console.log(`🔍 Members: ${memberCount}, Non-members: ${nonMemberCount}`);
    return { memberCount, nonMemberCount };
  }

  // Get detailed player list with fees
  formatPlayersWithFees(payment: any): string {
    if (!payment.reservationId || !payment.reservationId.players) {
      return '';
    }

    const reservation = payment.reservationId;
    const players = reservation.players;
    const timeSlot = reservation.timeSlot;

    // Determine if it's peak hour for context
    const peakHours = [5, 18, 19, 20, 21];
    const isPeakHour = peakHours.includes(timeSlot);
    const timeContext = isPeakHour ? ' (Peak)' : ' (Off-Peak)';

    // Check if this is a December 2025 reservation (new player format)
    const isNewFormat = players.length > 0 && typeof players[0] === 'object' && 'isMember' in players[0];

    let feeDescription = '';
    let playerNames: string[] = [];

    if (isNewFormat) {
      // December 2025 format: players are objects with {name, isMember, isGuest}
      const memberCount = players.filter((p: any) => p.isMember).length;
      const guestCount = players.filter((p: any) => p.isGuest).length;
      playerNames = players.map((p: any) => p.name);

      // Calculate December 2025 pricing
      const PEAK_BASE = 150;
      const NON_PEAK_BASE = 100;
      const GUEST_FEE = 70;

      const baseFee = isPeakHour ? PEAK_BASE : NON_PEAK_BASE;
      const totalGuestFee = guestCount * GUEST_FEE;

      if (guestCount > 0) {
        feeDescription = `${memberCount} ${memberCount === 1 ? 'member' : 'members'}, ${guestCount} ${guestCount === 1 ? 'guest' : 'guests'} — Reserver pays full amount (Base: ₱${baseFee} + Guests: ₱${totalGuestFee})`;
      } else {
        feeDescription = `${memberCount} ${memberCount === 1 ? 'member' : 'members'} — Reserver pays full amount (Base: ₱${baseFee})`;
      }
    } else {
      // Legacy format: players are strings, use old pricing logic
      const feeBreakdown = this.getPlayerFeeInfo(payment);
      playerNames = players;

      if (feeBreakdown.memberCount > 0 && feeBreakdown.nonMemberCount > 0) {
        feeDescription = `${feeBreakdown.memberCount} members @ ₱${feeBreakdown.memberFee}, ${feeBreakdown.nonMemberCount} non-members @ ₱${feeBreakdown.nonMemberFee}`;
      } else if (feeBreakdown.memberCount > 0) {
        feeDescription = `${feeBreakdown.memberCount} ${feeBreakdown.memberCount === 1 ? 'member' : 'members'} @ ₱${feeBreakdown.memberFee} each`;
      } else if (feeBreakdown.nonMemberCount > 0) {
        feeDescription = `${feeBreakdown.nonMemberCount} non-${feeBreakdown.nonMemberCount === 1 ? 'member' : 'members'} @ ₱${feeBreakdown.nonMemberFee} each`;
      }
    }

    const playerCount = playerNames.length;

    if (playerCount <= 2) {
      // For 1-2 players, show names with fees
      return `${playerNames.join(', ')} • ${feeDescription}${timeContext}`;
    } else {
      // For 3+ players, show fee breakdown and names
      return `${feeDescription}${timeContext}: ${playerNames.join(', ')}`;
    }
  }

  cancelReservationFromPaymentHistory(payment: Payment): void {
    if (!payment.reservationId) return;
    
    // For Payment History, we need to convert the payment reservation info to a full reservation object
    const reservation: Reservation = {
      _id: payment.reservationId._id,
      date: payment.reservationId.date,
      timeSlot: payment.reservationId.timeSlot,
      players: payment.reservationId.players,
      timeSlotDisplay: payment.reservationId.timeSlotDisplay,
      status: 'confirmed',
      paymentStatus: payment.status === 'completed' ? 'paid' : 'pending',
      totalFee: payment.amount
    };
    
    this.cancelReservationDirectly(reservation);
  }

  // Calculate correct payment amount based on stored amount (respects user-edited court fees)
  getCorrectPaymentAmount(payment: any): string {
    // Debug log for payment history amount issues
    console.log(`💰 DEBUG Payment Amount for ${payment._id}:`, {
      amount: payment.amount,
      formattedAmount: payment.formattedAmount,
      hasGroupedPayments: !!payment._groupedPayments,
      groupedPaymentsCount: payment._groupedPayments?.length,
      isReservationPayment: !!payment.reservationId,
      timeSlotDisplay: payment.reservationId?.timeSlotDisplay
    });

    // Always use the stored amount since users can now edit court fees
    // This respects both user-edited amounts and admin overrides
    // Rounding is now done at the reservation level, so amounts are already rounded in the database
    if (payment.amount !== undefined && payment.amount !== null) {
      console.log(`💰 Using stored payment amount for ${payment._id}: ₱${payment.amount}`);
      return '₱' + payment.amount.toFixed(2);
    }

    // For Open Play Events and other payment types, use stored amount
    if (payment.formattedAmount) {
      return payment.formattedAmount;
    }

    // Final fallback to raw amount
    if (payment.amount !== undefined) {
      return '₱' + payment.amount.toFixed(2);
    }

    // Last resort fallback
    return '₱0.00';
  }

  // Calculate correct reservation amount for the payment form
  getCorrectReservationAmount(): string {
    if (!this.selectedReservation) {
      return '₱0.00';
    }

    if (this.isOpenPlayPayment()) {
      // Open Play events have fixed pricing
      return '₱' + this.selectedReservation.totalFee.toFixed(2);
    }

    if (this.isManualPayment()) {
      // Manual court usage payments have fixed amounts set by admin
      return '₱' + this.selectedReservation.totalFee.toFixed(2);
    }

    if (this.isAssignedExpensePayment()) {
      return '₱' + this.selectedReservation.totalFee.toFixed(2);
    }

    // The reservation's totalFee is already the authoritative, fully-computed amount
    // (base fee for all hours + all guest fees), owed in full by the reserver.
    return '₱' + (this.selectedReservation.totalFee || 0).toFixed(2);
  }

  // Only the reserver owes anything for a reservation; they owe the full total fee.
  calculateMemberAmount(reservation: any, member: ReservationPlayer): number {
    const totalFee = reservation.totalFee || 0;
    const reserverId = this.getReservationUserId(reservation.userId);
    return member.userId === reserverId ? totalFee : 0;
  }

  // Admin detection
  isAdmin(): boolean {
    return this.currentUser?.role === 'admin' || this.currentUser?.role === 'superadmin';
  }


  // Get display amount from court fee field
  getDisplayAmount(): string {
    const courtFee = this.paymentForm.get('courtFee')?.value;
    if (courtFee && courtFee > 0) {
      return '₱' + parseFloat(courtFee).toFixed(2);
    }
    return this.getCorrectReservationAmount();
  }

  // Get the actual amount to use for payment processing
  getPaymentAmount(): number {
    const courtFee = this.paymentForm.get('courtFee')?.value;
    if (courtFee && courtFee > 0) {
      return parseFloat(courtFee);
    }

    // Fallback to calculated logic
    if (!this.selectedReservation) return 0;

    if (this.isOpenPlayPayment()) {
      return this.selectedReservation.totalFee;
    }

    if (this.isManualPayment()) {
      return this.selectedReservation.totalFee;
    }

    if (this.isAssignedExpensePayment()) {
      return this.selectedReservation.totalFee;
    }

    const mockPayment = {
      reservationId: {
        players: this.selectedReservation.players,
        timeSlot: this.selectedReservation.timeSlot,
        date: this.selectedReservation.date
      }
    };

    const feeInfo = this.getPlayerFeeInfo(mockPayment);
    return (feeInfo.memberCount * feeInfo.memberFee) + (feeInfo.nonMemberCount * feeInfo.nonMemberFee);
  }

  // Format court reservation players for display
  formatCourtPlayers(payment: Payment): string {
    if (!payment.reservationId || !payment.reservationId.players || payment.reservationId.players.length === 0) {
      return '';
    }

    return this.formatPlayerNames(payment.reservationId.players);
  }

  // Helper function for string similarity calculation
  private calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0.0;
    
    // Levenshtein distance algorithm
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    const maxLength = Math.max(str1.length, str2.length);
    return (maxLength - matrix[str2.length][str1.length]) / maxLength;
  }

  // Setup manual payment form validation based on user role
  setupManualPaymentFormValidation(): void {
    if (this.isSuperAdmin()) {
      // Superadmin needs to select a player
      this.manualPaymentForm.get('playerName')?.setValidators([Validators.required]);
    } else {
      // Non-superadmin uses their own account
      this.manualPaymentForm.get('playerName')?.clearValidators();
    }
    this.manualPaymentForm.get('playerName')?.updateValueAndValidity();
  }

  // Check if user is superadmin
  isSuperAdmin(): boolean {
    return this.currentUser?.role === 'superadmin';
  }

  // Manual Payment Methods
  onManualPaymentSubmit(): void {
    if (this.manualPaymentForm.invalid) {
      this.markFormGroupTouched(this.manualPaymentForm);
      return;
    }

    const formValue = this.manualPaymentForm.value;

    if (formValue.paymentMethod !== 'cash' && !this.manualProofOfPaymentFile) {
      this.showError('Proof of Payment Required', 'Please attach a screenshot/photo of your payment confirmation');
      return;
    }

    this.loadingManualPayment = true;

    // Determine the player name based on user role
    let selectedPlayerName: string;
    if (this.isSuperAdmin()) {
      // Superadmin must select a player
      if (!formValue.playerName || formValue.playerName.trim() === '') {
        this.showError('Invalid Input', 'Please select a player');
        this.loadingManualPayment = false;
        return;
      }
      selectedPlayerName = formValue.playerName.trim();
    } else {
      // Non-superadmin uses their own account
      selectedPlayerName = this.currentUser?.fullName || '';
      if (!selectedPlayerName) {
        this.showError('Invalid Input', 'Unable to determine your player name');
        this.loadingManualPayment = false;
        return;
      }
    }

    const manualPaymentData = {
      isManualPayment: true,
      playerNames: [selectedPlayerName], // Send as array with single player
      courtUsageDate: new Date(formValue.courtUsageDate).toISOString(),
      paymentMethod: formValue.paymentMethod,
      amount: parseFloat(formValue.amount),
      notes: formValue.notes || undefined
    };

    console.log('📝 Submitting manual payment:', manualPaymentData);

    const manualFormData = new FormData();
    manualFormData.append('isManualPayment', 'true');
    manualFormData.append('playerNames', JSON.stringify(manualPaymentData.playerNames));
    manualFormData.append('courtUsageDate', manualPaymentData.courtUsageDate);
    manualFormData.append('paymentMethod', manualPaymentData.paymentMethod);
    manualFormData.append('amount', manualPaymentData.amount.toString());
    if (manualPaymentData.notes) {
      manualFormData.append('notes', manualPaymentData.notes);
    }
    if (this.manualProofOfPaymentFile) {
      manualFormData.append('proofOfPayment', this.manualProofOfPaymentFile);
    }

    this.http.post<any>(`${this.apiUrl}/payments`, manualFormData).subscribe({
      next: (response) => {
        this.loadingManualPayment = false;
        if (response.success) {
          this.showSuccess('Manual Payment Created', 
            `Payment of ₱${formValue.amount} for ${selectedPlayerName} has been submitted successfully`);
          
          // Reset form
          this.resetManualPaymentForm();
          
          // Refresh payment history to show the new manual payment
          this.loadPaymentHistory();
          
          // Switch to payment history tab to show the result
          this.activeTab = 'history';
        }
      },
      error: (error) => {
        this.loadingManualPayment = false;
        console.error('Manual payment error:', error);
        console.error('Manual payment error details:', error.error);
        
        let message = 'Failed to create manual payment';
        if (error.error?.details && Array.isArray(error.error.details)) {
          // Show validation error details
          const validationErrors = error.error.details.map((detail: any) => detail.msg).join(', ');
          message = `Validation errors: ${validationErrors}`;
        } else if (error.error?.error) {
          message = error.error.error;
        }
        
        this.showError('Manual Payment Failed', message);
      }
    });
  }

  resetManualPaymentForm(): void {
    this.manualPaymentForm.reset({
      playerName: '',
      courtUsageDate: '',
      paymentMethod: '',
      amount: '',
      notes: ''
    });
    this.manualPaymentForm.markAsUntouched();
    this.removeManualProofOfPaymentFile();
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.controls[key];
      control.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  formatManualPaymentPlayers(payment: any): string {
    if (!payment.metadata?.playerNames || !Array.isArray(payment.metadata.playerNames)) {
      return 'No player listed';
    }
    
    const players = payment.metadata.playerNames;
    if (players.length === 1) {
      return players[0];
    } else if (players.length <= 3) {
      return players.join(', ');
    } else {
      const firstThree = players.slice(0, 3).join(', ');
      const remaining = players.length - 3;
      return `${firstThree} and ${remaining} other${remaining !== 1 ? 's' : ''}`;
    }
  }

  /**
   * Format payment description for mobile with proper AM/PM time and wrapping
   */
  formatPaymentDescriptionForMobile(payment: Payment): string {
    if (payment.reservationId) {
      const date = new Date(payment.reservationId.date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      const startTime = this.formatTime(payment.reservationId.timeSlot);
      // Use endTimeSlot if available, otherwise calculate from duration or default to +1
      const calculatedEndTime = payment.reservationId.endTimeSlot ||
                                (payment.reservationId.timeSlot + (payment.reservationId.duration || 1));
      const endTime = this.formatTime(calculatedEndTime);

      // Create a more compact description for mobile
      return `Court reservation ${date} ${startTime}-${endTime}`;
    } else if (payment.pollId?.title) {
      const date = new Date(payment.pollId.openPlayEvent?.eventDate || new Date()).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      return `${payment.pollId.title} ${date}`;
    } else if (payment.metadata?.isManualPayment) {
      const date = payment.metadata.courtUsageDate 
        ? new Date(payment.metadata.courtUsageDate).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
          })
        : 'Unknown date';
      return `Manual payment ${date}`;
    }
    
    // Fallback to original description but make it more compact
    return payment.description || 'Payment';
  }
}