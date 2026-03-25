import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, interval, of } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface PlayerDisplay {
  name: string;
  isGuest: boolean;
  initials: string;
  avatarColor: string;
}

export interface CourtSlotInfo {
  exists: boolean;
  timeRange: string;
  players: PlayerDisplay[];
  isBlocked: boolean;
  isHomeownerDay?: boolean;
  blockInfo?: { reason: string; notes: string };
}

export interface CourtStatusData {
  current: CourtSlotInfo;
  next: CourtSlotInfo;
  courtStatus: 'open' | 'closed' | 'available';
  lastUpdated: Date;
  hasAnyReservationsToday: boolean;
}

interface Reservation {
  _id: string;
  userId: any;
  date: string;
  timeSlot: number;
  endTimeSlot: number;
  duration: number;
  players: any[];
  status: string;
  blockReason?: string;
  blockNotes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CourtStatusService {
  private apiUrl = environment.apiUrl || 'http://localhost:3000/api';
  private statusSubject = new BehaviorSubject<CourtStatusData | null>(null);
  public status$ = this.statusSubject.asObservable();
  private refreshIntervalSubscription: any;

  private readonly COURT_OPEN_HOUR = 5;  // 5 AM
  private readonly COURT_CLOSE_HOUR = 22; // 10 PM
  private readonly HOMEOWNER_TIME_START = 18; // 6 PM
  private readonly HOMEOWNER_TIME_END = 20;   // 8 PM
  private readonly HOMEOWNER_DAY = 3;         // Wednesday

  constructor(private http: HttpClient) {}

  /**
   * Get current court status as an Observable
   */
  getCurrentStatus(): Observable<CourtStatusData> {
    return this.status$.pipe(
      switchMap(status => {
        if (status === null) {
          // Initial fetch
          return this.fetchAndProcessStatus();
        }
        return of(status);
      })
    );
  }

  /**
   * Manually refresh the status
   */
  refreshStatus(): void {
    this.fetchAndProcessStatus().subscribe();
  }

  /**
   * Start automatic 60-second polling
   */
  startAutoRefresh(): void {
    // Initial fetch
    this.refreshStatus();

    // Set up 60-second interval
    this.refreshIntervalSubscription = interval(60000).pipe(
      switchMap(() => this.fetchAndProcessStatus())
    ).subscribe();
  }

  /**
   * Stop automatic polling (cleanup)
   */
  stopAutoRefresh(): void {
    if (this.refreshIntervalSubscription) {
      this.refreshIntervalSubscription.unsubscribe();
      this.refreshIntervalSubscription = null;
    }
  }

  /**
   * Fetch today's reservations and process them
   */
  private fetchAndProcessStatus(): Observable<CourtStatusData> {
    const todayStr = this.getTodayDateString();

    return this.http.get<any>(`${this.apiUrl}/reservations/date/${todayStr}`).pipe(
      map(response => {
        console.log('Court status API response:', response);

        // Handle different response formats
        let reservations: Reservation[] = [];

        if (Array.isArray(response)) {
          // Direct array response
          reservations = response;
        } else if (response && response.success && response.data) {
          // Wrapped response with success flag and data object
          if (Array.isArray(response.data)) {
            // data is array directly
            reservations = response.data;
          } else if (Array.isArray(response.data.reservations)) {
            // data is object with reservations property
            reservations = response.data.reservations;
          }
        } else if (response && Array.isArray(response.reservations)) {
          // Response with reservations property at root level
          reservations = response.reservations;
        }

        if (reservations.length === 0) {
          console.warn('No reservations found in API response:', response);
        }

        console.log('Processing', reservations.length, 'reservations');
        return this.processReservations(reservations);
      }),
      tap(status => this.statusSubject.next(status)),
      catchError(error => {
        console.error('Court status fetch failed:', error);
        // Return empty status on error
        return of(this.getEmptyStatus());
      })
    );
  }

  /**
   * Process reservations to determine current and next slots
   */
  private processReservations(reservations: Reservation[]): CourtStatusData {
    const phTime = this.getCurrentPhilippineTime();
    const currentHour = phTime.getHours();
    const currentMinute = phTime.getMinutes();

    console.log('🕐 Philippine Time:', phTime.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    console.log('🕐 Current Hour:', currentHour, 'Current Minute:', currentMinute);

    // Filter active reservations (not cancelled)
    const activeReservations = reservations.filter(
      r => r.status !== 'cancelled' && r.status !== 'no-show'
    );

    console.log('📋 Active Reservations:', activeReservations.length);
    activeReservations.forEach(r => {
      console.log(`  - ${r.timeSlot}:00-${r.endTimeSlot}:00 (${r.status})`, r);
    });

    // Check if court is open
    if (currentHour < this.COURT_OPEN_HOUR) {
      console.log('⏰ Court not open yet (opens at 5 AM)');
      return this.getBeforeHoursStatus(activeReservations);
    }

    if (currentHour >= this.COURT_CLOSE_HOUR) {
      console.log('⏰ Court closed (closes at 10 PM)');
      return this.getAfterHoursStatus();
    }

    // Inject Homeowner's Day as a virtual blocked reservation if today is Wednesday
    // and no real reservation already covers that time slot
    if (phTime.getDay() === this.HOMEOWNER_DAY) {
      const homeownerCovered = activeReservations.some(
        r => r.timeSlot <= this.HOMEOWNER_TIME_START && r.endTimeSlot > this.HOMEOWNER_TIME_START
      );
      if (!homeownerCovered) {
        activeReservations.push({
          _id: 'homeowner-day',
          userId: null,
          date: '',
          timeSlot: this.HOMEOWNER_TIME_START,
          endTimeSlot: this.HOMEOWNER_TIME_END,
          duration: 2,
          players: [],
          status: 'blocked',
          blockReason: 'homeowner_day',
          blockNotes: 'Reserved for homeowners'
        });
      }
    }

    // Find current and next reservations
    let currentReservation: Reservation | null = null;
    let nextReservation: Reservation | null = null;

    // Current reservation: one that covers the current hour
    for (const res of activeReservations) {
      if (res.timeSlot <= currentHour && res.endTimeSlot > currentHour) {
        currentReservation = res;
        console.log('✅ Found CURRENT reservation:', res.timeSlot, '-', res.endTimeSlot);
        break;
      }
    }

    if (!currentReservation) {
      console.log('❌ No current reservation');
    }

    // Next reservation: first one that starts after current hour (not including current reservation)
    const sortedReservations = activeReservations
      .filter(r => {
        // Exclude current reservation if it exists
        if (currentReservation && r._id === currentReservation._id) {
          return false;
        }
        // Include reservations that start after current hour
        return r.timeSlot > currentHour;
      })
      .sort((a, b) => a.timeSlot - b.timeSlot);

    console.log('🔍 Potential NEXT reservations:', sortedReservations.length);

    if (sortedReservations.length > 0) {
      nextReservation = sortedReservations[0];
      console.log('✅ Found NEXT reservation:', nextReservation.timeSlot, '-', nextReservation.endTimeSlot);
    } else {
      console.log('❌ No next reservation');
    }

    // Build status data
    const statusData: CourtStatusData = {
      current: currentReservation
        ? this.buildSlotInfo(currentReservation)
        : this.getEmptySlotInfo('Court Available Now ✅'),
      next: nextReservation
        ? this.buildSlotInfo(nextReservation)
        : this.getEmptySlotInfo('No Upcoming Reservation'),
      courtStatus: activeReservations.length === 0 ? 'available' : 'open',
      lastUpdated: new Date(),
      hasAnyReservationsToday: activeReservations.length > 0
    };

    return statusData;
  }

  /**
   * Build slot info from reservation
   */
  private buildSlotInfo(reservation: Reservation): CourtSlotInfo {
    // Check if blocked
    if (reservation.status === 'blocked') {
      return {
        exists: true,
        timeRange: this.formatTimeRange(reservation.timeSlot, reservation.endTimeSlot),
        players: [],
        isBlocked: true,
        isHomeownerDay: reservation.blockReason === 'homeowner_day',
        blockInfo: {
          reason: this.formatBlockReason(reservation.blockReason),
          notes: reservation.blockNotes || 'Court temporarily unavailable'
        }
      };
    }

    // Process players
    const players = this.processPlayers(reservation);

    return {
      exists: true,
      timeRange: this.formatTimeRange(reservation.timeSlot, reservation.endTimeSlot),
      players: players,
      isBlocked: false
    };
  }

  /**
   * Process player data from reservation
   */
  private processPlayers(reservation: Reservation): PlayerDisplay[] {
    const players: PlayerDisplay[] = [];

    // Process players array
    if (reservation.players && Array.isArray(reservation.players)) {
      for (const player of reservation.players) {
        if (typeof player === 'string') {
          // String player (legacy format)
          players.push(this.createPlayerDisplay(player, false));
        } else if (player && typeof player === 'object') {
          // Player object with isMember/isGuest flags
          const name = player.name || player.fullName || 'Unknown';
          const isGuest = player.isGuest === true;
          players.push(this.createPlayerDisplay(name, isGuest));
        }
      }
    }

    return players;
  }

  /**
   * Create player display object
   */
  private createPlayerDisplay(name: string, isGuest: boolean): PlayerDisplay {
    return {
      name: name,
      isGuest: isGuest,
      initials: this.getInitials(name),
      avatarColor: this.getAvatarColor(name)
    };
  }

  /**
   * Get initials from name
   */
  private getInitials(name: string): string {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  /**
   * Get consistent avatar color based on name
   */
  private getAvatarColor(name: string): string {
    const colors = [
      '#3b82f6', // blue
      '#10b981', // green
      '#f59e0b', // amber
      '#ef4444', // red
      '#8b5cf6', // purple
      '#ec4899', // pink
      '#06b6d4', // cyan
      '#f97316'  // orange
    ];

    const hash = name.split('').reduce((acc, char) =>
      char.charCodeAt(0) + ((acc << 5) - acc), 0
    );

    return colors[Math.abs(hash) % colors.length];
  }

  /**
   * Format block reason code to a readable label
   */
  private formatBlockReason(reason?: string): string {
    const labels: { [key: string]: string } = {
      'maintenance': 'Court Maintenance',
      'private_event': 'Private Event',
      'weather': 'Weather Closure',
      'homeowner_day': "Homeowner's Day",
      'other': 'Court Unavailable'
    };
    return (reason && labels[reason]) || reason || 'Court Blocked';
  }

  /**
   * Format time range for display
   */
  private formatTimeRange(startHour: number, endHour: number): string {
    const formatHour = (hour: number): string => {
      if (hour === 0) return '12:00 AM';
      if (hour < 12) return `${hour}:00 AM`;
      if (hour === 12) return '12:00 PM';
      return `${hour - 12}:00 PM`;
    };

    return `${formatHour(startHour)} - ${formatHour(endHour)}`;
  }

  /**
   * Get empty slot info with custom message
   */
  private getEmptySlotInfo(message: string): CourtSlotInfo {
    return {
      exists: false,
      timeRange: message,
      players: [],
      isBlocked: false
    };
  }

  /**
   * Get status for before operating hours
   */
  private getBeforeHoursStatus(reservations: Reservation[]): CourtStatusData {
    // Find first reservation of the day
    const firstRes = reservations
      .filter(r => r.status !== 'blocked')
      .sort((a, b) => a.timeSlot - b.timeSlot)[0];

    return {
      current: this.getEmptySlotInfo('Court Opens at 5:00 AM'),
      next: firstRes
        ? this.buildSlotInfo(firstRes)
        : this.getEmptySlotInfo('No Reservations Today'),
      courtStatus: 'closed',
      lastUpdated: new Date(),
      hasAnyReservationsToday: reservations.length > 0
    };
  }

  /**
   * Get status for after operating hours
   */
  private getAfterHoursStatus(): CourtStatusData {
    return {
      current: this.getEmptySlotInfo('Court Closed'),
      next: this.getEmptySlotInfo('Opens Tomorrow at 5:00 AM'),
      courtStatus: 'closed',
      lastUpdated: new Date(),
      hasAnyReservationsToday: false
    };
  }

  /**
   * Get empty status (no data)
   */
  private getEmptyStatus(): CourtStatusData {
    return {
      current: this.getEmptySlotInfo('Unable to load status'),
      next: this.getEmptySlotInfo(''),
      courtStatus: 'available',
      lastUpdated: new Date(),
      hasAnyReservationsToday: false
    };
  }

  /**
   * Get current time in Philippine timezone
   */
  private getCurrentPhilippineTime(): Date {
    const now = new Date();
    const phTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Manila' });
    return new Date(phTimeStr);
  }

  /**
   * Get today's date in YYYY-MM-DD format (Philippine timezone)
   */
  private getTodayDateString(): string {
    const phTime = this.getCurrentPhilippineTime();
    const year = phTime.getFullYear();
    const month = String(phTime.getMonth() + 1).padStart(2, '0');
    const day = String(phTime.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
