import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { UIChart } from 'primeng/chart';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

interface QuietHour {
  hour: number;
  label: string;
  shortLabel: string;
  count: number;
  rank: number;
}

interface DayRanking {
  dayNumber: number;
  dayName: string;
  count: number;
  percentage: number;
}

interface TrendsData {
  peakHours: QuietHour[];
  quietHours: QuietHour[];
  dayOfWeekRanking: DayRanking[];
  avgUtilization: number;
  bookingTypeBreakdown: { coaching: number; regular: number; total: number };
  myStats: {
    totalBookings: number;
    upcomingCount: number;
    cancelledCount: number;
    preferredDay: string | null;
    preferredHour: string | null;
  };
}

@Component({
  selector: 'app-court-trends',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    UIChart,
  ],
  template: `
    <div class="trends-container">

      <!-- Header -->
      <div class="page-header">
        <div class="header-icon">
          <mat-icon>trending_up</mat-icon>
        </div>
        <div>
          <h1 class="page-title">Court Trends</h1>
          <p class="page-subtitle">Based on club activity from the last 30 days</p>
        </div>
      </div>

      <!-- Loading -->
      <div *ngIf="loading" class="loading-container">
        <mat-spinner diameter="44"></mat-spinner>
        <p>Loading court trends...</p>
      </div>

      <!-- Error -->
      <div *ngIf="error && !loading" class="error-card">
        <mat-icon>error_outline</mat-icon>
        <p>{{ error }}</p>
        <button class="btn ghost" (click)="loadData()">Retry</button>
      </div>

      <ng-container *ngIf="data && !loading">

        <!-- My Stats Row -->
        <section class="section">
          <h2 class="section-label">
            <mat-icon>person</mat-icon>
            My Activity (last 30 days)
          </h2>
          <div class="stats-grid">

            <div class="stat-card">
              <div class="stat-icon blue"><mat-icon>event_available</mat-icon></div>
              <div class="stat-info">
                <span class="stat-value">{{ data.myStats.totalBookings }}</span>
                <span class="stat-label">My Bookings</span>
              </div>
            </div>

            <div class="stat-card">
              <div class="stat-icon green"><mat-icon>upcoming</mat-icon></div>
              <div class="stat-info">
                <span class="stat-value">{{ data.myStats.upcomingCount }}</span>
                <span class="stat-label">Upcoming</span>
              </div>
            </div>

            <div class="stat-card">
              <div class="stat-icon teal"><mat-icon>calendar_today</mat-icon></div>
              <div class="stat-info">
                <span class="stat-value">{{ data.myStats.preferredDay || '—' }}</span>
                <span class="stat-label">Favourite Day</span>
              </div>
            </div>

            <div class="stat-card">
              <div class="stat-icon purple"><mat-icon>schedule</mat-icon></div>
              <div class="stat-info">
                <span class="stat-value preferred-hour">{{ data.myStats.preferredHour || '—' }}</span>
                <span class="stat-label">Favourite Time</span>
              </div>
            </div>

          </div>
        </section>

        <!-- Quietest Slots -->
        <section class="section" *ngIf="data.quietHours.length > 0">
          <h2 class="section-label">
            <mat-icon>event_available</mat-icon>
            Best Times to Book
          </h2>
          <p class="section-hint">These time slots typically have the least competition — ideal for last-minute bookings.</p>
          <div class="quiet-chips">
            <div class="quiet-chip" *ngFor="let h of data.quietHours">
              <mat-icon>check_circle</mat-icon>
              <span>{{ h.label }}</span>
            </div>
          </div>
        </section>

        <!-- Utilization Banner -->
        <section class="utilization-banner">
          <div class="util-icon"><mat-icon>sports_tennis</mat-icon></div>
          <div class="util-body">
            <div class="util-number">{{ data.avgUtilization }}%</div>
            <div class="util-label">Court Utilization (last 30 days)</div>
            <div class="util-context">{{ utilizationContext }}</div>
          </div>
          <div class="util-bar-wrap">
            <div class="util-bar" [style.width.%]="data.avgUtilization"></div>
          </div>
        </section>

        <!-- Charts Grid -->
        <div class="charts-grid">

          <!-- Day-of-Week Activity -->
          <div class="chart-card wide">
            <div class="card-header">
              <div class="card-icon"><mat-icon>calendar_view_week</mat-icon></div>
              <div class="card-meta">
                <h3 class="card-title">Day-of-Week Activity</h3>
                <p class="card-subtitle">Which days are most popular — plan your bookings accordingly</p>
              </div>
            </div>
            <div class="card-body">
              <p-chart *ngIf="dayChart" type="bar"
                [data]="dayChart" [options]="dayChartOptions" height="260px">
              </p-chart>
              <div *ngIf="data.dayOfWeekRanking.length > 0" class="day-ranking">
                <ng-container *ngFor="let d of data.dayOfWeekRanking; let i = index">
                  <div class="day-row" [class.top-day]="i === 0">
                    <span class="day-rank">{{ i + 1 }}</span>
                    <span class="day-name">{{ d.dayName }}</span>
                    <div class="day-bar-wrap">
                      <div class="day-bar" [style.width.%]="d.percentage"></div>
                    </div>
                    <span class="day-pct">{{ d.percentage }}%</span>
                  </div>
                </ng-container>
              </div>
            </div>
          </div>

          <!-- Peak Hours -->
          <div class="chart-card">
            <div class="card-header">
              <div class="card-icon warn"><mat-icon>schedule</mat-icon></div>
              <div class="card-meta">
                <h3 class="card-title">Busiest Hours</h3>
                <p class="card-subtitle">Slots that fill up fastest — book ahead for these times</p>
              </div>
            </div>
            <div class="card-body">
              <p-chart *ngIf="peakChart" type="bar"
                [data]="peakChart" [options]="peakChartOptions" height="280px">
              </p-chart>
              <p *ngIf="!peakChart" class="no-data">No peak hour data yet.</p>
            </div>
          </div>

          <!-- Booking Type -->
          <div class="chart-card">
            <div class="card-header">
              <div class="card-icon purple-bg"><mat-icon>sports</mat-icon></div>
              <div class="card-meta">
                <h3 class="card-title">Booking Type</h3>
                <p class="card-subtitle">Regular play vs coaching / training sessions</p>
              </div>
            </div>
            <div class="card-body">
              <p-chart *ngIf="typeChart" type="doughnut"
                [data]="typeChart" [options]="doughnutOptions" height="240px">
              </p-chart>
              <div *ngIf="data.bookingTypeBreakdown.total > 0" class="type-legend">
                <div class="legend-item">
                  <span class="legend-dot" style="background:#4caf50"></span>
                  <span class="legend-label">Regular Play</span>
                  <span class="legend-count">{{ data.bookingTypeBreakdown.regular }}</span>
                </div>
                <div class="legend-item">
                  <span class="legend-dot" style="background:#7c3aed"></span>
                  <span class="legend-label">Training / Coaching</span>
                  <span class="legend-count">{{ data.bookingTypeBreakdown.coaching }}</span>
                </div>
                <div class="legend-note" *ngIf="data.bookingTypeBreakdown.coaching > 0">
                  {{ coachingPct }}% of court time is coaching sessions
                </div>
              </div>
              <p *ngIf="!typeChart" class="no-data">No booking data yet.</p>
            </div>
          </div>

        </div>

      </ng-container>
    </div>
  `,
  styleUrl: './court-trends.component.scss',
})
export class CourtTrendsComponent implements OnInit {
  loading = false;
  error: string | null = null;
  data: TrendsData | null = null;

  dayChart: any = null;
  peakChart: any = null;
  typeChart: any = null;

  dayChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true } },
  };

  peakChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: { legend: { display: false } },
    scales: { x: { beginAtZero: true } },
  };

  doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
  };

  get utilizationContext(): string {
    const u = this.data?.avgUtilization ?? 0;
    if (u < 20) return 'The court is lightly used — plenty of room for everyone.';
    if (u < 50) return 'Court demand is moderate — booking is usually easy.';
    if (u < 80) return 'Court demand is healthy — book a bit ahead for popular times.';
    return 'Court is very busy — book as early as possible, especially at peak hours.';
  }

  get coachingPct(): number {
    const btd = this.data?.bookingTypeBreakdown;
    if (!btd || btd.total === 0) return 0;
    return Math.round((btd.coaching / btd.total) * 100);
  }

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.error = null;

    const headers = new HttpHeaders({ Authorization: `Bearer ${this.authService.token}` });

    this.http
      .get<{ success: boolean; data: TrendsData }>(`${environment.apiUrl}/member-trends`, { headers })
      .subscribe({
        next: (res) => {
          this.data = res.data;
          this.buildCharts();
          this.loading = false;
        },
        error: (err) => {
          this.error = err.error?.message || 'Failed to load court trends. Please try again.';
          this.loading = false;
          this.snackBar.open(this.error ?? 'Error', 'Dismiss', { duration: 4000 });
        },
      });
  }

  private buildCharts(): void {
    if (!this.data) return;

    // Day-of-week bar (sorted by day number for chronological display)
    const sortedDays = [...this.data.dayOfWeekRanking].sort((a, b) => a.dayNumber - b.dayNumber);
    if (sortedDays.length > 0) {
      this.dayChart = {
        labels: sortedDays.map((d) => d.dayName.slice(0, 3)),
        datasets: [{
          label: 'Bookings',
          data: sortedDays.map((d) => d.count),
          backgroundColor: sortedDays.map((d) => {
            const topDay = this.data!.dayOfWeekRanking[0];
            return d.dayNumber === topDay?.dayNumber
              ? 'rgba(14,165,164,0.85)'
              : 'rgba(14,165,164,0.4)';
          }),
          borderColor: '#0ea5a4',
          borderWidth: 1,
          borderRadius: 6,
        }],
      };
    } else {
      this.dayChart = null;
    }

    // Peak hours horizontal bar
    if (this.data.peakHours.length > 0) {
      this.peakChart = {
        labels: this.data.peakHours.map((h) => h.label),
        datasets: [{
          label: 'Bookings',
          data: this.data.peakHours.map((h) => h.count),
          backgroundColor: this.data.peakHours.map((_, i) =>
            i === 0 ? '#ef4444' : i === 1 ? '#f97316' : i === 2 ? '#fbbf24' : 'rgba(14,165,164,0.55)',
          ),
          borderRadius: 4,
        }],
      };
    } else {
      this.peakChart = null;
    }

    // Booking type doughnut
    const btd = this.data.bookingTypeBreakdown;
    if (btd.total > 0) {
      this.typeChart = {
        labels: ['Regular Play', 'Training / Coaching'],
        datasets: [{
          data: [btd.regular, btd.coaching],
          backgroundColor: ['#4caf50', '#7c3aed'],
        }],
      };
    } else {
      this.typeChart = null;
    }
  }
}
