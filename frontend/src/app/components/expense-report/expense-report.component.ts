import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  FormsModule,
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSortModule } from '@angular/material/sort';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogData,
} from '../../shared/confirmation-dialog/confirmation-dialog.component';
import { environment } from '../../../environments/environment';

interface Expense {
  _id?: string;
  date: Date;
  amount: number;
  details: string;
  category: string;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ExpenseResponse {
  success: boolean;
  data: {
    expenses: Expense[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
    summary: {
      totalAmount: number;
      totalExpenses: number;
      categorySummary: Array<{
        _id: string;
        count: number;
        totalAmount: number;
      }>;
    };
  };
}

@Component({
  selector: 'app-expense-report',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatTabsModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatToolbarModule,
    MatPaginatorModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSortModule,
  ],
  template: `
    <div class="page-container">
      <!-- Modern Header -->
      <div class="page-header">
        <div class="header-content">
          <button mat-icon-button (click)="goBack()" class="back-button">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <div class="title-section">
            <h1 class="page-title">
              <mat-icon>receipt_long</mat-icon>
              Expense Report
            </h1>
            <p class="page-subtitle">Manage and track club expenses</p>
          </div>
          <div class="summary-cards">
            <mat-card class="summary-card">
              <mat-icon>payments</mat-icon>
              <div class="summary-content">
                <span class="summary-value">₱{{ getTotalAmount() | number: '1.2-2' }}</span>
                <span class="summary-label">Total Expenses</span>
              </div>
            </mat-card>
            <mat-card class="summary-card">
              <mat-icon>receipt</mat-icon>
              <div class="summary-content">
                <span class="summary-value">{{ getTotalCount() }}</span>
                <span class="summary-label">Records</span>
              </div>
            </mat-card>
          </div>
        </div>
      </div>

      <!-- Page Content -->
      <div class="page-content">
        <mat-tab-group class="management-tabs" [(selectedIndex)]="selectedTabIndex">
          <!-- Expense List Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>list</mat-icon>
              Expense List
            </ng-template>

            <div class="tab-content modern-expense-list">
              <!-- Modern Toolbar -->
              <div class="modern-toolbar">
                <div class="toolbar-left">
                  <div class="search-filter-section">
                    <div class="filter-group">
                      <label for="categoryFilter" class="filter-label">
                        <mat-icon class="label-icon">category</mat-icon>
                        Filter by Category
                      </label>
                      <select
                        id="categoryFilter"
                        class="modern-select"
                        [(ngModel)]="selectedCategory"
                        (change)="onFilterChange()"
                      >
                        <option value="all">All Categories</option>
                        <option *ngFor="let category of expenseCategories" [value]="category">
                          {{ category }}
                        </option>
                      </select>
                    </div>
                  </div>
                </div>

                <div class="toolbar-right">
                  <button class="modern-btn modern-btn-primary" (click)="openAddExpenseDialog()">
                    <mat-icon>add_circle</mat-icon>
                    <span>Add New Expense</span>
                  </button>
                </div>
              </div>

              <!-- Loading State -->
              <div *ngIf="loading" class="modern-loading">
                <mat-progress-spinner mode="indeterminate" diameter="50"></mat-progress-spinner>
                <p class="loading-text">Loading expenses...</p>
              </div>

              <!-- Modern Table List -->
              <div *ngIf="!loading && expenses.length > 0" class="expense-list-container">
                <!-- Stats Bar -->
                <div class="stats-bar">
                  <div class="stat-item">
                    <mat-icon class="stat-icon">receipt</mat-icon>
                    <div class="stat-content">
                      <span class="stat-value">{{ totalExpenses }}</span>
                      <span class="stat-label">Total Expenses</span>
                    </div>
                  </div>
                  <div class="stat-item highlight">
                    <mat-icon class="stat-icon">payments</mat-icon>
                    <div class="stat-content">
                      <span class="stat-value">₱{{ totalAmount | number: '1.2-2' }}</span>
                      <span class="stat-label">Total Amount</span>
                    </div>
                  </div>
                  <div class="stat-item">
                    <mat-icon class="stat-icon">filter_alt</mat-icon>
                    <div class="stat-content">
                      <span class="stat-value">{{ expenses.length }}</span>
                      <span class="stat-label">Showing</span>
                    </div>
                  </div>
                </div>

                <!-- Modern Table -->
                <div class="modern-table-wrapper">
                  <table class="modern-table">
                    <thead>
                      <tr>
                        <th class="col-date">
                          <div class="header-content">
                            <mat-icon>event</mat-icon>
                            <span>Date</span>
                          </div>
                        </th>
                        <th class="col-amount">
                          <div class="header-content">
                            <mat-icon>payments</mat-icon>
                            <span>Amount</span>
                          </div>
                        </th>
                        <th class="col-details">
                          <div class="header-content">
                            <mat-icon>description</mat-icon>
                            <span>Details</span>
                          </div>
                        </th>
                        <th class="col-category">
                          <div class="header-content">
                            <mat-icon>label</mat-icon>
                            <span>Category</span>
                          </div>
                        </th>
                        <th class="col-actions">
                          <div class="header-content">
                            <mat-icon>settings</mat-icon>
                            <span>Actions</span>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let expense of expenses; let i = index" class="expense-row">
                        <td class="col-date">
                          <span class="date-text">{{ formatDate(expense.date) }}</span>
                        </td>
                        <td class="col-amount">
                          <span class="amount-text">₱{{ expense.amount | number: '1.2-2' }}</span>
                        </td>
                        <td class="col-details">
                          <span class="details-text" [title]="expense.details">{{
                            expense.details
                          }}</span>
                        </td>
                        <td class="col-category">
                          <span class="category-badge">{{ expense.category }}</span>
                        </td>
                        <td class="col-actions">
                          <div class="action-buttons">
                            <button
                              class="action-btn edit-btn"
                              (click)="editExpense(expense)"
                              title="Edit expense"
                            >
                              <mat-icon>edit</mat-icon>
                            </button>
                            <button
                              class="action-btn delete-btn"
                              (click)="deleteExpense(expense)"
                              title="Delete expense"
                            >
                              <mat-icon>delete</mat-icon>
                            </button>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- Modern Pagination -->
                <div class="modern-pagination">
                  <div class="pagination-info">
                    Showing {{ (currentPage - 1) * pageSize + 1 }} -
                    {{ Math.min(currentPage * pageSize, totalExpenses) }} of
                    {{ totalExpenses }} expenses
                  </div>
                  <div class="pagination-controls">
                    <button
                      class="page-btn"
                      [disabled]="currentPage === 1"
                      (click)="goToPage(1)"
                      title="First page"
                    >
                      <mat-icon>first_page</mat-icon>
                    </button>
                    <button
                      class="page-btn"
                      [disabled]="currentPage === 1"
                      (click)="goToPage(currentPage - 1)"
                      title="Previous page"
                    >
                      <mat-icon>chevron_left</mat-icon>
                    </button>
                    <div class="page-numbers">
                      <span class="current-page">{{ currentPage }}</span>
                      <span class="page-separator">/</span>
                      <span class="total-pages">{{ Math.ceil(totalExpenses / pageSize) }}</span>
                    </div>
                    <button
                      class="page-btn"
                      [disabled]="currentPage >= Math.ceil(totalExpenses / pageSize)"
                      (click)="goToPage(currentPage + 1)"
                      title="Next page"
                    >
                      <mat-icon>chevron_right</mat-icon>
                    </button>
                    <button
                      class="page-btn"
                      [disabled]="currentPage >= Math.ceil(totalExpenses / pageSize)"
                      (click)="goToPage(Math.ceil(totalExpenses / pageSize))"
                      title="Last page"
                    >
                      <mat-icon>last_page</mat-icon>
                    </button>
                  </div>
                  <div class="page-size-selector">
                    <label for="pageSize">Items per page:</label>
                    <select
                      id="pageSize"
                      class="page-size-select"
                      [(ngModel)]="pageSize"
                      (change)="onPageSizeChange()"
                    >
                      <option [value]="10">10</option>
                      <option [value]="25">25</option>
                      <option [value]="50">50</option>
                      <option [value]="100">100</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Modern Empty State -->
              <div *ngIf="!loading && expenses.length === 0" class="modern-empty-state">
                <div class="empty-illustration">
                  <mat-icon>receipt_long</mat-icon>
                </div>
                <h3 class="empty-title">No expenses found</h3>
                <p class="empty-message">
                  Start tracking your club expenses by adding your first entry.
                </p>
                <button class="modern-btn modern-btn-primary" (click)="openAddExpenseDialog()">
                  <mat-icon>add_circle</mat-icon>
                  <span>Add First Expense</span>
                </button>
              </div>
            </div>
          </mat-tab>

          <!-- Add/Edit Expense Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>{{ editingExpense ? 'edit' : 'add' }}</mat-icon>
              {{ editingExpense ? 'Edit' : 'Add' }} Expense
            </ng-template>

            <div class="tab-content modern-form-container">
              <div class="modern-form-card">
                <!-- Form Header -->
                <div class="form-header">
                  <div class="header-icon" [ngClass]="editingExpense ? 'edit-mode' : 'add-mode'">
                    <mat-icon>{{ editingExpense ? 'edit' : 'add_circle_outline' }}</mat-icon>
                  </div>
                  <div class="header-text">
                    <h2 class="form-title">{{ editingExpense ? 'Edit' : 'Add New' }} Expense</h2>
                    <p class="form-subtitle">
                      {{
                        editingExpense
                          ? 'Update the expense details below'
                          : 'Fill in the details to record a new expense'
                      }}
                    </p>
                  </div>
                </div>

                <!-- Form Body -->
                <form
                  [formGroup]="expenseForm"
                  (ngSubmit)="onSubmitExpense()"
                  class="modern-expense-form"
                >
                  <div class="form-grid">
                    <!-- Date Field -->
                    <div class="form-group">
                      <label for="expenseDate" class="form-label">
                        <mat-icon class="label-icon">event</mat-icon>
                        <span>Date</span>
                        <span class="required-mark">*</span>
                      </label>
                      <input
                        type="date"
                        id="expenseDate"
                        class="modern-input"
                        [class.input-error]="
                          expenseForm.get('date')?.invalid && expenseForm.get('date')?.touched
                        "
                        formControlName="date"
                        [value]="formatDateForInput(expenseForm.get('date')?.value)"
                        (change)="onDateChange($event)"
                        required
                      />
                      <div
                        class="error-message"
                        *ngIf="
                          expenseForm.get('date')?.hasError('required') &&
                          expenseForm.get('date')?.touched
                        "
                      >
                        <mat-icon>error</mat-icon>
                        <span>Date is required</span>
                      </div>
                    </div>

                    <!-- Amount Field -->
                    <div class="form-group">
                      <label for="expenseAmount" class="form-label">
                        <mat-icon class="label-icon">payments</mat-icon>
                        <span>Amount (₱)</span>
                        <span class="required-mark">*</span>
                      </label>
                      <div class="input-with-prefix">
                        <span class="input-prefix">₱</span>
                        <input
                          type="number"
                          id="expenseAmount"
                          class="modern-input with-prefix"
                          [class.input-error]="
                            expenseForm.get('amount')?.invalid && expenseForm.get('amount')?.touched
                          "
                          formControlName="amount"
                          placeholder="0.00"
                          min="0.01"
                          step="0.01"
                          required
                        />
                      </div>
                      <div
                        class="error-message"
                        *ngIf="
                          expenseForm.get('amount')?.hasError('required') &&
                          expenseForm.get('amount')?.touched
                        "
                      >
                        <mat-icon>error</mat-icon>
                        <span>Amount is required</span>
                      </div>
                      <div
                        class="error-message"
                        *ngIf="
                          expenseForm.get('amount')?.hasError('min') &&
                          expenseForm.get('amount')?.touched
                        "
                      >
                        <mat-icon>error</mat-icon>
                        <span>Amount must be greater than 0</span>
                      </div>
                    </div>

                    <!-- Category Field -->
                    <div class="form-group full-width">
                      <label for="expenseCategory" class="form-label">
                        <mat-icon class="label-icon">label</mat-icon>
                        <span>Category</span>
                        <span class="required-mark">*</span>
                      </label>
                      <select
                        id="expenseCategory"
                        class="modern-select"
                        [class.input-error]="
                          expenseForm.get('category')?.invalid &&
                          expenseForm.get('category')?.touched
                        "
                        formControlName="category"
                        required
                      >
                        <option value="" disabled selected>Select a category</option>
                        <option *ngFor="let category of expenseCategories" [value]="category">
                          {{ category }}
                        </option>
                      </select>
                      <div
                        class="error-message"
                        *ngIf="
                          expenseForm.get('category')?.hasError('required') &&
                          expenseForm.get('category')?.touched
                        "
                      >
                        <mat-icon>error</mat-icon>
                        <span>Category is required</span>
                      </div>
                    </div>

                    <!-- Details Field -->
                    <div class="form-group full-width">
                      <label for="expenseDetails" class="form-label">
                        <mat-icon class="label-icon">description</mat-icon>
                        <span>Details</span>
                        <span class="required-mark">*</span>
                      </label>
                      <textarea
                        id="expenseDetails"
                        class="modern-textarea"
                        [class.input-error]="
                          expenseForm.get('details')?.invalid && expenseForm.get('details')?.touched
                        "
                        formControlName="details"
                        rows="4"
                        placeholder="Enter expense description..."
                        required
                      ></textarea>
                      <div class="char-counter">
                        {{ expenseForm.get('details')?.value?.length || 0 }} characters
                      </div>
                      <div
                        class="error-message"
                        *ngIf="
                          expenseForm.get('details')?.hasError('required') &&
                          expenseForm.get('details')?.touched
                        "
                      >
                        <mat-icon>error</mat-icon>
                        <span>Details are required</span>
                      </div>
                      <div
                        class="error-message"
                        *ngIf="
                          expenseForm.get('details')?.hasError('minlength') &&
                          expenseForm.get('details')?.touched
                        "
                      >
                        <mat-icon>error</mat-icon>
                        <span>Details must be at least 3 characters</span>
                      </div>
                    </div>
                  </div>

                  <!-- Form Actions -->
                  <div class="form-actions">
                    <button
                      type="button"
                      class="modern-btn cancel-btn"
                      (click)="resetForm()"
                      [disabled]="submitting"
                    >
                      <mat-icon>close</mat-icon>
                      <span>Cancel</span>
                    </button>
                    <button
                      type="submit"
                      class="modern-btn submit-btn"
                      [class.submitting]="submitting"
                      [disabled]="expenseForm.invalid || submitting"
                    >
                      <mat-icon>{{
                        submitting ? 'hourglass_empty' : editingExpense ? 'save' : 'add_circle'
                      }}</mat-icon>
                      <span>{{
                        submitting ? 'Saving...' : editingExpense ? 'Update Expense' : 'Add Expense'
                      }}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </mat-tab>
        </mat-tab-group>
      </div>
    </div>
  `,
  styleUrls: ['./expense-report.component.scss'],
})
export class ExpenseReportComponent implements OnInit {
  expenses: Expense[] = [];
  expenseCategories: string[] = [];
  displayedColumns: string[] = ['date', 'amount', 'details', 'category', 'actions'];

  // Pagination
  currentPage = 1;
  pageSize = 25;
  totalExpenses = 0;
  totalAmount = 0;

  // Filters
  selectedCategory = 'all';

  // State
  loading = false;
  submitting = false;
  editingExpense: Expense | null = null;
  selectedTabIndex = 0;

  // Form
  expenseForm: FormGroup;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private fb: FormBuilder,
  ) {
    this.expenseForm = this.fb.group({
      date: [new Date(), [Validators.required]],
      amount: ['', [Validators.required, Validators.min(0.01)]],
      details: ['', [Validators.required, Validators.minLength(3)]],
      category: ['', [Validators.required]],
    });
  }

  ngOnInit() {
    this.loadExpenseCategories();
    this.loadExpenses();
  }

  loadExpenseCategories() {
    this.http
      .get<{ success: boolean; data: string[] }>(`${environment.apiUrl}/expenses/categories`)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.expenseCategories = response.data;
          }
        },
        error: (error) => {
          console.error('Error loading categories:', error);
        },
      });
  }

  loadExpenses() {
    this.loading = true;
    const params: any = {
      page: this.currentPage,
      limit: this.pageSize,
    };

    if (this.selectedCategory !== 'all') {
      params.category = this.selectedCategory;
    }

    this.http.get<ExpenseResponse>(`${environment.apiUrl}/expenses`, { params }).subscribe({
      next: (response) => {
        if (response.success) {
          this.expenses = response.data.expenses;
          this.totalExpenses = response.data.pagination.totalItems;
          this.totalAmount = response.data.summary.totalAmount;
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading expenses:', error);
        this.showSnackBar('Failed to load expenses', 'error');
        this.loading = false;
      },
    });
  }

  onFilterChange() {
    this.currentPage = 1;
    this.loadExpenses();
  }

  onPageChange(event: PageEvent) {
    this.currentPage = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadExpenses();
  }

  openAddExpenseDialog() {
    // Switch to add expense tab
    this.editingExpense = null;
    this.resetForm();
    this.selectedTabIndex = 1; // Switch to the form tab
  }

  editExpense(expense: Expense) {
    this.editingExpense = expense;
    this.expenseForm.patchValue({
      date: new Date(expense.date),
      amount: expense.amount,
      details: expense.details,
      category: expense.category,
    });
    this.selectedTabIndex = 1; // Switch to the form tab
  }

  onSubmitExpense() {
    if (this.expenseForm.valid) {
      this.submitting = true;
      const formData = this.expenseForm.value;

      const request = this.editingExpense
        ? this.http.put(`${environment.apiUrl}/expenses/${this.editingExpense._id}`, formData)
        : this.http.post(`${environment.apiUrl}/expenses`, formData);

      request.subscribe({
        next: (response: any) => {
          if (response.success) {
            this.showSnackBar(
              this.editingExpense ? 'Expense updated successfully' : 'Expense added successfully',
              'success',
            );
            this.resetForm();
            this.loadExpenses();
          }
          this.submitting = false;
        },
        error: (error) => {
          console.error('Error saving expense:', error);
          this.showSnackBar('Failed to save expense', 'error');
          this.submitting = false;
        },
      });
    }
  }

  deleteExpense(expense: Expense) {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '450px',
      maxWidth: '90vw',
      panelClass: 'modern-dialog',
      disableClose: false,
      autoFocus: false,
      data: {
        title: 'Delete Expense',
        message: `Are you sure you want to permanently delete this expense: "${expense.details}"? This action cannot be undone.`,
        confirmText: 'Delete Expense',
        cancelText: 'Keep It',
        type: 'danger',
      } as ConfirmationDialogData,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.http.delete(`${environment.apiUrl}/expenses/${expense._id}`).subscribe({
          next: (response: any) => {
            if (response.success) {
              this.showSnackBar('Expense deleted successfully', 'success');
              this.loadExpenses();
            }
          },
          error: (error) => {
            console.error('Error deleting expense:', error);
            this.showSnackBar('Failed to delete expense', 'error');
          },
        });
      }
    });
  }

  resetForm() {
    this.editingExpense = null;
    this.expenseForm.reset();
    this.expenseForm.patchValue({
      date: new Date(),
      amount: '',
      details: '',
      category: '',
    });
    this.selectedTabIndex = 0; // Return to list tab
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString();
  }

  getTotalAmount(): number {
    return this.totalAmount;
  }

  getTotalCount(): number {
    return this.totalExpenses;
  }

  goBack() {
    this.router.navigate(['/admin']);
  }

  private showSnackBar(message: string, type: 'success' | 'error') {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: type === 'success' ? 'success-snackbar' : 'error-snackbar',
    });
  }

  // Pagination helper methods
  goToPage(page: number) {
    this.currentPage = page;
    this.loadExpenses();
  }

  onPageSizeChange() {
    this.currentPage = 1;
    this.loadExpenses();
  }

  // Expose Math for template
  Math = Math;

  // Helper methods for native date input
  formatDateForInput(date: Date | string | null): string {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      this.expenseForm.patchValue({
        date: new Date(input.value),
      });
    }
  }
}
