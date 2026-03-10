import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormsModule,
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ExpenseCategoryService } from '../../services/expense-category.service';
import {
  ExpenseCategory,
  CreateCategoryDto,
  UpdateCategoryDto,
} from '../../models/expense-category.model';

interface CategoryWithUsage extends ExpenseCategory {
  usageCount?: number;
}

@Component({
  selector: 'app-expense-category-management',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTabsModule,
    DragDropModule,
  ],
  templateUrl: './expense-category-management.component.html',
  styleUrl: './expense-category-management.component.scss',
})
export class ExpenseCategoryManagementComponent implements OnInit {
  categories: CategoryWithUsage[] = [];
  filteredCategories: CategoryWithUsage[] = [];
  filterStatus: 'all' | 'active' | 'inactive' = 'all';

  categoryForm: FormGroup;
  isEditMode = false;
  editingCategoryId: string | null = null;

  isLoading = false;
  isSaving = false;

  displayedColumns: string[] = [
    'dragHandle',
    'name',
    'color',
    'description',
    'usageCount',
    'isActive',
    'actions',
  ];

  // Material icon options (common icons)
  materialIcons = [
    'attach_money',
    'build',
    'cleaning_services',
    'local_shipping',
    'volunteer_activism',
    'local_drink',
    'lightbulb',
    'shopping_cart',
    'sports_tennis',
    'checkroom',
    'scoreboard',
    'emoji_events',
    'water_drop',
  ];

  // Stats
  totalCategories = 0;
  activeCategories = 0;
  inactiveCategories = 0;

  constructor(
    private fb: FormBuilder,
    private categoryService: ExpenseCategoryService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
  ) {
    this.categoryForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      description: ['', [Validators.maxLength(500)]],
      color: ['', [Validators.pattern(/^#[0-9A-F]{6}$/i)]],
      icon: [''],
    });
  }

  ngOnInit(): void {
    this.loadCategories();
  }

  /**
   * Load all categories including inactive
   */
  loadCategories(): void {
    this.isLoading = true;
    this.categoryService.getAllCategoriesIncludingInactive().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.categories = response.data;
          this.applyFilter();
          this.updateStats();

          // Load usage counts for each category
          this.loadUsageCounts();
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading categories:', error);
        this.snackBar.open('Failed to load categories', 'Close', { duration: 3000 });
        this.isLoading = false;
      },
    });
  }

  /**
   * Load usage counts for all categories
   */
  loadUsageCounts(): void {
    this.categories.forEach((category) => {
      this.categoryService.getCategoryUsage(category._id).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            category.usageCount = response.data.usageCount;
          }
        },
        error: (error) => {
          console.error(`Error loading usage for category ${category._id}:`, error);
        },
      });
    });
  }

  /**
   * Apply filter based on status
   */
  applyFilter(): void {
    if (this.filterStatus === 'all') {
      this.filteredCategories = [...this.categories];
    } else if (this.filterStatus === 'active') {
      this.filteredCategories = this.categories.filter((cat) => cat.isActive);
    } else {
      this.filteredCategories = this.categories.filter((cat) => !cat.isActive);
    }
  }

  /**
   * Update stats
   */
  updateStats(): void {
    this.totalCategories = this.categories.length;
    this.activeCategories = this.categories.filter((cat) => cat.isActive).length;
    this.inactiveCategories = this.categories.filter((cat) => !cat.isActive).length;
  }

  /**
   * Change filter status
   */
  setFilter(status: 'all' | 'active' | 'inactive'): void {
    this.filterStatus = status;
    this.applyFilter();
  }

  /**
   * Create new category
   */
  createCategory(): void {
    if (this.categoryForm.invalid) {
      this.snackBar.open('Please fix form errors', 'Close', { duration: 3000 });
      return;
    }

    this.isSaving = true;
    const formData: CreateCategoryDto = this.categoryForm.value;

    this.categoryService.createCategory(formData).subscribe({
      next: (response) => {
        if (response.success) {
          this.snackBar.open('Category created successfully', 'Close', { duration: 3000 });
          this.categoryForm.reset();
          this.loadCategories();
        }
        this.isSaving = false;
      },
      error: (error) => {
        console.error('Error creating category:', error);
        const errorMessage = error.error?.message || 'Failed to create category';
        this.snackBar.open(errorMessage, 'Close', { duration: 5000 });
        this.isSaving = false;
      },
    });
  }

  /**
   * Edit category
   */
  editCategory(category: ExpenseCategory): void {
    this.isEditMode = true;
    this.editingCategoryId = category._id;

    this.categoryForm.patchValue({
      name: category.name,
      description: category.description || '',
      color: category.color || '',
      icon: category.icon || '',
    });
  }

  /**
   * Update category
   */
  updateCategory(): void {
    if (this.categoryForm.invalid || !this.editingCategoryId) {
      this.snackBar.open('Please fix form errors', 'Close', { duration: 3000 });
      return;
    }

    this.isSaving = true;
    const formData: UpdateCategoryDto = this.categoryForm.value;

    this.categoryService.updateCategory(this.editingCategoryId, formData).subscribe({
      next: (response) => {
        if (response.success) {
          this.snackBar.open('Category updated successfully', 'Close', { duration: 3000 });
          this.cancelEdit();
          this.loadCategories();
        }
        this.isSaving = false;
      },
      error: (error) => {
        console.error('Error updating category:', error);
        const errorMessage = error.error?.message || 'Failed to update category';
        this.snackBar.open(errorMessage, 'Close', { duration: 5000 });
        this.isSaving = false;
      },
    });
  }

  /**
   * Cancel edit mode
   */
  cancelEdit(): void {
    this.isEditMode = false;
    this.editingCategoryId = null;
    this.categoryForm.reset();
  }

  /**
   * Delete (deactivate) category
   */
  deleteCategory(category: CategoryWithUsage): void {
    if (category.usageCount && category.usageCount > 0) {
      this.snackBar.open(
        `Cannot delete category. It is used in ${category.usageCount} expense(s)`,
        'Close',
        { duration: 5000 },
      );
      return;
    }

    if (confirm(`Are you sure you want to deactivate the category "${category.name}"?`)) {
      this.categoryService.deleteCategory(category._id).subscribe({
        next: (response) => {
          if (response.success) {
            this.snackBar.open('Category deactivated successfully', 'Close', { duration: 3000 });
            this.loadCategories();
          }
        },
        error: (error) => {
          console.error('Error deleting category:', error);
          const errorMessage = error.error?.message || 'Failed to delete category';
          this.snackBar.open(errorMessage, 'Close', { duration: 5000 });
        },
      });
    }
  }

  /**
   * Toggle category activation status
   */
  toggleActivation(category: ExpenseCategory): void {
    if (category.isActive) {
      // Deactivating
      this.deleteCategory(category);
    } else {
      // Activating
      this.categoryService.activateCategory(category._id).subscribe({
        next: (response) => {
          if (response.success) {
            this.snackBar.open('Category activated successfully', 'Close', { duration: 3000 });
            this.loadCategories();
          }
        },
        error: (error) => {
          console.error('Error activating category:', error);
          const errorMessage = error.error?.message || 'Failed to activate category';
          this.snackBar.open(errorMessage, 'Close', { duration: 5000 });
        },
      });
    }
  }

  /**
   * Handle drag and drop reordering
   */
  onDrop(event: CdkDragDrop<CategoryWithUsage[]>): void {
    moveItemInArray(this.filteredCategories, event.previousIndex, event.currentIndex);

    // Get the new order of category IDs
    const categoryIds = this.filteredCategories.map((cat) => cat._id);

    // Update display order on server
    this.categoryService.reorderCategories(categoryIds).subscribe({
      next: (response) => {
        if (response.success) {
          this.snackBar.open('Categories reordered successfully', 'Close', { duration: 2000 });
        }
      },
      error: (error) => {
        console.error('Error reordering categories:', error);
        this.snackBar.open('Failed to reorder categories', 'Close', { duration: 3000 });
        // Reload to restore original order
        this.loadCategories();
      },
    });
  }

  /**
   * Save form (create or update)
   */
  saveCategory(): void {
    if (this.isEditMode) {
      this.updateCategory();
    } else {
      this.createCategory();
    }
  }
}
