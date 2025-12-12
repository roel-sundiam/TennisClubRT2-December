import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { DayReservationInfo, Reservation } from '../../services/calendar.service';

export interface CalendarDayDialogData {
  date: Date;
  dayInfo: DayReservationInfo;
}

@Component({
  selector: 'app-calendar-day-details-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './calendar-day-details-dialog.component.html',
  styleUrls: ['./calendar-day-details-dialog.component.css']
})
export class CalendarDayDetailsDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<CalendarDayDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CalendarDayDialogData,
    private router: Router
  ) {}

  /**
   * Close the dialog
   */
  close(): void {
    this.dialogRef.close();
  }

  /**
   * Navigate to booking page for this date
   */
  bookThisDay(): void {
    const date = this.data.date;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    this.dialogRef.close();
    this.router.navigate(['/reservations'], {
      queryParams: { date: dateStr }
    });
  }

  /**
   * Get reserver name from reservation
   */
  getReserverName(reservation: Reservation): string {
    if (typeof reservation.userId === 'object' && reservation.userId !== null) {
      return reservation.userId.fullName || reservation.userId.username;
    }
    return 'Unknown';
  }

  /**
   * Get time display for reservation
   */
  getTimeDisplay(reservation: Reservation): string {
    if (reservation.timeSlotDisplay) {
      return reservation.timeSlotDisplay;
    }

    const startHour = reservation.timeSlot;
    const endHour = reservation.endTimeSlot;

    const formatHour = (hour: number): string => {
      if (hour === 0) return '12 AM';
      if (hour < 12) return `${hour} AM`;
      if (hour === 12) return '12 PM';
      return `${hour - 12} PM`;
    };

    return `${formatHour(startHour)} - ${formatHour(endHour)}`;
  }

  /**
   * Check if date is in the past
   */
  isDateInPast(): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(this.data.date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  }

  /**
   * Get comma-separated list of player names
   */
  getPlayerNames(players: any[]): string {
    if (!players || players.length === 0) {
      return 'No players';
    }

    const names = players.map(player => {
      // Handle both string format (legacy) and object format
      if (typeof player === 'string') {
        return player;
      } else if (player && player.name) {
        return player.name;
      }
      return 'Unknown';
    });

    return names.join(', ');
  }

  /**
   * Get payment status label for display
   */
  getPaymentStatusLabel(paymentStatus: string): string {
    const labels: { [key: string]: string } = {
      'paid': 'Paid ✓',
      'pending': 'Pending Payment',
      'overdue': 'Overdue!',
      'not_applicable': 'N/A'
    };
    return labels[paymentStatus] || paymentStatus;
  }
}
