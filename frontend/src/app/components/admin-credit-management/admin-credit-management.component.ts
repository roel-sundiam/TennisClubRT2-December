import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';
import { Router } from '@angular/router';
import { CreditService, CreditTransaction, AdminCreditAction } from '../../services/credit.service';
import { AuthService } from '../../services/auth.service';
import { MemberService, Member } from '../../services/member.service';

interface UserCreditInfo {
  _id: string;
  username: string;
  fullName: string;
  email: string;
  creditBalance: number;
  isApproved: boolean;
  role: string;
  lastTransaction?: CreditTransaction;
}

@Component({
  selector: 'app-admin-credit-management',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatTabsModule,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatChipsModule
  ],
  template: `
    <div class="admin-credit-container">
      <!-- Modern Header -->
      <div class="header-section">
        <button class="back-btn" (click)="goBack()">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div class="header-content">
          <h1>💳 Credit Management</h1>
          <p class="header-subtitle">Manage member credit balances and transactions</p>
        </div>
        <button class="refresh-btn" (click)="refreshData()">
          <mat-icon>refresh</mat-icon>
          <span>Refresh</span>
        </button>
      </div>

      <!-- Modern Tab Navigation -->
      <div class="custom-tabs">
        <button class="tab-btn" [class.active]="selectedTab === 0" (click)="selectedTab = 0">
          <mat-icon>account_balance_wallet</mat-icon>
          <span>User Balances</span>
        </button>
        <button class="tab-btn" [class.active]="selectedTab === 1" (click)="selectedTab = 1">
          <mat-icon>tune</mat-icon>
          <span>Adjust Credits</span>
        </button>
        <button class="tab-btn" [class.active]="selectedTab === 2" (click)="selectedTab = 2">
          <mat-icon>bar_chart</mat-icon>
          <span>Statistics</span>
        </button>
      </div>

      <!-- Tab Content: User Balances -->
      <div class="tab-content" *ngIf="selectedTab === 0">
        <div class="modern-card">
          <!-- Search Bar -->
          <div class="search-section">
            <div class="search-wrapper">
              <mat-icon class="search-icon">search</mat-icon>
              <input 
                type="text" 
                class="search-input" 
                [formControl]="searchControl" 
                placeholder="Search by name, username, or email..."
              />
            </div>
          </div>

          <!-- Users Table -->
          <div class="users-list">
            <div class="user-card" *ngFor="let user of users">
              <div class="user-info">
                <div class="user-avatar">
                  <mat-icon>person</mat-icon>
                </div>
                <div class="user-details">
                  <h3 class="user-name">{{user.fullName}}</h3>
                  <p class="user-meta">{{user.username}} • {{user.email}}</p>
                  <div class="user-badges">
                    <span class="badge" [class.approved]="user.isApproved" [class.pending]="!user.isApproved">
                      {{user.isApproved ? '✓ Approved' : '⏳ Pending'}}
                    </span>
                    <span class="badge role" [attr.data-role]="user.role">
                      {{user.role | titlecase}}
                    </span>
                  </div>
                </div>
              </div>

              <div class="user-balance">
                <div class="balance-label">Credit Balance</div>
                <div class="balance-value" [class.low]="user.creditBalance < 100">
                  ₱{{user.creditBalance | number:'1.2-2'}}
                </div>
                
                <div class="last-transaction" *ngIf="user.lastTransaction">
                  <mat-icon class="tx-icon" [attr.data-type]="user.lastTransaction.type">
                    {{getTransactionIcon(user.lastTransaction.type)}}
                  </mat-icon>
                  <div class="tx-details">
                    <span class="tx-type">{{user.lastTransaction.type | titlecase}}</span>
                    <span class="tx-amount">{{getAmountPrefix(user.lastTransaction.type)}}₱{{user.lastTransaction.amount | number:'1.2-2'}}</span>
                    <span class="tx-date">{{user.lastTransaction.createdAt | date:'MMM d, h:mm a'}}</span>
                  </div>
                </div>
                <div class="no-tx" *ngIf="!user.lastTransaction">
                  <mat-icon>info_outline</mat-icon>
                  No transactions
                </div>
              </div>

              <div class="user-actions">
                <button class="action-btn add" (click)="adjustCredits(user, 'deposit')">
                  <mat-icon>add_circle</mat-icon>
                  <span>Add</span>
                </button>
                <button class="action-btn deduct" (click)="adjustCredits(user, 'deduction')" [disabled]="user.creditBalance <= 0">
                  <mat-icon>remove_circle</mat-icon>
                  <span>Deduct</span>
                </button>
                <button class="action-btn history" (click)="viewUserHistory(user)">
                  <mat-icon>history</mat-icon>
                  <span>History</span>
                </button>
              </div>
            </div>

            <!-- Loading State -->
            <div class="loading-state" *ngIf="loading">
              <mat-spinner diameter="50"></mat-spinner>
              <p>Loading user credit data...</p>
            </div>

            <!-- Empty State -->
            <div class="empty-state" *ngIf="!loading && users.length === 0">
              <mat-icon>people_outline</mat-icon>
              <p>No users found</p>
            </div>
          </div>

          <!-- Pagination -->
          <mat-paginator
            [length]="totalUsers"
            [pageSize]="pageSize"
            [pageSizeOptions]="[10, 25, 50]"
            (page)="onPageChange($event)"
            showFirstLastButtons>
          </mat-paginator>
        </div>
      </div>

      <!-- Tab Content: Adjust Credits -->
      <div class="tab-content" *ngIf="selectedTab === 1">
        <div class="modern-card adjustment-card">
          <div class="card-header">
            <mat-icon>tune</mat-icon>
            <div>
              <h2>Credit Adjustments</h2>
              <p>Add or deduct credits from user accounts</p>
            </div>
          </div>

          <form [formGroup]="adjustmentForm" (ngSubmit)="processAdjustment()">
            <!-- User Selection -->
            <div class="form-group">
              <label for="userId" class="form-label">
                <mat-icon>person</mat-icon>
                Select User
              </label>
              <select id="userId" formControlName="userId" class="form-select">
                <option value="">Choose a user...</option>
                <option *ngFor="let user of allUsers" [value]="user._id">
                  {{user.fullName}} ({{user.username}}) - ₱{{user.creditBalance | number:'1.2-2'}}
                </option>
              </select>
              <div class="form-error" *ngIf="adjustmentForm.get('userId')?.touched && adjustmentForm.get('userId')?.hasError('required')">
                Please select a user
              </div>
            </div>

            <!-- Action and Amount Row -->
            <div class="form-row">
              <div class="form-group">
                <label for="type" class="form-label">
                  <mat-icon>swap_horiz</mat-icon>
                  Action
                </label>
                <select id="type" formControlName="type" class="form-select">
                  <option value="deposit">➕ Add Credits</option>
                  <option value="deduction">➖ Deduct Credits</option>
                </select>
                <div class="form-error" *ngIf="adjustmentForm.get('type')?.touched && adjustmentForm.get('type')?.hasError('required')">
                  Please select an action
                </div>
              </div>

              <div class="form-group">
                <label for="amount" class="form-label">
                  <mat-icon>attach_money</mat-icon>
                  Amount (₱)
                </label>
                <input 
                  id="amount"
                  type="number" 
                  formControlName="amount" 
                  class="form-input" 
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                />
                <div class="form-error" *ngIf="adjustmentForm.get('amount')?.touched && adjustmentForm.get('amount')?.hasError('required')">
                  Amount is required
                </div>
                <div class="form-error" *ngIf="adjustmentForm.get('amount')?.touched && adjustmentForm.get('amount')?.hasError('min')">
                  Amount must be greater than 0
                </div>
              </div>
            </div>

            <!-- Reason -->
            <div class="form-group">
              <label for="reason" class="form-label">
                <mat-icon>description</mat-icon>
                Reason for Adjustment
              </label>
              <textarea 
                id="reason"
                formControlName="reason" 
                class="form-textarea" 
                placeholder="Enter the reason for this credit adjustment..."
                rows="4"
              ></textarea>
              <div class="form-error" *ngIf="adjustmentForm.get('reason')?.touched && adjustmentForm.get('reason')?.hasError('required')">
                Please provide a reason
              </div>
            </div>

            <!-- Form Actions -->
            <div class="form-actions">
              <button type="button" class="btn-secondary" (click)="resetForm()">
                <mat-icon>clear</mat-icon>
                Clear Form
              </button>
              <button type="submit" class="btn-primary" [disabled]="adjustmentForm.invalid || processing">
                <mat-spinner diameter="20" *ngIf="processing"></mat-spinner>
                <mat-icon *ngIf="!processing">
                  {{adjustmentForm.get('type')?.value === 'deposit' ? 'add_circle' : 'remove_circle'}}
                </mat-icon>
                {{processing ? 'Processing...' : (adjustmentForm.get('type')?.value === 'deposit' ? 'Add Credits' : 'Deduct Credits')}}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Tab Content: Statistics -->
      <div class="tab-content" *ngIf="selectedTab === 2">
        <div class="stats-grid" *ngIf="creditStats">
          <div class="stat-card deposit">
            <div class="stat-icon">
              <mat-icon>add_circle</mat-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">₱{{getTotalDeposits() | number:'1.2-2'}}</div>
              <div class="stat-label">Total Credits Added</div>
            </div>
          </div>

          <div class="stat-card deduction">
            <div class="stat-icon">
              <mat-icon>remove_circle</mat-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">₱{{getTotalUsed() | number:'1.2-2'}}</div>
              <div class="stat-label">Total Credits Used</div>
            </div>
          </div>

          <div class="stat-card refund">
            <div class="stat-icon">
              <mat-icon>refresh</mat-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">₱{{getTotalRefunds() | number:'1.2-2'}}</div>
              <div class="stat-label">Total Refunds</div>
            </div>
          </div>

          <div class="stat-card balance">
            <div class="stat-icon">
              <mat-icon>account_balance</mat-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">₱{{getTotalBalance() | number:'1.2-2'}}</div>
              <div class="stat-label">Total Outstanding Credits</div>
            </div>
          </div>

          <div class="stat-card users">
            <div class="stat-icon">
              <mat-icon>people</mat-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{getUsersWithCredits()}}</div>
              <div class="stat-label">Users with Credits</div>
            </div>
          </div>

          <div class="stat-card transactions">
            <div class="stat-icon">
              <mat-icon>receipt</mat-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{getTotalTransactions()}}</div>
              <div class="stat-label">Total Transactions</div>
            </div>
          </div>
        </div>

        <div class="loading-state" *ngIf="!creditStats && loading">
          <mat-spinner diameter="50"></mat-spinner>
          <p>Loading statistics...</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    * {
      box-sizing: border-box;
    }

    .admin-credit-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      padding-bottom: 80px;
    }

    /* Modern Header */
    .header-section {
      background: rgba(255, 255, 255, 0.98);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      gap: 20px;
      animation: slideDown 0.4s ease-out;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .back-btn {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      border: none;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }

    .back-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
    }

    .back-btn:active {
      transform: translateY(0);
    }

    .header-content {
      flex: 1;
    }

    .header-content h1 {
      margin: 0;
      font-size: 2rem;
      font-weight: 700;
      background: linear-gradient(135deg, #667eea, #764ba2);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .header-subtitle {
      margin: 4px 0 0 0;
      color: #64748b;
      font-size: 0.95rem;
    }

    .refresh-btn {
      padding: 12px 24px;
      border-radius: 12px;
      border: none;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
      font-size: 0.95rem;
    }

    .refresh-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
    }

    /* Custom Tabs */
    .custom-tabs {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .tab-btn {
      flex: 1;
      min-width: 200px;
      padding: 16px 24px;
      border-radius: 16px;
      border: none;
      background: rgba(255, 255, 255, 0.9);
      color: #64748b;
      font-weight: 600;
      font-size: 0.95rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }

    .tab-btn:hover {
      background: white;
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
    }

    .tab-btn.active {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
    }

    .tab-btn mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    /* Modern Card */
    .modern-card {
      background: rgba(255, 255, 255, 0.98);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 28px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      animation: fadeIn 0.4s ease-out;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 28px;
      padding-bottom: 20px;
      border-bottom: 2px solid #f1f5f9;
    }

    .card-header mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: #667eea;
    }

    .card-header h2 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: #1e293b;
    }

    .card-header p {
      margin: 4px 0 0 0;
      color: #64748b;
      font-size: 0.9rem;
    }

    /* Search Section */
    .search-section {
      margin-bottom: 28px;
    }

    .search-wrapper {
      position: relative;
      max-width: 500px;
    }

    .search-icon {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      color: #94a3b8;
      pointer-events: none;
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .search-input {
      width: 100%;
      padding: 16px 20px 16px 52px;
      border: 2px solid #e2e8f0;
      border-radius: 14px;
      font-size: 1rem;
      color: #1e293b;
      transition: all 0.3s ease;
      background: #f8fafc;
      font-family: inherit;
    }

    .search-input:focus {
      outline: none;
      border-color: #667eea;
      background: white;
      box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
    }

    .search-input::placeholder {
      color: #94a3b8;
    }

    /* Users List */
    .users-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-bottom: 24px;
    }

    .user-card {
      background: #f8fafc;
      border-radius: 16px;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 20px;
      transition: all 0.3s ease;
      border: 2px solid transparent;
    }

    .user-card:hover {
      background: white;
      border-color: #667eea;
      box-shadow: 0 4px 16px rgba(102, 126, 234, 0.15);
      transform: translateY(-2px);
    }

    .user-info {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .user-avatar {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 700;
      font-size: 1.2rem;
      flex-shrink: 0;
    }

    .user-avatar mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .user-details {
      flex: 1;
      min-width: 0;
    }

    .user-name {
      font-size: 1.1rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 4px 0;
    }

    .user-meta {
      font-size: 0.9rem;
      color: #64748b;
      margin: 0 0 8px 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .user-badges {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .badge {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .badge.approved {
      background: #dcfce7;
      color: #166534;
    }

    .badge.pending {
      background: #fef3c7;
      color: #92400e;
    }

    .badge.role[data-role="member"] {
      background: #dbeafe;
      color: #1e40af;
    }

    .badge.role[data-role="admin"] {
      background: #f3e8ff;
      color: #6b21a8;
    }

    .badge.role[data-role="superadmin"] {
      background: #fee2e2;
      color: #991b1b;
    }

    /* User Balance */
    .user-balance {
      text-align: right;
      padding: 0 20px;
      border-left: 2px solid #e2e8f0;
      border-right: 2px solid #e2e8f0;
      min-width: 180px;
    }

    .balance-label {
      font-size: 0.8rem;
      color: #64748b;
      margin-bottom: 4px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .balance-value {
      font-size: 1.6rem;
      font-weight: 800;
      color: #10b981;
      margin-bottom: 8px;
    }

    .balance-value.low {
      color: #f59e0b;
    }

    .last-transaction {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
    }

    .tx-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    .tx-icon[data-type="deposit"] {
      color: #10b981;
    }

    .tx-icon[data-type="deduction"] {
      color: #ef4444;
    }

    .tx-icon[data-type="refund"] {
      color: #3b82f6;
    }

    .tx-details {
      display: flex;
      flex-direction: column;
      gap: 2px;
      text-align: left;
    }

    .tx-type {
      font-size: 0.75rem;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .tx-amount {
      font-size: 0.9rem;
      font-weight: 700;
      color: #1e293b;
    }

    .tx-date {
      font-size: 0.75rem;
      color: #94a3b8;
    }

    .no-tx {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #94a3b8;
      font-size: 0.85rem;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
    }

    .no-tx mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    /* User Actions */
    .user-actions {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }

    .action-btn {
      padding: 10px 16px;
      border-radius: 10px;
      border: none;
      font-weight: 600;
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      transition: all 0.3s ease;
      font-family: inherit;
    }

    .action-btn mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .action-btn.add {
      background: #dcfce7;
      color: #166534;
    }

    .action-btn.add:hover {
      background: #bbf7d0;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }

    .action-btn.deduct {
      background: #fee2e2;
      color: #991b1b;
    }

    .action-btn.deduct:hover:not(:disabled) {
      background: #fecaca;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
    }

    .action-btn.deduct:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .action-btn.history {
      background: #dbeafe;
      color: #1e40af;
    }

    .action-btn.history:hover {
      background: #bfdbfe;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    }

    /* Form Styles */
    .form-group {
      margin-bottom: 24px;
    }

    .form-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 10px;
      font-size: 0.95rem;
    }

    .form-label mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: #667eea;
    }

    .form-select,
    .form-input,
    .form-textarea {
      width: 100%;
      padding: 14px 18px;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      font-size: 1rem;
      color: #1e293b;
      background: #f8fafc;
      transition: all 0.3s ease;
      font-family: inherit;
    }

    .form-select:focus,
    .form-input:focus,
    .form-textarea:focus {
      outline: none;
      border-color: #667eea;
      background: white;
      box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
    }

    .form-select {
      cursor: pointer;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath fill='%2364748b' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      padding-right: 48px;
    }

    .form-textarea {
      resize: vertical;
      min-height: 120px;
      line-height: 1.6;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 24px;
    }

    .form-error {
      color: #ef4444;
      font-size: 0.85rem;
      margin-top: 6px;
      display: flex;
      align-items: center;
      gap: 4px;
      font-weight: 500;
    }

    .form-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      padding-top: 20px;
      border-top: 2px solid #f1f5f9;
    }

    .btn-primary,
    .btn-secondary {
      padding: 14px 32px;
      border-radius: 12px;
      border: none;
      font-weight: 700;
      font-size: 1rem;
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      transition: all 0.3s ease;
      font-family: inherit;
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }

    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
    }

    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .btn-primary mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .btn-secondary {
      background: #f1f5f9;
      color: #475569;
    }

    .btn-secondary:hover {
      background: #e2e8f0;
      transform: translateY(-2px);
    }

    .btn-secondary mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    /* Statistics Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      animation: fadeIn 0.4s ease-out;
    }

    .stat-card {
      background: white;
      border-radius: 20px;
      padding: 28px;
      display: flex;
      align-items: center;
      gap: 20px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
      transition: all 0.3s ease;
      border: 2px solid transparent;
    }

    .stat-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
    }

    .stat-card.deposit {
      border-color: #10b981;
    }

    .stat-card.deposit:hover {
      box-shadow: 0 8px 24px rgba(16, 185, 129, 0.2);
    }

    .stat-card.deduction {
      border-color: #ef4444;
    }

    .stat-card.deduction:hover {
      box-shadow: 0 8px 24px rgba(239, 68, 68, 0.2);
    }

    .stat-card.refund {
      border-color: #3b82f6;
    }

    .stat-card.refund:hover {
      box-shadow: 0 8px 24px rgba(59, 130, 246, 0.2);
    }

    .stat-card.balance {
      border-color: #8b5cf6;
    }

    .stat-card.balance:hover {
      box-shadow: 0 8px 24px rgba(139, 92, 246, 0.2);
    }

    .stat-card.users {
      border-color: #f59e0b;
    }

    .stat-card.users:hover {
      box-shadow: 0 8px 24px rgba(245, 158, 11, 0.2);
    }

    .stat-card.transactions {
      border-color: #64748b;
    }

    .stat-card.transactions:hover {
      box-shadow: 0 8px 24px rgba(100, 116, 139, 0.2);
    }

    .stat-icon {
      width: 64px;
      height: 64px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      flex-shrink: 0;
    }

    .stat-card.deposit .stat-icon {
      background: linear-gradient(135deg, #10b981, #059669);
    }

    .stat-card.deduction .stat-icon {
      background: linear-gradient(135deg, #ef4444, #dc2626);
    }

    .stat-card.refund .stat-icon {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
    }

    .stat-card.balance .stat-icon {
      background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    }

    .stat-card.users .stat-icon {
      background: linear-gradient(135deg, #f59e0b, #d97706);
    }

    .stat-card.transactions .stat-icon {
      background: linear-gradient(135deg, #64748b, #475569);
    }

    .stat-icon mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
    }

    .stat-info {
      flex: 1;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: 800;
      color: #1e293b;
      margin: 0 0 6px 0;
    }

    .stat-label {
      font-size: 0.9rem;
      color: #64748b;
      font-weight: 500;
      line-height: 1.4;
    }

    /* Loading and Empty States */
    .loading-state,
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #64748b;
    }

    .loading-state mat-spinner,
    .empty-state mat-icon {
      margin: 0 auto 16px auto;
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #cbd5e1;
    }

    .loading-state p,
    .empty-state p {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 500;
    }

    /* Responsive Design */
    @media (max-width: 1024px) {
      .user-card {
        flex-direction: column;
        align-items: stretch;
      }

      .user-balance {
        border-left: none;
        border-right: none;
        border-top: 2px solid #e2e8f0;
        border-bottom: 2px solid #e2e8f0;
        padding: 16px 0;
        text-align: left;
        min-width: 0;
      }

      .last-transaction {
        justify-content: flex-start;
      }

      .user-actions {
        width: 100%;
        justify-content: stretch;
      }

      .action-btn {
        flex: 1;
        justify-content: center;
      }
    }

    @media (max-width: 768px) {
      .admin-credit-container {
        padding: 12px;
      }

      .header-section {
        flex-direction: column;
        align-items: stretch;
        gap: 16px;
        padding: 20px;
      }

      .header-content h1 {
        font-size: 1.6rem;
        text-align: center;
      }

      .header-subtitle {
        text-align: center;
      }

      .back-btn,
      .refresh-btn {
        width: 100%;
        justify-content: center;
      }

      .custom-tabs {
        flex-direction: column;
      }

      .tab-btn {
        min-width: 0;
        width: 100%;
      }

      .modern-card {
        padding: 20px;
      }

      .form-row {
        grid-template-columns: 1fr;
      }

      .stats-grid {
        grid-template-columns: 1fr;
      }

      .user-info {
        flex-direction: column;
        align-items: flex-start;
      }

      .user-avatar {
        width: 48px;
        height: 48px;
      }

      .action-btn span {
        display: none;
      }

      .search-wrapper {
        max-width: 100%;
      }
    }

    @media (max-width: 480px) {
      .header-content h1 {
        font-size: 1.3rem;
      }

      .stat-value {
        font-size: 1.5rem;
      }

      .balance-value {
        font-size: 1.3rem;
      }

      .form-actions {
        flex-direction: column-reverse;
      }

      .btn-primary,
      .btn-secondary {
        width: 100%;
        justify-content: center;
      }
    }

  `]
})
export class AdminCreditManagementComponent implements OnInit {
  selectedTab = 0;
  loading = true;
  processing = false;
  
  // User data
  users: UserCreditInfo[] = [];
  allUsers: UserCreditInfo[] = []; // All users for dropdown
  totalUsers = 0;
  pageSize = 10;
  currentPage = 0;
  
  // Statistics
  creditStats: any = null;
  
  // Form controls
  searchControl = new FormControl('');
  adjustmentForm: FormGroup;
  
  // Table columns
  displayedColumns = ['user', 'balance', 'lastTransaction', 'actions'];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private creditService: CreditService,
    private authService: AuthService,
    private memberService: MemberService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.adjustmentForm = this.fb.group({
      userId: ['', Validators.required],
      type: ['deposit', Validators.required],
      amount: ['', [Validators.required, Validators.min(0.01)]],
      reason: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadData();
    this.setupSearchListener();
  }

  setupSearchListener(): void {
    this.searchControl.valueChanges.subscribe(value => {
      this.loadUsers(this.currentPage, this.pageSize, value || '');
    });
  }

  async loadData(): Promise<void> {
    this.loading = true;
    try {
      await Promise.all([
        this.loadUsers(),
        this.loadAllUsers(),
        this.loadStatistics()
      ]);
    } catch (error) {
      console.error('Error loading admin credit data:', error);
      this.snackBar.open('Error loading data', 'Close', { duration: 3000 });
    } finally {
      this.loading = false;
    }
  }

  async loadUsers(page = 0, limit = 10, search = ''): Promise<void> {
    try {
      const response = await this.creditService.getAllUserCredits(page + 1, limit, search).toPromise();
      if (response?.success) {
        this.users = response.data.users;
        this.totalUsers = response.data.pagination.total;
        this.currentPage = page;
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }

  async loadAllUsers(): Promise<void> {
    try {
      // Load all users for the dropdown by requesting a large limit
      const response = await this.creditService.getAllUserCredits(1, 1000).toPromise();
      if (response?.success) {
        this.allUsers = response.data.users;
      }
    } catch (error) {
      console.error('Error loading all users:', error);
    }
  }

  async loadStatistics(): Promise<void> {
    try {
      // Note: We'll need to create an admin endpoint for overall credit stats
      // For now, we'll aggregate from user data
      this.calculateStats();
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  }

  calculateStats(): void {
    if (this.users.length === 0) return;
    
    this.creditStats = {
      totalBalance: this.users.reduce((sum, user) => sum + user.creditBalance, 0),
      usersWithCredits: this.users.filter(user => user.creditBalance > 0).length,
      totalUsers: this.users.length
    };
  }

  onPageChange(event: PageEvent): void {
    this.loadUsers(event.pageIndex, event.pageSize, this.searchControl.value || '');
  }

  adjustCredits(user: UserCreditInfo, type: 'deposit' | 'deduction'): void {
    this.adjustmentForm.patchValue({
      userId: user._id,
      type: type,
      amount: '',
      reason: ''
    });
    this.selectedTab = 1; // Switch to adjustment tab
  }

  async processAdjustment(): Promise<void> {
    if (this.adjustmentForm.invalid) return;
    
    this.processing = true;
    try {
      const formValue = this.adjustmentForm.value;
      const response = await this.creditService.adjustUserCredits(formValue).toPromise();
      
      if (response?.success) {
        this.snackBar.open(response.message, 'Close', { 
          duration: 5000,
          panelClass: ['success-snackbar']
        });
        this.resetForm();
        this.refreshData();
      }
    } catch (error: any) {
      console.error('Error adjusting credits:', error);
      this.snackBar.open(error.error?.message || 'Error processing adjustment', 'Close', { 
        duration: 5000,
        panelClass: ['error-snackbar']
      });
    } finally {
      this.processing = false;
    }
  }

  resetForm(): void {
    this.adjustmentForm.reset({
      userId: '',
      type: 'deposit',
      amount: '',
      reason: ''
    });
  }

  refreshData(): void {
    this.loadData();
  }

  viewUserHistory(user: UserCreditInfo): void {
    this.dialog.open(UserHistoryDialogComponent, {
      data: user,
      width: '720px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      panelClass: 'history-dialog-panel'
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  // Helper methods for template
  getTransactionIcon(type: string): string {
    switch (type) {
      case 'deposit': return 'add_circle';
      case 'deduction': return 'remove_circle';
      case 'refund': return 'refresh';
      case 'adjustment': return 'tune';
      default: return 'account_balance';
    }
  }

  getAmountPrefix(type: string): string {
    return ['deposit', 'refund'].includes(type) ? '+' : '-';
  }

  // Statistics helper methods
  getTotalDeposits(): number {
    return this.creditStats?.totalDeposits || 0;
  }

  getTotalUsed(): number {
    return this.creditStats?.totalUsed || 0;
  }

  getTotalRefunds(): number {
    return this.creditStats?.totalRefunds || 0;
  }

  getTotalBalance(): number {
    return this.creditStats?.totalBalance || 0;
  }

  getUsersWithCredits(): number {
    return this.creditStats?.usersWithCredits || 0;
  }

  getTotalTransactions(): number {
    return this.creditStats?.totalTransactions || 0;
  }
}

// ─── User Credit History Dialog ─────────────────────────────────────────────

@Component({
  selector: 'app-user-history-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="history-dialog">
      <!-- Header -->
      <div class="hd-header">
        <div class="hd-title">
          <mat-icon>history</mat-icon>
          <div>
            <h2>Transaction History</h2>
            <p>{{data.fullName}} &nbsp;·&nbsp; Balance: <strong>₱{{data.creditBalance | number:'1.2-2'}}</strong></p>
          </div>
        </div>
        <button class="hd-close" (click)="dialogRef.close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Body -->
      <div class="hd-body">
        <!-- Loading -->
        <div class="hd-loading" *ngIf="loading">
          <mat-spinner diameter="44"></mat-spinner>
          <span>Loading transactions...</span>
        </div>

        <!-- List -->
        <div *ngIf="!loading">
          <div class="hd-row" *ngFor="let tx of transactions">
            <mat-icon class="hd-icon" [attr.data-type]="tx.type">{{getIcon(tx.type)}}</mat-icon>
            <div class="hd-info">
              <div class="hd-top">
                <span class="hd-badge" [attr.data-type]="tx.type">{{tx.type | titlecase}}</span>
                <span class="hd-desc">{{tx.description}}</span>
              </div>
              <div class="hd-meta">
                <span class="hd-flow">₱{{tx.balanceBefore | number:'1.2-2'}} → ₱{{tx.balanceAfter | number:'1.2-2'}}</span>
                <span class="hd-date">{{tx.createdAt | date:'MMM d, y, h:mm a'}}</span>
              </div>
            </div>
            <div class="hd-amount" [class.pos]="isPositive(tx.type)" [class.neg]="!isPositive(tx.type)">
              {{isPositive(tx.type) ? '+' : '−'}}₱{{tx.amount | number:'1.2-2'}}
            </div>
          </div>

          <!-- Empty State -->
          <div class="hd-empty" *ngIf="transactions.length === 0">
            <mat-icon>receipt_long</mat-icon>
            <p>No transactions found for this member</p>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <mat-paginator
        *ngIf="total > pageSize"
        [length]="total"
        [pageSize]="pageSize"
        [pageIndex]="page"
        [pageSizeOptions]="[5, 10, 25]"
        (page)="onPageChange($event)"
        showFirstLastButtons>
      </mat-paginator>
    </div>
  `,
  styles: [`
    .history-dialog {
      display: flex;
      flex-direction: column;
      max-height: 85vh;
      overflow: hidden;
    }

    /* Header */
    .hd-header {
      background: linear-gradient(135deg, #667eea, #764ba2);
      padding: 20px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-shrink: 0;
    }

    .hd-title {
      display: flex;
      align-items: center;
      gap: 14px;
      color: white;
    }

    .hd-title mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      flex-shrink: 0;
    }

    .hd-title h2 {
      margin: 0 0 4px 0;
      font-size: 1.2rem;
      font-weight: 700;
    }

    .hd-title p {
      margin: 0;
      font-size: 0.9rem;
      opacity: 0.9;
    }

    .hd-close {
      background: rgba(255,255,255,0.2);
      border: none;
      border-radius: 10px;
      color: white;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.2s;
      flex-shrink: 0;
    }

    .hd-close:hover { background: rgba(255,255,255,0.35); }

    /* Body */
    .hd-body {
      overflow-y: auto;
      flex: 1;
      background: white;
    }

    /* Loading */
    .hd-loading {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 40px 24px;
      color: #64748b;
      font-size: 1rem;
    }

    /* Rows */
    .hd-row {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 24px;
      border-bottom: 1px solid #f1f5f9;
      transition: background 0.15s;
    }

    .hd-row:last-child { border-bottom: none; }
    .hd-row:hover { background: #f8fafc; }

    .hd-icon {
      font-size: 26px;
      width: 26px;
      height: 26px;
      flex-shrink: 0;
    }

    .hd-icon[data-type="deposit"]    { color: #10b981; }
    .hd-icon[data-type="deduction"]  { color: #ef4444; }
    .hd-icon[data-type="refund"]     { color: #3b82f6; }
    .hd-icon[data-type="adjustment"] { color: #8b5cf6; }

    .hd-info {
      flex: 1;
      min-width: 0;
    }

    .hd-top {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 5px;
      flex-wrap: wrap;
    }

    .hd-badge {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 2px 10px;
      border-radius: 20px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      flex-shrink: 0;
    }

    .hd-badge[data-type="deposit"]    { background: #dcfce7; color: #166534; }
    .hd-badge[data-type="deduction"]  { background: #fee2e2; color: #991b1b; }
    .hd-badge[data-type="refund"]     { background: #dbeafe; color: #1e40af; }
    .hd-badge[data-type="adjustment"] { background: #f3e8ff; color: #6b21a8; }

    .hd-desc {
      font-size: 0.9rem;
      color: #374151;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .hd-meta {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
    }

    .hd-flow {
      font-size: 0.78rem;
      color: #94a3b8;
      font-family: monospace;
    }

    .hd-date {
      font-size: 0.78rem;
      color: #94a3b8;
    }

    .hd-amount {
      font-size: 1.05rem;
      font-weight: 700;
      flex-shrink: 0;
      min-width: 80px;
      text-align: right;
    }

    .hd-amount.pos { color: #10b981; }
    .hd-amount.neg { color: #ef4444; }

    /* Empty */
    .hd-empty {
      text-align: center;
      padding: 48px 24px;
      color: #94a3b8;
    }

    .hd-empty mat-icon {
      font-size: 52px;
      width: 52px;
      height: 52px;
      display: block;
      margin: 0 auto 12px;
      color: #cbd5e1;
    }

    .hd-empty p {
      margin: 0;
      font-size: 1rem;
    }

    @media (max-width: 480px) {
      .hd-flow { display: none; }
      .hd-desc { max-width: 130px; }
    }
  `]
})
export class UserHistoryDialogComponent implements OnInit {
  transactions: CreditTransaction[] = [];
  loading = false;
  page = 0;
  pageSize = 10;
  total = 0;

  constructor(
    public dialogRef: MatDialogRef<UserHistoryDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: UserCreditInfo,
    private creditService: CreditService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadTransactions(0, this.pageSize);
  }

  loadTransactions(page: number, pageSize: number): void {
    this.loading = true;
    this.creditService.getUserCreditTransactions(this.data._id, page + 1, pageSize)
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.transactions = res.data.transactions;
            this.total = res.data.pagination.total;
            this.page = page;
          }
          this.loading = false;
        },
        error: () => {
          this.snackBar.open('Error loading transaction history', 'Close', { duration: 3000 });
          this.loading = false;
        }
      });
  }

  onPageChange(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.loadTransactions(event.pageIndex, event.pageSize);
  }

  getIcon(type: string): string {
    switch (type) {
      case 'deposit':    return 'add_circle';
      case 'deduction':  return 'remove_circle';
      case 'refund':     return 'refresh';
      case 'adjustment': return 'tune';
      default:           return 'account_balance';
    }
  }

  isPositive(type: string): boolean {
    return ['deposit', 'refund'].includes(type);
  }
}