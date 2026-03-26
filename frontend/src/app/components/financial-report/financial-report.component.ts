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
import { ExpenseCategoryManagementComponent } from '../expense-category-management/expense-category-management.component';

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

interface DistributionPaymentEntry {
  memberName: string;
  amount: number;
  paymentDate: string;
  referenceNumber: string;
}

interface DistributionGroup {
  payments: DistributionPaymentEntry[];
  subtotal: number;
  count: number;
}

interface DistributionCategory {
  homeowners: DistributionGroup;
  nonHomeowners: DistributionGroup;
  grandTotal: number;
}

interface HomeownerDistributionData {
  courtUsage: DistributionCategory;
  membershipFees2026: DistributionCategory;
  period: { startDate: string; endDate: string };
}

interface HomeownerDistributionAPIResponse {
  success: boolean;
  data: HomeownerDistributionData;
  message?: string;
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
    ExpenseReportComponent,
    ExpenseCategoryManagementComponent
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
        <mat-tab-group #tabGroup class="financial-tabs" (selectedTabChange)="onTabChange($event)">
          <!-- Financial Statement Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>account_balance</mat-icon>
              Financial Statement
            </ng-template>

            <!-- Nested tabs for Current and Archive -->
            <mat-tab-group class="nested-tabs">
              <!-- Current Financial Statement -->
              <mat-tab label="Current">
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
          <div class="statement-section liabilities-section" *ngIf="financialData.liabilities?.appServiceFee && financialData.liabilities.appServiceFee.remainingLiability > 0">
            <div class="section-header">
              <div class="section-title">LIABILITIES</div>
            </div>
            <div class="section-items">
              <div class="line-item liability-item">
                <div class="item-description">Accrued App Service Fee</div>
                <div class="item-amount">{{ formatCurrency(financialData.liabilities.appServiceFee.remainingLiability) }}</div>
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

              <!-- 2025 Archive Tab -->
              <mat-tab *ngIf="show2025Archive">
                <ng-template mat-tab-label>
                  2025 Archive
                  <span class="archive-badge">Read-Only</span>
                </ng-template>

                <div class="archive-container">
                  <!-- Static HTML content -->
                  <div class="archive-content" [innerHTML]="archive2025HTML"></div>

                  <!-- Fallback message if no content -->
                  <div class="no-content-message" *ngIf="!archiveDebugInfo.loaded && !archiveDebugInfo.error">
                    <mat-icon>hourglass_empty</mat-icon>
                    <p>Loading archive...</p>
                  </div>
                </div>
              </mat-tab>
            </mat-tab-group>
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

          <!-- Manage Categories Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>category</mat-icon>
              Manage Categories
            </ng-template>

            <!-- Category Management Content -->
            <div class="category-tab-content">
              <app-expense-category-management></app-expense-category-management>
            </div>
          </mat-tab>

          <!-- Distribution Report Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>pie_chart</mat-icon>
              Distribution
            </ng-template>

            <div class="distribution-tab-content">
              <!-- Loading -->
              <div *ngIf="distributionLoading" class="dist-loading">
                <mat-spinner diameter="40"></mat-spinner>
                <p>Loading distribution data...</p>
              </div>

              <!-- Error -->
              <div *ngIf="!distributionLoading && distributionError" class="dist-error">
                <mat-icon>error_outline</mat-icon>
                <p>{{ distributionError }}</p>
                <button mat-button (click)="loadDistributionReport()">Retry</button>
              </div>

              <!-- Content -->
              <div *ngIf="!distributionLoading && distributionData" class="dist-content">

                <!-- Overall Summary Card -->
                <div class="dist-section dist-summary-card">
                  <h3 class="dist-section-title">Overall Collections Summary 2026</h3>
                  <div class="dist-aggregate">
                    <div class="dist-aggregate-row">
                      <span class="agg-label court-label">Court Usage</span>
                      <div class="agg-bar-track">
                        <div class="agg-bar court-bar"
                             [style.width]="pct(distributionData.courtUsage.grandTotal, distributionData.courtUsage.grandTotal + distributionData.membershipFees2026.grandTotal) + '%'">
                        </div>
                      </div>
                      <span class="agg-pct">{{ pct(distributionData.courtUsage.grandTotal, distributionData.courtUsage.grandTotal + distributionData.membershipFees2026.grandTotal) }}%</span>
                      <span class="agg-amount">{{ formatCurrency(distributionData.courtUsage.grandTotal) }}</span>
                    </div>
                    <div class="dist-aggregate-row">
                      <span class="agg-label membership-label">Membership Fees</span>
                      <div class="agg-bar-track">
                        <div class="agg-bar membership-bar"
                             [style.width]="pct(distributionData.membershipFees2026.grandTotal, distributionData.courtUsage.grandTotal + distributionData.membershipFees2026.grandTotal) + '%'">
                        </div>
                      </div>
                      <span class="agg-pct">{{ pct(distributionData.membershipFees2026.grandTotal, distributionData.courtUsage.grandTotal + distributionData.membershipFees2026.grandTotal) }}%</span>
                      <span class="agg-amount">{{ formatCurrency(distributionData.membershipFees2026.grandTotal) }}</span>
                    </div>
                  </div>
                  <div class="dist-grand-total">
                    <span>Grand Total Collections</span>
                    <span>{{ formatCurrency(distributionData.courtUsage.grandTotal + distributionData.membershipFees2026.grandTotal) }}</span>
                  </div>
                </div>

                <!-- Section 1: Court Usage Receipts -->
                <div class="dist-section">
                  <h3 class="dist-section-title">Tennis Court Usage Receipts</h3>

                  <div class="dist-aggregate">
                    <div class="dist-aggregate-row">
                      <span class="agg-label homeowner-label">Homeowners ({{ distributionData.courtUsage.homeowners.count }})</span>
                      <div class="agg-bar-track">
                        <div class="agg-bar homeowner-bar"
                             [style.width]="pct(distributionData.courtUsage.homeowners.subtotal, distributionData.courtUsage.grandTotal) + '%'">
                        </div>
                      </div>
                      <span class="agg-pct">{{ pct(distributionData.courtUsage.homeowners.subtotal, distributionData.courtUsage.grandTotal) }}%</span>
                      <span class="agg-amount">{{ formatCurrency(distributionData.courtUsage.homeowners.subtotal) }}</span>
                    </div>
                    <div class="dist-aggregate-row">
                      <span class="agg-label non-homeowner-label">Non-Homeowners ({{ distributionData.courtUsage.nonHomeowners.count }})</span>
                      <div class="agg-bar-track">
                        <div class="agg-bar non-homeowner-bar"
                             [style.width]="pct(distributionData.courtUsage.nonHomeowners.subtotal, distributionData.courtUsage.grandTotal) + '%'">
                        </div>
                      </div>
                      <span class="agg-pct">{{ pct(distributionData.courtUsage.nonHomeowners.subtotal, distributionData.courtUsage.grandTotal) }}%</span>
                      <span class="agg-amount">{{ formatCurrency(distributionData.courtUsage.nonHomeowners.subtotal) }}</span>
                    </div>
                  </div>

                  <div class="dist-grand-total">
                    <span>Total Court Usage Receipts</span>
                    <span>{{ formatCurrency(distributionData.courtUsage.grandTotal) }}</span>
                  </div>

                  <div class="dist-group">
                    <h4 class="dist-group-title">Homeowners ({{ distributionData.courtUsage.homeowners.count }})</h4>
                    <table class="dist-table" *ngIf="distributionData.courtUsage.homeowners.payments.length > 0">
                      <thead><tr><th>Member</th><th>Date</th><th>Reference</th><th class="amount-col">Amount</th></tr></thead>
                      <tbody>
                        <tr *ngFor="let p of distributionData.courtUsage.homeowners.payments">
                          <td>{{ p.memberName }}</td>
                          <td>{{ p.paymentDate | date:'mediumDate' }}</td>
                          <td>{{ p.referenceNumber }}</td>
                          <td class="amount-col">{{ formatCurrency(p.amount) }}</td>
                        </tr>
                      </tbody>
                      <tfoot><tr class="subtotal-row"><td colspan="3">Homeowners Subtotal</td><td class="amount-col">{{ formatCurrency(distributionData.courtUsage.homeowners.subtotal) }}</td></tr></tfoot>
                    </table>
                    <p *ngIf="distributionData.courtUsage.homeowners.payments.length === 0" class="dist-empty">No payments found.</p>
                  </div>

                  <div class="dist-group">
                    <h4 class="dist-group-title">Non-Homeowners ({{ distributionData.courtUsage.nonHomeowners.count }})</h4>
                    <table class="dist-table" *ngIf="distributionData.courtUsage.nonHomeowners.payments.length > 0">
                      <thead><tr><th>Member</th><th>Date</th><th>Reference</th><th class="amount-col">Amount</th></tr></thead>
                      <tbody>
                        <tr *ngFor="let p of distributionData.courtUsage.nonHomeowners.payments">
                          <td>{{ p.memberName }}</td>
                          <td>{{ p.paymentDate | date:'mediumDate' }}</td>
                          <td>{{ p.referenceNumber }}</td>
                          <td class="amount-col">{{ formatCurrency(p.amount) }}</td>
                        </tr>
                      </tbody>
                      <tfoot><tr class="subtotal-row"><td colspan="3">Non-Homeowners Subtotal</td><td class="amount-col">{{ formatCurrency(distributionData.courtUsage.nonHomeowners.subtotal) }}</td></tr></tfoot>
                    </table>
                    <p *ngIf="distributionData.courtUsage.nonHomeowners.payments.length === 0" class="dist-empty">No payments found.</p>
                  </div>
                </div>

                <!-- Section 2: Annual Membership Fees 2026 -->
                <div class="dist-section">
                  <h3 class="dist-section-title">Annual Membership Fees 2026</h3>

                  <div class="dist-aggregate">
                    <div class="dist-aggregate-row">
                      <span class="agg-label homeowner-label">Homeowners ({{ distributionData.membershipFees2026.homeowners.count }})</span>
                      <div class="agg-bar-track">
                        <div class="agg-bar homeowner-bar"
                             [style.width]="pct(distributionData.membershipFees2026.homeowners.subtotal, distributionData.membershipFees2026.grandTotal) + '%'">
                        </div>
                      </div>
                      <span class="agg-pct">{{ pct(distributionData.membershipFees2026.homeowners.subtotal, distributionData.membershipFees2026.grandTotal) }}%</span>
                      <span class="agg-amount">{{ formatCurrency(distributionData.membershipFees2026.homeowners.subtotal) }}</span>
                    </div>
                    <div class="dist-aggregate-row">
                      <span class="agg-label non-homeowner-label">Non-Homeowners ({{ distributionData.membershipFees2026.nonHomeowners.count }})</span>
                      <div class="agg-bar-track">
                        <div class="agg-bar non-homeowner-bar"
                             [style.width]="pct(distributionData.membershipFees2026.nonHomeowners.subtotal, distributionData.membershipFees2026.grandTotal) + '%'">
                        </div>
                      </div>
                      <span class="agg-pct">{{ pct(distributionData.membershipFees2026.nonHomeowners.subtotal, distributionData.membershipFees2026.grandTotal) }}%</span>
                      <span class="agg-amount">{{ formatCurrency(distributionData.membershipFees2026.nonHomeowners.subtotal) }}</span>
                    </div>
                  </div>

                  <div class="dist-grand-total">
                    <span>Total Membership Fees 2026</span>
                    <span>{{ formatCurrency(distributionData.membershipFees2026.grandTotal) }}</span>
                  </div>

                  <div class="dist-group">
                    <h4 class="dist-group-title">Homeowners ({{ distributionData.membershipFees2026.homeowners.count }})</h4>
                    <table class="dist-table" *ngIf="distributionData.membershipFees2026.homeowners.payments.length > 0">
                      <thead><tr><th>Member</th><th>Date Paid</th><th>Reference</th><th class="amount-col">Amount</th></tr></thead>
                      <tbody>
                        <tr *ngFor="let p of distributionData.membershipFees2026.homeowners.payments">
                          <td>{{ p.memberName }}</td>
                          <td>{{ p.paymentDate | date:'mediumDate' }}</td>
                          <td>{{ p.referenceNumber }}</td>
                          <td class="amount-col">{{ formatCurrency(p.amount) }}</td>
                        </tr>
                      </tbody>
                      <tfoot><tr class="subtotal-row"><td colspan="3">Homeowners Subtotal</td><td class="amount-col">{{ formatCurrency(distributionData.membershipFees2026.homeowners.subtotal) }}</td></tr></tfoot>
                    </table>
                    <p *ngIf="distributionData.membershipFees2026.homeowners.payments.length === 0" class="dist-empty">No payments found.</p>
                  </div>

                  <div class="dist-group">
                    <h4 class="dist-group-title">Non-Homeowners ({{ distributionData.membershipFees2026.nonHomeowners.count }})</h4>
                    <table class="dist-table" *ngIf="distributionData.membershipFees2026.nonHomeowners.payments.length > 0">
                      <thead><tr><th>Member</th><th>Date Paid</th><th>Reference</th><th class="amount-col">Amount</th></tr></thead>
                      <tbody>
                        <tr *ngFor="let p of distributionData.membershipFees2026.nonHomeowners.payments">
                          <td>{{ p.memberName }}</td>
                          <td>{{ p.paymentDate | date:'mediumDate' }}</td>
                          <td>{{ p.referenceNumber }}</td>
                          <td class="amount-col">{{ formatCurrency(p.amount) }}</td>
                        </tr>
                      </tbody>
                      <tfoot><tr class="subtotal-row"><td colspan="3">Non-Homeowners Subtotal</td><td class="amount-col">{{ formatCurrency(distributionData.membershipFees2026.nonHomeowners.subtotal) }}</td></tr></tfoot>
                    </table>
                    <p *ngIf="distributionData.membershipFees2026.nonHomeowners.payments.length === 0" class="dist-empty">No payments found.</p>
                  </div>
                </div>

              </div>
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

  // 2025 Archive properties
  archive2025HTML: string = ''; // Store as plain string for innerHTML binding
  show2025Archive: boolean = true;
  archiveDebugInfo: {
    loaded: boolean;
    error: string | null;
  } = {
    loaded: false,
    error: null
  };

  distributionData: HomeownerDistributionData | null = null;
  distributionLoading = false;
  distributionError: string | null = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    // Load 2025 archive HTML
    this.http.get('/2025-financial-archive.html', { responseType: 'text' })
      .subscribe({
        next: (html) => {
          this.archive2025HTML = html;
          this.archiveDebugInfo.loaded = true;
          this.archiveDebugInfo.error = null;
          console.log('✅ 2025 Archive HTML loaded successfully');
        },
        error: (err) => {
          console.error('❌ Failed to load 2025 archive:', err);
          this.archiveDebugInfo.error = err.message || 'Failed to load archive';
          this.archiveDebugInfo.loaded = false;
          this.show2025Archive = false;
        }
      });

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

    // Load financial statement only (2026 uses database-filtered court receipts)
    // Static court usage is only for 2025 archive
    const financialRequest = this.http.get<FinancialAPIResponse>(
      `${this.apiUrl}/reports/financial-sheet`,
      { headers }
    );

    financialRequest.toPromise().then((financialResult) => {
      if (financialResult?.success) {
        // Use financial data directly without merging static court usage
        this.financialData = financialResult.data;
        this.lastUpdated = financialResult.metadata?.lastModified || financialResult.data.lastUpdated;

        console.log('✅ Financial statement loaded for 2026');
        console.log('💰 Beginning Balance:', this.financialData?.beginningBalance?.amount);
        console.log('💵 Total Receipts:', this.financialData?.totalReceipts);
        console.log('💸 Total Disbursements:', this.financialData?.totalDisbursements);
        console.log('💰 Fund Balance:', this.financialData?.fundBalance);

        this.loading = false;
      } else {
        this.error = 'Failed to load financial statement';
        this.loading = false;
      }
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

  onTabChange(event: any): void {
    if (event.index === 3 && !this.distributionData && !this.distributionLoading) {
      this.loadDistributionReport();
    }
  }

  pct(part: number, total: number): string {
    if (!total) return '0.0';
    return ((part / total) * 100).toFixed(1);
  }

  loadDistributionReport(): void {
    this.distributionLoading = true;
    this.distributionError = null;
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${this.authService.token}` });
    this.http.get<HomeownerDistributionAPIResponse>(
      `${this.apiUrl}/reports/homeowner-distribution`,
      { headers }
    ).subscribe({
      next: (result) => {
        if (result?.success) {
          this.distributionData = result.data;
        } else {
          this.distributionError = result.message || 'Failed to load distribution report';
        }
        this.distributionLoading = false;
      },
      error: (err) => {
        this.distributionError = err.error?.message || 'Failed to load distribution data';
        this.distributionLoading = false;
      }
    });
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

              // Auto-refresh financial data only (2026 uses database-filtered court receipts)
              const financialRequest = this.http.get<FinancialAPIResponse>(
                `${this.apiUrl}/reports/financial-sheet`,
                { headers }
              );

              return financialRequest.toPromise();
            }
            return Promise.resolve(null);
          })
        )
        .subscribe({
          next: (financialResult: any) => {
            if (financialResult?.success) {
              const isDataChanged = this.hasDataChanged(financialResult.data);
              this.financialData = financialResult.data;
              this.lastUpdated = financialResult.metadata?.lastModified || financialResult.data.lastUpdated;

              if (isDataChanged) {
                console.log('🔄 Data refreshed automatically');
                this.snackBar.open('📊 Data refreshed automatically', 'Close', {
                  duration: 2000,
                  panelClass: ['info-snack']
                });
              }
            } else {
              console.warn('Auto-refresh: Financial data unavailable');
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
   * Get receipts collection without the Men's Tournament Entries and zero amounts
   */
  getReceiptsWithoutTournament(): any[] {
    if (!this.financialData?.receiptsCollections) return [];

    return this.financialData.receiptsCollections.filter(item =>
      !item.description.toLowerCase().includes('tournament entries') &&
      item.amount > 0 // Hide items with zero amounts
    );
  }

  /**
   * Initialize WebSocket connection for real-time updates
   */
  private initializeWebSocket(): void {
    try {
      this.socket = io(environment.socketUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 3,
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

      this.socket.on('connect_error', (error) => {
        console.warn('⚠️ WebSocket connection error (will retry):', error.message);
        this.socketConnected = false;
      });

      this.socket.on('connect_timeout', () => {
        console.warn('⚠️ WebSocket connection timeout (will retry)');
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