import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule, MatTabGroup } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { interval, Subscription } from 'rxjs';
import { switchMap, filter, tap } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { ExpenseReportComponent } from '../expense-report/expense-report.component';

interface FinancialAPIResponse {
  success: boolean;
  data: FinancialStatementData;
  message?: string;
  metadata?: {
    source: string;
    lastModified: string;
    cached: boolean;
  };
}

interface ServiceFeeLiability {
  totalAccrued: number;
  totalPaid: number;
  remainingLiability: number;
}

interface FinancialStatementData {
  clubName: string;
  location: string;
  statementTitle: string;
  period: string;
  beginningBalance: {
    date: string;
    amount: number;
  };
  receiptsCollections: Array<{
    description: string;
    amount: number;
    highlighted?: boolean;
  }>;
  totalReceipts: number;
  disbursementsExpenses: Array<{
    description: string;
    amount: number;
  }>;
  totalDisbursements: number;
  netIncome: number;
  fundBalance: number;
  lastUpdated: string;
  liabilities?: {
    appServiceFee: ServiceFeeLiability;
  };
}

interface CourtUsageAPIResponse {
  success: boolean;
  data: CourtUsageData;
  message?: string;
  metadata?: {
    source: string;
    lastModified: string;
    cached: boolean;
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
  selector: 'app-financial-report',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTabsModule,
    MatTooltipModule,
    ExpenseReportComponent
  ],
  template: `
    <div class="financial-statement-container">
      <!-- Header with Club Logo and Title -->
      <div class="statement-header" *ngIf="!loading && financialData">
        <div class="club-logo">
          <img src="/images/rt2-logo.png" alt="Rich Town 2 Tennis Club" class="club-logo-img">
        </div>
        <div class="header-content">
          <h1 class="club-name">{{ financialData.clubName }}</h1>
          <p class="club-location">{{ financialData.location }}</p>
          <h2 class="statement-title">Financial Reports</h2>
          <p class="statement-period">{{ financialData.period }}</p>
        </div>
        <div class="refresh-section">
          <div class="update-status" *ngIf="lastUpdated">
            <span class="last-updated">Updated {{ getTimeAgo(lastUpdated) }}</span>
            <div class="connection-status" *ngIf="socketConnected">
              <mat-icon class="connected-icon">wifi</mat-icon>
              <span class="status-text">Real-time</span>
            </div>
            <div class="auto-refresh-indicator" *ngIf="autoRefreshEnabled && !socketConnected">
              <mat-icon class="pulse-icon">sync</mat-icon>
              <span class="next-update">Next: {{ nextUpdateCountdown }}s</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div class="loading-container" *ngIf="loading">
        <mat-spinner></mat-spinner>
        <p>Loading financial statement...</p>
      </div>

      <!-- Tabbed Content -->
      <div class="tabs-container" *ngIf="!loading && financialData">
        <mat-tab-group #tabGroup class="financial-tabs">
          <!-- Financial Statement Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>account_balance</mat-icon>
              Financial Statement
            </ng-template>
            
            <!-- Financial Statement Content -->
            <div class="statement-content">
        <div class="statement-body">
          <!-- Beginning Balance -->
          <div class="statement-section beginning-balance">
            <div class="balance-row">
              <div class="balance-title">BEGINNING BALANCE: {{ financialData.beginningBalance.date }}</div>
              <div class="balance-amount">{{ formatCurrency(financialData.beginningBalance.amount) }}</div>
            </div>
          </div>

          <!-- Receipts/Collections -->
          <div class="statement-section receipts-section">
            <div class="section-header">
              <div class="section-title">RECEIPTS/COLLECTIONS</div>
            </div>
            <div class="section-items">
              <div class="line-item" *ngFor="let item of getReceiptsWithoutTournament(); let last = last" 
                   [class.highlighted]="item.highlighted">
                <div class="item-description">{{ item.description }}</div>
                <div class="item-amount">{{ formatCurrency(item.amount) }}</div>
                <div class="total-amount" *ngIf="last">{{ formatCurrency(financialData.totalReceipts) }}</div>
              </div>
            </div>
          </div>

          <!-- Disbursements/Expenses -->
          <div class="statement-section disbursements-section">
            <div class="section-header">
              <div class="section-title">DISBURSEMENTS/EXPENSES</div>
              <button mat-icon-button
                      (click)="switchToExpenseTab()"
                      matTooltip="Manage Expenses (Edit/Delete)"
                      class="manage-expenses-btn">
                <mat-icon>edit</mat-icon>
              </button>
            </div>
            <div class="section-items">
              <div class="line-item" *ngFor="let item of financialData.disbursementsExpenses; let last = last">
                <div class="item-description">{{ item.description }}</div>
                <div class="item-amount">{{ formatCurrency(item.amount) }}</div>
                <div class="disbursement-totals" *ngIf="last">
                  <div class="total-disbursements">({{ formatCurrency(financialData.totalDisbursements) }})</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Liabilities Section -->
          <div class="statement-section liabilities-section" *ngIf="financialData.liabilities?.appServiceFee">
            <div class="section-header">
              <div class="section-title">LIABILITIES</div>
            </div>
            <div class="section-items">
              <div class="line-item liability-item">
                <div class="item-description">Accrued App Service Fee (10%)</div>
                <div class="item-amount">{{ formatCurrency(financialData.liabilities.appServiceFee.totalAccrued) }}</div>
              </div>
              <div class="line-item liability-item paid" *ngIf="financialData.liabilities.appServiceFee.totalPaid > 0">
                <div class="item-description indent">Less: Paid to Developer</div>
                <div class="item-amount negative">({{ formatCurrency(financialData.liabilities.appServiceFee.totalPaid) }})</div>
              </div>
              <div class="line-item liability-item total">
                <div class="item-description strong">Remaining Liability</div>
                <div class="item-amount highlight strong">{{ formatCurrency(financialData.liabilities.appServiceFee.remainingLiability) }}</div>
              </div>
            </div>
          </div>

          <!-- Fund Balance -->
          <div class="statement-section fund-balance">
            <div class="balance-row final-balance">
              <div class="balance-title">FUND BALANCE</div>
              <div class="balance-amount">{{ formatCurrency(financialData.fundBalance) }}</div>
            </div>
          </div>
            </div>
          </div>
          </mat-tab>

          <!-- Expense Report Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>receipt_long</mat-icon>
              Expense Report
            </ng-template>
            
            <!-- Expense Report Content -->
            <div class="expense-tab-content">
              <app-expense-report></app-expense-report>
            </div>
          </mat-tab>
        </mat-tab-group>
      </div>

      <!-- Error State -->
      <div class="error-container" *ngIf="!loading && error">
        <div class="error-content">
          <mat-icon class="error-icon">error_outline</mat-icon>
          <h2>Unable to Load Financial Statement</h2>
          <p>{{ error }}</p>
          <button mat-raised-button color="primary" (click)="refreshData()">
            <mat-icon>refresh</mat-icon>
            Try Again
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./financial-report.component.scss']
})
export class FinancialReportComponent implements OnInit, OnDestroy {
  @ViewChild('tabGroup') tabGroup!: MatTabGroup;

  financialData: FinancialStatementData | null = null;
  loading = true;
  error: string | null = null;
  lastUpdated: string | null = null;
  autoRefreshEnabled = true;
  nextUpdateCountdown = 30;

  private apiUrl = environment.apiUrl;
  private autoRefreshSubscription?: Subscription;
  private countdownSubscription?: Subscription;
  private readonly REFRESH_INTERVAL = 30000; // 30 seconds
  private socket: Socket | null = null;
  public socketConnected = false;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadFinancialStatement();
    this.initializeWebSocket();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
    this.disconnectWebSocket();
  }

  loadFinancialStatement(): void {
    this.loading = true;
    this.error = null;

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.authService.token}`
    });

    // Load both financial statement and court usage data
    const financialRequest = this.http.get<FinancialAPIResponse>(
      `${this.apiUrl}/reports/financial-sheet`,
      { headers }
    );
    
    const courtUsageRequest = this.http.get<CourtUsageAPIResponse>(
      `${this.apiUrl}/reports/static-court-usage`,
      { headers }
    );

    // Combine both requests with individual error handling
    Promise.allSettled([
      financialRequest.toPromise(),
      courtUsageRequest.toPromise()
    ]).then(([financialResult, courtUsageResult]) => {
      let updatedFinancialData: FinancialStatementData | null = null;
      let hasCourtUsageData = false;

      // Handle financial data result
      if (financialResult.status === 'fulfilled' && financialResult.value?.success) {
        updatedFinancialData = financialResult.value.data;
        this.lastUpdated = financialResult.value.metadata?.lastModified || financialResult.value.data.lastUpdated;
      } else {
        this.error = 'Failed to load financial statement';
        this.loading = false;
        return;
      }

      // Handle court usage data result (optional)
      if (courtUsageResult.status === 'fulfilled' && courtUsageResult.value?.success) {
        try {
          // Update with live court usage data
          updatedFinancialData = this.updateCourtReceiptsFromUsageData(
            updatedFinancialData, 
            courtUsageResult.value.data
          );
          hasCourtUsageData = true;
          console.log('✅ Successfully integrated live court usage data');
        } catch (error) {
          console.warn('⚠️ Failed to integrate court usage data, using financial data only:', error);
        }
      } else {
        console.warn('⚠️ Court usage data unavailable, using static financial data');
        if (courtUsageResult.status === 'rejected') {
          console.warn('Court usage API error:', courtUsageResult.reason);
        }
      }

      const isDataChanged = this.hasDataChanged(updatedFinancialData);
      this.financialData = updatedFinancialData;
      
      if (isDataChanged && this.lastUpdated) {
        const message = hasCourtUsageData 
          ? '💰 Financial data updated with live court receipts!'
          : '💰 Financial data updated (court receipts from cache)!';
        
        this.snackBar.open(message, 'Close', {
          duration: 4000,
          panelClass: ['success-snack']
        });
      }
      
      this.loading = false;
    }).catch((error) => {
      console.error('Error loading financial data:', error);
      this.error = error.error?.message || 'Failed to load financial data';
      this.loading = false;
      this.snackBar.open('Error loading financial data', 'Close', {
        duration: 5000
      });
    });
  }

  refreshData(): void {
    this.loadFinancialStatement();
  }

  formatCurrency(amount: number): string {
    if (amount === 0) {
      return '0.00';
    }
    return amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  switchToExpenseTab(): void {
    if (this.tabGroup) {
      this.tabGroup.selectedIndex = 1; // Switch to the Expense Report tab (index 1)
    }
  }

  private hasDataChanged(newData: FinancialStatementData): boolean {
    if (!this.financialData) return true;
    return JSON.stringify(this.financialData) !== JSON.stringify(newData);
  }

  private updateCourtReceiptsFromUsageData(
    financialData: FinancialStatementData, 
    courtUsageData: CourtUsageData
  ): FinancialStatementData {
    try {
      // Parse the total revenue from court usage (e.g., "₱70,700.00" -> 70700)
      const courtReceiptsAmount = parseFloat(
        courtUsageData.summary.totalRevenue.replace('₱', '').replace(',', '')
      );

      console.log(`💰 Updating Tennis Court Usage Receipts: ${courtUsageData.summary.totalRevenue} (${courtReceiptsAmount})`);

      // Create a copy of the financial data
      const updatedData = { ...financialData };
      updatedData.receiptsCollections = [...financialData.receiptsCollections];

      // Find and update Tennis Court Usage Receipts
      const courtReceiptsIndex = updatedData.receiptsCollections.findIndex(
        item => item.description === 'Tennis Court Usage Receipts'
      );

      if (courtReceiptsIndex !== -1) {
        // Update existing entry
        updatedData.receiptsCollections[courtReceiptsIndex] = {
          ...updatedData.receiptsCollections[courtReceiptsIndex],
          amount: courtReceiptsAmount,
          highlighted: true // Highlight to show it's live data
        };
      } else {
        // Add new entry if it doesn't exist
        updatedData.receiptsCollections.push({
          description: 'Tennis Court Usage Receipts',
          amount: courtReceiptsAmount,
          highlighted: true
        });
      }

      // Recalculate total receipts
      updatedData.totalReceipts = updatedData.receiptsCollections.reduce(
        (sum, item) => sum + item.amount, 0
      );

      // Recalculate net income and fund balance
      updatedData.netIncome = updatedData.totalReceipts - updatedData.totalDisbursements;
      updatedData.fundBalance = updatedData.beginningBalance.amount + updatedData.netIncome;

      // Update timestamp
      updatedData.lastUpdated = new Date().toISOString();

      console.log(`💰 Updated totals - Receipts: ₱${updatedData.totalReceipts.toLocaleString()}, Fund Balance: ₱${updatedData.fundBalance.toLocaleString()}`);

      return updatedData;
    } catch (error) {
      console.error('Error updating court receipts from usage data:', error);
      // Return original data if there's an error
      return financialData;
    }
  }

  private startAutoRefresh(): void {
    if (this.autoRefreshEnabled) {
      this.autoRefreshSubscription = interval(this.REFRESH_INTERVAL)
        .pipe(
          filter(() => this.autoRefreshEnabled),
          switchMap(() => {
            if (!this.loading) {
              const headers = new HttpHeaders({
                'Authorization': `Bearer ${this.authService.token}`
              });
              
              // Auto-refresh both financial and court usage data
              const financialRequest = this.http.get<FinancialAPIResponse>(
                `${this.apiUrl}/reports/financial-sheet`,
                { headers }
              );
              
              const courtUsageRequest = this.http.get<CourtUsageAPIResponse>(
                `${this.apiUrl}/reports/static-court-usage`,
                { headers }
              );

              return Promise.allSettled([
                financialRequest.toPromise(),
                courtUsageRequest.toPromise()
              ]);
            }
            return [];
          })
        )
        .subscribe({
          next: (results: any) => {
            if (results && results.length === 2) {
              const [financialResult, courtUsageResult] = results;
              let updatedFinancialData: FinancialStatementData | null = null;
              let hasCourtUsageData = false;

              // Handle financial data result
              if (financialResult.status === 'fulfilled' && financialResult.value?.success) {
                updatedFinancialData = financialResult.value.data;
                this.lastUpdated = financialResult.value.metadata?.lastModified || financialResult.value.data.lastUpdated;
              } else {
                console.warn('Auto-refresh: Financial data unavailable');
                return; // Skip this refresh cycle
              }

              // Handle court usage data result (optional for auto-refresh)
              if (courtUsageResult.status === 'fulfilled' && courtUsageResult.value?.success) {
                try {
                  updatedFinancialData = this.updateCourtReceiptsFromUsageData(
                    updatedFinancialData, 
                    courtUsageResult.value.data
                  );
                  hasCourtUsageData = true;
                } catch (error) {
                  console.warn('Auto-refresh: Failed to integrate court usage data:', error);
                }
              }

              const isDataChanged = this.hasDataChanged(updatedFinancialData);
              this.financialData = updatedFinancialData;
              
              if (isDataChanged) {
                const message = hasCourtUsageData 
                  ? '📊 Data refreshed with live court receipts'
                  : '📊 Data refreshed automatically';
                  
                console.log(`🔄 ${message}`);
                this.snackBar.open(message, 'Close', {
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


  getTimeAgo(dateString: string): string {
    const now = new Date().getTime();
    const updated = new Date(dateString).getTime();
    const diffSeconds = Math.floor((now - updated) / 1000);
    
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    return `${Math.floor(diffSeconds / 86400)}d ago`;
  }

  /**
   * Get receipts collection without the Men's Tournament Entries
   */
  getReceiptsWithoutTournament(): any[] {
    if (!this.financialData?.receiptsCollections) return [];
    
    return this.financialData.receiptsCollections.filter(item => 
      !item.description.toLowerCase().includes('tournament entries')
    );
  }

  /**
   * Initialize WebSocket connection for real-time updates
   */
  private initializeWebSocket(): void {
    try {
      this.socket = io(environment.socketUrl, {
        transports: ['websocket', 'polling'],
        auth: {
          token: this.authService.token
        }
      });

      // Connection events
      this.socket.on('connect', () => {
        console.log('🔌 Connected to WebSocket server');
        this.socketConnected = true;
        this.socket?.emit('subscribe_financial_updates');
      });

      this.socket.on('disconnect', () => {
        console.log('🔌 Disconnected from WebSocket server');
        this.socketConnected = false;
      });

      // Subscription confirmed
      this.socket.on('subscription_confirmed', (data) => {
        console.log('📊 Subscribed to financial updates:', data);
        this.snackBar.open('🔄 Real-time updates enabled', 'Close', {
          duration: 3000,
          panelClass: ['success-snack']
        });
      });

      // Financial data update events
      this.socket.on('financial_update', (updateEvent) => {
        console.log('📊 Received real-time financial update:', updateEvent);
        
        if (updateEvent.data) {
          const isDataChanged = this.hasDataChanged(updateEvent.data);
          if (isDataChanged) {
            this.financialData = updateEvent.data;
            this.lastUpdated = updateEvent.timestamp;
            
            this.snackBar.open('💰 Financial data updated in real-time!', 'Close', {
              duration: 5000,
              panelClass: ['success-snack']
            });
          }
        }
      });

      // Fallback for general financial data change events
      this.socket.on('financial_data_changed', (data) => {
        console.log('📊 Financial data change notification:', data);
        this.snackBar.open(`🔄 ${data.message}`, 'Refresh', {
          duration: 6000,
          panelClass: ['info-snack']
        }).onAction().subscribe(() => {
          this.refreshData();
        });
      });

      // Handle connection errors
      this.socket.on('connect_error', (error) => {
        console.error('🔌 WebSocket connection error:', error);
        this.socketConnected = false;
      });

    } catch (error) {
      console.error('🔌 Failed to initialize WebSocket:', error);
    }
  }

  /**
   * Disconnect WebSocket
   */
  private disconnectWebSocket(): void {
    if (this.socket) {
      this.socket.emit('unsubscribe_financial_updates');
      this.socket.disconnect();
      this.socket = null;
      this.socketConnected = false;
      console.log('🔌 WebSocket disconnected');
    }
  }

}