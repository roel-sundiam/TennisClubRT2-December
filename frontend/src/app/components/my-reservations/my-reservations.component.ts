import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { timeout, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { canCancelReservation } from '../../utils/date-validation.util';

interface Reservation {
  _id: string;
  date: Date;
  timeSlot: number;
  timeSlotDisplay: string;
  players: string[];
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no-show' | 'blocked';
  paymentStatus: 'pending' | 'paid' | 'overdue';
  totalFee: number;
  feePerPlayer: number;
  userId?: {
    _id: string;
    username: string;
    fullName: string;
  };
  weatherForecast?: {
    temperature: number;
    description: string;
    icon: string;
    rainChance?: number;
    humidity?: number;
  };
  blockReason?: 'maintenance' | 'private_event' | 'weather' | 'other';
  blockNotes?: string;
  tennisBalls?: {
    quantity: number;
    costPerCan: number;
    totalCost: number;
  };
  createdAt: Date;
  updatedAt: Date;
  isHomeownerDay?: boolean; // Flag for Homeowner's Day entries
}

interface GroupedReservations {
  date: string; // "Tue, Nov 4"
  dateKey: string; // For grouping
  reservations: Reservation[];
}

interface AvatarInfo {
  initials: string;
  color: string;
}

@Component({
  selector: 'app-my-reservations',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    MatTabsModule,
    MatChipsModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatTooltipModule,
    MatSelectModule,
    MatFormFieldModule
  ],
  template: `
    <!-- Modern page structure following design system -->
    <div class="page-container">
      <div class="page-content">
        <!-- Page Header with Action -->
        <div class="page-header">
          <div class="page-title-section">
            <div class="page-title">
              <mat-icon class="page-icon">event</mat-icon>
              <h1>My Reservations</h1>
            </div>
            <p class="page-subtitle">View and manage your court bookings</p>
          </div>
          <div class="page-actions">
            <button mat-raised-button class="btn-calendar" (click)="viewCalendar()">
              <mat-icon>calendar_month</mat-icon>
              <span class="btn-text">Calendar View</span>
            </button>
            <button mat-raised-button class="btn-primary" (click)="createNewReservation()">
              <mat-icon>add</mat-icon>
              Book Court
            </button>
          </div>
        </div>

        <div class="content-wrapper">
        <mat-tab-group class="reservations-tabs modern-compact-tabs" (selectedTabChange)="onTabChange($event)">
          <!-- All Reservations -->
          <mat-tab [label]="getTabLabel('all')" [disabled]="loading">
            <div class="tab-content">
              <div *ngIf="loading" class="loading-container">
                <mat-spinner diameter="50"></mat-spinner>
                <p>Loading all reservations...</p>
              </div>

              <!-- Member Filter Bar -->
              <div *ngIf="!loading && allReservations.length > 0" class="member-filter-bar">
                <div class="filter-container">
                  <label for="member-filter" class="filter-label">
                    <svg class="filter-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="8.5" cy="7" r="4"></circle>
                      <path d="M20 8v6M23 11h-6"></path>
                    </svg>
                    Filter by Member
                  </label>
                  <div class="select-wrapper">
                    <select 
                      id="member-filter" 
                      class="member-filter-select" 
                      [(ngModel)]="memberFilterId">
                      <option value="">All Members</option>
                      <option *ngFor="let member of memberFilterOptions" [value]="member.id">
                        {{member.name}}
                      </option>
                    </select>
                    <svg class="select-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>
                </div>
              </div>

              <div *ngIf="!loading && allReservations.length === 0" class="no-reservations">
                <mat-icon class="large-icon">event_note</mat-icon>
                <h2>No Reservations Found</h2>
                <p>No court reservations have been made by any members yet.</p>
                <button mat-raised-button color="primary" (click)="createNewReservation()">
                  <mat-icon>add</mat-icon>
                  Book a Court
                </button>
              </div>

              <div *ngIf="!loading && allReservations.length > 0 && filteredAllReservations.length === 0" class="no-reservations">
                <mat-icon class="large-icon">person_search</mat-icon>
                <h2>No Reservations for This Member</h2>
                <p>The selected member has no scheduled reservations.</p>
              </div>

              <!-- Mobile View: New Design -->
              <div *ngIf="!loading && filteredAllReservations.length > 0 && isMobileView" class="reservations-list mobile-schedule">
                <div *ngFor="let group of filteredGroupedAllReservations" class="date-group">
                  <!-- Sticky Date Header -->
                  <div class="date-header">{{group.date}}</div>

                  <!-- Reservation Cards for this Date -->
                  <div *ngFor="let reservation of group.reservations"
                       class="mobile-event-card"
                       [class.homeowner-day]="reservation.isHomeownerDay"
                       [class.expanded]="isExpanded(reservation._id)"
                       (click)="toggleExpansion(reservation._id)">

                    <!-- Time Range -->
                    <h2 class="event-time">{{reservation.timeSlotDisplay}}</h2>

                    <!-- Blocked Court Info -->
                    <div class="block-info" *ngIf="isBlockedReservation(reservation)">
                      <mat-icon class="inline-icon">{{getBlockReasonIcon(reservation)}}</mat-icon>
                      <span class="block-text">
                        <strong>{{getBlockReasonDisplay(reservation)}}</strong>
                        <span *ngIf="reservation.blockNotes"> - {{reservation.blockNotes}}</span>
                      </span>
                    </div>

                    <!-- Participants with Avatars (non-blocked) -->
                    <div class="participants-section" *ngIf="!isBlockedReservation(reservation)">
                      <div *ngFor="let playerName of getAllPlayers(reservation)" class="participant-row">
                        <div class="avatar" [style.background-color]="getAvatarColor(playerName)">
                          {{getInitials(playerName)}}
                        </div>
                        <span class="participant-name">{{playerName}}</span>
                      </div>
                    </div>

                    <!-- Weather Info -->
                    <div class="weather-row" *ngIf="reservation.weatherForecast">
                      <mat-icon class="weather-icon">{{getWeatherIcon(reservation.weatherForecast.icon)}}</mat-icon>
                      <span class="temp">{{reservation.weatherForecast.temperature}}°C</span>
                      <span class="humidity" *ngIf="reservation.weatherForecast.humidity">
                        Humidity: {{reservation.weatherForecast.humidity}}%
                      </span>
                      <span class="rain-chance-mobile" *ngIf="reservation.weatherForecast.rainChance !== undefined">
                        Rain: {{reservation.weatherForecast.rainChance}}%
                      </span>
                    </div>

                    <!-- Fee Badge (Floating) -->
                    <div class="fee-badge" [style.background-color]="getFeeColor(reservation.totalFee)">
                      ₱{{reservation.totalFee}}
                    </div>

                    <!-- Expanded Content -->
                    <div class="expanded-content" *ngIf="isExpanded(reservation._id)">
                      <mat-divider></mat-divider>

                      <div class="expanded-details">
                        <div class="detail-row">
                          <mat-icon class="detail-icon">event</mat-icon>
                          <span class="detail-label">Status:</span>
                          <mat-chip class="status-chip" [ngClass]="'status-' + reservation.status">
                            {{reservation.status | titlecase}}
                          </mat-chip>
                        </div>

                        <div class="detail-row" *ngIf="reservation.userId">
                          <mat-icon class="detail-icon">person</mat-icon>
                          <span class="detail-label">Reserved by:</span>
                          <span class="detail-value">{{reservation.userId.fullName}}</span>
                        </div>

                        <div class="detail-row" *ngIf="isBlockedReservation(reservation) && reservation.blockReason">
                          <mat-icon class="detail-icon">{{getBlockReasonIcon(reservation)}}</mat-icon>
                          <span class="detail-label">Block Reason:</span>
                          <span class="detail-value">{{getBlockReasonDisplay(reservation)}}</span>
                        </div>

                        <div class="detail-row" *ngIf="reservation.status === 'blocked' && reservation.blockNotes">
                          <mat-icon class="detail-icon">notes</mat-icon>
                          <span class="detail-label">Notes:</span>
                          <span class="detail-value">{{reservation.blockNotes}}</span>
                        </div>

                        <div class="detail-row">
                          <mat-icon class="detail-icon">payments</mat-icon>
                          <span class="detail-label">Fee per player:</span>
                          <span class="detail-value">₱{{(reservation.totalFee / getAllPlayers(reservation).length) | number:'1.0-0'}}</span>
                        </div>

                        <div class="detail-row" *ngIf="reservation.tennisBalls && reservation.tennisBalls.quantity > 0">
                          <mat-icon class="detail-icon">sports_tennis</mat-icon>
                          <span class="detail-label">Tennis balls:</span>
                          <span class="detail-value">{{reservation.tennisBalls.quantity}} {{ reservation.tennisBalls.quantity === 1 ? 'can' : 'cans' }} @ ₱{{reservation.tennisBalls.costPerCan}} = ₱{{reservation.tennisBalls.totalCost}}</span>
                        </div>
                      </div>
                    </div>

                    <!-- Expand Indicator -->
                    <mat-icon class="expand-icon" *ngIf="!isExpanded(reservation._id)">expand_more</mat-icon>
                    <mat-icon class="expand-icon" *ngIf="isExpanded(reservation._id)">expand_less</mat-icon>
                  </div>
                </div>
              </div>

              <!-- Desktop View: Original Design -->
              <div *ngIf="!loading && filteredAllReservations.length > 0 && !isMobileView" class="reservations-list">
                <!-- Original Desktop Design -->
                <div *ngFor="let reservation of filteredAllReservations"
                     class="reservation-card-compact all-reservations"
                     [class.homeowner-day]="reservation.isHomeownerDay"
                     [style.border-left-color]="getWeatherBorderColor(reservation)">
                  <div class="card-left">
                    <div class="date-badge" [ngClass]="isPastReservation(reservation.date) ? 'past' : ''">
                      <span class="date-day">{{getDay(reservation.date)}}</span>
                      <span class="date-info">{{getShortDate(reservation.date)}}</span>
                    </div>
                    <div class="reservation-main show-user-info">
                      <div class="time-slot">{{reservation.timeSlotDisplay}}</div>
                      <!-- Show user info only for non-blocked -->
                      <div class="user-info" *ngIf="!isBlockedReservation(reservation) && reservation.userId">
                        <mat-icon class="inline-icon">person</mat-icon>
                        <span class="user-text">{{reservation.userId.fullName}}</span>
                      </div>
                      <!-- Show block info for blocked reservations -->
                      <div class="block-info" *ngIf="isBlockedReservation(reservation)">
                        <mat-icon class="inline-icon">{{getBlockReasonIcon(reservation)}}</mat-icon>
                        <span class="block-text">
                          <strong>{{getBlockReasonDisplay(reservation)}}</strong>
                          <span *ngIf="reservation.blockNotes"> - {{reservation.blockNotes}}</span>
                        </span>
                      </div>
                      <!-- Show players for non-blocked reservations -->
                      <div class="players-info" *ngIf="!isBlockedReservation(reservation)">
                        <mat-icon class="inline-icon">people</mat-icon>
                        <span class="players-text">{{formatPlayerNames(getFilteredPlayers(reservation))}}</span>
                      </div>
                    </div>
                  </div>
                  <div class="card-right">
                    <!-- Hide status chip for blocked reservations -->
                    <div class="status-chips" *ngIf="!isBlockedReservation(reservation)">
                      <mat-chip *ngIf="reservation.status !== 'pending'" class="status-chip" [ngClass]="'status-' + reservation.status">
                        {{reservation.status | titlecase}}
                      </mat-chip>
                    </div>
                    <div class="status-chips" *ngIf="isBlockedReservation(reservation)">
                      <!-- Empty for blocked reservations -->
                    </div>
                    <!-- For blocked: hide fee, show only weather -->
                    <div class="fee-weather" *ngIf="!isBlockedReservation(reservation)">
                      <span class="fee">₱{{reservation.totalFee}}</span>
                      <span class="weather" *ngIf="reservation.weatherForecast">
                        <mat-icon class="weather-icon">{{getWeatherIcon(reservation.weatherForecast.icon)}}</mat-icon>
                        {{reservation.weatherForecast.temperature}}°C
                        <span class="humidity-desktop" *ngIf="reservation.weatherForecast.humidity !== undefined">
                          {{reservation.weatherForecast.humidity}}% humidity
                        </span>
                        <span class="rain-chance" *ngIf="reservation.weatherForecast.rainChance !== undefined">
                          {{reservation.weatherForecast.rainChance}}% rain
                        </span>
                      </span>
                    </div>
                    <div class="fee-weather" *ngIf="isBlockedReservation(reservation)">
                      <!-- No fee for blocked, only weather -->
                      <span class="weather" *ngIf="reservation.weatherForecast">
                        <mat-icon class="weather-icon">{{getWeatherIcon(reservation.weatherForecast.icon)}}</mat-icon>
                        {{reservation.weatherForecast.temperature}}°C
                        <span class="rain-chance" *ngIf="reservation.weatherForecast.rainChance !== undefined">
                          {{reservation.weatherForecast.rainChance}}% rain
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </mat-tab>
          
          <!-- Upcoming Reservations -->
          <mat-tab [label]="getTabLabel('upcoming')" [disabled]="loading">
            <div class="tab-content">
              <div *ngIf="loading" class="loading-container">
                <mat-spinner diameter="50"></mat-spinner>
                <p>Loading your reservations...</p>
              </div>

              <div *ngIf="!loading && upcomingReservations.length === 0" class="no-reservations">
                <mat-icon class="large-icon">event_busy</mat-icon>
                <h2>No Upcoming Reservations</h2>
                <p>You don't have any upcoming court reservations.</p>
                <button mat-raised-button color="primary" (click)="createNewReservation()">
                  <mat-icon>add</mat-icon>
                  Book Your First Court
                </button>
              </div>

              <!-- Mobile View: New Design -->
              <div *ngIf="!loading && upcomingReservations.length > 0 && isMobileView" class="reservations-list mobile-schedule">
                <div *ngFor="let group of groupedUpcomingReservations" class="date-group">
                  <!-- Sticky Date Header -->
                  <div class="date-header">{{group.date}}</div>

                  <!-- Reservation Cards for this Date -->
                  <div *ngFor="let reservation of group.reservations"
                       class="mobile-event-card"
                       [class.expanded]="isExpanded(reservation._id)">

                    <!-- Action Buttons (Floating Top Right) -->
                    <div class="action-buttons-mobile">
                      <button mat-icon-button class="action-btn edit-btn"
                              (click)="editReservation(reservation); $event.stopPropagation()"
                              [disabled]="!canEdit(reservation)"
                              matTooltip="Edit">
                        <mat-icon>edit</mat-icon>
                      </button>
                      <button mat-icon-button class="action-btn cancel-btn"
                              (click)="cancelReservation(reservation); $event.stopPropagation()"
                              [disabled]="!canCancel(reservation)"
                              matTooltip="Cancel">
                        <mat-icon>cancel</mat-icon>
                      </button>
                    </div>

                    <!-- Clickable area for expansion -->
                    <div (click)="toggleExpansion(reservation._id)">
                      <!-- Time Range -->
                      <h2 class="event-time">{{reservation.timeSlotDisplay}}</h2>

                      <!-- Participants with Avatars -->
                      <div class="participants-section">
                        <div *ngFor="let playerName of getAllPlayers(reservation)" class="participant-row">
                          <div class="avatar" [style.background-color]="getAvatarColor(playerName)">
                            {{getInitials(playerName)}}
                          </div>
                          <span class="participant-name">{{playerName}}</span>
                        </div>
                      </div>

                      <!-- Weather Info -->
                      <div class="weather-row" *ngIf="reservation.weatherForecast">
                        <mat-icon class="weather-icon">{{getWeatherIcon(reservation.weatherForecast.icon)}}</mat-icon>
                        <span class="temp">{{reservation.weatherForecast.temperature}}°C</span>
                        <span class="humidity" *ngIf="reservation.weatherForecast.humidity">
                          Humidity: {{reservation.weatherForecast.humidity}}%
                        </span>
                        <span class="rain-chance-mobile" *ngIf="reservation.weatherForecast.rainChance !== undefined">
                          Rain: {{reservation.weatherForecast.rainChance}}%
                        </span>
                      </div>

                      <!-- Fee Badge (Floating) -->
                      <div class="fee-badge" [style.background-color]="getFeeColor(reservation.totalFee)">
                        ₱{{reservation.totalFee}}
                      </div>

                      <!-- Expanded Content -->
                      <div class="expanded-content" *ngIf="isExpanded(reservation._id)">
                        <mat-divider></mat-divider>

                        <div class="expanded-details">
                          <div class="detail-row">
                            <mat-icon class="detail-icon">event</mat-icon>
                            <span class="detail-label">Status:</span>
                            <mat-chip class="status-chip" [ngClass]="'status-' + reservation.status">
                              {{reservation.status | titlecase}}
                            </mat-chip>
                          </div>

                          <div class="detail-row">
                            <mat-icon class="detail-icon">payment</mat-icon>
                            <span class="detail-label">Payment:</span>
                            <mat-chip class="payment-chip" [ngClass]="'payment-' + reservation.paymentStatus">
                              {{getPaymentStatusText(reservation.paymentStatus)}}
                            </mat-chip>
                          </div>

                          <div class="detail-row">
                            <mat-icon class="detail-icon">payments</mat-icon>
                            <span class="detail-label">Fee per player:</span>
                            <span class="detail-value">₱{{(reservation.totalFee / getAllPlayers(reservation).length) | number:'1.0-0'}}</span>
                          </div>

                          <div class="detail-row" *ngIf="reservation.tennisBalls && reservation.tennisBalls.quantity > 0">
                            <mat-icon class="detail-icon">sports_tennis</mat-icon>
                            <span class="detail-label">Tennis balls:</span>
                            <span class="detail-value">{{reservation.tennisBalls.quantity}} {{ reservation.tennisBalls.quantity === 1 ? 'can' : 'cans' }} @ ₱{{reservation.tennisBalls.costPerCan}} = ₱{{reservation.tennisBalls.totalCost}}</span>
                          </div>
                        </div>
                      </div>

                      <!-- Expand Indicator -->
                      <mat-icon class="expand-icon" *ngIf="!isExpanded(reservation._id)">expand_more</mat-icon>
                      <mat-icon class="expand-icon" *ngIf="isExpanded(reservation._id)">expand_less</mat-icon>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Desktop View: Original Design -->
              <div *ngIf="!loading && upcomingReservations.length > 0 && !isMobileView" class="reservations-list">
                <div *ngFor="let reservation of upcomingReservations" class="reservation-card-compact">
                  <!-- Mobile Action Buttons (Upper Right Corner) -->
                  <div class="card-actions-mobile" *ngIf="isMobileView">
                    <button mat-icon-button class="action-btn edit-btn"
                            (click)="editReservation(reservation)"
                            [disabled]="!canEdit(reservation)"
                            matTooltip="Edit">
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button mat-icon-button class="action-btn cancel-btn"
                            (click)="cancelReservation(reservation)"
                            [disabled]="!canCancel(reservation)"
                            matTooltip="Cancel">
                      <mat-icon>cancel</mat-icon>
                    </button>
                  </div>

                  <div class="card-left">
                    <div class="date-badge">
                      <span class="date-day">{{getDay(reservation.date)}}</span>
                      <span class="date-info">{{getShortDate(reservation.date)}}</span>
                    </div>
                    <div class="reservation-main">
                      <div class="time-slot">{{reservation.timeSlotDisplay}}</div>
                      <div class="players-info">
                        <mat-icon class="inline-icon">people</mat-icon>
                        <span class="players-text">{{formatPlayerNames(reservation.players)}}</span>
                      </div>
                    </div>
                  </div>
                  <div class="card-right">
                    <div class="status-chips">
                      <mat-chip *ngIf="reservation.status !== 'pending'" class="status-chip" [ngClass]="'status-' + reservation.status">
                        {{reservation.status | titlecase}}
                      </mat-chip>
                      <mat-chip class="payment-chip" [ngClass]="'payment-' + reservation.paymentStatus">
                        {{getPaymentStatusText(reservation.paymentStatus)}}
                      </mat-chip>
                    </div>
                    <div class="fee-weather">
                      <span class="fee">₱{{reservation.totalFee}}</span>
                      <span class="weather" *ngIf="reservation.weatherForecast">
                        <mat-icon class="weather-icon">{{getWeatherIcon(reservation.weatherForecast.icon)}}</mat-icon>
                        {{reservation.weatherForecast.temperature}}°C
                        <span class="rain-chance" *ngIf="reservation.weatherForecast.rainChance !== undefined">
                          {{reservation.weatherForecast.rainChance}}%
                        </span>
                      </span>
                    </div>
                    <!-- Desktop Action Buttons (Bottom Right) -->
                    <div class="card-actions" *ngIf="!isMobileView">
                      <button mat-icon-button class="action-btn edit-btn"
                              (click)="editReservation(reservation)"
                              [disabled]="!canEdit(reservation)"
                              matTooltip="Edit">
                        <mat-icon>edit</mat-icon>
                      </button>
                      <button mat-icon-button class="action-btn cancel-btn"
                              (click)="cancelReservation(reservation)"
                              [disabled]="!canCancel(reservation)"
                              matTooltip="Cancel">
                        <mat-icon>cancel</mat-icon>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </mat-tab>
          
          <!-- Past Reservations -->
          <mat-tab [label]="getTabLabel('history')" [disabled]="loading">
            <div class="tab-content">
              <div *ngIf="loading" class="loading-container">
                <mat-spinner diameter="50"></mat-spinner>
                <p>Loading reservation history...</p>
              </div>

              <div *ngIf="!loading && pastReservations.length === 0" class="no-reservations">
                <mat-icon class="large-icon">history</mat-icon>
                <h2>No Past Reservations</h2>
                <p>Your reservation history will appear here.</p>
              </div>

              <!-- Mobile View: New Design -->
              <div *ngIf="!loading && pastReservations.length > 0 && isMobileView" class="reservations-list mobile-schedule">
                <div *ngFor="let group of groupedPastReservations" class="date-group">
                  <!-- Sticky Date Header -->
                  <div class="date-header past-header">{{group.date}}</div>

                  <!-- Reservation Cards for this Date -->
                  <div *ngFor="let reservation of group.reservations"
                       class="mobile-event-card past-card"
                       [class.expanded]="isExpanded(reservation._id)"
                       (click)="toggleExpansion(reservation._id)">

                    <!-- Time Range -->
                    <h2 class="event-time">{{reservation.timeSlotDisplay}}</h2>

                    <!-- Participants with Avatars -->
                    <div class="participants-section">
                      <div *ngFor="let playerName of getAllPlayers(reservation)" class="participant-row">
                        <div class="avatar" [style.background-color]="getAvatarColor(playerName)">
                          {{getInitials(playerName)}}
                        </div>
                        <span class="participant-name">{{playerName}}</span>
                      </div>
                    </div>

                    <!-- Weather Info (if available) -->
                    <div class="weather-row" *ngIf="reservation.weatherForecast">
                      <mat-icon class="weather-icon">{{getWeatherIcon(reservation.weatherForecast.icon)}}</mat-icon>
                      <span class="temp">{{reservation.weatherForecast.temperature}}°C</span>
                      <span class="humidity" *ngIf="reservation.weatherForecast.humidity">
                        Humidity: {{reservation.weatherForecast.humidity}}%
                      </span>
                      <span class="rain-chance-mobile" *ngIf="reservation.weatherForecast.rainChance !== undefined">
                        Rain: {{reservation.weatherForecast.rainChance}}%
                      </span>
                    </div>

                    <!-- Fee Badge (Floating) -->
                    <div class="fee-badge past-badge" [style.background-color]="getFeeColor(reservation.totalFee)">
                      ₱{{reservation.totalFee}}
                    </div>

                    <!-- Expanded Content -->
                    <div class="expanded-content" *ngIf="isExpanded(reservation._id)">
                      <mat-divider></mat-divider>

                      <div class="expanded-details">
                        <div class="detail-row">
                          <mat-icon class="detail-icon">event</mat-icon>
                          <span class="detail-label">Status:</span>
                          <mat-chip class="status-chip" [ngClass]="'status-' + reservation.status">
                            {{reservation.status | titlecase}}
                          </mat-chip>
                        </div>

                        <div class="detail-row">
                          <mat-icon class="detail-icon">payments</mat-icon>
                          <span class="detail-label">Fee per player:</span>
                          <span class="detail-value">₱{{(reservation.totalFee / getAllPlayers(reservation).length) | number:'1.0-0'}}</span>
                        </div>

                        <div class="detail-row" *ngIf="reservation.tennisBalls && reservation.tennisBalls.quantity > 0">
                          <mat-icon class="detail-icon">sports_tennis</mat-icon>
                          <span class="detail-label">Tennis balls:</span>
                          <span class="detail-value">{{reservation.tennisBalls.quantity}} {{ reservation.tennisBalls.quantity === 1 ? 'can' : 'cans' }} @ ₱{{reservation.tennisBalls.costPerCan}} = ₱{{reservation.tennisBalls.totalCost}}</span>
                        </div>

                        <div class="detail-row">
                          <mat-icon class="detail-icon">calendar_today</mat-icon>
                          <span class="detail-label">Date:</span>
                          <span class="detail-value">{{reservation.date | date:'fullDate'}}</span>
                        </div>
                      </div>
                    </div>

                    <!-- Expand Indicator -->
                    <mat-icon class="expand-icon" *ngIf="!isExpanded(reservation._id)">expand_more</mat-icon>
                    <mat-icon class="expand-icon" *ngIf="isExpanded(reservation._id)">expand_less</mat-icon>
                  </div>
                </div>
              </div>

              <!-- Desktop View: Original Design -->
              <div *ngIf="!loading && pastReservations.length > 0 && !isMobileView" class="reservations-list">
                <div *ngFor="let reservation of pastReservations" class="reservation-card-compact past">
                  <div class="card-left">
                    <div class="date-badge past">
                      <span class="date-day">{{getDay(reservation.date)}}</span>
                      <span class="date-info">{{getShortDate(reservation.date)}}</span>
                    </div>
                    <div class="reservation-main">
                      <div class="time-slot">{{reservation.timeSlotDisplay}}</div>
                      <div class="players-info">
                        <mat-icon class="inline-icon">people</mat-icon>
                        <span class="players-text">{{formatPlayerNames(reservation.players)}}</span>
                      </div>
                    </div>
                  </div>
                  <div class="card-right">
                    <div class="status-chips">
                      <mat-chip *ngIf="reservation.status !== 'pending'" class="status-chip" [ngClass]="'status-' + reservation.status">
                        {{reservation.status | titlecase}}
                      </mat-chip>
                    </div>
                    <div class="fee-weather">
                      <span class="fee">₱{{reservation.totalFee}}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </mat-tab>

          <!-- Admin Report Tab (Superadmin Only) -->
          <mat-tab *ngIf="isSuperAdmin()" [label]="isMobileView ? 'Admin' : 'Admin Report'" [disabled]="loading">
            <div class="tab-content">
              <!-- Summary Statistics Card -->
              <div class="admin-stats-card" *ngIf="!loading && sortedAdminReservations.length > 0">
                <h3>
                  <mat-icon>analytics</mat-icon>
                  Report Summary
                </h3>
                <div class="stats-grid">
                  <div class="stat-item">
                    <span class="stat-label">Total Reservations</span>
                    <span class="stat-value">{{adminStats.total}}</span>
                  </div>
                  <div class="stat-item status-pending">
                    <span class="stat-label">Pending</span>
                    <span class="stat-value">{{adminStats.pending}}</span>
                  </div>
                  <div class="stat-item status-confirmed">
                    <span class="stat-label">Confirmed</span>
                    <span class="stat-value">{{adminStats.confirmed}}</span>
                  </div>
                  <div class="stat-item status-cancelled">
                    <span class="stat-label">Cancelled</span>
                    <span class="stat-value">{{adminStats.cancelled}}</span>
                  </div>
                  <div class="stat-item status-completed">
                    <span class="stat-label">Completed</span>
                    <span class="stat-value">{{adminStats.completed}}</span>
                  </div>
                  <div class="stat-item status-no-show">
                    <span class="stat-label">No-Show</span>
                    <span class="stat-value">{{adminStats.noShow}}</span>
                  </div>
                  <div class="stat-item revenue-total">
                    <span class="stat-label">Total Revenue</span>
                    <span class="stat-value">₱{{adminStats.totalRevenue}}</span>
                  </div>
                  <div class="stat-item revenue-paid">
                    <span class="stat-label">Paid Revenue</span>
                    <span class="stat-value">₱{{adminStats.paidRevenue}}</span>
                  </div>
                  <div class="stat-item revenue-pending">
                    <span class="stat-label">Pending Revenue</span>
                    <span class="stat-value">₱{{adminStats.pendingRevenue}}</span>
                  </div>
                </div>
              </div>

              <div *ngIf="loading" class="loading-container">
                <mat-spinner diameter="50"></mat-spinner>
                <p>Loading admin report...</p>
              </div>

              <div *ngIf="!loading && sortedAdminReservations.length === 0" class="no-reservations">
                <mat-icon class="large-icon">assessment</mat-icon>
                <h2>No Reservations Data</h2>
                <p>No court reservations found in the system.</p>
              </div>

              <!-- Nested tabs for Admin Report -->
              <mat-tab-group *ngIf="!loading && sortedAdminReservations.length > 0" class="admin-sub-tabs modern-compact-tabs">
                <!-- Pending Items Tab -->
                <mat-tab label="Pending Items ({{pendingAdminReservations.length}})">
                  <div class="tab-content">
                    <div *ngIf="pendingAdminReservations.length === 0" class="no-reservations">
                      <mat-icon class="large-icon">check_circle</mat-icon>
                      <h2>All Clear!</h2>
                      <p>No pending items or pending payments.</p>
                    </div>

                    <div *ngIf="pendingAdminReservations.length > 0" class="reservations-list">
                      <div *ngFor="let reservation of pendingAdminReservations"
                           class="reservation-card-compact admin-report"
                           [class.cancelled-reservation]="reservation.status === 'cancelled'"
                           [class.completed-reservation]="reservation.status === 'completed'"
                           [style.border-left-color]="getWeatherBorderColor(reservation)">
                        <div class="card-left">
                          <div class="date-badge"
                               [ngClass]="{
                                 'past': isPastReservation(reservation.date),
                                 'cancelled': reservation.status === 'cancelled'
                               }">
                            <span class="date-day">{{getDay(reservation.date)}}</span>
                            <span class="date-info">{{getShortDate(reservation.date)}}</span>
                          </div>
                          <div class="reservation-main show-user-info">
                            <div class="time-slot">{{reservation.timeSlotDisplay}}</div>
                            <div class="user-info" *ngIf="reservation.userId">
                              <mat-icon class="inline-icon">person</mat-icon>
                              <span class="user-text">{{reservation.userId.fullName}}</span>
                            </div>
                            <div class="players-info">
                              <mat-icon class="inline-icon">people</mat-icon>
                              <span class="players-text">{{formatPlayerNames(getFilteredPlayers(reservation))}}</span>
                            </div>
                          </div>
                        </div>
                        <div class="card-right">
                          <div class="status-chips">
                            <mat-chip class="status-chip" [ngClass]="'status-' + reservation.status">
                              {{reservation.status | titlecase}}
                            </mat-chip>
                            <mat-chip class="payment-chip" [ngClass]="'payment-' + reservation.paymentStatus">
                              {{getPaymentStatusText(reservation.paymentStatus)}}
                            </mat-chip>
                          </div>
                          <div class="fee-weather">
                            <span class="fee">₱{{reservation.totalFee}}</span>
                            <span class="weather" *ngIf="reservation.weatherForecast">
                              <mat-icon class="weather-icon">{{getWeatherIcon(reservation.weatherForecast.icon)}}</mat-icon>
                              {{reservation.weatherForecast.temperature}}°C
                              <span class="rain-chance" *ngIf="reservation.weatherForecast.rainChance !== undefined">
                                {{reservation.weatherForecast.rainChance}}%
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </mat-tab>

                <!-- Other Items Tab -->
                <mat-tab label="Other Items ({{otherAdminReservations.length}})">
                  <div class="tab-content">
                    <div *ngIf="otherAdminReservations.length === 0" class="no-reservations">
                      <mat-icon class="large-icon">inbox</mat-icon>
                      <h2>No Other Items</h2>
                      <p>No confirmed, cancelled, completed, or no-show reservations.</p>
                    </div>

                    <div *ngIf="otherAdminReservations.length > 0" class="reservations-list">
                      <div *ngFor="let reservation of otherAdminReservations"
                           class="reservation-card-compact admin-report"
                           [class.cancelled-reservation]="reservation.status === 'cancelled'"
                           [class.completed-reservation]="reservation.status === 'completed'"
                           [style.border-left-color]="getWeatherBorderColor(reservation)">
                        <div class="card-left">
                          <div class="date-badge"
                               [ngClass]="{
                                 'past': isPastReservation(reservation.date),
                                 'cancelled': reservation.status === 'cancelled'
                               }">
                            <span class="date-day">{{getDay(reservation.date)}}</span>
                            <span class="date-info">{{getShortDate(reservation.date)}}</span>
                          </div>
                          <div class="reservation-main show-user-info">
                            <div class="time-slot">{{reservation.timeSlotDisplay}}</div>
                            <div class="user-info" *ngIf="reservation.userId">
                              <mat-icon class="inline-icon">person</mat-icon>
                              <span class="user-text">{{reservation.userId.fullName}}</span>
                            </div>
                            <div class="players-info">
                              <mat-icon class="inline-icon">people</mat-icon>
                              <span class="players-text">{{formatPlayerNames(getFilteredPlayers(reservation))}}</span>
                            </div>
                          </div>
                        </div>
                        <div class="card-right">
                          <div class="status-chips">
                            <mat-chip class="status-chip" [ngClass]="'status-' + reservation.status">
                              {{reservation.status | titlecase}}
                            </mat-chip>
                            <mat-chip class="payment-chip" [ngClass]="'payment-' + reservation.paymentStatus">
                              {{getPaymentStatusText(reservation.paymentStatus)}}
                            </mat-chip>
                          </div>
                          <div class="fee-weather">
                            <span class="fee">₱{{reservation.totalFee}}</span>
                            <span class="weather" *ngIf="reservation.weatherForecast">
                              <mat-icon class="weather-icon">{{getWeatherIcon(reservation.weatherForecast.icon)}}</mat-icon>
                              {{reservation.weatherForecast.temperature}}°C
                              <span class="rain-chance" *ngIf="reservation.weatherForecast.rainChance !== undefined">
                                {{reservation.weatherForecast.rainChance}}%
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </mat-tab>
              </mat-tab-group>
            </div>
          </mat-tab>
        </mat-tab-group>
        </div>
      </div>
    </div>

    <!-- Cancel Confirmation Modal -->
    <div class="modal-overlay" *ngIf="showCancelModal" (click)="closeCancelModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>Cancel Reservation</h2>
          <button class="modal-close" (click)="closeCancelModal()">×</button>
        </div>
        <div class="modal-body">
          <div class="warning-icon">⚠️</div>
          <p>Are you sure you want to cancel this reservation?</p>
          <div class="reservation-details" *ngIf="reservationToCancel">
            <strong>Date:</strong> {{reservationToCancel.date | date:'fullDate'}}<br>
            <strong>Time:</strong> {{reservationToCancel.timeSlotDisplay}}<br>
            <strong>Players:</strong> {{formatPlayerNames(reservationToCancel.players)}}
          </div>
          <div class="fee-warning" *ngIf="isLateCancellation(reservationToCancel)"
               style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:12px;margin:12px 0;color:#856404;">
            <strong>⚠️ Late Cancellation Fee</strong><br>
            This reservation starts in less than 12 hours. A <strong>₱100 cancellation fee</strong>
            will be added to your pending payments.
          </div>
          <p class="warning-text">This action cannot be undone.</p>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" (click)="closeCancelModal()">
            Keep Reservation
          </button>
          <button class="btn-danger" (click)="confirmCancelReservation()">
            Yes, Cancel Reservation
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrl: './my-reservations.component.scss'
})
export class MyReservationsComponent implements OnInit, OnDestroy {
  upcomingReservations: Reservation[] = [];
  pastReservations: Reservation[] = [];
  allReservations: Reservation[] = [];
  adminReservations: Reservation[] = [];
  sortedAdminReservations: Reservation[] = [];
  pendingAdminReservations: Reservation[] = [];
  otherAdminReservations: Reservation[] = [];
  loading = true;
  currentTab = 0;

  // Mobile All tab - grouped reservations
  groupedAllReservations: GroupedReservations[] = [];
  groupedUpcomingReservations: GroupedReservations[] = [];
  groupedPastReservations: GroupedReservations[] = [];
  expandedReservations = new Set<string>(); // Track which cards are expanded

  // Member filter for All Reservations tab
  memberFilterId: string = '';
  memberFilterOptions: { id: string; name: string }[] = [];

  // Admin statistics
  adminStats = {
    total: 0,
    pending: 0,
    confirmed: 0,
    cancelled: 0,
    completed: 0,
    noShow: 0,
    totalRevenue: 0,
    paidRevenue: 0,
    pendingRevenue: 0
  };
  
  // Responsive tab labels for modern compact design
  isMobileView = false;
  
  // Cancel modal state
  showCancelModal = false;
  reservationToCancel: Reservation | null = null;
  
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    console.log('🚀 MyReservationsComponent ngOnInit called');
    console.log('🚀 User authenticated:', this.authService.isAuthenticated());
    console.log('🚀 Current user:', this.authService.currentUser);
    
    // Initialize responsive tab detection
    this.checkScreenSize();
    
    // Test backend connectivity first
    this.testBackendConnectivity();
  }

  ngOnDestroy(): void {
    // Cleanup any subscriptions if needed
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.checkScreenSize();
  }

  private checkScreenSize(): void {
    this.isMobileView = window.innerWidth <= 768;
  }

  /**
   * Generate initials from a full name
   */
  getInitials(name: string): string {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /**
   * Generate consistent color for a name using simple hash
   */
  getAvatarColor(name: string): string {
    const colors = [
      '#5B7FE6', // Blue
      '#8B5CF6', // Purple
      '#10B981', // Green
      '#F59E0B', // Orange
      '#EC4899', // Pink
      '#3B82F6', // Light blue
      '#14B8A6', // Teal
      '#EF4444'  // Red
    ];

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
  }

  /**
   * Get avatar info for a player
   */
  getAvatarInfo(name: string): AvatarInfo {
    return {
      initials: this.getInitials(name),
      color: this.getAvatarColor(name)
    };
  }

  /**
   * Group reservations by date for mobile All tab
   */
  groupReservationsByDate(reservations: Reservation[]): GroupedReservations[] {
    const grouped = new Map<string, Reservation[]>();

    reservations.forEach(reservation => {
      const dateKey = new Date(reservation.date).toDateString();
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(reservation);
    });

    // Convert to array and format dates
    const result: GroupedReservations[] = [];
    grouped.forEach((reservations, dateKey) => {
      const date = new Date(dateKey);
      const formattedDate = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });

      result.push({
        date: formattedDate,
        dateKey: dateKey,
        reservations: reservations.sort((a, b) => a.timeSlot - b.timeSlot)
      });
    });

    // Sort by date
    return result.sort((a, b) =>
      new Date(a.dateKey).getTime() - new Date(b.dateKey).getTime()
    );
  }

  /**
   * Toggle card expansion
   */
  toggleExpansion(reservationId: string): void {
    if (this.expandedReservations.has(reservationId)) {
      this.expandedReservations.delete(reservationId);
    } else {
      this.expandedReservations.add(reservationId);
    }
  }

  /**
   * Check if a card is expanded
   */
  isExpanded(reservationId: string): boolean {
    return this.expandedReservations.has(reservationId);
  }

  /**
   * Get all unique players including reserver
   */
  getAllPlayers(reservation: Reservation): string[] {
    const players: string[] = [];

    // Add reserver
    if (reservation.userId?.fullName) {
      players.push(reservation.userId.fullName);
    }

    // Add other players
    reservation.players.forEach((player: any) => {
      const name = typeof player === 'string' ? player : player.name;
      if (!players.includes(name)) {
        players.push(name);
      }
    });

    return players;
  }

  /**
   * Get color for fee badge
   */
  getFeeColor(fee: number): string {
    if (fee >= 150) return '#059669'; // Dark green
    if (fee >= 120) return '#10B981'; // Green
    return '#10B981'; // Default green
  }

  /**
   * Get responsive tab labels based on screen size
   */
  getTabLabel(tabType: 'upcoming' | 'history' | 'all'): string {
    const labels = {
      upcoming: this.isMobileView ? 'Up' : 'Upcoming',
      history: this.isMobileView ? 'Past' : 'History',
      all: this.isMobileView ? 'All' : 'All Reservations'
    };
    return labels[tabType];
  }

  private testBackendConnectivity(): void {
    console.log('🔌 Testing backend connectivity...');
    
    // Try /health endpoint first (without /api prefix)
    this.http.get<any>('${environment.apiBaseUrl}/health')
      .pipe(
        timeout(5000),
        catchError(error => {
          console.warn('⚠️ /health endpoint failed, trying /api/health:', error);
          // Fallback to /api/health endpoint
          return this.http.get<any>(`${this.apiUrl}/health`).pipe(
            timeout(5000),
            catchError(apiError => {
              console.error('❌ Both health endpoints failed');
              console.error('- /health error:', error);
              console.error('- /api/health error:', apiError);
              throw apiError;
            })
          );
        })
      )
      .subscribe({
        next: (response) => {
          console.log('✅ Backend health check passed:', response);
          // Backend is running, proceed to load reservations
          this.loadReservations();
        },
        error: (error) => {
          console.error('❌ Backend connectivity test failed:', error);
          this.handleBackendConnectivityError();
        }
      });
  }

  private handleBackendConnectivityError(): void {
    this.loading = false;
    
    // Show a comprehensive error message with clear instructions
    this.snackBar.open(
      'Backend server connection failed. Please start the backend server first.',
      'Show Instructions',
      {
        duration: 0, // Don't auto-dismiss
        panelClass: ['error-snackbar']
      }
    ).onAction().subscribe(() => {
      // User clicked "Show Instructions" - display detailed startup guide
      this.showBackendStartupInstructions();
    });
    
    // Show empty state immediately so page is usable
    this.upcomingReservations = [];
    this.pastReservations = [];
    this.allReservations = [];
    
    console.log('🚨 BACKEND CONNECTION FAILED - TROUBLESHOOTING GUIDE:');
    console.log('');
    console.log('📋 STEP 1: Open a new terminal');
    console.log('📋 STEP 2: Navigate to backend directory: cd backend');
    console.log('📋 STEP 3: Start the server: npm run dev');
    console.log('📋 STEP 4: Wait for "🚀 Rich Town 2 Tennis Club Backend running on port 3000"');
    console.log('📋 STEP 5: Refresh this page');
    console.log('');
    console.log('💡 Alternative: Run "./start-backend.sh" from project root');
    console.log('');
    console.log('🔍 If still having issues:');
    console.log('   • Check port 3000 is not in use: lsof -i :3000');
    console.log('   • Verify MongoDB connection in backend logs');
    console.log('   • Ensure .env file exists in backend folder');
  }

  private showBackendStartupInstructions(): void {
    const instructions = `
BACKEND SERVER STARTUP GUIDE

📋 Quick Start:
1. Open a new terminal window
2. Navigate to backend: cd backend  
3. Start server: npm run dev
4. Wait for success message
5. Refresh this page

💡 Alternative Method:
Run: ./start-backend.sh

🔍 Troubleshooting:
• Port conflict: lsof -i :3000
• MongoDB issues: Check backend logs
• Missing config: Verify .env file exists

Once you see "🚀 Rich Town 2 Tennis Club Backend running on port 3000", 
click "Try Again" below to reconnect.
    `;
    
    console.log(instructions);
    
    // Provide try again option
    this.snackBar.open(
      'Ready to test connection again?',
      'Try Again',
      {
        duration: 0,
        panelClass: ['info-snackbar']
      }
    ).onAction().subscribe(() => {
      this.loading = true;
      this.testBackendConnectivity();
    });
  }

  loadReservations(): void {
    console.log('📡 Starting loadReservations...');
    this.loading = true;
    
    console.log('📡 Making HTTP request to:', `${this.apiUrl}/reservations/my-upcoming`);
    console.log('📡 Auth token available:', !!this.authService.token);
    
    this.http.get<any>(`${this.apiUrl}/reservations/my-upcoming`)
      .pipe(
        timeout(10000), // 10 second timeout
        catchError(error => {
          console.error('❌ HTTP request timed out or failed:', error);
          throw error;
        })
      )
      .subscribe({
      next: (response) => {
        console.log('✅ HTTP request successful, processing response...');
        console.log('🔍 MY-UPCOMING Response received:', response);
        const reservations = response.data || response;
        console.log('🔍 Parsed reservations:', reservations.length);
        console.log('🔍 Raw reservations data:', reservations.map((r: any) => ({
          id: r._id,
          date: r.date,
          timeSlot: r.timeSlot,
          status: r.status,
          players: r.players
        })));
        
        const now = new Date();
        console.log('🔍 Current time for filtering:', now);
        
        // Group and process reservations to handle time ranges
        // Consider time slots: if it's today but future time slot, it's still upcoming
        const upcomingRaw = reservations.filter((r: any) => {
          const reservationDate = new Date(r.date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          reservationDate.setHours(0, 0, 0, 0);
          
          // If future date, it's upcoming
          if (reservationDate > today) {
            return true;
          }
          
          // If today, check if the time slot hasn't passed yet
          if (reservationDate.getTime() === today.getTime()) {
            const currentHour = now.getHours();
            console.log(`🔍 Today reservation: timeSlot ${r.timeSlot} vs currentHour ${currentHour} = ${r.timeSlot > currentHour ? 'UPCOMING' : 'PAST'}`);
            return r.timeSlot > currentHour;
          }
          
          // Past date
          return false;
        });
        
        const pastRaw = reservations.filter((r: any) => {
          const reservationDate = new Date(r.date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          reservationDate.setHours(0, 0, 0, 0);
          
          // If past date, it's past
          if (reservationDate < today) {
            return true;
          }
          
          // If today, check if the time slot has already passed
          if (reservationDate.getTime() === today.getTime()) {
            const currentHour = now.getHours();
            return r.timeSlot <= currentHour;
          }
          
          // Future date
          return false;
        });
        
        console.log('🔍 Before formatting - Upcoming:', upcomingRaw.length, 'Past:', pastRaw.length);

        this.upcomingReservations = this.formatReservationTimeDisplay(upcomingRaw);
        this.pastReservations = this.formatReservationTimeDisplay(pastRaw);

        // Ensure all time displays use AM/PM format
        this.convertToAMPMFormat(this.upcomingReservations);
        this.convertToAMPMFormat(this.pastReservations);

        // Group reservations by date for mobile view
        this.groupedUpcomingReservations = this.groupReservationsByDate(this.upcomingReservations);
        this.groupedPastReservations = this.groupReservationsByDate(this.pastReservations);

        console.log('📊 Personal Reservations loaded:');
        console.log('- Upcoming:', this.upcomingReservations.length);
        console.log('- Past:', this.pastReservations.length);
        console.log('- Weather data from backend:', this.upcomingReservations.filter(r => r.weatherForecast).length, 'reservations');

        // Don't set loading = false yet, keep it true until all initial data loads
        // This prevents "No Reservations Found" from flashing before data loads

        // Load all reservations since it's now the first tab (without showing loading again)
        this.loadAllReservations(false);

        // Also load admin reservations if user is admin
        const user = this.authService.currentUser;
        if (user?.role === 'admin' || user?.role === 'superadmin') {
          console.log('✅ Admin user detected, loading admin reservations on init');
          this.loadAdminReservations(false);
        } else {
          // If not admin, set loading to false after all reservations load
          // Admin loading will be handled by loadAdminReservations completion
          this.loading = false;
        }
      },
      error: (error) => {
        console.error('❌ HTTP request failed:', error);
        console.error('❌ Error status:', error.status);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error details:', error.error);
        
        this.loading = false;
        
        let errorMessage = 'Failed to load reservations';
        if (error.status === 401) {
          errorMessage = 'Authentication required. Please log in again.';
        } else if (error.status === 403) {
          errorMessage = 'Access denied. Please check your permissions.';
        } else if (error.status === 0) {
          errorMessage = 'Cannot connect to server. Please check your internet connection.';
        }
        
        this.snackBar.open(errorMessage, 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  onTabChange(event: any): void {
    this.currentTab = event.index;
    console.log('🔄 Tab changed to index:', event.index);

    // Load all reservations when switching to "All Reservations" tab (index 0)
    if (event.index === 0) {
      console.log('📋 Loading All Reservations tab');
      this.loadAllReservations();
    }

    // Load admin report when switching to "Admin Report" tab (index 3)
    if (event.index === 3) {
      console.log('📋 Loading Admin Report tab');
      this.loadAdminReservations(true);
    }
  }

  private matchesMemberFilter(r: Reservation): boolean {
    if (r.userId?.fullName === this.memberFilterId) return true;
    return (r.players || []).some((p: any) => {
      const name = typeof p === 'string' ? p : p.name;
      return name === this.memberFilterId;
    });
  }

  get filteredAllReservations(): Reservation[] {
    if (!this.memberFilterId) return this.allReservations;
    return this.allReservations.filter(r => this.matchesMemberFilter(r));
  }

  get filteredGroupedAllReservations(): GroupedReservations[] {
    if (!this.memberFilterId) return this.groupedAllReservations;
    return this.groupReservationsByDate(
      this.allReservations.filter(r => this.matchesMemberFilter(r))
    );
  }

  loadAllReservations(showLoading: boolean = true): void {
    console.log('Loading all reservations from all users...');
    if (showLoading) {
      this.loading = true;
    }

    // Use the general reservations endpoint with showAll=true to get all reservations
    // Set high limit to fetch all reservations (default is 10)
    const timestamp = new Date().getTime();
    this.http.get<any>(`${this.apiUrl}/reservations?showAll=true&limit=1000&_t=${timestamp}`).subscribe({
      next: (response) => {
        const reservations = response.data || [];
        console.log('🔍 Raw reservations received:', reservations.length);
        console.log('🔍 Sample reservation users:', reservations.slice(0, 3).map((r: any) => ({ 
          id: r._id, 
          user: r.userId?.fullName || 'No user', 
          status: r.status,
          date: r.date,
          players: r.players 
        })));
        
        // Filter out cancelled reservations and past date/time reservations
        const now = new Date();
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to start of today
        
        const activeReservations = reservations.filter((r: any) => {
          if (r.status === 'cancelled') return false;
          
          const reservationDate = new Date(r.date);
          reservationDate.setHours(0, 0, 0, 0);
          
          // Future dates: include
          if (reservationDate > today) return true;
          
          // Past dates: exclude
          if (reservationDate < today) return false;
          
          // Today: check if reservation end time hasn't passed yet
          if (reservationDate.getTime() === today.getTime()) {
            const currentHour = now.getHours();
            const endHour = r.endTimeSlot || (r.timeSlot + (r.duration || 1));
            return endHour > currentHour; // Show until entire reservation time is over
          }
          
          return false;
        });
        console.log('🔍 Active reservations before formatting:', activeReservations.length);
        console.log('🔍 Active reservations details:', activeReservations.map(r => ({
          id: r._id,
          user: r.userId?.fullName,
          date: r.date,
          timeSlot: r.timeSlot,
          players: r.players
        })));

        this.allReservations = this.formatReservationTimeDisplay(activeReservations);

        // Ensure all time displays use AM/PM format
        this.convertToAMPMFormat(this.allReservations);
        console.log('🔍 After formatting:', this.allReservations.length);

        // Add Homeowner's Day entries for upcoming Wednesdays
        this.addHomeownerDayEntries();

        // Build member filter options from reservers + all players in each reservation
        const seen = new Set<string>();
        this.memberFilterOptions = [];
        for (const r of this.allReservations) {
          if (r.userId?.fullName && !seen.has(r.userId.fullName)) {
            seen.add(r.userId.fullName);
            this.memberFilterOptions.push({ id: r.userId.fullName, name: r.userId.fullName });
          }
          for (const player of (r.players || [])) {
            const playerName = typeof player === 'string' ? player : (player as any).name;
            if (playerName && !seen.has(playerName)) {
              seen.add(playerName);
              this.memberFilterOptions.push({ id: playerName, name: playerName });
            }
          }
        }
        this.memberFilterOptions.sort((a, b) => a.name.localeCompare(b.name));

        // Group reservations by date for mobile view
        this.groupedAllReservations = this.groupReservationsByDate(this.allReservations);

        console.log('📊 All Reservations loaded:');
        console.log('- Total from all users (excluding cancelled):', this.allReservations.length);
        console.log('- Cancelled reservations filtered out:', reservations.length - activeReservations.length);
        console.log('- Grouped by date:', this.groupedAllReservations.length, 'dates');
        console.log('- Real weather data:', this.allReservations.filter(r => r.weatherForecast).length, 'reservations have weather');

        // Verify mobile and desktop use same data
        const totalGrouped = this.groupedAllReservations.reduce((sum, group) => sum + group.reservations.length, 0);
        console.log('✅ Data consistency check:');
        console.log('  - Desktop view (allReservations):', this.allReservations.length, 'items');
        console.log('  - Mobile view (groupedAllReservations):', totalGrouped, 'items');
        console.log('  - Match:', this.allReservations.length === totalGrouped ? '✓' : '✗ MISMATCH!');

        // Always set loading to false when data loads complete
        // This fixes the issue where "No Reservations Found" briefly appears
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading all reservations:', error);
        // Always set loading to false on error too
        this.loading = false;
        this.snackBar.open('Failed to load all reservations', 'Close', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  loadAdminReservations(showLoading: boolean = true): void {
    console.log('📊 Loading admin reservations report...');
    if (showLoading) {
      this.loading = true;
    }

    // Fetch ALL reservations without any filtering - no status filter, no date filter
    const timestamp = new Date().getTime();
    this.http.get<any>(`${this.apiUrl}/reservations?showAll=true&limit=10000&_t=${timestamp}`).subscribe({
      next: (response) => {
        console.log('📊 ADMIN REPORT - Full response:', response);
        const reservations = response.data || [];
        console.log('🔍 Admin Report - Raw reservations received:', reservations.length);
        console.log('🔍 First reservation raw data:', reservations[0]);
        console.log('🔍 Status breakdown before filtering:', {
          pending: reservations.filter((r: any) => r.status === 'pending').length,
          confirmed: reservations.filter((r: any) => r.status === 'confirmed').length,
          cancelled: reservations.filter((r: any) => r.status === 'cancelled').length,
          completed: reservations.filter((r: any) => r.status === 'completed').length
        });

        // Sort reservations in DESCENDING order (newest first)
        this.adminReservations = reservations.sort((a: any, b: any) => {
          const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
          if (dateCompare !== 0) return dateCompare;
          // If same date, sort by time slot descending
          return b.timeSlot - a.timeSlot;
        });

        // Convert time displays to AM/PM format
        this.convertToAMPMFormat(this.adminReservations);

        console.log('📊 Admin reservations loaded:', this.adminReservations.length);

        // Calculate statistics
        this.calculateAdminStats(reservations);

        // Update sorted array for template binding
        this.sortedAdminReservations = this.getSortedAdminReservations();

        // Split into pending and other reservations
        this.filterAdminReservations();

        console.log('📊 Admin Report loaded - Total:', this.adminReservations.length, 'Sorted (descending):', this.sortedAdminReservations.length);
        console.log('📊 Pending items:', this.pendingAdminReservations.length, 'Other items:', this.otherAdminReservations.length);

        // Always set loading to false when data loads complete
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading admin reservations:', error);
        // Always set loading to false on error too
        this.loading = false;
        this.snackBar.open('Failed to load admin report', 'Close', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  calculateAdminStats(reservations: any[]): void {
    this.adminStats = {
      total: reservations.length,
      pending: reservations.filter(r => r.status === 'pending').length,
      confirmed: reservations.filter(r => r.status === 'confirmed').length,
      cancelled: reservations.filter(r => r.status === 'cancelled').length,
      completed: reservations.filter(r => r.status === 'completed').length,
      noShow: reservations.filter(r => r.status === 'no-show').length,
      totalRevenue: reservations.reduce((sum, r) => sum + (r.totalFee || 0), 0),
      paidRevenue: reservations.filter(r => r.paymentStatus === 'paid').reduce((sum, r) => sum + (r.totalFee || 0), 0),
      pendingRevenue: reservations.filter(r => r.paymentStatus === 'pending').reduce((sum, r) => sum + (r.totalFee || 0), 0)
    };
  }

  filterAdminReservations(): void {
    // First sub-tab: ONLY Pending status (reservation status must be 'pending')
    this.pendingAdminReservations = this.sortedAdminReservations.filter(r =>
      r.status === 'pending'
    );

    // Second sub-tab: Everything else (all non-pending statuses)
    this.otherAdminReservations = this.sortedAdminReservations.filter(r =>
      r.status !== 'pending'
    );

    // Debug logging
    console.log('📊 Filtered Admin Reservations:');
    console.log('  - Pending Items:', this.pendingAdminReservations.length);
    console.log('  - Other Items:', this.otherAdminReservations.length);
    console.log('  - Pending Items statuses:', this.pendingAdminReservations.map(r => `${r.status}/${r.paymentStatus}`));
  }

  isAdmin(): boolean {
    const user = this.authService.currentUser;
    console.log('🔐 isAdmin check - Current user:', user);
    console.log('🔐 User role:', user?.role);
    const result = user?.role === 'admin' || user?.role === 'superadmin';
    console.log('🔐 isAdmin result:', result);
    return result;
  }

  isSuperAdmin(): boolean {
    const user = this.authService.currentUser;
    return user?.role === 'superadmin'; // Only superadmins see Admin Report tab
  }

  getSortedAdminReservations(): Reservation[] {
    // For admin report, use adminReservations if available, otherwise use allReservations
    const source = this.adminReservations.length > 0 ? this.adminReservations : this.allReservations;

    // Sort in DESCENDING order - newest dates first, then highest time slots first
    return [...source].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();

      // Sort by date descending (newest first)
      if (dateB !== dateA) {
        return dateB - dateA;
      }

      // Same date: sort by time slot descending (latest time first)
      return b.timeSlot - a.timeSlot;
    });
  }

  groupConsecutiveReservationsDescending(reservations: any[]): Reservation[] {
    // Assumes reservations are already sorted in DESCENDING order
    // Does NOT re-sort to preserve the descending order
    const grouped: Reservation[] = [];
    let i = 0;

    while (i < reservations.length) {
      const current = reservations[i];
      const consecutiveGroup = [current];

      // Find consecutive reservations for the same date (in descending order)
      let j = i + 1;
      while (j < reservations.length) {
        const next = reservations[j];
        const isSameDate = new Date(current.date).toDateString() === new Date(next.date).toDateString();
        // For descending order, next timeSlot should be one less than current
        const isConsecutive = next.timeSlot === (consecutiveGroup[consecutiveGroup.length - 1].timeSlot - 1);
        const haveSamePlayers = JSON.stringify(current.players.sort()) === JSON.stringify(next.players.sort());

        if (isSameDate && isConsecutive && haveSamePlayers) {
          consecutiveGroup.push(next);
          j++;
        } else {
          break;
        }
      }

      // Create a merged reservation if we have multiple consecutive slots
      if (consecutiveGroup.length > 1) {
        const firstSlot = consecutiveGroup[0]; // Highest time slot (descending)
        const lastSlot = consecutiveGroup[consecutiveGroup.length - 1]; // Lowest time slot
        const totalFee = consecutiveGroup.reduce((sum, res) => sum + res.totalFee, 0);

        const mergedReservation: Reservation = {
          ...firstSlot,
          timeSlotDisplay: this.formatTimeRange(lastSlot.timeSlot, firstSlot.timeSlot + 1),
          totalFee: totalFee,
          feePerPlayer: totalFee / firstSlot.players.length
        };

        grouped.push(mergedReservation);
      } else {
        // Single reservation, keep as is
        grouped.push(current);
      }

      i = j;
    }

    return grouped;
  }

  groupConsecutiveReservations(reservations: any[]): Reservation[] {
    // First, sort reservations by date and timeSlot in ASCENDING order
    const sorted = reservations.sort((a, b) => {
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return a.timeSlot - b.timeSlot;
    });

    const grouped: Reservation[] = [];
    let i = 0;

    while (i < sorted.length) {
      const current = sorted[i];
      const consecutiveGroup = [current];
      
      // Find consecutive reservations for the same date
      let j = i + 1;
      while (j < sorted.length) {
        const next = sorted[j];
        const isSameDate = new Date(current.date).toDateString() === new Date(next.date).toDateString();
        const isConsecutive = next.timeSlot === (consecutiveGroup[consecutiveGroup.length - 1].timeSlot + 1);
        const haveSamePlayers = JSON.stringify(current.players.sort()) === JSON.stringify(next.players.sort());
        
        if (isSameDate && isConsecutive && haveSamePlayers) {
          consecutiveGroup.push(next);
          j++;
        } else {
          break;
        }
      }

      // Create a merged reservation if we have multiple consecutive slots
      if (consecutiveGroup.length > 1) {
        const firstSlot = consecutiveGroup[0];
        const lastSlot = consecutiveGroup[consecutiveGroup.length - 1];
        const totalFee = consecutiveGroup.reduce((sum, res) => sum + res.totalFee, 0);
        
        const mergedReservation: Reservation = {
          ...firstSlot,
          timeSlotDisplay: this.formatTimeRange(firstSlot.timeSlot, lastSlot.timeSlot + 1),
          totalFee: totalFee,
          feePerPlayer: totalFee / firstSlot.players.length
        };
        
        grouped.push(mergedReservation);
      } else {
        // Single reservation, keep as is
        grouped.push(current);
      }

      i = j;
    }

    return grouped;
  }

  getDay(date: Date | string): string {
    return new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
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
   * Create time range display in AM/PM format
   */
  formatTimeRange(startHour: number, endHour: number): string {
    return `${this.formatTime(startHour)} - ${this.formatTime(endHour)}`;
  }

  /**
   * Convert all reservation time displays to AM/PM format
   */
  convertToAMPMFormat(reservations: Reservation[]): void {
    reservations.forEach(reservation => {
      if (!reservation.timeSlotDisplay || reservation.timeSlotDisplay.includes(':00')) {
        // If it's a single hour slot or military time format, convert it
        if (reservation.timeSlotDisplay && reservation.timeSlotDisplay.includes(' - ')) {
          // Handle range format like "18:00 - 20:00"
          const parts = reservation.timeSlotDisplay.split(' - ');
          const startHour = parseInt(parts[0].split(':')[0]);
          const endHour = parseInt(parts[1].split(':')[0]);
          reservation.timeSlotDisplay = this.formatTimeRange(startHour, endHour);
        } else {
          // Handle single slot format, use timeSlot property
          const endHour = reservation.timeSlot + 1;
          reservation.timeSlotDisplay = this.formatTimeRange(reservation.timeSlot, endHour);
        }
      }
    });
  }

  /**
   * Format reservation time displays without grouping consecutive slots
   * Each reservation is displayed as a separate row
   */
  formatReservationTimeDisplay(reservations: any[]): Reservation[] {
    // Sort by date and timeSlot first
    const sorted = reservations.sort((a, b) => {
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return a.timeSlot - b.timeSlot;
    });

    // Format time display for each reservation individually
    return sorted.map(res => ({
      ...res,
      timeSlotDisplay: res.timeSlotDisplay ||
        this.formatTimeRange(res.timeSlot, res.timeSlot + (res.duration || 1))
    }));
  }

  getDateMonth(date: Date | string): string {
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  }

  getShortDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
  }

  getTimeAgo(date: Date | string): string {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'confirmed': return 'primary';
      case 'pending': return 'accent';
      case 'cancelled': return 'warn';
      case 'completed': return '';
      default: return '';
    }
  }

  getPaymentStatusColor(status: string): string {
    switch (status) {
      case 'paid': return 'primary';
      case 'pending': return 'accent';
      case 'overdue': return 'warn';
      default: return '';
    }
  }

  getPaymentStatusText(status: string): string {
    switch (status) {
      case 'paid': return 'Paid';
      case 'pending': return 'Payment Pending';
      case 'overdue': return 'Payment Overdue';
      default: return status;
    }
  }

  canEdit(reservation: Reservation): boolean {
    if (reservation.status === 'cancelled') return false;

    const reservationDate = new Date(reservation.date);
    const now = new Date();

    // Set both dates to start of day for comparison
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    reservationDate.setHours(0, 0, 0, 0);

    // If reservation is in the future, can edit
    if (reservationDate > today) return true;

    // If reservation is today, check if time slot hasn't started yet
    if (reservationDate.getTime() === today.getTime()) {
      const currentHour = now.getHours();
      if (reservation.timeSlot > currentHour) return true;
    }

    // For past reservations: Only admins can edit, and ONLY if all payments are pending
    const user = this.authService.currentUser;
    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

    if (isAdmin && reservation.paymentStatus === 'pending') {
      // Admin can edit past reservations if all payments are still pending
      return true;
    }

    // Past date with completed payments or non-admin user
    return false;
  }

  canCancel(reservation: Reservation): boolean {
    return canCancelReservation(reservation);
  }

  isLateCancellation(reservation: Reservation | null): boolean {
    if (!reservation) return false;
    const reservationDate = new Date(reservation.date);
    const reservationStart = new Date(
      reservationDate.getFullYear(),
      reservationDate.getMonth(),
      reservationDate.getDate(),
      reservation.timeSlot,
      0, 0, 0
    );
    const hoursUntil = (reservationStart.getTime() - Date.now()) / (1000 * 60 * 60);
    const bookedToday = new Date(reservation.createdAt).toDateString() === new Date().toDateString();
    return hoursUntil < 12 && !bookedToday;
  }

  editReservation(reservation: Reservation): void {
    // Navigate to reservations page with edit mode
    this.router.navigate(['/reservations'], { 
      queryParams: { edit: reservation._id } 
    });
  }

  cancelReservation(reservation: Reservation): void {
    this.reservationToCancel = reservation;
    this.showCancelModal = true;
  }

  closeCancelModal(): void {
    this.showCancelModal = false;
    this.reservationToCancel = null;
  }

  confirmCancelReservation(): void {
    if (!this.reservationToCancel) return;

    this.http.delete<any>(`${this.apiUrl}/reservations/${this.reservationToCancel._id}`).subscribe({
      next: (response) => {
        const msg = response.data?.cancellationFeeCharged
          ? 'Reservation cancelled. A ₱100 late cancellation fee has been added to your pending payments.'
          : 'Reservation cancelled successfully';
        this.snackBar.open(msg, 'Close', {
          duration: 5000,
          panelClass: ['success-snackbar']
        });
        this.loadReservations(); // Reload the list
        this.closeCancelModal(); // Close the modal
      },
      error: (error) => {
        const message = error.error?.message || 'Failed to cancel reservation';
        this.snackBar.open(message, 'Close', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
        this.closeCancelModal(); // Close the modal even on error
      }
    });
  }

  viewPayment(reservation: Reservation): void {
    this.router.navigate(['/payments'], { 
      queryParams: { reservation: reservation._id } 
    });
  }

  createNewReservation(): void {
    this.router.navigate(['/reservations']);
  }

  viewCalendar(): void {
    this.router.navigate(['/calendar']);
  }

  // New methods for All Reservations tab
  isPastReservation(date: Date | string): boolean {
    return new Date(date) < new Date();
  }

  getFullDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // Filter out the reservation creator from players list to avoid duplication
  getFilteredPlayers(reservation: any): any[] {
    if (!reservation.players || !reservation.userId) {
      return reservation.players || [];
    }

    const creatorName = reservation.userId.fullName;

    // December 2025: Handle both old (string[]) and new (object[]) formats
    return reservation.players.filter((player: any) => {
      if (typeof player === 'string') {
        return player !== creatorName;
      } else if (typeof player === 'object' && 'name' in player) {
        return player.name !== creatorName;
      }
      return true;
    });
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

  getTimeUntil(date: Date | string): string {
    const now = new Date();
    const future = new Date(date);
    const diffMs = future.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (diffDays > 0) {
      return `In ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      return `In ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    } else {
      return 'Soon';
    }
  }


  isWeatherClear(weatherDescription: string): boolean {
    if (!weatherDescription) return false;
    const clearConditions = ['clear sky', 'clear', 'sunny'];
    return clearConditions.some(condition => 
      weatherDescription.toLowerCase().includes(condition)
    );
  }

  getWeatherBackgroundColor(reservation: Reservation): string {
    if (!reservation.weatherForecast?.description) {
      return ''; // Default color
    }
    
    const description = reservation.weatherForecast.description.toLowerCase();
    
    // Clear/Sunny weather - Light blue
    if (this.isWeatherClear(description)) {
      return 'rgba(173, 216, 255, 0.3)';
    }
    
    // Rainy weather - Light purple/blue
    if (description.includes('rain') || description.includes('drizzle') || description.includes('shower')) {
      return 'rgba(196, 181, 253, 0.3)'; // Light purple for rain
    }
    
    // Stormy weather - Darker gray
    if (description.includes('storm') || description.includes('thunder')) {
      return 'rgba(107, 114, 128, 0.4)'; // Darker gray for storms
    }
    
    // Foggy/Misty weather - Light yellow/gray
    if (description.includes('fog') || description.includes('mist') || description.includes('haze')) {
      return 'rgba(254, 240, 138, 0.3)'; // Light yellow for fog/mist
    }
    
    // Snow weather - Light cyan/white
    if (description.includes('snow') || description.includes('sleet')) {
      return 'rgba(224, 242, 254, 0.4)'; // Light cyan for snow
    }
    
    // Cloudy weather (default for clouds, overcast, etc.) - Light gray
    return 'rgba(156, 163, 175, 0.2)';
  }

  getWeatherBorderColor(reservation: Reservation): string {
    if (!reservation.weatherForecast?.description) {
      return '#e5e7eb'; // Default gray
    }
    
    const description = reservation.weatherForecast.description.toLowerCase();
    
    // Clear/Sunny weather - Blue
    if (this.isWeatherClear(description)) {
      return '#3b82f6';
    }
    
    // Rainy weather - Purple
    if (description.includes('rain') || description.includes('drizzle') || description.includes('shower')) {
      return '#8b5cf6'; // Purple for rain
    }
    
    // Stormy weather - Dark gray
    if (description.includes('storm') || description.includes('thunder')) {
      return '#6b7280'; // Dark gray for storms
    }
    
    // Foggy/Misty weather - Yellow
    if (description.includes('fog') || description.includes('mist') || description.includes('haze')) {
      return '#f59e0b'; // Yellow for fog/mist
    }
    
    // Snow weather - Light blue
    if (description.includes('snow') || description.includes('sleet')) {
      return '#0ea5e9'; // Light blue for snow
    }
    
    // Cloudy weather (default) - Gray
    return '#9ca3af';
  }

  getWeatherIcon(weatherIcon: string): string {
    // Map OpenWeatherMap icons to Material Icons
    const iconMap: { [key: string]: string } = {
      '01d': 'wb_sunny',        // clear sky day
      '01n': 'nights_stay',     // clear sky night
      '02d': 'partly_cloudy_day', // few clouds day
      '02n': 'partly_cloudy_night', // few clouds night
      '03d': 'cloud',           // scattered clouds
      '03n': 'cloud',           // scattered clouds
      '04d': 'cloud',           // broken clouds
      '04n': 'cloud',           // broken clouds
      '09d': 'grain',           // shower rain
      '09n': 'grain',           // shower rain
      '10d': 'rainy',           // rain day
      '10n': 'rainy',           // rain night
      '11d': 'thunderstorm',    // thunderstorm day
      '11n': 'thunderstorm',    // thunderstorm night
      '13d': 'ac_unit',         // snow day
      '13n': 'ac_unit',         // snow night
      '50d': 'foggy',           // mist day
      '50n': 'foggy'            // mist night
    };

    return iconMap[weatherIcon] || 'cloud';
  }

  getBlockReasonDisplay(reservation: Reservation): string {
    if (!reservation.blockReason) return '';
    const reasonMap: { [key: string]: string } = {
      'maintenance': '🔧 Maintenance',
      'private_event': '🎉 Private Event',
      'weather': '🌧️ Weather',
      'other': '📝 Other'
    };
    return reasonMap[reservation.blockReason] || reservation.blockReason;
  }

  getBlockReasonIcon(reservation: Reservation): string {
    if (!reservation.blockReason) return 'block';
    const iconMap: { [key: string]: string } = {
      'maintenance': 'build',
      'private_event': 'event',
      'weather': 'cloud',
      'other': 'info'
    };
    return iconMap[reservation.blockReason] || 'block';
  }

  isBlockedReservation(reservation: Reservation): boolean {
    return reservation.status === 'blocked';
  }


  /**
   * Add Homeowner's Day entries for the next 2 upcoming Wednesdays
   */
  addHomeownerDayEntries(): void {
    const homeownerEntries = this.generateHomeownerDayEntries();
    
    // Add entries to the beginning of the list
    this.allReservations = [...homeownerEntries, ...this.allReservations];

    // Sort by date AND timeSlot to maintain chronological order
    this.allReservations.sort((a, b) => {
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return a.timeSlot - b.timeSlot;
    });

    console.log(`✅ Added ${homeownerEntries.length} Homeowner's Day entries`);
  }

  /**
   * Generate Homeowner's Day entries for the next 2 upcoming Wednesdays
   * Note: Uses mock weather since these are UI-only placeholder events
   */
  generateHomeownerDayEntries(): Reservation[] {
    const entries: Reservation[] = [];
    const now = new Date();
    let foundWednesdays = 0;

    // Look for next 2 Wednesdays within the next 30 days
    for (let i = 0; i < 30 && foundWednesdays < 2; i++) {
      const checkDate = new Date(now);
      checkDate.setDate(now.getDate() + i);

      // Check if this date is a Wednesday (day 3) and is in the future
      if (checkDate.getDay() === 3 && checkDate >= now) {
        // Generate realistic weather forecast for the Wednesday evening
        // Using mock data since Homeowner's Day is a UI placeholder, not a real reservation
        const weatherTypes = [
          { desc: 'sunny', icon: '01d', temp: 28, rain: 10, humidity: 65 },
          { desc: 'partly cloudy', icon: '02d', temp: 26, rain: 20, humidity: 70 },
          { desc: 'cloudy', icon: '03d', temp: 25, rain: 30, humidity: 75 },
          { desc: 'clear sky', icon: '01d', temp: 29, rain: 5, humidity: 60 }
        ];

        const weather = weatherTypes[foundWednesdays % weatherTypes.length];

        const entry: Reservation = {
          _id: `homeowner-${checkDate.toISOString().split('T')[0]}`, // Unique ID
          date: checkDate,
          timeSlot: 18, // 6 PM
          timeSlotDisplay: '6PM - 8PM',
          players: ["Homeowner's Day"],
          status: 'confirmed',
          paymentStatus: 'paid',
          totalFee: 0,
          feePerPlayer: 0,
          createdAt: now,
          updatedAt: now,
          isHomeownerDay: true, // Special flag
          weatherForecast: {
            temperature: weather.temp + Math.floor(Math.random() * 4) - 2, // ±2 degrees variation
            description: weather.desc,
            icon: weather.icon,
            rainChance: weather.rain + Math.floor(Math.random() * 10) - 5, // ±5% variation
            humidity: weather.humidity + Math.floor(Math.random() * 10) - 5 // ±5% variation
          }
        };

        entries.push(entry);
        foundWednesdays++;

        console.log(`📅 Generated Homeowner's Day entry for: ${checkDate.toDateString()} with weather: ${entry.weatherForecast?.temperature}°C`);
      }
    }

    return entries;
  }

}