import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { UIChart } from 'primeng/chart';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

interface SummaryCards {
  totalBookings: number;
  avgDailyUtilization: number;
  cancellationRate: number;
  noShowRate: number;
}

interface Insight {
  category: 'utilization' | 'noShow' | 'cancellation' | 'demand' | 'trend';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  icon: string;
}

interface Recommendation {
  type: 'scheduling' | 'noShow' | 'utilization' | 'engagement';
  priority: 'low' | 'medium' | 'high';
  action: string;
  detail: string;
  icon: string;
}

interface InsightsData {
  courtUtilization: Array<{ date: string; bookedSlots: number; totalSlots: number; utilization: number }>;
  peakHours: Array<{ hour: number; label: string; count: number; rank: number }>;
  bookingStatusBreakdown: {
    confirmed: number; completed: number; cancelled: number;
    noShow: number; pending: number; blocked: number; total: number;
  };
  dayOfWeekRanking: Array<{ dayNumber: number; dayName: string; count: number; percentage: number }>;
  weeklyTrend: Array<{ week: string; label: string; count: number; percentChange: number | null }>;
  summaryCards: SummaryCards;
  bookingTypeBreakdown: { coaching: number; regular: number; total: number };
  insights: Insight[];
  recommendations: Recommendation[];
}

@Component({
  selector: 'app-club-insights',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    UIChart,
  ],
  template: `
    <div class="insights-container">

      <!-- Page Header -->
      <div class="page-header">
        <div class="header-content">
          <div class="header-icon">
            <mat-icon>insights</mat-icon>
          </div>
          <div>
            <h1 class="page-title">Club Insights</h1>
            <p class="page-subtitle">Court booking intelligence with actionable trends</p>
          </div>
        </div>

        <!-- Date Range Filter -->
        <div class="filter-card">
          <div class="filter-title">
            <span>Reporting Window</span>
            <span class="filter-note">Local time</span>
          </div>
          <form class="filter-form" (ngSubmit)="loadData()" novalidate>
            <div class="field">
              <label for="startDate">Start date</label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                [ngModel]="startDate | date:'yyyy-MM-dd'"
                (ngModelChange)="onStartDateChange($event)"
              />
            </div>
            <div class="field">
              <label for="endDate">End date</label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                [ngModel]="endDate | date:'yyyy-MM-dd'"
                (ngModelChange)="onEndDateChange($event)"
              />
            </div>
            <div class="filter-actions">
              <button class="btn primary" type="submit" [disabled]="loading">
                <mat-icon>refresh</mat-icon>
                Apply
              </button>
              <button class="btn ghost" type="button" (click)="resetDates()" [disabled]="loading">
                Last 30 days
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Loading -->
      <div *ngIf="loading" class="loading-container">
        <mat-spinner diameter="48"></mat-spinner>
        <p>Loading club insights...</p>
      </div>

      <!-- Error -->
      <div *ngIf="error && !loading" class="error-card">
        <mat-icon>error_outline</mat-icon>
        <p>{{ error }}</p>
        <button class="btn ghost" type="button" (click)="loadData()">Retry</button>
      </div>

      <ng-container *ngIf="data && !loading">

        <!-- Summary Cards -->
        <div class="summary-grid">

          <div class="summary-card">
            <div class="summary-icon-wrap blue">
              <mat-icon>event_available</mat-icon>
            </div>
            <div class="summary-info">
              <span class="summary-value">{{ data.summaryCards.totalBookings }}</span>
              <span class="summary-label">Total Bookings</span>
            </div>
          </div>

          <div class="summary-card">
            <div class="summary-icon-wrap green">
              <mat-icon>sports_tennis</mat-icon>
            </div>
            <div class="summary-info">
              <span class="summary-value">{{ data.summaryCards.avgDailyUtilization }}%</span>
              <span class="summary-label">Avg Daily Utilization</span>
            </div>
          </div>

          <div class="summary-card">
            <div class="summary-icon-wrap orange">
              <mat-icon>cancel</mat-icon>
            </div>
            <div class="summary-info">
              <span class="summary-value">{{ data.summaryCards.cancellationRate }}%</span>
              <span class="summary-label">Cancellation Rate</span>
            </div>
          </div>

          <div class="summary-card">
            <div class="summary-icon-wrap teal">
              <mat-icon>sports</mat-icon>
            </div>
            <div class="summary-info">
              <span class="summary-value">{{ data.bookingTypeBreakdown.coaching }}</span>
              <span class="summary-label">Coaching Sessions</span>
            </div>
          </div>

        </div>

        <!-- Charts Grid -->
        <div class="charts-grid">

          <!-- Court Utilization -->
          <div class="chart-card wide">
            <div class="card-header">
              <div class="card-icon"><mat-icon>bar_chart</mat-icon></div>
              <div class="card-meta">
                <h3 class="card-title">Court Utilization by Day</h3>
                <p class="card-subtitle">% of available time slots booked (5 AM – 10 PM)</p>
              </div>
            </div>
            <div class="card-body">
              <p-chart *ngIf="utilizationChart" type="bar"
                [data]="utilizationChart" [options]="utilizationOptions" height="280px">
              </p-chart>
              <p *ngIf="!utilizationChart" class="no-data">No utilization data for this period.</p>
            </div>
          </div>

          <!-- Weekly Trend -->
          <div class="chart-card wide">
            <div class="card-header">
              <div class="card-icon"><mat-icon>trending_up</mat-icon></div>
              <div class="card-meta">
                <h3 class="card-title">Weekly Booking Trend</h3>
                <p class="card-subtitle">Bookings per week over the selected period</p>
              </div>
            </div>
            <div class="card-body">
              <p-chart *ngIf="weeklyChart" type="line"
                [data]="weeklyChart" [options]="lineOptions" height="280px">
              </p-chart>
              <p *ngIf="!weeklyChart" class="no-data">No weekly trend data for this period.</p>
            </div>
          </div>

          <!-- Peak Hours -->
          <div class="chart-card">
            <div class="card-header">
              <div class="card-icon"><mat-icon>schedule</mat-icon></div>
              <div class="card-meta">
                <h3 class="card-title">Peak Hours</h3>
                <p class="card-subtitle">Top 10 busiest time slots</p>
              </div>
            </div>
            <div class="card-body">
              <p-chart *ngIf="peakHoursChart" type="bar"
                [data]="peakHoursChart" [options]="peakHoursOptions" height="280px">
              </p-chart>
              <p *ngIf="!peakHoursChart" class="no-data">No peak hour data for this period.</p>
            </div>
          </div>

          <!-- Booking Status Breakdown -->
          <div class="chart-card">
            <div class="card-header">
              <div class="card-icon"><mat-icon>pie_chart</mat-icon></div>
              <div class="card-meta">
                <h3 class="card-title">Booking Status Breakdown</h3>
                <p class="card-subtitle">Distribution of all booking statuses</p>
              </div>
            </div>
            <div class="card-body">
              <p-chart *ngIf="statusChart" type="doughnut"
                [data]="statusChart" [options]="doughnutOptions" height="280px">
              </p-chart>
              <div *ngIf="data.bookingStatusBreakdown.total > 0" class="status-legend">
                <div class="legend-item" *ngFor="let item of statusLegend">
                  <span class="legend-dot" [style.background]="item.color"></span>
                  <span class="legend-label">{{ item.label }}</span>
                  <span class="legend-count">{{ item.count }}</span>
                </div>
              </div>
              <p *ngIf="!statusChart" class="no-data">No status data for this period.</p>
            </div>
          </div>

          <!-- Booking Type: Regular vs Coaching -->
          <div class="chart-card">
            <div class="card-header">
              <div class="card-icon"><mat-icon>sports</mat-icon></div>
              <div class="card-meta">
                <h3 class="card-title">Booking Type</h3>
                <p class="card-subtitle">Regular play vs Training / Coaching sessions</p>
              </div>
            </div>
            <div class="card-body">
              <p-chart *ngIf="bookingTypeChart" type="doughnut"
                [data]="bookingTypeChart" [options]="doughnutOptions" height="280px">
              </p-chart>
              <div *ngIf="data.bookingTypeBreakdown.total > 0" class="status-legend">
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
              </div>
              <p *ngIf="!bookingTypeChart" class="no-data">No booking data for this period.</p>
            </div>
          </div>

          <!-- Day-of-Week Ranking -->
          <div class="chart-card wide">
            <div class="card-header">
              <div class="card-icon"><mat-icon>calendar_view_week</mat-icon></div>
              <div class="card-meta">
                <h3 class="card-title">Day-of-Week Ranking</h3>
                <p class="card-subtitle">Which days see the most court activity</p>
              </div>
            </div>
            <div class="card-body">
              <p-chart *ngIf="dayOfWeekChart" type="bar"
                [data]="dayOfWeekChart" [options]="dayOfWeekOptions" height="260px">
              </p-chart>
              <div *ngIf="data.dayOfWeekRanking.length > 0" class="ranking-table">
                <div class="ranking-row header-row">
                  <span>Rank</span><span>Day</span><span>Bookings</span><span>Share</span>
                </div>
                <div class="ranking-row" *ngFor="let d of data.dayOfWeekRanking; let i = index">
                  <span class="rank-badge">{{ i + 1 }}</span>
                  <span>{{ d.dayName }}</span>
                  <span>{{ d.count }}</span>
                  <span>{{ d.percentage }}%</span>
                </div>
              </div>
              <p *ngIf="!dayOfWeekChart" class="no-data">No day-of-week data for this period.</p>
            </div>
          </div>

        </div>

        <!-- Intelligence Layer -->
        <div class="intelligence-grid">

          <!-- Insights Panel -->
          <div class="intel-panel">
            <div class="intel-panel-header">
              <mat-icon>psychology</mat-icon>
              <h2>Insights</h2>
              <span class="panel-badge">{{ data.insights.length }}</span>
            </div>
            <div class="insight-list">
              <div *ngFor="let insight of data.insights"
                   class="insight-card"
                   [class.severity-info]="insight.severity === 'info'"
                   [class.severity-warning]="insight.severity === 'warning'"
                   [class.severity-critical]="insight.severity === 'critical'">
                <mat-icon class="insight-icon">{{ insight.icon }}</mat-icon>
                <div class="insight-body">
                  <span class="insight-category">{{ categoryLabel(insight.category) }}</span>
                  <p class="insight-message">{{ insight.message }}</p>
                </div>
              </div>
              <p *ngIf="data.insights.length === 0" class="no-data">No insights generated for this period.</p>
            </div>
          </div>

          <!-- Recommendations Panel -->
          <div class="intel-panel">
            <div class="intel-panel-header">
              <mat-icon>lightbulb</mat-icon>
              <h2>Recommendations</h2>
              <span class="panel-badge">{{ data.recommendations.length }}</span>
            </div>
            <div class="recommendation-list">
              <div *ngFor="let rec of data.recommendations"
                   class="recommendation-card"
                   [class.priority-high]="rec.priority === 'high'"
                   [class.priority-medium]="rec.priority === 'medium'"
                   [class.priority-low]="rec.priority === 'low'">
                <div class="rec-header">
                  <mat-icon class="rec-icon">{{ rec.icon }}</mat-icon>
                  <span class="rec-action">{{ rec.action }}</span>
                  <span class="priority-chip" [class]="'chip-' + rec.priority">{{ rec.priority }}</span>
                </div>
                <p class="rec-detail">{{ rec.detail }}</p>
              </div>
              <p *ngIf="data.recommendations.length === 0" class="no-data">No recommendations at this time — the club is operating well!</p>
            </div>
          </div>

        </div>

      </ng-container>
    </div>
  `,
  styleUrl: './club-insights.component.scss',
})
export class ClubInsightsDashboardComponent implements OnInit, OnDestroy {
  loading = false;
  error: string | null = null;
  data: InsightsData | null = null;

  startDate: Date;
  endDate: Date;

  utilizationChart: any = null;
  peakHoursChart: any = null;
  statusChart: any = null;
  bookingTypeChart: any = null;
  dayOfWeekChart: any = null;
  weeklyChart: any = null;

  statusLegend: Array<{ label: string; count: number; color: string }> = [];

  private readonly STATUS_COLORS = {
    confirmed: '#4caf50',
    completed: '#2196f3',
    cancelled: '#f44336',
    noShow: '#ff9800',
    pending: '#9e9e9e',
    blocked: '#795548',
  };

  utilizationOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { min: 0, max: 100, ticks: { callback: (v: any) => v + '%' } },
      x: { ticks: { maxRotation: 45 } },
    },
  };

  lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true } },
  };

  peakHoursOptions = {
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

  dayOfWeekOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true } },
  };

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private snackBar: MatSnackBar,
  ) {
    const now = new Date();
    this.endDate = new Date(now);
    this.startDate = new Date(now);
    this.startDate.setDate(this.startDate.getDate() - 30);
  }

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {}

  onStartDateChange(value: string): void {
    this.startDate = this.parseDateInput(value, this.startDate);
  }

  onEndDateChange(value: string): void {
    this.endDate = this.parseDateInput(value, this.endDate);
  }

  resetDates(): void {
    const now = new Date();
    this.endDate = new Date(now);
    this.startDate = new Date(now);
    this.startDate.setDate(this.startDate.getDate() - 30);
    this.loadData();
  }

  categoryLabel(cat: string): string {
    const map: Record<string, string> = {
      utilization: 'Court Utilization',
      noShow: 'No-Shows',
      cancellation: 'Cancellations',
      demand: 'Demand Pattern',
      trend: 'Weekly Trend',
    };
    return map[cat] || cat;
  }

  loadData(): void {
    this.loading = true;
    this.error = null;

    const headers = new HttpHeaders({ Authorization: `Bearer ${this.authService.token}` });
    let params = new HttpParams();
    if (this.startDate) params = params.set('startDate', this.startDate.toISOString());
    if (this.endDate) params = params.set('endDate', this.endDate.toISOString());

    this.http
      .get<{ success: boolean; data: InsightsData }>(`${environment.apiUrl}/club-insights/reports`, {
        headers,
        params,
      })
      .subscribe({
        next: (res) => {
          this.data = res.data;
          this.buildCharts();
          this.loading = false;
        },
        error: (err) => {
          this.error = err.error?.message || 'Failed to load insights. Please try again.';
          this.loading = false;
          this.snackBar.open(this.error ?? 'Error', 'Dismiss', { duration: 4000 });
        },
      });
  }

  private buildCharts(): void {
    if (!this.data) return;

    // Utilization chart
    if (this.data.courtUtilization.length > 0) {
      this.utilizationChart = {
        labels: this.data.courtUtilization.map((d) => d.date),
        datasets: [{
          label: 'Utilization %',
          data: this.data.courtUtilization.map((d) => d.utilization),
          backgroundColor: 'rgba(14, 165, 164, 0.65)',
          borderColor: '#0ea5a4',
          borderWidth: 1,
          borderRadius: 4,
        }],
      };
    } else {
      this.utilizationChart = null;
    }

    // Peak hours chart (horizontal bar)
    if (this.data.peakHours.length > 0) {
      this.peakHoursChart = {
        labels: this.data.peakHours.map((h) => h.label),
        datasets: [{
          label: 'Bookings',
          data: this.data.peakHours.map((h) => h.count),
          backgroundColor: this.data.peakHours.map((_, i) =>
            i === 0 ? '#ef4444' : i === 1 ? '#f97316' : i === 2 ? '#fbbf24' : 'rgba(14,165,164,0.65)',
          ),
          borderRadius: 4,
        }],
      };
    } else {
      this.peakHoursChart = null;
    }

    // Status doughnut
    const bd = this.data.bookingStatusBreakdown;
    if (bd.total > 0) {
      const statusEntries = [
        { key: 'confirmed', label: 'Confirmed', count: bd.confirmed },
        { key: 'completed', label: 'Completed', count: bd.completed },
        { key: 'cancelled', label: 'Cancelled', count: bd.cancelled },
        { key: 'noShow', label: 'No-Show', count: bd.noShow },
        { key: 'pending', label: 'Pending', count: bd.pending },
        { key: 'blocked', label: 'Blocked', count: bd.blocked },
      ].filter((e) => e.count > 0);

      this.statusChart = {
        labels: statusEntries.map((e) => e.label),
        datasets: [{
          data: statusEntries.map((e) => e.count),
          backgroundColor: statusEntries.map(
            (e) => this.STATUS_COLORS[e.key as keyof typeof this.STATUS_COLORS],
          ),
        }],
      };

      this.statusLegend = statusEntries.map((e) => ({
        label: e.label,
        count: e.count,
        color: this.STATUS_COLORS[e.key as keyof typeof this.STATUS_COLORS],
      }));
    } else {
      this.statusChart = null;
      this.statusLegend = [];
    }

    // Booking type doughnut
    const btd = this.data.bookingTypeBreakdown;
    if (btd.total > 0) {
      this.bookingTypeChart = {
        labels: ['Regular Play', 'Training / Coaching'],
        datasets: [{
          data: [btd.regular, btd.coaching],
          backgroundColor: ['#4caf50', '#7c3aed'],
        }],
      };
    } else {
      this.bookingTypeChart = null;
    }

    // Day-of-week chart — sort by day number for display
    const sorted = [...this.data.dayOfWeekRanking].sort((a, b) => a.dayNumber - b.dayNumber);
    if (sorted.length > 0) {
      this.dayOfWeekChart = {
        labels: sorted.map((d) => d.dayName),
        datasets: [{
          label: 'Bookings',
          data: sorted.map((d) => d.count),
          backgroundColor: 'rgba(103, 58, 183, 0.7)',
          borderColor: '#673ab7',
          borderWidth: 1,
          borderRadius: 4,
        }],
      };
    } else {
      this.dayOfWeekChart = null;
    }

    // Weekly trend line
    if (this.data.weeklyTrend.length > 0) {
      this.weeklyChart = {
        labels: this.data.weeklyTrend.map((w) => w.week),
        datasets: [{
          label: 'Bookings',
          data: this.data.weeklyTrend.map((w) => w.count),
          fill: true,
          backgroundColor: 'rgba(14, 165, 164, 0.12)',
          borderColor: '#0ea5a4',
          borderWidth: 2,
          pointBackgroundColor: '#0ea5a4',
          tension: 0.3,
        }],
      };
    } else {
      this.weeklyChart = null;
    }
  }

  private parseDateInput(value: string, fallback: Date): Date {
    if (!value) return fallback;
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
  }
}
