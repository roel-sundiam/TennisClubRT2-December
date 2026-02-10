import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { interval, Subscription } from 'rxjs';
import { switchMap, filter, tap } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

interface CourtUsageAPIResponse {
  success: boolean;
  data: CourtUsageData;
  message?: string;
  metadata?: {
    source: string;
    lastModified: string;
    cached: boolean;
    paymentIntegration?: boolean;
  };
}

interface CourtUsageData {
  summary: {
    totalMembers: number;
    totalRecordedPayments: number;
    totalRevenue: string;
    lastUpdated: string;
  };
  rawData: Array<any>;
  headers: string[];
}

@Component({
  selector: 'app-court-usage-report',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  template: `
    <div class="modern-page-container">
      <!-- Header Section -->
      <div class="page-header">
        <div class="header-content">
          <div class="title-section">
            <button class="back-btn" (click)="goBack()">
              <mat-icon>arrow_back</mat-icon>
            </button>
            <mat-icon class="page-icon">analytics</mat-icon>
            <div>
              <h1>Court Usage Report</h1>
              <p class="subtitle">Member contributions and recorded payments</p>
            </div>
          </div>
          <div class="header-actions">
            <button mat-raised-button class="refresh-btn" (click)="refreshData()" [disabled]="loading">
              <mat-icon>refresh</mat-icon>
              Refresh
            </button>
            <div class="toggle-container">
              <span class="toggle-label">Auto-refresh</span>
              <div class="toggle-switch">
                <input type="checkbox" id="autoRefresh" [checked]="autoRefreshEnabled" (change)="toggleAutoRefresh()">
                <label for="autoRefresh"></label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Stats Dashboard -->
      <div class="stats-dashboard" *ngIf="!loading && reportData">
        <div class="stat-card">
          <div class="stat-icon">
            <mat-icon>people</mat-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ reportData.summary.totalMembers }}</div>
            <div class="stat-label">Contributing Members</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon payments">
            <mat-icon>receipt_long</mat-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ reportData.summary.totalRecordedPayments }}</div>
            <div class="stat-label">Recorded Payments</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon revenue">
            <mat-icon>monetization_on</mat-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ reportData.summary.totalRevenue }}</div>
            <div class="stat-label">Total Revenue</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon time">
            <mat-icon>schedule</mat-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ getTimeAgo(reportData.summary.lastUpdated) }}</div>
            <div class="stat-label">Last Updated</div>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div class="loading-container" *ngIf="loading">
        <mat-spinner></mat-spinner>
        <p>Loading recorded payments data...</p>
      </div>

      <!-- Main Content -->
      <div class="content-section" *ngIf="!loading && reportData">
        <!-- Modern Data Table -->
        <div class="modern-table-container">
          <div class="table-header">
            <div class="table-title">
              <mat-icon>table_chart</mat-icon>
              <h2>Member Contributions Details</h2>
            </div>
            <div class="table-info">
              <span class="record-count">{{ reportData.rawData.length }} records</span>
            </div>
          </div>
          
          <div class="table-wrapper">
            <table mat-table [dataSource]="reportData.rawData" class="modern-data-table">
              <ng-container *ngFor="let column of reportData.headers; trackBy: trackByColumn" [matColumnDef]="column">
                <th mat-header-cell *matHeaderCellDef 
                    [ngClass]="['table-header-cell', column === 'Players/Members' ? 'frozen-header-cell' : '']">
                  {{ column }}
                </th>
                <td mat-cell *matCellDef="let element" 
                    [ngClass]="{
                      'member-name-cell': column === 'Players/Members',
                      'amount-cell': column === 'Total' || column.includes('2025'),
                      'total-cell': column === 'Total'
                    }">
                  {{ element[column] }}
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="reportData.headers; sticky: true" class="table-header-row"></tr>
              <tr mat-row *matRowDef="let row; columns: reportData.headers;" class="table-data-row"></tr>
            </table>
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div class="error-container" *ngIf="!loading && error">
        <div class="error-content">
          <mat-icon class="error-icon">error_outline</mat-icon>
          <h2>Unable to Load Report</h2>
          <p>{{ error }}</p>
          <button mat-raised-button color="primary" (click)="refreshData()">
            <mat-icon>refresh</mat-icon>
            Try Again
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./court-usage-report.component.scss']
})
export class CourtUsageReportComponent implements OnInit, OnDestroy {
  reportData: CourtUsageData | null = null;
  loading = true;
  error: string | null = null;
  lastUpdated: string | null = null;
  autoRefreshEnabled = true;
  nextUpdateCountdown = 30;
  
  private apiUrl = environment.apiBaseUrl;
  private autoRefreshSubscription?: Subscription;
  private countdownSubscription?: Subscription;
  private readonly REFRESH_INTERVAL = 30000; // 30 seconds

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.loadCourtUsageData();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  loadCourtUsageData(): void {
    this.loading = true;
    this.error = null;

    // Log API URL for debugging
    const apiEndpoint = `${this.apiUrl}/api/reports/static-court-usage`;
    console.log('🔗 Court Usage API URL:', apiEndpoint);
    console.log('🌍 Environment:', environment.production ? 'production' : 'development');

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.authService.token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });

    this.http.get<CourtUsageAPIResponse>(apiEndpoint, { 
      headers,
      observe: 'response'  // Get full response to see status codes
    }).subscribe({
      next: (httpResponse) => {
        const response = httpResponse.body;
        console.log('📊 Court Usage API Response:', httpResponse.status, response);
        
        if (response && response.success) {
          const isDataChanged = this.hasDataChanged(response.data);
          this.reportData = response.data;
          this.lastUpdated = response.metadata?.lastModified || response.data.summary.lastUpdated;
          
          if (isDataChanged && this.lastUpdated) {
            this.snackBar.open('📊 Recorded payments updated!', 'Close', {
              duration: 4000,
              panelClass: ['success-snack']
            });
          }
        } else {
          this.error = response?.message || 'Failed to load court usage data';
          console.error('❌ API returned unsuccessful response:', response);
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('❌ Error loading court usage data:', error);
        console.error('❌ Error status:', error.status);
        console.error('❌ Error message:', error.message);
        console.error('❌ Full error object:', JSON.stringify(error, null, 2));
        
        let errorMessage = 'Failed to load recorded payments data';
        if (error.status === 0) {
          errorMessage = 'Network error: Unable to connect to server. Please check your internet connection and try again.';
        } else if (error.status === 401) {
          errorMessage = 'Authentication error: Please log in again';
          // Redirect to login if authentication fails
          this.authService.logout();
        } else if (error.status === 403) {
          errorMessage = 'Access denied: You do not have permission to view this report';
        } else if (error.status === 404) {
          errorMessage = 'API endpoint not found. Please contact support if this persists.';
        } else if (error.status === 500) {
          errorMessage = 'Server error: There was a problem processing your request. Please try again later.';
        } else if (error.status >= 500) {
          errorMessage = 'Server unavailable: The service is temporarily unavailable. Please try again later.';
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        } else if (error.name === 'TimeoutError') {
          errorMessage = 'Request timeout: The server is taking too long to respond. Please try again.';
        }
        
        this.error = errorMessage;
        this.loading = false;
        this.snackBar.open(`Error: ${errorMessage}`, 'Close', {
          duration: 10000,
          panelClass: ['error-snack']
        });
      }
    });
  }

  refreshData(): void {
    this.loadCourtUsageData();
  }

  goBack(): void {
    this.location.back();
  }

  getLastUpdated(): string {
    if (!this.reportData?.summary.lastUpdated) return '';
    const date = new Date(this.reportData.summary.lastUpdated);
    return date.toLocaleDateString();
  }

  trackByColumn(index: number, column: string): string {
    return column;
  }

  private hasDataChanged(newData: CourtUsageData): boolean {
    if (!this.reportData) return true;
    return JSON.stringify(this.reportData) !== JSON.stringify(newData);
  }

  private startAutoRefresh(): void {
    if (this.autoRefreshEnabled) {
      this.autoRefreshSubscription = interval(this.REFRESH_INTERVAL)
        .pipe(
          filter(() => this.autoRefreshEnabled),
          switchMap(() => {
            if (!this.loading) {
              return this.http.get<CourtUsageAPIResponse>(
                `${this.apiUrl}/api/reports/static-court-usage`,
                {
                  headers: new HttpHeaders({
                    'Authorization': `Bearer ${this.authService.token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                  })
                }
              );
            }
            return [];
          })
        )
        .subscribe({
          next: (response: CourtUsageAPIResponse) => {
            if (response.success) {
              const isDataChanged = this.hasDataChanged(response.data);
              this.reportData = response.data;
              this.lastUpdated = response.metadata?.lastModified || response.data.summary.lastUpdated;
              
              if (isDataChanged) {
                console.log('🔄 Recorded payments data auto-updated');
                this.snackBar.open('📊 Data refreshed automatically', 'Close', {
                  duration: 2000,
                  panelClass: ['info-snack']
                });
              }
            }
          },
          error: (error) => {
            console.error('Auto-refresh error:', error);
          }
        });

      this.startCountdown();
    }
  }

  private startCountdown(): void {
    this.nextUpdateCountdown = this.REFRESH_INTERVAL / 1000;
    this.countdownSubscription = interval(1000).subscribe(() => {
      if (this.nextUpdateCountdown > 0) {
        this.nextUpdateCountdown--;
      } else {
        this.nextUpdateCountdown = this.REFRESH_INTERVAL / 1000;
      }
    });
  }

  private stopAutoRefresh(): void {
    this.autoRefreshSubscription?.unsubscribe();
    this.countdownSubscription?.unsubscribe();
  }

  toggleAutoRefresh(): void {
    this.autoRefreshEnabled = !this.autoRefreshEnabled;
    
    if (this.autoRefreshEnabled) {
      this.startAutoRefresh();
      this.snackBar.open('🔄 Auto-refresh enabled', 'Close', {
        duration: 2000,
        panelClass: ['success-snack']
      });
    } else {
      this.stopAutoRefresh();
      this.snackBar.open('⏸️ Auto-refresh disabled', 'Close', {
        duration: 2000,
        panelClass: ['info-snack']
      });
    }
  }

  getTimeAgo(dateString: string): string {
    const now = new Date().getTime();
    const updated = new Date(dateString).getTime();
    const diffSeconds = Math.floor((now - updated) / 1000);
    
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    return `${Math.floor(diffSeconds / 86400)}d ago`;
  }



}