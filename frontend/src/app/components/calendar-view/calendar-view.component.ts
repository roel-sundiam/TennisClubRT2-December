import { Component, OnInit, ViewEncapsulation, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { FullCalendarModule, FullCalendarComponent } from '@fullcalendar/angular';
import { CalendarOptions, EventClickArg, EventInput, Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { CalendarService, DayReservationInfo, Reservation } from '../../services/calendar.service';
import { CalendarDayDetailsDialogComponent } from '../calendar-day-details-dialog/calendar-day-details-dialog.component';

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    FullCalendarModule
  ],
  templateUrl: './calendar-view.component.html',
  styleUrls: ['./calendar-view.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class CalendarViewComponent implements OnInit {
  @ViewChild('calendar') calendarComponent!: FullCalendarComponent;

  loading = true;
  monthData: Map<string, DayReservationInfo> = new Map();
  isInitialLoad = true;
  private isRefetching = false;

  debugInfo: any = {
    totalReservations: 0,
    blockedCount: 0,
    eventsRendered: 0,
    blockedReservations: [],
    dateRange: { startDate: '', endDate: '', month: 0, year: 0 },
    backendResponse: { total: 0, blocked: 0, blockedDates: [] }
  };

  get serviceDebugInfo() {
    return this.calendarService.debugInfo;
  }

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev',
      center: 'title',
      right: 'next'
    },
    height: 'auto',
    fixedWeekCount: false,
    showNonCurrentDates: false,
    eventOrder: 'order,start', // Sort by our custom 'order' property, then by start time
    events: (fetchInfo, successCallback, failureCallback) => {
      // Return current events from monthData
      const events: EventInput[] = [];
      let blockedCount = 0;
      let allReservations = 0;
      const blockedReservations: any[] = [];

      this.monthData.forEach((dayInfo, dateKey) => {
        // Add reservation events
        dayInfo.reservations.forEach(reservation => {
          allReservations++;

          // Collect blocked reservations for debug info
          if (reservation.status === 'blocked') {
            blockedCount++;
            blockedReservations.push({
              date: dateKey,
              timeSlot: reservation.timeSlot,
              blockNotes: reservation.blockNotes,
              blockReason: reservation.blockReason,
              status: reservation.status,
              _id: reservation._id
            });
          }

          // Show: confirmed, pending, blocked, completed, and no-show (historical) reservations
          // Hide: cancelled (user cancelled)
          if (reservation.status === 'confirmed' || reservation.status === 'pending' || reservation.status === 'blocked' || reservation.status === 'completed' || reservation.status === 'no-show') {
            // For blocked reservations, show the block notes (full description) as title
            let title = '';
            let statusBadge = '';

            // Add emoji/badge for reservation status
            if (reservation.status === 'confirmed') {
              statusBadge = '✓ ';
            } else if (reservation.status === 'pending') {
              statusBadge = '⏳ ';
            } else if (reservation.status === 'completed') {
              statusBadge = '✔️ ';
            } else if (reservation.status === 'blocked') {
              statusBadge = '🚫 ';
            } else if (reservation.status === 'no-show') {
              statusBadge = '⏱️ ';  // Indicates historical/passed reservation
            }

            if (reservation.status === 'blocked') {
              title = `${statusBadge}${reservation.blockNotes || reservation.blockReason || 'Court Blocked'}`;
            } else {
              const startTime = this.formatTimeSlot(reservation.timeSlot);
              const endTime = this.formatTimeSlot(reservation.timeSlot + (reservation.duration || 1));
              title = `${statusBadge}${this.getReserverName(reservation)} (${startTime}-${endTime})`;
            }

            // Determine colors based on PAYMENT STATUS (primary indicator)
            const paymentStatus = reservation.paymentStatus || 'not_applicable';
            let bgColor = '#9e9e9e'; // default gray for not_applicable

            if (paymentStatus === 'paid') {
              bgColor = '#4caf50'; // paid - green
            } else if (paymentStatus === 'pending') {
              bgColor = '#ff9800'; // pending payment - orange
            } else if (paymentStatus === 'overdue') {
              bgColor = '#dc2626'; // overdue - red
            }

            // Override color for no-show status to show historical reservations in gray-blue
            if (reservation.status === 'no-show') {
              bgColor = '#94a3b8'; // light gray-blue (slate-400) for historical/no-show reservations
            }

            let borderColor = bgColor;

            // Ensure we have a valid timeSlot for ordering
            const eventOrder = reservation.timeSlot || 0;

            // Create a timed event using the timeSlot for proper ordering
            const timeSlotValue = reservation.timeSlot || 0;
            const startDateTime = `${dateKey}T${String(timeSlotValue).padStart(2, '0')}:00:00`;

            events.push({
              id: reservation._id,
              title: title,
              start: startDateTime,
              allDay: false,  // Must be false for time-based sorting
              backgroundColor: bgColor,
              borderColor: borderColor,
              color: bgColor, // Also set color property
              textColor: 'white', // Ensure text is white
              order: eventOrder, // Explicit ordering for FullCalendar
              classNames: ['reservation-event', `payment-${paymentStatus}`, `status-${reservation.status}`],
              extendedProps: {
                reservation: reservation,
                hours: reservation.duration,
                timeSlot: reservation.timeSlot,
                bgColor: bgColor, // Store color in extendedProps as fallback
                status: reservation.status,
                paymentStatus: paymentStatus
              }
            });
          }
        });

        // Add Wednesday Homeowner's Day indicator as a regular event (not background)
        if (dayInfo.isWednesday) {
          // Create timed event at 6 PM (18:00) for proper ordering
          const homeownerDateTime = `${dateKey}T18:00:00`;

          events.push({
            title: 'Homeowner',
            start: homeownerDateTime,
            allDay: false,  // Must be false for time-based sorting
            backgroundColor: '#8b5cf6',
            borderColor: '#8b5cf6',
            color: '#8b5cf6', // Also set color property
            textColor: 'white', // Ensure text is white
            order: 18, // Explicit ordering for FullCalendar
            classNames: ['homeowner-event'], // Add custom class for styling
            extendedProps: {
              isWednesday: true,
              timeSlot: 18,  // 6 PM - for sorting purposes
              bgColor: '#8b5cf6',
              status: 'wednesday'
            }
          });
        }
      });

      // Update debug info (kept for potential future debugging)
      this.debugInfo = {
        totalReservations: allReservations,
        blockedCount: blockedCount,
        eventsRendered: events.length,
        blockedReservations: blockedReservations
      };

      // Sort events by timeSlot to show them in chronological order
      events.sort((a, b) => {
        const timeA = a.extendedProps?.reservation?.timeSlot ?? a.extendedProps?.timeSlot ?? 999;
        const timeB = b.extendedProps?.reservation?.timeSlot ?? b.extendedProps?.timeSlot ?? 999;
        return timeA - timeB;
      });

      successCallback(events);
    },
    eventClick: this.handleEventClick.bind(this),
    dateClick: this.handleDateClick.bind(this),
    eventDidMount: this.handleEventDidMount.bind(this),
    dayCellDidMount: this.handleDayCellDidMount.bind(this),
    // Custom button handlers for navigation
    customButtons: {
      prev: {
        text: 'prev',
        click: () => this.handlePrevMonth()
      },
      next: {
        text: 'next',
        click: () => this.handleNextMonth()
      }
    },
    eventContent: this.renderEventContent.bind(this)
  };

  constructor(
    private calendarService: CalendarService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    // Loading starts as true, load initial data
    this.loadMonthData(new Date());
  }

  /**
   * Load reservation data for current month
   */
  loadMonthData(date: Date): void {
    const year = date.getFullYear();
    const month = date.getMonth();
    const monthKey = `${year}-${month}`;
    const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });


    // Set loading immediately but schedule change detection
    this.loading = true;
    setTimeout(() => this.cdr.detectChanges(), 0);

    this.calendarService.getMonthReservations(year, month).subscribe({
      next: (data) => {
        this.monthData = data;

        // Refetch events to update calendar display
        if (this.calendarComponent) {
          const calendarApi = this.calendarComponent.getApi();

          // Log current view date before refetch
          const currentView = calendarApi.view.currentStart;

          calendarApi.refetchEvents();

          // Apply weather styling to all cells after events are loaded
          setTimeout(() => {
            this.applyWeatherStyling();
          }, 100);
        }

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }


  /**
   * Handle previous month button
   */
  handlePrevMonth(): void {
    if (!this.calendarComponent) return;

    const calendarApi = this.calendarComponent.getApi();
    const currentDate = calendarApi.view.currentStart;

    // Calculate previous month
    const prevMonth = new Date(currentDate);
    prevMonth.setMonth(prevMonth.getMonth() - 1);


    // Load data first, then navigate
    this.loadMonthDataThenNavigate(prevMonth, 'prev');
  }

  /**
   * Handle next month button
   */
  handleNextMonth(): void {
    if (!this.calendarComponent) return;

    const calendarApi = this.calendarComponent.getApi();
    const currentDate = calendarApi.view.currentStart;

    // Calculate next month
    const nextMonth = new Date(currentDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);


    // Load data first, then navigate
    this.loadMonthDataThenNavigate(nextMonth, 'next');
  }

  /**
   * Load month data, then navigate calendar
   */
  private loadMonthDataThenNavigate(date: Date, direction: 'prev' | 'next'): void {
    const year = date.getFullYear();
    const month = date.getMonth();
    const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    this.loading = true;
    setTimeout(() => this.cdr.detectChanges(), 0);

    this.calendarService.getMonthReservations(year, month).subscribe({
      next: (data) => {
        this.monthData = data;

        // Now navigate the calendar with the new data loaded
        if (this.calendarComponent) {
          const calendarApi = this.calendarComponent.getApi();

          // Use gotoDate to jump directly to the target month
          calendarApi.gotoDate(date);

          const viewDate = calendarApi.view.currentStart;

          // Refetch events with new data
          calendarApi.refetchEvents();
        }

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Handle event click (reservation clicked) - Show day details in dialog
   */
  handleEventClick(arg: EventClickArg): void {
    // Get the date from the event
    const eventDate = arg.event.start || new Date();
    const dateKey = this.calendarService.getDateKey(eventDate);
    const dayInfo = this.monthData.get(dateKey);

    if (dayInfo) {
      this.dialog.open(CalendarDayDetailsDialogComponent, {
        width: '700px',
        maxWidth: '95vw',
        data: {
          date: eventDate,
          dayInfo: dayInfo
        }
      });
    }
  }

  /**
   * Handle date cell click - Show day details in dialog
   */
  handleDateClick(arg: any): void {
    const clickedDate = arg.date;
    const dateKey = this.calendarService.getDateKey(clickedDate);
    const dayInfo = this.monthData.get(dateKey);

    if (dayInfo) {
      this.dialog.open(CalendarDayDetailsDialogComponent, {
        width: '700px',
        maxWidth: '95vw',
        data: {
          date: clickedDate,
          dayInfo: dayInfo
        }
      });
    }
  }

  /**
   * Custom event content renderer
   */
  renderEventContent(arg: any): any {
    const hours = arg.event.extendedProps['hours'];
    if (hours) {
      return {
        html: `
          <div class="fc-event-main-frame">
            <div class="fc-event-title-container">
              <div class="fc-event-title">${arg.event.title}</div>
            </div>
          </div>
        `
      };
    }
    return { html: arg.event.title };
  }

  /**
   * Navigate to dashboard
   */
  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  /**
   * Navigate to reservations with today's date
   */
  bookToday(): void {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    this.router.navigate(['/reservations'], {
      queryParams: { date: dateStr }
    });
  }

  /**
   * Get reserver name from reservation
   */
  getReserverName(reservation: Reservation): string {
    return this.calendarService.getReserverName(reservation);
  }

  /**
   * Debug method: Get all blocked reservations
   */
  getBlockedReservationsDebug(): any[] {
    const blocked: any[] = [];
    this.monthData.forEach((dayInfo, dateKey) => {
      dayInfo.reservations.forEach(reservation => {
        if (reservation.status === 'blocked') {
          blocked.push({
            date: dateKey,
            status: reservation.status,
            reason: reservation.blockReason || 'N/A',
            notes: reservation.blockNotes || 'N/A',
            timeSlot: reservation.timeSlot,
            endTimeSlot: reservation.endTimeSlot,
            duration: reservation.duration
          });
        }
      });
    });
    return blocked;
  }

  /**
   * Debug method: Get total reservations count
   */
  getTotalReservationsCount(): number {
    let count = 0;
    this.monthData.forEach((dayInfo) => {
      count += dayInfo.reservations.length;
    });
    return count;
  }

  /**
   * Handle event mounting - apply custom styles
   */
  handleEventDidMount(arg: any): void {
    const bgColor = arg.event.extendedProps.bgColor;
    if (bgColor && arg.el) {
      // Apply background color directly to the element
      arg.el.style.backgroundColor = bgColor;
      arg.el.style.borderColor = bgColor;
      arg.el.style.color = 'white';
      arg.el.style.opacity = '1';
      arg.el.style.visibility = 'visible';
    }
  }

  /**
   * Format time slot to 12-hour format with AM/PM
   */
  formatTimeSlot(timeSlot: number): string {
    if (timeSlot === 0) return '12AM';
    if (timeSlot < 12) return `${timeSlot}AM`;
    if (timeSlot === 12) return '12PM';
    return `${timeSlot - 12}PM`;
  }

  /**
   * Get reservation status counts for debugging
   */
  getReservationStatusCounts(): { [key: string]: number } {
    const counts: { [key: string]: number } = {};
    this.monthData.forEach((dayInfo) => {
      dayInfo.reservations.forEach(reservation => {
        const status = reservation.status || 'unknown';
        counts[status] = (counts[status] || 0) + 1;
      });
    });
    return counts;
  }

  /**
   * Get sample reservations for debugging
   */
  getSampleReservations(): any[] {
    const samples: any[] = [];
    let count = 0;
    this.monthData.forEach((dayInfo) => {
      if (count >= 5) return;
      dayInfo.reservations.forEach(reservation => {
        if (count >= 5) return;
        samples.push({
          date: reservation.date,
          status: reservation.status,
          timeSlot: reservation.timeSlot
        });
        count++;
      });
    });
    return samples;
  }

  /**
   * Get payment status border color
   */
  getPaymentStatusBorderColor(status: string): string {
    switch(status) {
      case 'paid': return '#4caf50';      // green
      case 'pending': return '#ff9800';   // orange
      case 'overdue': return '#dc2626';   // red
      default: return '#9e9e9e';          // gray for not_applicable
    }
  }

  /**
   * Get payment status border width
   */
  getPaymentStatusBorderWidth(status: string): string {
    return status === 'not_applicable' ? '3px' : '6px';
  }

  /**
   * Get debug information about reservations for UI display
   */
  getDebugReservations(): any[] {
    const debugInfo: any[] = [];
    let visibleCount = 0;
    let hiddenCount = 0;

    this.monthData.forEach((dayInfo, dateKey) => {
      dayInfo.reservations.forEach(reservation => {
        if (debugInfo.length >= 10) return; // Limit to 10 for readability

        const paymentStatus = reservation.paymentStatus || 'not_applicable';
        const isVisible = reservation.status === 'confirmed' || reservation.status === 'pending' || reservation.status === 'blocked' || reservation.status === 'completed' || reservation.status === 'no-show';

        if (isVisible) {
          visibleCount++;
        } else {
          hiddenCount++;
        }

        // Show first 10 reservations (mix of visible and hidden to compare)
        debugInfo.push({
          title: this.getReserverName(reservation),
          date: dateKey,
          timeSlot: this.formatTimeSlot(reservation.timeSlot),
          status: reservation.status,
          paymentStatus: paymentStatus,
          rawPaymentStatus: reservation.paymentStatus,
          borderColor: this.getPaymentStatusBorderColor(paymentStatus),
          borderWidth: this.getPaymentStatusBorderWidth(paymentStatus),
          isVisible: isVisible
        });
      });
    });

    // Add summary at the end
    if (debugInfo.length > 0) {
      debugInfo.push({
        title: `--- SUMMARY ---`,
        date: `Visible: ${visibleCount} | Hidden: ${hiddenCount}`,
        timeSlot: '',
        status: '',
        paymentStatus: '',
        borderColor: '',
        borderWidth: '',
        isVisible: true
      });
    }

    return debugInfo;
  }

  /**
   * Handle day cell mounting - apply rain forecast background tint
   */
  handleDayCellDidMount(arg: any): void {
    const cellDate = arg.date;
    const dateKey = this.calendarService.getDateKey(cellDate);
    const dayInfo = this.monthData.get(dateKey);

    if (!dayInfo || !dayInfo.hasWeatherData || dayInfo.maxRainChance === undefined) {
      return; // No weather data - use default styling
    }

    // Apply rain chance background tint
    const rainChance = dayInfo.maxRainChance;
    const backgroundColor = this.getRainBackgroundColor(rainChance);

    // Apply to day cell frame
    const dayFrame = arg.el.querySelector('.fc-daygrid-day-frame');
    if (dayFrame) {
      (dayFrame as HTMLElement).style.background = backgroundColor;
      (dayFrame as HTMLElement).style.transition = 'background 0.3s ease';

      // Remove any existing rain badges to prevent duplicates
      const existingBadge = dayFrame.querySelector('.rain-probability-badge');
      if (existingBadge) {
        existingBadge.remove();
      }

      // Add rain probability badge
      const rainBadge = document.createElement('div');
      rainBadge.className = 'rain-probability-badge';
      rainBadge.innerHTML = `<span class="rain-icon">☔</span> ${Math.round(rainChance)}%`;
      dayFrame.appendChild(rainBadge);
    }
  }

  /**
   * Calculate background color gradient based on rain probability
   */
  getRainBackgroundColor(rainChance: number): string {
    // Clamp between 0 and 100
    const chance = Math.max(0, Math.min(100, rainChance));

    // Calculate opacity: 0% = 0, 100% = 0.4 (maintain readability)
    const opacity = (chance / 100) * 0.4;

    // Blue gradient using primary blue (#3b82f6)
    return `linear-gradient(135deg,
      rgba(59, 130, 246, ${opacity * 0.8}) 0%,
      rgba(59, 130, 246, ${opacity}) 50%,
      rgba(37, 99, 235, ${opacity * 1.2}) 100%)`;
  }

  /**
   * Manually apply weather styling to all calendar day cells
   */
  applyWeatherStyling(): void {
    // Find all day cells in the DOM
    const dayCells = document.querySelectorAll('.fc-daygrid-day');

    dayCells.forEach((cell: any) => {
      // Get the date from the cell's data attribute
      const dateAttr = cell.getAttribute('data-date');
      if (!dateAttr) return;

      const dayInfo = this.monthData.get(dateAttr);

      if (!dayInfo || !dayInfo.hasWeatherData || dayInfo.maxRainChance === undefined) {
        return;
      }

      const rainChance = dayInfo.maxRainChance;
      const backgroundColor = this.getRainBackgroundColor(rainChance);

      // Apply to day cell frame
      const dayFrame = cell.querySelector('.fc-daygrid-day-frame');
      if (dayFrame) {
        (dayFrame as HTMLElement).style.background = backgroundColor;
        (dayFrame as HTMLElement).style.transition = 'background 0.3s ease';

        // Remove any existing rain badges to prevent duplicates
        const existingBadge = dayFrame.querySelector('.rain-probability-badge');
        if (existingBadge) {
          existingBadge.remove();
        }

        // Add rain probability badge
        const rainBadge = document.createElement('div');
        rainBadge.className = 'rain-probability-badge';
        rainBadge.innerHTML = `<span class="rain-icon">☔</span> ${Math.round(rainChance)}%`;
        dayFrame.appendChild(rainBadge);
      }
    });
  }

  /**
   * Get weather debug information for display
   */
  getWeatherDebugInfo(): any[] {
    const debugInfo: any[] = [];

    this.monthData.forEach((dayInfo, dateKey) => {
      debugInfo.push({
        date: dateKey,
        hasWeather: dayInfo.hasWeatherData,
        rainChance: dayInfo.maxRainChance,
        reservations: dayInfo.reservations.length
      });
    });

    // Sort by date
    debugInfo.sort((a, b) => a.date.localeCompare(b.date));

    return debugInfo.slice(0, 10); // Show first 10 days
  }
}
