import { Component, OnInit, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { environment } from '../../../environments/environment';

interface Player {
  name?: string;
  fullName?: string;
  isGuest?: boolean;
  isMember?: boolean;
}

interface Reservation {
  _id: string;
  userId: any;
  date: string;
  timeSlot: number;
  endTimeSlot: number;
  duration: number;
  players: Player[];
  status: string;
  blockReason?: string;
  blockNotes?: string;
}

@Component({
  selector: 'app-tomorrow-schedule-share-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './tomorrow-schedule-share-dialog.component.html',
  styleUrls: ['./tomorrow-schedule-share-dialog.component.css']
})
export class TomorrowScheduleShareDialogComponent implements OnInit {
  @ViewChild('scheduleCard') scheduleCard!: ElementRef<HTMLDivElement>;

  private apiUrl = environment.apiUrl || 'http://localhost:3000/api';

  loading = true;
  error = false;
  reservations: Reservation[] = [];
  tomorrowDate!: Date;
  tomorrowDateStr!: string;
  availableSlots: number[] = [];
  isDownloading = false;
  isCopying = false;

  private readonly ALL_SLOTS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
  readonly HOMEOWNER_TIME_START = 18; // 6 PM
  readonly HOMEOWNER_TIME_END = 20;   // 8 PM

  private dialogRef = inject(MatDialogRef<TomorrowScheduleShareDialogComponent>);
  private http = inject(HttpClient);
  private snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    this.tomorrowDate = tomorrow;
    const y = tomorrow.getFullYear();
    const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const d = String(tomorrow.getDate()).padStart(2, '0');
    this.tomorrowDateStr = `${y}-${m}-${d}`;
    console.log('📅 Tomorrow Schedule Dialog initialized:', this.tomorrowDateStr);
    this.fetchSchedule();
  }

  private fetchSchedule(): void {
    this.http.get<any>(`${this.apiUrl}/reservations/date/${this.tomorrowDateStr}`).subscribe({
      next: (response) => {
        let all: Reservation[] = [];
        if (Array.isArray(response)) {
          all = response;
        } else if (response?.data?.reservations) {
          all = response.data.reservations;
        } else if (Array.isArray(response?.data)) {
          all = response.data;
        } else if (Array.isArray(response?.reservations)) {
          all = response.reservations;
        }

        this.reservations = all
          .filter(r => r.status === 'confirmed' || r.status === 'pending' || r.status === 'blocked')
          .sort((a, b) => a.timeSlot - b.timeSlot);

        this.computeAvailableSlots();
        this.loading = false;
        console.log('✅ Schedule loaded successfully. Loading:', this.loading, 'Error:', this.error);
      },
      error: (err) => {
        console.error('❌ Failed to load schedule:', err);
        this.error = true;
        this.loading = false;
      }
    });
  }

  private computeAvailableSlots(): void {
    const bookedHours = new Set<number>();
    for (const r of this.reservations) {
      const end = r.endTimeSlot || (r.timeSlot + (r.duration || 1));
      for (let h = r.timeSlot; h < end; h++) {
        bookedHours.add(h);
      }
    }
    // Exclude Homeowner's Time slots on Wednesdays
    if (this.isTomorrowWednesday) {
      for (let h = this.HOMEOWNER_TIME_START; h < this.HOMEOWNER_TIME_END; h++) {
        bookedHours.add(h);
      }
    }
    this.availableSlots = this.ALL_SLOTS.filter(slot => !bookedHours.has(slot));
  }

  getReserverName(r: Reservation): string {
    if (r.status === 'blocked') return r.blockNotes || r.blockReason || 'Court Blocked';
    const userId = r.userId;
    if (userId && typeof userId === 'object') {
      return userId.fullName || userId.username || 'Unknown';
    }
    return 'Unknown';
  }

  getTimeRange(r: Reservation): string {
    return `${this.formatHour(r.timeSlot)} – ${this.formatHour(r.endTimeSlot || r.timeSlot + (r.duration || 1))}`;
  }

  getGuestCount(r: Reservation): number {
    return (r.players || []).filter(p => p.isGuest).length;
  }

  getMemberPlayers(r: Reservation): string {
    const members = (r.players || []).filter(p => !p.isGuest);
    return members.map(p => p.name || p.fullName || '').filter(Boolean).join(', ');
  }

  formatHour(h: number): string {
    if (h === 0) return '12:00 AM';
    if (h < 12) return `${h}:00 AM`;
    if (h === 12) return '12:00 PM';
    return `${h - 12}:00 PM`;
  }

  formatSlot(h: number): string {
    if (h === 0) return '12AM';
    if (h < 12) return `${h}AM`;
    if (h === 12) return '12PM';
    return `${h - 12}PM`;
  }

  get isTomorrowWednesday(): boolean {
    return this.tomorrowDate?.getDay() === 3;
  }

  get homeownerTimeRange(): string {
    return `${this.formatHour(this.HOMEOWNER_TIME_START)} – ${this.formatHour(this.HOMEOWNER_TIME_END)}`;
  }

  get formattedDate(): string {
    return this.tomorrowDate.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  get bookedReservations(): Reservation[] {
    return this.reservations.filter(r => r.status !== 'blocked');
  }

  get blockedReservations(): Reservation[] {
    return this.reservations.filter(r => r.status === 'blocked');
  }

  async copyImage(): Promise<void> {
    this.isCopying = true;
    try {
      const canvas = await this.renderCanvas();
      canvas.toBlob(async (blob) => {
        if (!blob) {
          this.snackBar.open('Copy failed. Try "Save as Image" instead.', 'OK', { duration: 3000 });
          return;
        }
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          this.snackBar.open('Image copied! Paste it anywhere.', 'OK', { duration: 3000 });
        } catch {
          this.snackBar.open('Copy not supported in this browser. Use "Save as Image".', 'OK', { duration: 4000 });
        }
      }, 'image/png');
    } catch {
      this.snackBar.open('Failed to render image.', 'OK', { duration: 3000 });
    } finally {
      this.isCopying = false;
    }
  }

  async downloadImage(): Promise<void> {
    this.isDownloading = true;
    try {
      const canvas = await this.renderCanvas();
      const link = document.createElement('a');
      link.download = `court-schedule-${this.tomorrowDateStr}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      this.snackBar.open('Image downloaded!', 'OK', { duration: 3000 });
    } catch {
      this.snackBar.open('Download failed.', 'OK', { duration: 3000 });
    } finally {
      this.isDownloading = false;
    }
  }

  private async renderCanvas(): Promise<HTMLCanvasElement> {
    const html2canvas = (await import('html2canvas')).default;
    return html2canvas(this.scheduleCard.nativeElement, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
