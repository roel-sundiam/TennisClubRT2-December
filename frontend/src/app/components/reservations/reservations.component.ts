import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { trigger, transition, style, animate } from '@angular/animations';
import { environment } from '../../../environments/environment';

// Custom notification interface
interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

interface TimeSlot {
  hour: number;
  display: string;
  available: boolean;
  availableAsEndTime?: boolean;  // NEW: Separate availability for end times
  isPeak: boolean;
  blockedByOpenPlay?: boolean;
  openPlayEvent?: {
    id: string;
    title: string;
    status: string;
    startTime: string;
    endTime: string;
    confirmedPlayers: number;
    maxPlayers: number;
  };
}

interface Member {
  _id: string;
  username: string;
  fullName: string;
  email: string;
  isApproved: boolean;
  isActive: boolean;
}

interface Reservation {
  _id: string;
  userId: string;
  date: Date;
  timeSlot: number;
  players: string[];
  status: string;
  paymentStatus: string;
  totalFee: number;
  timeSlotDisplay: string;
  duration?: number;
  endTimeSlot?: number;
  isMultiHour?: boolean;
}

@Component({
  selector: 'app-reservations',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  animations: [
    trigger('slideInOut', [
      transition(':enter', [
        style({ transform: 'translateX(100%)', opacity: 0 }),
        animate('300ms ease-in', style({ transform: 'translateX(0%)', opacity: 1 })),
      ]),
      transition(':leave', [
        animate('300ms ease-out', style({ transform: 'translateX(100%)', opacity: 0 })),
      ]),
    ]),
  ],
  template: `
    <div class="page-container reservations-container">
      <!-- Modern Header with Glassmorphism -->
      <div class="header">
        <button (click)="goBack()" class="back-btn">Back</button>
        <h1>Reserve a Court</h1>
      </div>

      <div class="form-container">
        <form [formGroup]="reservationForm" (ngSubmit)="onSubmit()" class="reservation-form">
          <!-- Date Selection -->
          <div class="field">
            <label for="date">Select Date * <span class="date-hint">(Philippine Time)</span></label>
            <input
              type="date"
              id="date"
              formControlName="date"
              [min]="minDateString"
              (change)="onDateChange($event)"
              title="Select reservation date in Philippine time"
            />
            <small
              class="error"
              *ngIf="
                reservationForm.get('date')?.hasError('required') &&
                reservationForm.get('date')?.touched
              "
            >
              Date is required
            </small>
          </div>

          <!-- Date Selection Prompt (when no date selected) -->
          <div class="date-selection-prompt" *ngIf="!selectedDate">
            <div class="prompt-content">
              <div class="prompt-icon">📅</div>
              <h3>Select a Date First</h3>
              <p>Please choose a date above to see available time slots for court reservation.</p>
            </div>
          </div>

          <!-- Time Range Selection (only shown when date is selected) -->
          <div class="time-range-section" *ngIf="selectedDate">
            <h3>Select Time Range *</h3>

            <!-- STEPPER UI -->
            <div *ngIf="useStepperUI" class="stepper-time-selection">
              <!-- Loading Indicator -->
              <div *ngIf="!timeSlotsLoaded" class="stepper-loading">
                <div class="spinner"></div>
                <p>Loading available time slots...</p>
              </div>

              <!-- Compact Time Controls Row -->
              <div *ngIf="timeSlotsLoaded" class="stepper-compact-row" [class.has-conflict]="getAvailabilityStatus() === 'conflict'" [class.available]="getAvailabilityStatus() === 'available'">
                <!-- Start Time -->
                <div class="stepper-compact-item">
                  <span class="stepper-compact-label">Start</span>
                  <div class="stepper-compact-controls">
                    <button type="button" class="stepper-compact-btn" [disabled]="!canDecrementStart()" (click)="adjustStartTime(-1)">−</button>
                    <div class="stepper-compact-value">{{ selectedStartTime ? formatTimeAMPM(selectedStartTime) : '--:-- --' }}</div>
                    <button type="button" class="stepper-compact-btn" [disabled]="!canIncrementStart()" (click)="adjustStartTime(1)">+</button>
                  </div>
                </div>

                <!-- Duration -->
                <div class="stepper-compact-item" *ngIf="selectedStartTime">
                  <span class="stepper-compact-label">Duration</span>
                  <div class="stepper-compact-controls">
                    <button type="button" class="stepper-compact-btn" [disabled]="!canDecrementDuration()" (click)="adjustDuration(-1)">−</button>
                    <div class="stepper-compact-value">{{ getDurationHours() }}h</div>
                    <button type="button" class="stepper-compact-btn" [disabled]="!canIncrementDuration()" (click)="adjustDuration(1)">+</button>
                  </div>
                </div>

                <!-- End Time -->
                <div class="stepper-compact-item stepper-compact-item-readonly" *ngIf="selectedStartTime && selectedEndTime">
                  <span class="stepper-compact-label">End</span>
                  <div class="stepper-compact-value-only">{{ formatTimeAMPM(selectedEndTime) }}</div>
                </div>

                <!-- Status Badge -->
                <div class="stepper-compact-status">
                  <span class="availability-badge-compact" [class]="'availability-badge-compact-' + getAvailabilityStatus()">
                    {{ getAvailabilityStatus() === 'available' ? '✓ Available' : '✗ Conflict' }}
                  </span>
                </div>
              </div>

              <!-- Find Next Available Button -->
              <button type="button" class="next-available-btn" *ngIf="timeSlotsLoaded && getAvailabilityStatus() === 'conflict'" (click)="findNextAvailableTime()">
                Find Next Available Time →
              </button>

              <!-- Time Preview -->
              <div class="time-preview" *ngIf="selectedStartTime && selectedEndTime" [class]="'time-preview-' + getAvailabilityStatus()">
                <span *ngIf="getAvailabilityStatus() === 'available'">✓</span>
                <span *ngIf="getAvailabilityStatus() === 'conflict'">✗</span>
                {{ getTimeRangeDisplay() }} ({{ getDurationHours() }} hour{{ getDurationHours() > 1 ? 's' : '' }})
              </div>
            </div>

            <!-- ORIGINAL BUTTON UI -->
            <div *ngIf="!useStepperUI">
              <!-- Start Time Buttons -->
              <div class="time-selection">
                <h4>Start Time</h4>
                <div class="time-buttons">
                  <button
                    *ngFor="let slot of timeSlots"
                    type="button"
                    class="time-btn"
                    [class.selected]="selectedStartTime === slot.hour"
                    [class.unavailable]="!slot.available"
                    [class.blocked-open-play]="slot.blockedByOpenPlay"
                    [class.peak]="slot.isPeak"
                    [disabled]="!slot.available"
                    (click)="selectStartTime(slot.hour)"
                    [title]="slot.blockedByOpenPlay ? 'Blocked by Open Play: ' + slot.openPlayEvent?.title : ''"
                  >
                    <span class="time">{{ formatTimeAMPM(slot.hour) }}</span>
                    <span class="rate-type">{{
                      slot.blockedByOpenPlay ? 'Open Play' :
                      (slot.isPeak ? 'Peak' : 'Regular')
                    }}</span>
                    <small *ngIf="slot.blockedByOpenPlay && slot.openPlayEvent" class="open-play-info">
                      {{ slot.openPlayEvent.status === 'active' ? 'Registration Open' : 'Event Confirmed' }}
                    </small>
                  </button>
                </div>
                <small
                  class="error"
                  *ngIf="
                    reservationForm.get('startTime')?.hasError('required') &&
                    reservationForm.get('startTime')?.touched
                  "
                >
                  Start time is required
                </small>
              </div>

              <!-- End Time Buttons -->
              <div class="time-selection" *ngIf="selectedStartTime">
                <h4>End Time <span class="hint-text">(Maximum 4 hours per reservation)</span></h4>
                <div class="time-buttons" *ngIf="availableEndTimes.length > 0">
                  <button
                    *ngFor="let slot of availableEndTimes"
                    type="button"
                    class="time-btn"
                    [class.selected]="selectedEndTime === slot.hour"
                    [class.peak]="slot.isPeak"
                    (click)="selectEndTime(slot.hour)"
                  >
                    <span class="time">{{ formatTimeAMPM(slot.hour) }}</span>
                    <span class="rate-type">{{ slot.isPeak ? 'Peak' : 'Regular' }}</span>
                  </button>
                </div>

                <!-- Message when no end times available -->
                <div class="no-end-times-message" *ngIf="availableEndTimes.length === 0 && selectedStartTime">
                  <p><strong>No consecutive time slots available</strong> after {{ formatTimeAMPM(selectedStartTime) }}</p>
                  <p>Court reservations require consecutive time blocks. The next hour ({{ formatTimeAMPM(selectedStartTime + 1) }}) is unavailable.</p>
                </div>

                <small
                  class="error"
                  *ngIf="
                    reservationForm.get('endTime')?.hasError('required') &&
                    reservationForm.get('endTime')?.touched
                  "
                >
                  End time is required
                </small>
              </div>

              <!-- Duration Display -->
              <div class="duration-info" *ngIf="selectedStartTime && selectedEndTime">
                <div class="duration-badge">
                  <i class="pi pi-clock"></i>
                  <strong
                    >{{ getDurationHours() }} hour{{ getDurationHours() > 1 ? 's' : '' }}</strong
                  >
                  <span class="time-range-display">{{ getTimeRangeDisplay() }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Players Section -->
          <div class="players-section">
            <h3>Players</h3>

            <div *ngIf="loadingMembers" class="loading">Loading members...</div>

            <!-- Member Players -->
            <div formArrayName="players" *ngIf="!loadingMembers">
              <div *ngFor="let player of playersArray.controls; let i = index" class="player-input">
                <div class="field">
                  <label>
                    <span *ngIf="i === 0">Player 1 (You) - Member</span>
                    <span *ngIf="i > 0">Player {{ i + 1 }} - Member</span>
                  </label>
                  <div class="player-row">
                    <!-- Modern Custom Dropdown -->
                    <div class="custom-dropdown" [class.open]="dropdownStates[i]">
                      <div class="dropdown-trigger" (click)="toggleDropdown(i)">
                        <div class="selected-value">
                          <span *ngIf="getSelectedMemberDisplay(i)" class="member-info">
                            {{ getSelectedMemberDisplay(i) }}
                          </span>
                          <span *ngIf="!getSelectedMemberDisplay(i)" class="placeholder">
                            Choose a member
                          </span>
                        </div>
                        <div class="dropdown-actions">
                          <button
                            type="button"
                            class="clear-btn"
                            *ngIf="getSelectedMemberDisplay(i)"
                            (click)="$event.stopPropagation(); clearSelection(i)"
                          >
                            ×
                          </button>
                          <div class="dropdown-arrow">
                            <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                              <path
                                d="M1 1.5L6 6.5L11 1.5"
                                stroke="currentColor"
                                stroke-width="1.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              />
                            </svg>
                          </div>
                        </div>
                      </div>

                      <div class="dropdown-menu" *ngIf="dropdownStates[i]">
                        <div class="search-box">
                          <input
                            type="text"
                            placeholder="Search members..."
                            [value]="searchTerms[i] || ''"
                            (input)="onSearchChange(i, $event)"
                            (click)="$event.stopPropagation()"
                          />
                        </div>

                        <div class="dropdown-options">
                          <div
                            *ngFor="let member of getFilteredMembers(i)"
                            class="dropdown-option"
                            (click)="selectMember(i, member)"
                          >
                            <div class="member-details">
                              <div class="member-name">{{ member.fullName }}</div>
                              <div class="member-username">@{{ member.username }}</div>
                            </div>
                            <div class="member-badge" *ngIf="member.isActive">✓</div>
                          </div>

                          <div *ngIf="getFilteredMembers(i).length === 0" class="no-results">
                            No members found
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      (click)="removePlayer(i)"
                      [disabled]="playersArray.length <= 1 || i === 0"
                      class="remove-btn"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              (click)="addPlayer()"
              [disabled]="loadingMembers"
              class="add-btn"
            >
              + Add Member Player
            </button>

            <!-- Custom Players Section -->
            <div class="custom-players-section" *ngIf="!loadingMembers">
              <h4>Non-Member Players (₱70 per hour each)</h4>

              <div
                *ngFor="
                  let customName of customPlayerNames;
                  let i = index;
                  trackBy: trackCustomPlayer
                "
                class="custom-player-input"
              >
                <div class="field">
                  <label>Custom Player {{ i + 1 }}</label>
                  <div class="player-row">
                    <input
                      type="text"
                      placeholder="Enter non-member name"
                      [value]="customPlayerNames[i] || ''"
                      (input)="updateCustomPlayerName(i, $event)"
                      class="custom-input"
                    />

                    <button
                      type="button"
                      (click)="removeCustomPlayer(i)"
                      [disabled]="customPlayerNames.length <= 0"
                      class="remove-btn"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                (click)="addCustomPlayer()"
                class="add-btn"
              >
                + Add Custom Player
              </button>
            </div>

            <div class="hint" *ngIf="members.length === 0 && !loadingMembers">
              No active members found. You can still enter custom names.
            </div>
          </div>


          <!-- Fee Information -->
          <div class="fee-info" *ngIf="selectedStartTime && selectedEndTime && calculatedFee > 0">
            <h3>Fee Information</h3>
            <div class="fee-details">
              <div class="fee-row">
                <span>Time Range:</span>
                <span
                  >{{ getTimeRangeDisplay() }} ({{ getDurationHours() }} hour{{
                    getDurationHours() > 1 ? 's' : ''
                  }})</span
                >
              </div>
              <div class="fee-row">
                <span>Rate Type:</span>
                <span>{{ getRateTypeDescription() }}</span>
              </div>
              <div class="fee-row">
                <span>Players:</span>
                <span
                  >{{ getPlayerCount() }} ({{ getMemberCount() }} members,
                  {{ getNonMemberCount() }} non-members)</span
                >
              </div>

              <!-- December 2025: New Fee Breakdown -->
              <div class="fee-breakdown" *ngIf="getMemberCount() > 0 || getNonMemberCount() > 0">
                <!-- Base Fee Calculation -->
                <div class="fee-row">
                  <span>Base Fee ({{ getRateType() }}):</span>
                  <span>₱{{ getBaseFeeTotal() }}</span>
                </div>
                <!-- Guest Fee (if any) -->
                <div class="fee-row" *ngIf="getNonMemberCount() > 0">
                  <span>Guest Fee ({{ getNonMemberCount() }} {{ getNonMemberCount() === 1 ? 'guest' : 'guests' }} × ₱70):</span>
                  <span>₱{{ getGuestFeeTotal() }}</span>
                </div>
                <!-- Payment Distribution per Player -->
                <div class="player-payments" *ngIf="getMemberCount() > 0">
                  <div class="fee-row player-payment-header">
                    <span><strong>Payment per Player:</strong></span>
                  </div>
                  <div class="player-payment-item" *ngFor="let player of getPlayerPaymentBreakdown()">
                    <div class="fee-row player-detail">
                      <span>
                        {{ player.name }}
                        <span class="player-badge" *ngIf="player.isReserver">(Reserver)</span>
                        <span class="player-badge" *ngIf="player.isGuest">(Guest)</span>
                      </span>
                      <span class="player-amount">
                        <span *ngIf="!player.isGuest">₱{{ player.amount.toFixed(2) }}</span>
                        <span *ngIf="player.isGuest" style="color: #666;">No payment</span>
                      </span>
                    </div>
                    <div class="fee-breakdown-detail" *ngIf="!player.isGuest && player.breakdown">
                      <small style="color: #666; padding-left: 20px;">
                        {{ player.breakdown }}
                      </small>
                    </div>
                  </div>
                </div>
              </div>
              <div class="fee-row total">
                <span>Total Fee:</span>
                <span>₱{{ calculatedFee }}</span>
              </div>
            </div>
          </div>

          <!-- Form Actions -->
          <div class="form-actions">
            <button type="submit" [disabled]="reservationForm.invalid || loading" class="book-btn">
              <ng-container *ngIf="loading">
                {{ isEditMode ? 'Updating...' : 'Booking...' }}
              </ng-container>
              <ng-container *ngIf="!loading">
                <ng-container *ngIf="isEditMode">Update Reservation</ng-container>
                <ng-container *ngIf="!isEditMode">Book Court</ng-container>
              </ng-container>
            </button>

            <button type="button" (click)="goBack()" class="cancel-btn">Cancel</button>
          </div>
        </form>

        <!-- Existing Reservations -->
        <div class="existing-reservations" *ngIf="selectedDate && existingReservations.length > 0">
          <h3>Existing Reservations for {{ selectedDate | date : 'fullDate' }}</h3>

          <div class="reservation-list">
            <div *ngFor="let reservation of existingReservations" class="reservation-item">
              <div class="reservation-time">
                {{ reservation.timeSlotDisplay }}
              </div>
              <div class="reservation-players">Players: {{ formatPlayerNames(reservation.players) }}</div>
              <div class="reservation-status status-{{ reservation.status }}">
                {{ reservation.status | titlecase }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modern Custom Notifications -->
      <div class="notification-container">
        <div
          *ngFor="let notification of notifications; trackBy: trackNotification"
          class="notification"
          [class]="'notification-' + notification.type"
          [@slideInOut]
        >
          <div class="notification-icon">
            <span *ngIf="notification.type === 'success'">✅</span>
            <span *ngIf="notification.type === 'error'">❌</span>
            <span *ngIf="notification.type === 'warning'">⚠️</span>
            <span *ngIf="notification.type === 'info'">ℹ️</span>
          </div>
          <div class="notification-content">
            <div class="notification-title">{{ notification.title }}</div>
            <div class="notification-message">{{ notification.message }}</div>
          </div>
          <button class="notification-close" (click)="removeNotification(notification.id)">
            ×
          </button>
        </div>
      </div>

      <!-- Overdue Payment Modal -->
      <div class="modal-overlay" *ngIf="showOverduePaymentModal">
        <div class="modal-content overdue-payment-modal">
          <div class="modal-header">
            <h2>⚠️ Overdue Payment</h2>
          </div>

          <div class="modal-body">
            <p class="warning-message">
              You have <strong>{{overduePaymentDetails.length}}</strong> overdue payment(s).
              Please settle your pending payments before making a new reservation.
            </p>

            <div class="overdue-list">
              <div *ngFor="let payment of overduePaymentDetails" class="overdue-item">
                <div class="payment-info">
                  <span class="amount">₱{{payment.amount}}</span>
                  <span class="days-overdue">{{payment.daysOverdue}} day(s) overdue</span>
                </div>
                <div class="payment-description">{{payment.description}}</div>
              </div>
            </div>
          </div>

          <div class="modal-actions">
            <button class="settle-btn" (click)="goToPayments()">Settle Payments</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrl: './reservations.component.scss',
})
export class ReservationsComponent implements OnInit, OnDestroy {
  reservationForm: FormGroup;
  loading = false;
  minDate = new Date();
  selectedDate: Date | null = null;
  minDateString = '';
  selectedStartTime: number | null = null;
  selectedEndTime: number | null = null;
  availableEndTimes: TimeSlot[] = [];
  calculatedFee = 0;

  // Expose Math for template use
  Math = Math;

  timeSlots: TimeSlot[] = []; // For START times (hours 5-21)
  allTimeSlots: TimeSlot[] = []; // All slots including hour 22 for END time calculations
  timeSlotsLoaded = false; // Track if time slot data has been loaded
  existingReservations: Reservation[] = [];
  members: Member[] = [];
  loadingMembers = false;
  customPlayerNames: string[] = []; // Track custom names for each player slot

  // Modern dropdown states
  dropdownStates: { [key: number]: boolean } = {};
  searchTerms: { [key: number]: string } = {};

  // Custom notifications
  notifications: Notification[] = [];

  // Edit mode
  isEditMode = false;
  editingReservationId: string | null = null;

  // Overdue payment modal
  showOverduePaymentModal = false;
  overduePaymentDetails: any[] = [];

  // Debounce timer for fee calculation
  private feeCalculationTimer: any;

  private apiUrl = environment.apiUrl;
  private peakHours = [5, 18, 19, 20, 21]; // 5AM, 6PM, 7PM, 8PM, 9PM

  // Stepper UI mode toggle
  useStepperUI = true; // Set to false to use original button UI

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.reservationForm = this.fb.group({
      date: ['', Validators.required],
      startTime: ['', Validators.required],
      endTime: ['', Validators.required],
      players: this.fb.array([this.fb.control('', Validators.required)]),
    });

    this.initializeTimeSlots();
    // Initialize custom names array as empty
    this.customPlayerNames = [];
    console.log('🔍 Constructor - initialized customPlayerNames as:', this.customPlayerNames);
  }

  ngOnInit(): void {
    // Check for overdue payments immediately on page load
    this.checkOverduePayments();

    // Set minimum date to today in Philippine time and update it dynamically
    this.updateMinDate();
    // Load members for player selection
    this.loadMembers();

    // Check for edit mode and pre-selected date
    this.route.queryParams.subscribe((params) => {
      if (params['edit']) {
        this.isEditMode = true;
        this.editingReservationId = params['edit'];
        this.loadReservationForEdit(params['edit']);
      } else {
        // Auto-populate Player 1 with logged-in user only if not editing
        this.setLoggedInUserAsPlayer1();
      }

      // Handle pre-selected date from calendar
      if (params['date']) {
        const dateString = params['date']; // Format: YYYY-MM-DD
        const [year, month, day] = dateString.split('-').map(Number);
        const selectedDate = new Date(year, month - 1, day); // month is 0-indexed

        // Set the date in the form
        this.reservationForm.get('date')?.setValue(dateString);

        // Trigger date change to load time slots
        this.onDateChangeInternal(selectedDate);
        console.log('🗓️ Pre-selected date from calendar:', dateString);
      }
    });

    // Add click outside handler for dropdown
    document.addEventListener('click', this.onDocumentClick.bind(this));
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.onDocumentClick.bind(this));
    if (this.feeCalculationTimer) {
      clearTimeout(this.feeCalculationTimer);
    }
  }

  loadReservationForEdit(reservationId: string): void {
    this.http.get<any>(`${this.apiUrl}/reservations/${reservationId}`).subscribe({
      next: (response) => {
        const reservation = response.data;
        console.log('🔍 Loading reservation for edit:', reservation);

        // Store reservation data for later use after time slots are loaded
        (this as any).pendingEditReservation = reservation;

        // Convert date to YYYY-MM-DD format for the date input
        const reservationDate = new Date(reservation.date);
        const dateString = reservationDate.toISOString().split('T')[0];

        // Set date first and trigger date change to load time slots
        this.reservationForm.get('date')?.setValue(dateString);
        this.selectedDate = reservationDate;

        // Load reservations for the date - this will populate time slots
        // The actual time selection will happen in the callback
        this.loadReservationsForDateWithEditCallback(reservation);

        // Clear existing players and custom players
        const playersArray = this.playersArray;
        playersArray.clear();
        this.customPlayerNames = [];

        // December 2025: Handle both old (string[]) and new (object[]) player formats
        const players = reservation.players;
        console.log('🔍 Players data:', players);

        // Check if new format (objects with name property)
        const isNewFormat = players.length > 0 && typeof players[0] === 'object' && 'name' in players[0];

        if (isNewFormat) {
          // December 2025 format: separate members and guests
          players.forEach((player: any) => {
            if (player.isMember) {
              // Add to member players array
              playersArray.push(this.fb.control(player.name, Validators.required));
            } else if (player.isGuest) {
              // Add to custom players (guests)
              this.customPlayerNames.push(player.name);
            }
          });
          console.log('🔍 Loaded members:', playersArray.length, 'guests:', this.customPlayerNames.length);
        } else {
          // Legacy format: all players are strings, treat as members
          players.forEach((playerName: string) => {
            playersArray.push(this.fb.control(playerName, Validators.required));
          });
          console.log('🔍 Loaded players (legacy format):', playersArray.length);
        }

        this.showSuccess(
          'Edit Mode',
          `Loaded reservation for editing: ${dateString} ${reservation.timeSlot}:00`
        );
      },
      error: (error) => {
        console.error('Error loading reservation for edit:', error);
        this.showError('Edit Error', 'Failed to load reservation data for editing');
        // Exit edit mode on error
        this.isEditMode = false;
        this.editingReservationId = null;
      },
    });
  }

  loadReservationsForDateWithEditCallback(reservation: any): void {
    if (!this.selectedDate) return;

    // Format date as YYYY-MM-DD in Philippine timezone
    const year = this.selectedDate.getFullYear();
    const month = String(this.selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(this.selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    console.log('🔍 Loading reservations for date (edit mode):', dateStr);
    console.log('🔍 Excluding reservation ID:', this.editingReservationId);

    // CRITICAL: Pass excludeId parameter so backend excludes current reservation from availability checks
    const url = `${this.apiUrl}/reservations/date/${dateStr}?excludeId=${this.editingReservationId}`;
    console.log('🔍 Request URL:', url);

    this.http.get<any>(url).subscribe({
      next: (response) => {
        console.log('🔍 API response for date', dateStr, ':', response);
        this.existingReservations = response.data?.reservations || [];
        console.log('🔍 Existing reservations loaded:', this.existingReservations.length);

        // Use backend time slots data
        if (response.data?.timeSlots) {
          console.log('✅ Backend provided timeSlots data');

          // Store ALL time slots (including hour 22) for end time calculations
          this.allTimeSlots = response.data.timeSlots.map((backendSlot: any) => ({
            hour: backendSlot.hour,
            display: `${backendSlot.hour}:00 - ${backendSlot.hour + 1}:00`,
            available: backendSlot.available,
            availableAsEndTime: backendSlot.availableAsEndTime,
            isPeak: this.peakHours.includes(backendSlot.hour),
            blockedByOpenPlay: backendSlot.blockedByOpenPlay || false,
            openPlayEvent: backendSlot.openPlayEvent || null
          }));

          // For START times: filter out hour 22
          this.timeSlots = this.allTimeSlots.filter((slot: any) => slot.hour <= 21);

          console.log('🔍 All time slots loaded:', this.allTimeSlots.length);
          console.log('🔍 Start time slots:', this.timeSlots.length);

          // CRITICAL FIX: Mark time slots as loaded in edit mode
          this.timeSlotsLoaded = true;
        } else {
          console.log('❌ No timeSlots in backend response');
          this.updateTimeSlotAvailability();
          this.timeSlotsLoaded = true;
        }

        // Use setTimeout to ensure Angular change detection picks up the changes
        setTimeout(() => {
          // NOW set the selected times after time slots are loaded
          console.log('🔍 Setting selected times in edit mode');
          const startTime = reservation.timeSlot;
          const endTime = reservation.endTimeSlot || (reservation.timeSlot + (reservation.duration || 1));

          this.selectedStartTime = startTime;
          this.selectedEndTime = endTime;

          console.log('🔍 Selected start time:', this.selectedStartTime);
          console.log('🔍 Selected end time:', this.selectedEndTime);
          console.log('🔍 Checking if start time slot exists:', this.timeSlots.find(s => s.hour === startTime));

          // Update form values
          this.reservationForm.patchValue({
            startTime: startTime,
            endTime: endTime,
          });

          console.log('🔍 Form values after patch:', {
            startTime: this.reservationForm.get('startTime')?.value,
            endTime: this.reservationForm.get('endTime')?.value
          });

          // Update available end times
          this.updateAvailableEndTimes();
          console.log('🔍 Available end times after update:', this.availableEndTimes.map(t => t.hour));

          // Trigger fee calculation
          this.calculateFee();
        }, 0);
      },
      error: (error) => {
        console.error('Error loading reservations:', error);
        this.existingReservations = [];
        this.updateTimeSlotAvailability();
      },
    });
  }

  private onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    const isDropdownClick = target.closest('.custom-dropdown');

    if (!isDropdownClick) {
      // Close all dropdowns
      Object.keys(this.dropdownStates).forEach((key) => {
        this.dropdownStates[parseInt(key)] = false;
      });
    }
  }

  private updateMinDate(): void {
    // Always get the current date in Philippine time
    this.minDate = this.getPhilippineDate();
    this.minDateString = this.formatDateForInput(this.minDate);
  }

  private getPhilippineDate(): Date {
    // Get current time in Philippine time zone (Asia/Manila)
    const now = new Date();
    const philippineTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    // Convert from MM/dd/yyyy to Date object
    const [month, day, year] = philippineTime.split('/').map(Number);
    return new Date(year, month - 1, day); // month is 0-indexed
  }

  private formatDateForInput(date: Date): string {
    // Format date as YYYY-MM-DD for HTML date input
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getCurrentPhilippineTime(): Date {
    // Get current time in Philippine time zone (Asia/Manila)
    const now = new Date();
    const philippineTimeString = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(now);

    // Parse the formatted string back to a Date object
    const [datePart, timePart] = philippineTimeString.split(', ');
    const [month, day, year] = datePart.split('/').map(Number);
    const [hour, minute, second] = timePart.split(':').map(Number);

    return new Date(year, month - 1, day, hour, minute, second);
  }

  private isToday(date: Date | null): boolean {
    if (!date) return false;
    const today = this.getPhilippineDate();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }

  private setLoggedInUserAsPlayer1(): void {
    const currentUser = this.authService.currentUser;
    if (currentUser && currentUser.fullName) {
      // Set the first player to be the logged-in user
      this.playersArray.at(0).setValue(currentUser.fullName);
      console.log('✅ Auto-populated Player 1 with logged-in user:', currentUser.fullName);
    } else {
      console.log('⚠️ No logged-in user found or user has no fullName');
    }
  }

  get playersArray(): FormArray {
    return this.reservationForm.get('players') as FormArray;
  }

  loadMembers(): void {
    console.log('🔍 Loading members from API...');
    this.loadingMembers = true;
    // Request all members by setting a high limit to get all 55+ members
    const membersUrl = `${this.apiUrl}/members?limit=100&page=1`;
    console.log('🔍 Requesting all members from:', membersUrl);
    this.http.get<any>(membersUrl).subscribe({
      next: (response) => {
        console.log('✅ Members API response received');
        const allMembers = response.data || response;

        // Use all members - they all appear to be valid based on the API response
        this.members = allMembers || [];
        console.log(`✅ Loaded ${this.members.length} members for player selection`);
        this.loadingMembers = false;
      },
      error: (error) => {
        console.error('❌ Error loading members:', error);
        console.error('❌ Status:', error.status);
        console.error('❌ Message:', error.message);
        this.loadingMembers = false;
        // Fallback - allow manual input if API fails
        this.members = [];
      },
    });
  }

  initializeTimeSlots(): void {
    this.timeSlots = [];
    // Court hours: 5:00 AM to 10:00 PM (last start time is 9:00 PM)
    for (let hour = 5; hour <= 21; hour++) {
      this.timeSlots.push({
        hour: hour,
        display: `${hour}:00 - ${hour + 1}:00`,
        available: true,
        isPeak: this.peakHours.includes(hour),
      });
    }
  }

  onDateChange(event: any): void {
    const dateString = event.target.value;
    if (dateString) {
      // Create date in Philippine time zone
      const [year, month, day] = dateString.split('-').map(Number);
      const selectedDate = new Date(year, month - 1, day); // month is 0-indexed

      this.onDateChangeInternal(selectedDate);
    }
  }

  onDateChangeInternal(selectedDate: Date): void {
    // Update minimum date to ensure it's current
    this.updateMinDate();

    // Check if selected date is in the past
    if (selectedDate < this.minDate) {
      console.warn('⚠️ Selected date is in the past, using minimum date');
      this.selectedDate = this.minDate;
    } else {
      this.selectedDate = selectedDate;
    }

    // Reset time selections when date changes (except in edit mode)
    if (!this.isEditMode) {
      this.selectedStartTime = null;
      this.selectedEndTime = null;
      this.availableEndTimes = [];
      this.calculatedFee = 0;
      this.timeSlotsLoaded = false; // Reset loading flag when date changes

      // Clear form controls for time selection
      this.reservationForm.patchValue({
        startTime: '',
        endTime: ''
      });
    }

    this.loadReservationsForDate();
  }

  selectStartTime(hour: number): void {
    console.log('🔍 selectStartTime() called with hour:', hour);
    this.selectedStartTime = hour;
    this.selectedEndTime = null; // Reset end time when start time changes

    // Update form controls
    this.reservationForm.get('startTime')?.setValue(hour);
    this.reservationForm.get('endTime')?.setValue('');

    // Only update available end times if time slot data has been loaded
    if (this.timeSlotsLoaded) {
      console.log('🔍 About to call updateAvailableEndTimes() - data is loaded');
      this.updateAvailableEndTimes();
    } else {
      console.log('⏳ Time slot data not yet loaded, will update end times after data arrives');
    }

    // Trigger fee calculation
    this.calculateFee();
  }

  selectEndTime(hour: number): void {
    // Validate maximum 4 hours duration
    if (this.selectedStartTime) {
      const duration = hour - this.selectedStartTime;
      if (duration > 4) {
        this.showError('Invalid Duration', 'Maximum reservation duration is 4 hours. Please select an end time within 4 hours of your start time.');
        return;
      }
    }

    this.selectedEndTime = hour;

    // Update form control
    this.reservationForm.get('endTime')?.setValue(hour);

    // Trigger fee calculation
    this.calculateFee();
  }

  onTimeRangeChange(): void {
    const startTime = this.reservationForm.get('startTime')?.value;
    const endTime = this.reservationForm.get('endTime')?.value;

    this.selectedStartTime = startTime ? parseInt(startTime) : null;
    this.selectedEndTime = endTime ? parseInt(endTime) : null;

    if (this.selectedStartTime && !this.selectedEndTime) {
      // Update available end times when start time is selected
      this.updateAvailableEndTimes();
    }

    if (this.selectedStartTime && this.selectedEndTime) {
      this.calculateFee();
    }
  }

  updateAvailableEndTimes(): void {
    console.log('🔍 updateAvailableEndTimes() called');
    console.log('🔍 selectedStartTime:', this.selectedStartTime);
    console.log('🔍 selectedDate:', this.selectedDate);
    console.log('🔍 timeSlots array length:', this.timeSlots.length);
    console.log('🔍 timeSlotsLoaded:', this.timeSlotsLoaded);

    // Defensive check: ensure data is loaded before proceeding
    if (!this.timeSlotsLoaded || !this.allTimeSlots.length) {
      this.availableEndTimes = [];
      console.log('⚠️ Time slot data not loaded yet, returning empty availableEndTimes');
      return;
    }

    // Enhanced logging for debugging specific time slots
    console.log('🔍 Detailed timeSlots data for debugging:');
    this.timeSlots.forEach(slot => {
      console.log(`  Hour ${slot.hour}: available=${slot.available}, availableAsEndTime=${slot.availableAsEndTime}, blocked=${slot.blockedByOpenPlay}, isPeak=${slot.isPeak}`);
    });

    if (!this.selectedStartTime) {
      this.availableEndTimes = [];
      console.log('❌ No selectedStartTime, returning empty availableEndTimes');
      return;
    }

    this.availableEndTimes = [];

    // CRITICAL FIX: Restore proper consecutive booking logic
    // Court reservations must be consecutive - no gaps allowed
    // Maximum duration: 4 hours
    const maxEndTime = Math.min(this.selectedStartTime + 4, 22);
    console.log('🔍 Checking consecutive hours starting from', this.selectedStartTime + 1, 'up to', maxEndTime, '(max 4 hours)');

    for (let hour = this.selectedStartTime + 1; hour <= maxEndTime; hour++) {
      console.log(`🔍 Checking hour ${hour} for consecutive availability`);

      if (hour <= 21) {
        // For regular operating hours (5-21), check END TIME availability
        const slot = this.allTimeSlots.find((s) => s.hour === hour);
        console.log(`🔍 Hour ${hour} slot:`, slot);

        // FIXED: Use availableAsEndTime for end time calculations
        const canUseAsEndTime = slot && (slot.availableAsEndTime !== undefined ? slot.availableAsEndTime : slot.available);

        // Special logging for hour 17
        if (hour === 17) {
          console.log(`🔍 SPECIAL DEBUG for Hour 17:`);
          console.log(`  - slot:`, slot);
          console.log(`  - slot.available:`, slot?.available);
          console.log(`  - slot.availableAsEndTime:`, slot?.availableAsEndTime);
          console.log(`  - canUseAsEndTime:`, canUseAsEndTime);
        }

        if (canUseAsEndTime) {
          console.log(`✅ Hour ${hour} is available as END TIME - adding to end times`);
          this.availableEndTimes.push({
            hour: hour,
            display: `${hour}:00`,
            available: true,
            isPeak: slot.isPeak,
          });

          // Log why this slot is available as end time
          if (slot.available !== slot.availableAsEndTime) {
            console.log(`📋 Hour ${hour}: available=${slot.available}, availableAsEndTime=${slot.availableAsEndTime}`);
          }
        } else {
          console.log(`❌ Hour ${hour} is NOT available as END TIME - STOPPING consecutive check`);
          if (slot) {
            console.log(`   Slot details: available=${slot.available}, availableAsEndTime=${slot.availableAsEndTime}, blocked=${slot.blockedByOpenPlay}`);
            if (slot.openPlayEvent) {
              console.log(`   Open Play event: ${slot.openPlayEvent.title} (${slot.openPlayEvent.status})`);
            }
          } else {
            console.log(`   No slot found for hour ${hour}`);
          }

          // CRITICAL: Stop at first unavailable slot for consecutive booking
          console.log('🛑 Breaking consecutive check - no more end times will be available');
          break;
        }
      } else if (hour === 22) {
        // Special case: 22:00 (court closing time) - check if it's available as end time
        console.log('🔍 Checking 22:00 as potential court closing end time');
        const slot22 = this.allTimeSlots.find((s) => s.hour === 22);
        const canUse22AsEndTime = slot22 && (slot22.availableAsEndTime !== undefined ? slot22.availableAsEndTime : slot22.available);

        console.log(`🔍 Hour 22 slot data:`, slot22);
        console.log(`🔍 Can use 22 as end time:`, canUse22AsEndTime);

        if (canUse22AsEndTime) {
          console.log('✅ Adding 22:00 as court closing end time');
          this.availableEndTimes.push({
            hour: hour,
            display: `${hour}:00`,
            available: true,
            isPeak: false, // 22:00 is not in peak hours
          });
        } else {
          console.log('❌ Hour 22 is not available as end time');
        }
      }
    }

    // Enhanced debugging for the final result
    console.log('🔍 FINAL RESULT:');
    console.log(`   Selected start time: ${this.selectedStartTime}:00`);
    console.log(`   Available end times: [${this.availableEndTimes.map(t => t.hour + ':00').join(', ')}]`);
    console.log(`   Total end time options: ${this.availableEndTimes.length}`);

    if (this.availableEndTimes.length === 0) {
      console.log('⚠️ WARNING: No end times available!');
      console.log('   This means the first hour after start time is unavailable');
      console.log('   Possible causes:');
      console.log('   - Existing reservation blocking the next hour');
      console.log('   - Open Play event scheduled for the next hour');
      console.log('   - Court closing time reached');
      console.log('   - Backend data inconsistency');
    }
  }

  addPlayer(): void {
    this.playersArray.push(this.fb.control('', Validators.required));
    this.calculateFee();
  }

  removePlayer(index: number): void {
    // Prevent removing Player 1 (the logged-in user) and ensure at least one player remains
    if (this.playersArray.length > 1 && index > 0) {
      this.playersArray.removeAt(index);
      this.calculateFee();
    }
  }

  addCustomPlayer(): void {
    this.customPlayerNames.push('');
    console.log('🔍 Added custom player, array now:', this.customPlayerNames);
    this.calculateFee();
  }

  removeCustomPlayer(index: number): void {
    if (this.customPlayerNames.length > 0) {
      this.customPlayerNames.splice(index, 1);
      this.calculateFee();
    }
  }

  getTotalPlayerCount(): number {
    const memberCount = this.playersArray.controls.filter(
      (control) => control.value && control.value.trim()
    ).length;
    const customCount = this.customPlayerNames.filter((name) => name && name.trim()).length;
    return memberCount + customCount;
  }

  updateCustomPlayerName(index: number, event: any): void {
    this.customPlayerNames[index] = event.target.value;
    console.log('🔍 updateCustomPlayerName() called, array now:', this.customPlayerNames);

    // Debounce fee calculation to avoid performance issues
    if (this.feeCalculationTimer) {
      clearTimeout(this.feeCalculationTimer);
    }
    this.feeCalculationTimer = setTimeout(() => {
      this.calculateFee();
    }, 100); // 100ms debounce
  }

  trackCustomPlayer(index: number, item: string): number {
    return index;
  }

  loadReservationsForDate(): void {
    if (!this.selectedDate) return;

    // Reset loading flag at the start
    this.timeSlotsLoaded = false;

    // Format date as YYYY-MM-DD in Philippine timezone
    const year = this.selectedDate.getFullYear();
    const month = String(this.selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(this.selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    console.log('🔍 Loading reservations for date:', dateStr);

    this.http.get<any>(`${this.apiUrl}/reservations/date/${dateStr}`).subscribe({
      next: (response) => {
        console.log('🔍 API response for date', dateStr, ':', response);
        console.log('🔍 Full API response structure:', JSON.stringify(response, null, 2));
        this.existingReservations = response.data?.reservations || [];
        console.log('🔍 Existing reservations loaded:', this.existingReservations.length);

        // Use backend time slots data that includes Open Play blocking
        if (response.data?.timeSlots) {
          console.log('✅ Backend provided timeSlots data, using it instead of local generation');
          console.log('📊 Backend timeSlots count:', response.data.timeSlots.length);
          console.log('🔍 Backend timeSlots raw data:', response.data.timeSlots);
          console.log('🚫 Backend blocked slots:', response.data.timeSlots.filter((s: any) => s.blockedByOpenPlay).length);

          // Store ALL time slots (including hour 22) for end time calculations
          this.allTimeSlots = response.data.timeSlots.map((backendSlot: any) => ({
            hour: backendSlot.hour,
            display: `${backendSlot.hour}:00 - ${backendSlot.hour + 1}:00`,
            available: backendSlot.available,
            availableAsEndTime: backendSlot.availableAsEndTime,
            isPeak: this.peakHours.includes(backendSlot.hour),
            blockedByOpenPlay: backendSlot.blockedByOpenPlay || false,
            openPlayEvent: backendSlot.openPlayEvent || null
          }));

          // For START times: filter out hour 22 (court closes at 10 PM, last start is 9 PM)
          this.timeSlots = this.allTimeSlots.filter((slot: any) => slot.hour <= 21);

          // Log specific slots for debugging
          const blockedSlots = this.timeSlots.filter(s => s.blockedByOpenPlay);
          console.log('🚫 Processed blocked slots:', blockedSlots.map(s => s.hour));
          const unavailableSlots = this.timeSlots.filter(s => !s.available);
          console.log('❌ All unavailable slots:', unavailableSlots.map(s => ({ hour: s.hour, blocked: s.blockedByOpenPlay, available: s.available })));
          console.log('🔍 Updated time slots with Open Play blocking:', this.timeSlots);

          // Mark slots as loaded and trigger end time update if start time is already selected
          this.timeSlotsLoaded = true;
          if (this.selectedStartTime !== null) {
            console.log('🔄 Start time already selected, updating available end times now that data is loaded');
            this.updateAvailableEndTimes();
          } else {
            // Initialize stepper with first available time if using stepper UI
            this.initializeStepperDefaults();
          }
        } else {
          console.log('❌ No timeSlots in backend response, falling back to local generation');
          console.log('📊 Backend response data keys:', Object.keys(response.data || {}));
          // Fallback to local generation if backend doesn't provide timeSlots
          this.updateTimeSlotAvailability();
          this.timeSlotsLoaded = true;
          if (this.selectedStartTime !== null) {
            this.updateAvailableEndTimes();
          } else {
            // Initialize stepper with first available time if using stepper UI
            this.initializeStepperDefaults();
          }
        }
      },
      error: (error) => {
        console.error('Error loading reservations:', error);
        this.existingReservations = [];
        this.updateTimeSlotAvailability();
        this.timeSlotsLoaded = true; // Mark as loaded even on error to prevent blocking UI
        // Initialize stepper with first available time if using stepper UI
        this.initializeStepperDefaults();
      },
    });
  }

  updateTimeSlotAvailability(): void {
    console.log('🔍 Updating time slot availability for date:', this.selectedDate);
    console.log('🔍 Existing reservations:', this.existingReservations);

    // Get current Philippine time
    const currentPhilippineTime = this.getCurrentPhilippineTime();
    const isToday = this.isToday(this.selectedDate);

    this.timeSlots.forEach((slot) => {
      // Check if booked by existing reservations (excluding the current reservation being edited)
      const isBooked = this.existingReservations.some(
        (res) => {
          const endTimeSlot = res.endTimeSlot || (res.timeSlot + (res.duration || 1));
          return slot.hour >= res.timeSlot && 
                 slot.hour < endTimeSlot &&
                 (res.status === 'pending' || res.status === 'confirmed') &&
                 (!this.isEditMode || res._id !== this.editingReservationId);
        }
      );

      // Check if time has passed (only for today)
      let hasTimePassed = false;
      if (isToday) {
        hasTimePassed = slot.hour <= currentPhilippineTime.getHours();
        if (hasTimePassed) {
          console.log(
            `⏰ Slot ${
              slot.hour
            }:00 is unavailable - time has passed (current time: ${currentPhilippineTime.getHours()}:${currentPhilippineTime
              .getMinutes()
              .toString()
              .padStart(2, '0')})`
          );
        }
      }

      slot.available = !isBooked && !hasTimePassed;

      if (isBooked) {
        console.log(`⚠️ Slot ${slot.hour}:00 is unavailable due to existing reservation`);
      }
    });

    console.log(
      '🔍 Final time slots availability:',
      this.timeSlots.map((s) => ({ hour: s.hour, available: s.available }))
    );
  }

  calculateFee(): void {
    console.log('🔍 calculateFee() called');
    console.log('🔍 customPlayerNames:', this.customPlayerNames);
    console.log('🔍 selectedStartTime:', this.selectedStartTime);
    console.log('🔍 selectedEndTime:', this.selectedEndTime);

    if (!this.selectedStartTime || !this.selectedEndTime) {
      this.calculatedFee = 0;
      console.log('❌ No time selected, fee = 0');
      return;
    }

    const duration = this.getDurationHours();
    if (duration <= 0) {
      this.calculatedFee = 0;
      console.log('❌ Invalid duration, fee = 0');
      return;
    }

    // December 2025 pricing constants
    const PEAK_BASE_FEE = 150;
    const NON_PEAK_BASE_FEE = 100;
    const GUEST_FEE = 70;

    // Count member players
    let memberCount = 0;
    this.playersArray.controls.forEach((control) => {
      if (control.value && control.value.trim()) {
        memberCount++;
      }
    });

    // Count custom (non-member/guest) players
    let guestCount = 0;
    this.customPlayerNames.forEach((name) => {
      console.log('🔍 Checking custom name:', `"${name}"`);
      if (name && name.trim()) {
        guestCount++;
        console.log('✅ Added guest player, count now:', guestCount);
      }
    });

    console.log('🔍 Final counts - Members:', memberCount, 'Guests:', guestCount);

    // Calculate total fee for all hours in the range
    // December 2025: Base rate (₱100 or ₱150) + ₱70 per guest
    let totalFee = 0;
    for (let hour = this.selectedStartTime!; hour < this.selectedEndTime!; hour++) {
      const baseFee = this.isPeakHour(hour) ? PEAK_BASE_FEE : NON_PEAK_BASE_FEE;
      const hourlyFee = baseFee + (guestCount * GUEST_FEE);
      totalFee += hourlyFee;

      console.log(`🔍 Hour ${hour}: Base=₱${baseFee}, Guests=${guestCount}×₱${GUEST_FEE}, Total=₱${hourlyFee}`);
    }

    // Round to nearest 10 pesos (e.g., 550 → 550, 183.33 → 190)
    this.calculatedFee = Math.ceil(totalFee / 10) * 10;
    console.log(`🔍 Final calculated fee: ₱${totalFee} → ₱${this.calculatedFee} (rounded)`);
  }

  isPeakHour(hour: number): boolean {
    return this.peakHours.includes(hour);
  }

  getPlayerCount(): number {
    const memberCount = this.playersArray.controls.filter(
      (control) => control.value && control.value.trim()
    ).length;
    const customCount = this.customPlayerNames.filter((name) => name && name.trim()).length;
    return memberCount + customCount;
  }

  getMemberCount(): number {
    return this.playersArray.controls.filter((control) => control.value && control.value.trim())
      .length;
  }

  getNonMemberCount(): number {
    const count = this.customPlayerNames.filter((name) => name && name.trim()).length;
    console.log('🔍 getNonMemberCount() - customPlayerNames:', this.customPlayerNames);
    console.log('🔍 getNonMemberCount() - returning:', count);
    return count;
  }

  getDurationHours(): number {
    if (!this.selectedStartTime || !this.selectedEndTime) return 0;
    return this.selectedEndTime - this.selectedStartTime;
  }

  // Convert 24-hour time to AM/PM format
  formatTimeAMPM(hour: number): string {
    if (hour === 0) return '12:00 AM';
    if (hour < 12) return `${hour}:00 AM`;
    if (hour === 12) return '12:00 PM';
    return `${hour - 12}:00 PM`;
  }

  getTimeRangeDisplay(): string {
    if (!this.selectedStartTime || !this.selectedEndTime) return '';
    return `${this.formatTimeAMPM(this.selectedStartTime)} - ${this.formatTimeAMPM(this.selectedEndTime)}`;
  }

  getRateType(): string {
    if (!this.selectedStartTime || !this.selectedEndTime) return '';

    let peakHours = 0;
    let offPeakHours = 0;

    console.log(
      '🔍 DEBUG getRateType - Start:',
      this.selectedStartTime,
      'End:',
      this.selectedEndTime
    );
    console.log('🔍 DEBUG peakHours array:', this.peakHours);

    for (let hour = this.selectedStartTime; hour < this.selectedEndTime; hour++) {
      const isPeak = this.isPeakHour(hour);
      console.log(`🔍 DEBUG Hour ${hour}: isPeak = ${isPeak}`);

      if (isPeak) {
        peakHours++;
      } else {
        offPeakHours++;
      }
    }

    console.log(`🔍 DEBUG Final count - Peak: ${peakHours}, Off-Peak: ${offPeakHours}`);

    if (peakHours === 0) {
      console.log('🔍 DEBUG Result: Off-Peak');
      return 'Off-Peak';
    } else if (offPeakHours === 0) {
      console.log('🔍 DEBUG Result: Peak Hours');
      return 'Peak Hours';
    } else {
      console.log('🔍 DEBUG Result: Mixed');
      return 'Mixed';
    }
  }

  getRateTypeDescription(): string {
    if (!this.selectedStartTime || !this.selectedEndTime) return '';

    const rateType = this.getRateType();
    if (rateType === 'Mixed') {
      let peakHours = 0;
      let offPeakHours = 0;

      for (let hour = this.selectedStartTime; hour < this.selectedEndTime; hour++) {
        if (this.isPeakHour(hour)) {
          peakHours++;
        } else {
          offPeakHours++;
        }
      }

      return `Mixed (${peakHours} peak, ${offPeakHours} off-peak)`;
    }

    return rateType;
  }

  getTimeSlotDisplay(hour: number): string {
    return `${hour}:00 - ${hour + 1}:00`;
  }

  getTimeSlotRange(): number[] {
    if (!this.selectedStartTime || !this.selectedEndTime) return [];
    const slots = [];
    for (let hour = this.selectedStartTime; hour < this.selectedEndTime; hour++) {
      slots.push(hour);
    }
    return slots;
  }

  // December 2025: Calculate base fee total (sum of hourly base fees)
  getBaseFeeTotal(): number {
    if (!this.selectedStartTime || !this.selectedEndTime) return 0;

    const PEAK_BASE_FEE = 150;
    const NON_PEAK_BASE_FEE = 100;

    let totalBaseFee = 0;
    for (let hour = this.selectedStartTime; hour < this.selectedEndTime; hour++) {
      const baseFee = this.isPeakHour(hour) ? PEAK_BASE_FEE : NON_PEAK_BASE_FEE;
      totalBaseFee += baseFee;
    }

    return totalBaseFee;
  }

  // December 2025: Calculate guest fee total (guests × ₱70 × hours)
  getGuestFeeTotal(): number {
    const guestCount = this.getNonMemberCount();
    const hours = this.getDurationHours();
    const GUEST_FEE = 70;

    return guestCount * GUEST_FEE * hours;
  }

  // December 2025: Get payment breakdown per player
  getPlayerPaymentBreakdown(): Array<{
    name: string;
    amount: number;
    isReserver: boolean;
    isGuest: boolean;
    breakdown?: string;
  }> {
    const result: Array<{
      name: string;
      amount: number;
      isReserver: boolean;
      isGuest: boolean;
      breakdown?: string;
    }> = [];

    const memberCount = this.getMemberCount();
    const guestCount = this.getNonMemberCount();

    if (memberCount === 0) return result;

    const baseFeeTotal = this.getBaseFeeTotal();
    const guestFeeTotal = this.getGuestFeeTotal();

    // Round total fee to nearest 10, then divide among members
    const totalFee = Math.ceil((baseFeeTotal + guestFeeTotal) / 10) * 10;
    const baseFeePerMember = (totalFee - guestFeeTotal) / memberCount;

    // Add member players
    let memberIndex = 0;
    this.playersArray.controls.forEach((control) => {
      const playerName = control.value?.trim();
      if (playerName) {
        const isReserver = memberIndex === 0;
        const amount = isReserver
          ? baseFeePerMember + guestFeeTotal
          : baseFeePerMember;

        let breakdown = `Base share: ₱${baseFeePerMember.toFixed(2)}`;
        if (isReserver && guestFeeTotal > 0) {
          breakdown += ` + Guest fees: ₱${guestFeeTotal.toFixed(2)}`;
        }

        result.push({
          name: playerName,
          amount: amount,
          isReserver: isReserver,
          isGuest: false,
          breakdown: breakdown,
        });
        memberIndex++;
      }
    });

    // Add guest players
    this.customPlayerNames.forEach((guestName) => {
      if (guestName && guestName.trim()) {
        result.push({
          name: guestName.trim(),
          amount: 0,
          isReserver: false,
          isGuest: true,
        });
      }
    });

    return result;
  }

  // December 2025: Format player names from either old (string[]) or new (object[]) format
  formatPlayerNames(players: any[]): string {
    if (!players || players.length === 0) return '';

    // Check if new format (objects with name property)
    if (typeof players[0] === 'object' && 'name' in players[0]) {
      return players.map((p: any) => p.name).join(', ');
    }

    // Old format (strings)
    return players.join(', ');
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'confirmed':
        return 'primary';
      case 'pending':
        return 'accent';
      case 'cancelled':
        return 'warn';
      default:
        return '';
    }
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'confirmed':
        return 'success';
      case 'pending':
        return 'info';
      case 'cancelled':
        return 'danger';
      case 'completed':
        return 'success';
      default:
        return 'secondary';
    }
  }

  onSubmit(): void {
    if (this.reservationForm.invalid || this.loading) return;

    this.loading = true;

    if (this.isEditMode && this.editingReservationId) {
      this.updateReservation();
    } else {
      this.createReservation();
    }
  }

  updateReservation(): void {
    const formValue = this.reservationForm.value;

    // Collect all valid player names
    const players: string[] = [];

    // Add member players
    this.playersArray.controls.forEach((control) => {
      if (control.value && control.value.trim()) {
        players.push(control.value.trim());
      }
    });

    // Add custom players
    this.customPlayerNames.forEach((name) => {
      if (name && name.trim()) {
        players.push(name.trim());
      }
    });

    // Calculate duration and end time slot
    const startTime = formValue.startTime;
    const endTime = formValue.endTime;
    const duration = endTime - startTime;

    const updateData = {
      date: formValue.date,
      timeSlot: startTime,
      endTimeSlot: endTime,
      duration: duration,
      isMultiHour: duration > 1,
      timeSlotDisplay: `${startTime}:00 - ${endTime}:00`,
      players: players,
    };

    console.log('🔄 Updating reservation:', updateData);

    this.http
      .put<any>(`${this.apiUrl}/reservations/${this.editingReservationId}`, updateData)
      .subscribe({
        next: (response) => {
          console.log('✅ Reservation updated successfully:', response);
          this.loading = false;
          this.showSuccess(
            'Reservation Updated!',
            'Your reservation has been updated successfully'
          );
          setTimeout(() => {
            this.router.navigate(['/my-reservations']);
          }, 2000);
        },
        error: (error) => {
          console.error('❌ Update failed:', error);
          this.loading = false;
          const message = error.error?.error || 'Failed to update reservation';
          this.showError('Update Failed', message);
        },
      });
  }

  createReservation(): void {
    const formValue = this.reservationForm.value;

    // Collect all valid player names (from members and custom players)
    const players: string[] = [];

    // Add member players
    this.playersArray.controls.forEach((control) => {
      if (control.value && control.value.trim()) {
        players.push(control.value.trim());
      }
    });

    // Add custom players
    this.customPlayerNames.forEach((name) => {
      if (name && name.trim()) {
        players.push(name.trim());
      }
    });

    // Create single multi-hour reservation
    const timeSlots = this.getTimeSlotRange();
    const totalDuration = this.getDurationHours();
    const startTimeSlot = timeSlots[0];
    const endTimeSlot = timeSlots[timeSlots.length - 1] + 1;

    console.log('🚀 Creating SINGLE multi-hour reservation:', {
      startTimeSlot,
      endTimeSlot,
      duration: totalDuration,
      totalFee: this.calculatedFee,
    });

    // Create single reservation data with multi-hour support
    const reservationData = {
      date: formValue.date,
      timeSlot: startTimeSlot,
      duration: totalDuration,
      endTimeSlot: endTimeSlot,
      isMultiHour: totalDuration > 1,
      timeSlotDisplay: this.getTimeRangeDisplay(), // e.g., "6:00 - 8:00"
      players: players,
      totalFee: this.calculatedFee, // Total fee for entire duration
      paymentStatus: 'pending',
      status: 'pending',
    };

    console.log(`🚀 Sending SINGLE reservation:`, reservationData);

    // Create single reservation
    this.http
      .post<any>(`${this.apiUrl}/reservations`, reservationData)
      .toPromise()
      .then((response) => {
        console.log('✅ Single multi-hour reservation created successfully:', response);
        this.loading = false;

        // Create success message
        const successMessage = `Court booked for ${this.getTimeRangeDisplay()} on ${new Date(
          formValue.date
        ).toLocaleDateString()}\n💰 Payment required: ₱${this.calculatedFee}`;

        this.showSuccess('Reservation Confirmed!', successMessage);
        setTimeout(() => {
          this.router.navigate(['/my-reservations']);
        }, 2000);
      })
      .catch((error) => {
        console.error('❌ Reservation failed:', error);
        console.error('❌ Error status:', error.status);
        console.error('❌ Error response:', error.error);
        console.error('❌ Full error object:', JSON.stringify(error, null, 2));
        this.loading = false;

        // Check if error is due to overdue payments
        if (error.status === 403 && error.error?.overduePayments) {
          this.overduePaymentDetails = error.error.overduePayments;
          this.showOverduePaymentModal = true;
        } else {
          const message = error.error?.message || error.error?.error || 'Failed to create reservation. Please try again.';
          this.showError('Booking Failed', message);
        }
      });
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  // Modern dropdown methods
  toggleDropdown(playerIndex: number): void {
    // Close all other dropdowns
    Object.keys(this.dropdownStates).forEach((key) => {
      if (parseInt(key) !== playerIndex) {
        this.dropdownStates[parseInt(key)] = false;
      }
    });

    // Toggle current dropdown
    this.dropdownStates[playerIndex] = !this.dropdownStates[playerIndex];

    // Initialize search term if not exists
    if (!this.searchTerms[playerIndex]) {
      this.searchTerms[playerIndex] = '';
    }
  }

  selectMember(playerIndex: number, member: Member): void {
    this.playersArray.at(playerIndex).setValue(member.fullName);
    this.dropdownStates[playerIndex] = false;
    this.searchTerms[playerIndex] = member.fullName;
    this.calculateFee();
  }

  clearSelection(playerIndex: number): void {
    this.playersArray.at(playerIndex).setValue('');
    this.searchTerms[playerIndex] = '';
    this.calculateFee();
  }

  getFilteredMembers(playerIndex: number): Member[] {
    const searchTerm = this.searchTerms[playerIndex]?.toLowerCase() || '';
    
    // Get currently selected players from other dropdowns (excluding current dropdown)
    const selectedPlayerNames = this.playersArray.controls
      .map((control, index) => index !== playerIndex ? control.value : null)
      .filter(value => value && typeof value === 'string' && value.trim() !== '');

    let filteredMembers = this.members.filter(member => 
      !selectedPlayerNames.includes(member.fullName)
    );

    if (!searchTerm) {
      return filteredMembers;
    }

    return filteredMembers.filter(
      (member) =>
        member.fullName.toLowerCase().includes(searchTerm) ||
        member.username.toLowerCase().includes(searchTerm)
    );
  }

  onSearchChange(playerIndex: number, event: any): void {
    this.searchTerms[playerIndex] = event.target.value;
    // Clear form control if search doesn't match any member
    const matchingMember = this.members.find(
      (m) => m.fullName.toLowerCase() === event.target.value.toLowerCase()
    );
    if (!matchingMember && event.target.value) {
      this.playersArray.at(playerIndex).setValue('');
    }
  }

  getSelectedMemberDisplay(playerIndex: number): string {
    const selectedValue = this.playersArray.at(playerIndex).value;
    if (selectedValue) {
      const member = this.members.find((m) => m.fullName === selectedValue);
      return member ? `${member.fullName} (${member.username})` : selectedValue;
    }
    return '';
  }

  // Modern notification methods
  private showNotification(
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string,
    duration = 5000
  ): void {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const notification: Notification = { id, type, title, message, duration };

    this.notifications.push(notification);

    // Auto remove notification after duration
    if (duration > 0) {
      setTimeout(() => {
        this.removeNotification(id);
      }, duration);
    }
  }

  removeNotification(id: string): void {
    this.notifications = this.notifications.filter((n) => n.id !== id);
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

  // New methods for proper fee display
  getPeakHoursFee(): number {
    if (!this.selectedStartTime || !this.selectedEndTime) return 0;

    let peakHours = 0;
    for (let hour = this.selectedStartTime; hour < this.selectedEndTime; hour++) {
      if (this.isPeakHour(hour)) {
        peakHours++;
      }
    }

    return peakHours * 100; // ₱100 per peak hour
  }

  getOffPeakMembersFee(): number {
    if (!this.selectedStartTime || !this.selectedEndTime) return 0;

    let offPeakHours = 0;
    for (let hour = this.selectedStartTime; hour < this.selectedEndTime; hour++) {
      if (!this.isPeakHour(hour)) {
        offPeakHours++;
      }
    }

    return offPeakHours * this.getMemberCount() * 20; // ₱20 per member per off-peak hour
  }

  getOffPeakNonMembersFee(): number {
    if (!this.selectedStartTime || !this.selectedEndTime) return 0;

    let offPeakHours = 0;
    for (let hour = this.selectedStartTime; hour < this.selectedEndTime; hour++) {
      if (!this.isPeakHour(hour)) {
        offPeakHours++;
      }
    }

    return offPeakHours * this.getNonMemberCount() * 50; // ₱50 per non-member per off-peak hour
  }

  // Debug method to determine why a specific hour is unavailable
  getUnavailabilityReason(hour: number): string {
    const slot = this.timeSlots.find(s => s.hour === hour);

    if (!slot) {
      return 'unknown';
    }

    if (slot.available) {
      return 'available';
    }

    if (slot.blockedByOpenPlay) {
      return 'open_play';
    }

    // Check if there's an existing reservation for this hour
    const conflictingReservation = this.existingReservations.find(res => {
      const endTimeSlot = res.endTimeSlot || (res.timeSlot + (res.duration || 1));
      return hour >= res.timeSlot && hour < endTimeSlot && res.status !== 'cancelled';
    });

    if (conflictingReservation) {
      return 'reservation';
    }

    return 'unknown';
  }

  // Overdue payment modal methods
  checkOverduePayments(): void {
    console.log('🔍 Checking for overdue payments on page load...');
    this.http.get<any>(`${this.apiUrl}/payments/check-overdue`).subscribe({
      next: (response) => {
        console.log('🔍 Overdue payment check response:', response);
        if (response.success && response.hasOverdue) {
          this.overduePaymentDetails = response.overduePayments;
          this.showOverduePaymentModal = true;
          console.log(`⚠️ Found ${response.count} overdue payment(s), showing modal`);
        } else {
          console.log('✅ No overdue payments found');
        }
      },
      error: (error) => {
        console.error('❌ Error checking overdue payments:', error);
        // Don't show error to user - this is a background check
      }
    });
  }

  closeOverdueModal(): void {
    this.showOverduePaymentModal = false;
    this.overduePaymentDetails = [];
  }

  goToPayments(): void {
    this.showOverduePaymentModal = false;
    this.router.navigate(['/payments'], {
      queryParams: { tab: 'pending' }
    });
  }

  // ========== STEPPER UI METHODS ==========

  // Initialize stepper with default values when using stepper UI
  private initializeStepperDefaults(): void {
    if (this.useStepperUI && !this.selectedStartTime && this.timeSlots.length > 0) {
      // Find first available time slot
      const firstAvailable = this.timeSlots.find(slot => slot.available);
      if (firstAvailable) {
        this.selectedStartTime = firstAvailable.hour;
        this.selectedEndTime = Math.min(22, firstAvailable.hour + 1);
        this.reservationForm.patchValue({
          startTime: this.selectedStartTime,
          endTime: this.selectedEndTime
        });
        this.calculateFee();
      }
    }
  }

  adjustStartTime(delta: number): void {
    if (!this.selectedStartTime) {
      // Initialize to first available time or default to 14:00
      const firstAvailable = this.timeSlots.find(slot => slot.available);
      this.selectedStartTime = firstAvailable ? firstAvailable.hour : 14;
      this.selectedEndTime = Math.min(22, this.selectedStartTime + 1);
      this.reservationForm.patchValue({
        startTime: this.selectedStartTime,
        endTime: this.selectedEndTime
      });
      this.calculateFee();
      return;
    }

    // Find next available time in the direction of delta
    let newStart = this.selectedStartTime + delta;
    const maxAttempts = 17; // Maximum time slots (5-22)
    let attempts = 0;

    // Keep searching for available time in the delta direction
    while (attempts < maxAttempts) {
      // Check bounds first
      if (newStart < 5 || newStart > 21) {
        return; // Reached the limit
      }

      // Check if this time is available
      if (!this.isTimeBooked(newStart)) {
        // Found available time - reset duration to 1 hour
        this.selectedStartTime = newStart;
        this.selectedEndTime = Math.min(22, newStart + 1);

        this.reservationForm.get('startTime')?.setValue(this.selectedStartTime);
        this.reservationForm.get('endTime')?.setValue(this.selectedEndTime);

        this.calculateFee();
        return;
      }

      // Time is booked, continue searching in the same direction
      newStart += delta;
      attempts++;
    }

    // If we reach here, no available time was found in that direction
  }

  adjustDuration(delta: number): void {
    const currentDuration = this.getDurationHours();
    const newDuration = Math.max(1, Math.min(4, currentDuration + delta));

    if (!this.selectedStartTime) return;

    const newEndTime = this.selectedStartTime + newDuration;

    // Check if new duration would cause conflict
    if (newEndTime > 22 || this.isRangeBooked(this.selectedStartTime, newEndTime)) {
      return; // Don't allow extending into booked slot
    }

    this.selectedEndTime = newEndTime;
    this.reservationForm.get('endTime')?.setValue(newEndTime);
    this.calculateFee();
  }

  canIncrementStart(): boolean {
    if (!this.selectedStartTime || this.selectedStartTime >= 21) return false;

    // Check if there's ANY available time after current time
    for (let hour = this.selectedStartTime + 1; hour <= 21; hour++) {
      if (!this.isTimeBooked(hour)) {
        return true;
      }
    }
    return false;
  }

  canDecrementStart(): boolean {
    if (!this.selectedStartTime || this.selectedStartTime <= 5) return false;

    // Check if there's ANY available time before current time
    for (let hour = this.selectedStartTime - 1; hour >= 5; hour--) {
      if (!this.isTimeBooked(hour)) {
        return true;
      }
    }
    return false;
  }

  canIncrementDuration(): boolean {
    const currentDuration = this.getDurationHours();
    if (currentDuration >= 4 || !this.selectedStartTime) return false;

    const newEndTime = this.selectedStartTime + currentDuration + 1;
    if (newEndTime > 22) return false;

    return !this.isTimeBooked(newEndTime - 1);
  }

  canDecrementDuration(): boolean {
    const currentDuration = this.getDurationHours();
    return currentDuration > 1;
  }

  getAvailabilityStatus(): 'available' | 'conflict' | 'warning' {
    if (!this.selectedStartTime || !this.selectedEndTime) return 'available';

    if (this.isRangeBooked(this.selectedStartTime, this.selectedEndTime)) {
      return 'conflict';
    }

    return 'available';
  }

  getAvailabilityMessage(): string {
    const status = this.getAvailabilityStatus();

    if (status === 'conflict') {
      return 'Conflicts with existing booking';
    }

    return 'Available';
  }

  findNextAvailableTime(): void {
    if (!this.selectedStartTime) return;

    const duration = this.getDurationHours();

    for (let h = this.selectedStartTime + 1; h <= 22 - duration; h++) {
      if (!this.isRangeBooked(h, h + duration)) {
        this.selectedStartTime = h;
        this.selectedEndTime = h + duration;
        this.reservationForm.patchValue({
          startTime: h,
          endTime: h + duration
        });
        this.calculateFee();
        return;
      }
    }

    this.showWarning('No Available Time', 'No consecutive time slots available for the selected duration.');
  }

  // Helper method to check if a single hour is booked
  private isTimeBooked(hour: number): boolean {
    // First check if the time slot is marked as unavailable (includes Open Play blocking)
    const timeSlot = this.timeSlots.find(slot => slot.hour === hour);
    if (timeSlot && !timeSlot.available) {
      return true;
    }

    // Then check existing reservations
    return this.existingReservations.some(res => {
      const endTimeSlot = res.endTimeSlot || (res.timeSlot + (res.duration || 1));
      return hour >= res.timeSlot && hour < endTimeSlot &&
             (res.status === 'pending' || res.status === 'confirmed') &&
             (!this.isEditMode || res._id !== this.editingReservationId);
    });
  }

  // Helper method to check if a time range is booked
  private isRangeBooked(startHour: number, endHour: number): boolean {
    for (let h = startHour; h < endHour; h++) {
      if (this.isTimeBooked(h)) return true;
    }
    return false;
  }

  private showWarning(title: string, message: string): void {
    this.showNotification('warning', title, message, 4000);
  }
}

