import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
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
import { ConfirmationDialogComponent, ConfirmationDialogData } from '../../shared/confirmation-dialog/confirmation-dialog.component';
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
    MatSortModule
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
                <span class="summary-value">₱{{getTotalAmount() | number:'1.2-2'}}</span>
                <span class="summary-label">Total Expenses</span>
              </div>
            </mat-card>
            <mat-card class="summary-card">
              <mat-icon>receipt</mat-icon>
              <div class="summary-content">
                <span class="summary-value">{{getTotalCount()}}</span>
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
            
            <div class="tab-content">
              <!-- Filters and Add Button -->
              <div class="actions-bar">
                <div class="filters">
                  <mat-form-field appearance="outline" class="filter-field">
                    <mat-label>Category</mat-label>
                    <mat-select [(value)]="selectedCategory" (selectionChange)="onFilterChange()">
                      <mat-option value="all">All Categories</mat-option>
                      <mat-option *ngFor="let category of expenseCategories" [value]="category">
                        {{category}}
                      </mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>
                
                <button mat-raised-button color="primary" (click)="openAddExpenseDialog()">
                  <mat-icon>add</mat-icon>
                  Add Expense
                </button>
              </div>

              <!-- Loading State -->
              <div *ngIf="loading" class="loading-container">
                <mat-progress-spinner mode="indeterminate"></mat-progress-spinner>
                <p>Loading expenses...</p>
              </div>

              <!-- Expense Table -->
              <div *ngIf="!loading" class="table-container">
                <table mat-table [dataSource]="expenses" class="expense-table" matSort>
                  <!-- Date Column -->
                  <ng-container matColumnDef="date">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header>Date</th>
                    <td mat-cell *matCellDef="let expense">
                      {{formatDate(expense.date)}}
                    </td>
                  </ng-container>

                  <!-- Amount Column -->
                  <ng-container matColumnDef="amount">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header class="amount-column">Amount</th>
                    <td mat-cell *matCellDef="let expense" class="amount-column">
                      <span class="amount">₱{{expense.amount | number:'1.2-2'}}</span>
                    </td>
                  </ng-container>

                  <!-- Details Column -->
                  <ng-container matColumnDef="details">
                    <th mat-header-cell *matHeaderCellDef>Details</th>
                    <td mat-cell *matCellDef="let expense">
                      <span class="details-text">{{expense.details}}</span>
                    </td>
                  </ng-container>

                  <!-- Category Column -->
                  <ng-container matColumnDef="category">
                    <th mat-header-cell *matHeaderCellDef>Category</th>
                    <td mat-cell *matCellDef="let expense">
                      <mat-chip class="category-chip">{{expense.category}}</mat-chip>
                    </td>
                  </ng-container>

                  <!-- Actions Column -->
                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef class="actions-column">Actions</th>
                    <td mat-cell *matCellDef="let expense" class="actions-column">
                      <button mat-icon-button (click)="editExpense(expense)" matTooltip="Edit">
                        <mat-icon>edit</mat-icon>
                      </button>
                      <button mat-icon-button color="warn" (click)="deleteExpense(expense)" matTooltip="Delete">
                        <mat-icon>delete</mat-icon>
                      </button>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="expense-row"></tr>
                </table>

                <!-- Paginator -->
                <mat-paginator 
                  [length]="totalExpenses"
                  [pageSize]="pageSize"
                  [pageSizeOptions]="[10, 25, 50, 100]"
                  (page)="onPageChange($event)"
                  showFirstLastButtons>
                </mat-paginator>
              </div>

              <!-- No Data State -->
              <div *ngIf="!loading && expenses.length === 0" class="no-data">
                <mat-icon>receipt_long</mat-icon>
                <h3>No expenses found</h3>
                <p>Add your first expense to get started.</p>
                <button mat-raised-button color="primary" (click)="openAddExpenseDialog()">
                  <mat-icon>add</mat-icon>
                  Add First Expense
                </button>
              </div>
            </div>
          </mat-tab>

          <!-- Add/Edit Expense Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>add</mat-icon>
              {{editingExpense ? 'Edit' : 'Add'}} Expense
            </ng-template>

            <div class="tab-content">
              <mat-card class="form-card">
                <mat-card-header>
                  <mat-card-title>
                    <mat-icon>{{editingExpense ? 'edit' : 'add'}}</mat-icon>
                    {{editingExpense ? 'Edit' : 'Add New'}} Expense
                  </mat-card-title>
                </mat-card-header>

                <mat-card-content>
                  <form [formGroup]="expenseForm" (ngSubmit)="onSubmitExpense()" class="expense-form">
                    <!-- Date Field -->
                    <mat-form-field appearance="outline" class="form-field">
                      <mat-label>Date</mat-label>
                      <input matInput [matDatepicker]="datePicker" formControlName="date" required>
                      <mat-datepicker-toggle matSuffix [for]="datePicker"></mat-datepicker-toggle>
                      <mat-datepicker #datePicker></mat-datepicker>
                      <mat-error *ngIf="expenseForm.get('date')?.hasError('required')">
                        Date is required
                      </mat-error>
                    </mat-form-field>

                    <!-- Amount Field -->
                    <mat-form-field appearance="outline" class="form-field">
                      <mat-label>Amount (₱)</mat-label>
                      <input matInput type="number" formControlName="amount" placeholder="0.00" min="0.01" step="0.01" required>
                      <mat-error *ngIf="expenseForm.get('amount')?.hasError('required')">
                        Amount is required
                      </mat-error>
                      <mat-error *ngIf="expenseForm.get('amount')?.hasError('min')">
                        Amount must be greater than 0
                      </mat-error>
                    </mat-form-field>

                    <!-- Category Field -->
                    <mat-form-field appearance="outline" class="form-field">
                      <mat-label>Category</mat-label>
                      <mat-select formControlName="category" required>
                        <mat-option *ngFor="let category of expenseCategories" [value]="category">
                          {{category}}
                        </mat-option>
                      </mat-select>
                      <mat-error *ngIf="expenseForm.get('category')?.hasError('required')">
                        Category is required
                      </mat-error>
                    </mat-form-field>

                    <!-- Details Field -->
                    <mat-form-field appearance="outline" class="form-field full-width">
                      <mat-label>Details</mat-label>
                      <textarea matInput formControlName="details" rows="3" placeholder="Expense description" required></textarea>
                      <mat-error *ngIf="expenseForm.get('details')?.hasError('required')">
                        Details are required
                      </mat-error>
                      <mat-error *ngIf="expenseForm.get('details')?.hasError('minlength')">
                        Details must be at least 3 characters
                      </mat-error>
                    </mat-form-field>
                  </form>
                </mat-card-content>

                <mat-card-actions align="end">
                  <button mat-button (click)="resetForm()" type="button">Cancel</button>
                  <button 
                    mat-raised-button 
                    color="primary" 
                    (click)="onSubmitExpense()" 
                    [disabled]="expenseForm.invalid || submitting">
                    <mat-icon>{{submitting ? 'hourglass_empty' : (editingExpense ? 'save' : 'add')}}</mat-icon>
                    {{submitting ? 'Saving...' : (editingExpense ? 'Update' : 'Add')}} Expense
                  </button>
                </mat-card-actions>
              </mat-card>
            </div>
          </mat-tab>
        </mat-tab-group>
      </div>
    </div>
  `,
  styleUrls: ['./expense-report.component.scss']
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
    private fb: FormBuilder
  ) {
    this.expenseForm = this.fb.group({
      date: [new Date(), [Validators.required]],
      amount: ['', [Validators.required, Validators.min(0.01)]],
      details: ['', [Validators.required, Validators.minLength(3)]],
      category: ['', [Validators.required]]
    });
  }

  ngOnInit() {
    this.loadExpenseCategories();
    this.loadExpenses();
  }

  loadExpenseCategories() {
    this.http.get<{success: boolean; data: string[]}>(`${environment.apiUrl}/expenses/categories`).subscribe({
      next: (response) => {
        if (response.success) {
          this.expenseCategories = response.data;
        }
      },
      error: (error) => {
        console.error('Error loading categories:', error);
      }
    });
  }

  loadExpenses() {
    this.loading = true;
    const params: any = {
      page: this.currentPage,
      limit: this.pageSize
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
      }
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
      category: expense.category
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
              'success'
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
        }
      });
    }
  }

  deleteExpense(expense: Expense) {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Expense',
        message: `Are you sure you want to delete this expense: "${expense.details}"?`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        type: 'danger'
      } as ConfirmationDialogData
    });

    dialogRef.afterClosed().subscribe(result => {
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
          }
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
      category: ''
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
      panelClass: type === 'success' ? 'success-snackbar' : 'error-snackbar'
    });
  }
}