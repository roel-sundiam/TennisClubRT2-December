import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

interface Suggestion {
  _id: string;
  userId: string;
  user?: {
    fullName: string;
    username: string;
  };
  type: 'suggestion' | 'complaint';
  category: 'facility' | 'service' | 'booking' | 'payments' | 'general' | 'staff' | 'maintenance';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  status: 'open' | 'in_review' | 'in_progress' | 'resolved' | 'closed';
  isAnonymous: boolean;
  adminResponse?: {
    responderId: string;
    responder?: {
      fullName: string;
      username: string;
    };
    response: string;
    responseDate: Date;
    actionTaken?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

@Component({
  selector: 'app-suggestions',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatChipsModule,
    MatTabsModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatPaginatorModule
  ],
  template: `
    <div class="suggestions-container">
      <div class="suggestions-header">
        <button mat-icon-button (click)="goBack()" class="back-button" aria-label="Back to dashboard">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div class="header-copy">
          <div class="eyebrow">Member Feedback</div>
          <h1>
            <mat-icon>forum</mat-icon>
            Suggestions & Complaints
          </h1>
          <p>Share court, booking, payment, and club experience feedback with the RT2 team.</p>
        </div>
      </div>

      <mat-card class="main-card">
        <mat-tab-group [(selectedIndex)]="selectedTab">
          
          <!-- Submit New Suggestion/Complaint -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>edit_note</mat-icon>
              Submit Feedback
            </ng-template>
            <div class="tab-content">
              <div class="section-header">
                <h2>Share Your Feedback</h2>
                <p>Send a suggestion or report an issue for club review.</p>
              </div>

              <div class="submit-layout">
                <aside class="feedback-summary-panel">
                  <div class="summary-panel-icon">
                    <mat-icon>support_agent</mat-icon>
                  </div>
                  <h3>Feedback Review</h3>
                  <div class="summary-steps">
                    <div class="summary-step">
                      <span>1</span>
                      <p>Submit your feedback</p>
                    </div>
                    <div class="summary-step">
                      <span>2</span>
                      <p>Management reviews it</p>
                    </div>
                    <div class="summary-step">
                      <span>3</span>
                      <p>Track the response here</p>
                    </div>
                  </div>
                </aside>

                <mat-card class="form-card">
                  <mat-card-content>
                  <form [formGroup]="suggestionForm" (ngSubmit)="submitSuggestion()">
                    
                    <!-- Type Selection -->
                    <div class="form-row">
                      <label class="native-field">
                        <span class="native-label">Feedback Type</span>
                        <select class="native-control" formControlName="type">
                          <option value="" disabled>Select feedback type</option>
                          <option value="suggestion">Suggestion - Ideas for improvement</option>
                          <option value="complaint">Complaint - Report an issue</option>
                        </select>
                        <span class="native-error" *ngIf="suggestionForm.get('type')?.touched && suggestionForm.get('type')?.hasError('required')">
                          Please select feedback type
                        </span>
                      </label>
                    </div>

                    <!-- Category Selection -->
                    <div class="form-row">
                      <label class="native-field">
                        <span class="native-label">Category</span>
                        <select class="native-control" formControlName="category">
                          <option value="" disabled>Select a category</option>
                          <option value="facility">Facility & Courts</option>
                          <option value="service">Customer Service</option>
                          <option value="booking">Booking System</option>
                          <option value="payments">Payments & Fees</option>
                          <option value="staff">Staff & Personnel</option>
                          <option value="maintenance">Maintenance & Repairs</option>
                          <option value="general">General Feedback</option>
                        </select>
                        <span class="native-error" *ngIf="suggestionForm.get('category')?.touched && suggestionForm.get('category')?.hasError('required')">
                          Please select a category
                        </span>
                      </label>
                    </div>

                    <!-- Priority (for complaints, auto-escalated) -->
                    <div class="form-row" *ngIf="suggestionForm.get('type')?.value === 'suggestion'">
                      <label class="native-field">
                        <span class="native-label">Priority</span>
                        <select class="native-control" formControlName="priority">
                          <option value="low">Low - Minor suggestion</option>
                          <option value="medium">Medium - Moderate importance</option>
                          <option value="high">High - Important improvement</option>
                        </select>
                        <span class="native-hint">Complaints are automatically prioritized based on category.</span>
                      </label>
                    </div>

                    <!-- Title -->
                    <div class="form-row">
                      <label class="native-field">
                        <span class="native-label">Title</span>
                        <input
                          class="native-control"
                          type="text"
                          formControlName="title"
                          placeholder="Brief description of your feedback">
                        <span class="native-hint">{{suggestionForm.get('title')?.value?.length || 0}}/200 characters</span>
                        <span class="native-error" *ngIf="suggestionForm.get('title')?.touched && suggestionForm.get('title')?.hasError('required')">
                          Title is required
                        </span>
                        <span class="native-error" *ngIf="suggestionForm.get('title')?.touched && suggestionForm.get('title')?.hasError('minlength')">
                          Title must be at least 5 characters long
                        </span>
                        <span class="native-error" *ngIf="suggestionForm.get('title')?.touched && suggestionForm.get('title')?.hasError('maxlength')">
                          Title cannot exceed 200 characters
                        </span>
                      </label>
                    </div>

                    <!-- Description -->
                    <div class="form-row">
                      <label class="native-field">
                        <span class="native-label">Description</span>
                        <textarea
                          class="native-control native-textarea"
                          formControlName="description"
                          rows="6"
                          placeholder="Provide detailed information about your feedback..."></textarea>
                        <span class="native-hint">{{suggestionForm.get('description')?.value?.length || 0}}/1000 characters</span>
                        <span class="native-error" *ngIf="suggestionForm.get('description')?.touched && suggestionForm.get('description')?.hasError('required')">
                          Description is required
                        </span>
                        <span class="native-error" *ngIf="suggestionForm.get('description')?.touched && suggestionForm.get('description')?.hasError('minlength')">
                          Description must be at least 10 characters long
                        </span>
                        <span class="native-error" *ngIf="suggestionForm.get('description')?.touched && suggestionForm.get('description')?.hasError('maxlength')">
                          Description cannot exceed 1000 characters
                        </span>
                      </label>
                    </div>

                    <!-- Anonymous Option -->
                    <div class="form-row">
                      <label class="native-checkbox">
                        <input type="checkbox" formControlName="isAnonymous">
                        <span class="checkbox-copy">
                          <strong>Submit anonymously</strong>
                        <span class="anonymous-hint">
                          (Your identity will not be shown to other members, but admins can see it)
                        </span>
                        </span>
                      </label>
                    </div>

                    <!-- Form Actions -->
                    <div class="form-actions">
                      <button type="button" mat-button (click)="resetForm()">
                        <mat-icon>clear</mat-icon>
                        Reset
                      </button>
                      <button type="submit" mat-raised-button color="primary" 
                              [disabled]="suggestionForm.invalid || submitting">
                        <mat-icon *ngIf="!submitting">send</mat-icon>
                        <mat-spinner *ngIf="submitting" diameter="20"></mat-spinner>
                        {{ submitting ? 'Submitting...' : 'Submit Feedback' }}
                      </button>
                    </div>
                  </form>
                  </mat-card-content>
                </mat-card>
              </div>
            </div>
          </mat-tab>

          <!-- My Feedback History -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>history</mat-icon>
              My Feedback
            </ng-template>
            <div class="tab-content">
              <div class="section-header">
                <h2>My Feedback History</h2>
                <p>Review your submissions, status updates, and admin responses.</p>
              </div>

              <!-- Loading State -->
              <div *ngIf="loading" class="loading-container">
                <mat-spinner diameter="50"></mat-spinner>
                <p>Loading your feedback...</p>
              </div>

              <!-- Empty State -->
              <div *ngIf="!loading && suggestions.length === 0" class="empty-state">
                <mat-icon class="empty-icon">feedback</mat-icon>
                <h3>No Feedback Submitted</h3>
                <p>You haven't submitted any suggestions or complaints yet.</p>
                <button mat-raised-button color="primary" (click)="selectedTab = 0">
                  <mat-icon>add</mat-icon>
                  Submit Your First Feedback
                </button>
              </div>

              <!-- Suggestions List -->
              <div *ngIf="!loading && suggestions.length > 0" class="suggestions-list">
                <mat-card *ngFor="let suggestion of suggestions" class="suggestion-card"
                         [class]="getSuggestionClass(suggestion)">
                  <mat-card-content>
                    <div class="suggestion-header">
                      <div class="suggestion-info">
                        <div class="suggestion-title">
                          <mat-icon>{{ getSuggestionIcon(suggestion) }}</mat-icon>
                          <h3>{{ suggestion.title }}</h3>
                        </div>
                        <div class="suggestion-meta">
                          <span class="type-badge" [class]="suggestion.type">
                            {{ suggestion.type | titlecase }}
                          </span>
                          <span class="category-badge">
                            {{ getCategoryLabel(suggestion.category) }}
                          </span>
                          <span class="priority-badge" [class]="suggestion.priority">
                            {{ suggestion.priority | titlecase }}
                          </span>
                          <span class="status-badge" [class]="suggestion.status">
                            {{ getStatusLabel(suggestion.status) }}
                          </span>
                        </div>
                      </div>
                      <div class="suggestion-date">
                        <mat-icon>schedule</mat-icon>
                        <span>{{ formatDate(suggestion.createdAt) }}</span>
                      </div>
                    </div>

                    <p class="suggestion-description">{{ suggestion.description }}</p>
                    
                    <!-- Admin Response -->
                    <div *ngIf="suggestion.adminResponse" class="admin-response">
                      <div class="response-header">
                        <mat-icon>admin_panel_settings</mat-icon>
                        <h4>Admin Response</h4>
                        <span class="response-date">{{ formatDate(suggestion.adminResponse.responseDate) }}</span>
                      </div>
                      <div class="response-content">
                        <p>{{ suggestion.adminResponse.response }}</p>
                        <div *ngIf="suggestion.adminResponse.actionTaken" class="action-taken">
                          <strong>Action Taken:</strong> {{ suggestion.adminResponse.actionTaken }}
                        </div>
                      </div>
                    </div>
                  </mat-card-content>

                  <mat-card-actions>
                    <button mat-button color="primary" (click)="viewSuggestionDetails(suggestion)">
                      <mat-icon>visibility</mat-icon>
                      View Details
                    </button>
                    <button *ngIf="suggestion.status === 'open'" 
                            mat-button color="warn" 
                            (click)="deleteSuggestion(suggestion)">
                      <mat-icon>delete</mat-icon>
                      Delete
                    </button>
                  </mat-card-actions>
                </mat-card>
              </div>

              <!-- Pagination -->
              <mat-paginator
                *ngIf="!loading && suggestions.length > 0"
                [length]="totalCount"
                [pageSize]="pageSize"
                [pageSizeOptions]="[5, 10, 20]"
                [pageIndex]="currentPage - 1"
                (page)="onPageChange($event)"
                showFirstLastButtons>
              </mat-paginator>
            </div>
          </mat-tab>
        </mat-tab-group>
      </mat-card>
    </div>
  `,
  styleUrl: './suggestions.component.scss'
})
export class SuggestionsComponent implements OnInit, OnDestroy {
  private apiUrl = environment.apiUrl;
  private subscription = new Subscription();

  suggestionForm: FormGroup;
  selectedTab = 0;
  submitting = false;
  loading = false;

  suggestions: Suggestion[] = [];
  totalCount = 0;
  currentPage = 1;
  pageSize = 10;

  categories = [
    { value: 'facility', label: 'Facility & Courts', icon: 'business' },
    { value: 'service', label: 'Customer Service', icon: 'room_service' },
    { value: 'booking', label: 'Booking System', icon: 'event' },
    { value: 'payments', label: 'Payments & Fees', icon: 'payment' },
    { value: 'staff', label: 'Staff & Personnel', icon: 'people' },
    { value: 'maintenance', label: 'Maintenance & Repairs', icon: 'build' },
    { value: 'general', label: 'General Feedback', icon: 'comment' }
  ];

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {
    this.suggestionForm = this.fb.group({
      type: ['', Validators.required],
      category: ['', Validators.required],
      priority: ['medium'],
      title: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(200)]],
      description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
      isAnonymous: [false]
    });
  }

  ngOnInit(): void {
    this.loadSuggestions();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  submitSuggestion(): void {
    if (this.suggestionForm.invalid) {
      return;
    }

    this.submitting = true;
    const formData = this.suggestionForm.value;

    this.subscription.add(
      this.http.post<any>(`${this.apiUrl}/suggestions`, formData).subscribe({
        next: (response) => {
          if (response.success) {
            this.showMessage(`${formData.type === 'complaint' ? 'Complaint' : 'Suggestion'} submitted successfully!`, 'success');
            this.resetForm();
            this.selectedTab = 1; // Switch to history tab
            this.loadSuggestions(); // Refresh the list
          } else {
            this.showMessage('Failed to submit feedback', 'error');
          }
          this.submitting = false;
        },
        error: (error) => {
          console.error('Error submitting suggestion:', error);
          this.showMessage('Failed to submit feedback', 'error');
          this.submitting = false;
        }
      })
    );
  }

  loadSuggestions(): void {
    this.loading = true;

    const params = {
      page: this.currentPage.toString(),
      limit: this.pageSize.toString()
    };

    this.subscription.add(
      this.http.get<any>(`${this.apiUrl}/suggestions`, { params }).subscribe({
        next: (response) => {
          if (response.success) {
            this.suggestions = response.data;
            this.totalCount = response.pagination?.totalCount || 0;
          } else {
            this.showMessage('Failed to load suggestions', 'error');
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading suggestions:', error);
          this.showMessage('Failed to load suggestions', 'error');
          this.loading = false;
        }
      })
    );
  }

  resetForm(): void {
    this.suggestionForm.reset();
    this.suggestionForm.patchValue({
      type: '',
      category: '',
      priority: 'medium',
      title: '',
      description: '',
      isAnonymous: false
    });
    
    // Clear all validation states
    Object.keys(this.suggestionForm.controls).forEach(key => {
      this.suggestionForm.get(key)?.setErrors(null);
    });
    
    this.suggestionForm.markAsUntouched();
    this.suggestionForm.markAsPristine();
  }

  deleteSuggestion(suggestion: Suggestion): void {
    if (confirm(`Are you sure you want to delete this ${suggestion.type}?`)) {
      this.subscription.add(
        this.http.delete<any>(`${this.apiUrl}/suggestions/${suggestion._id}`).subscribe({
          next: (response) => {
            if (response.success) {
              this.showMessage(`${suggestion.type} deleted successfully`, 'success');
              this.loadSuggestions();
            } else {
              this.showMessage('Failed to delete suggestion', 'error');
            }
          },
          error: (error) => {
            console.error('Error deleting suggestion:', error);
            this.showMessage('Failed to delete suggestion', 'error');
          }
        })
      );
    }
  }

  viewSuggestionDetails(suggestion: Suggestion): void {
    // Could implement a detailed view modal or navigate to details page
    console.log('Viewing suggestion details:', suggestion);
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadSuggestions();
  }

  getSuggestionClass(suggestion: Suggestion): string {
    const classes = ['suggestion-item'];
    classes.push(`type-${suggestion.type}`);
    classes.push(`status-${suggestion.status}`);
    classes.push(`priority-${suggestion.priority}`);
    return classes.join(' ');
  }

  getSuggestionIcon(suggestion: Suggestion): string {
    if (suggestion.type === 'complaint') {
      return 'report_problem';
    }
    return 'lightbulb';
  }

  getCategoryLabel(category: string): string {
    const categoryMap: Record<string, string> = {
      facility: 'Facility',
      service: 'Service',
      booking: 'Booking',
      payments: 'Payments',
      staff: 'Staff',
      maintenance: 'Maintenance',
      general: 'General'
    };
    return categoryMap[category] || category;
  }

  getStatusLabel(status: string): string {
    const statusMap: Record<string, string> = {
      open: 'Open',
      in_review: 'Under Review',
      in_progress: 'In Progress',
      resolved: 'Resolved',
      closed: 'Closed'
    };
    return statusMap[status] || status;
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private showMessage(message: string, type: 'success' | 'error' | 'warning'): void {
    const config = {
      duration: 4000,
      panelClass: [`snackbar-${type}`],
      horizontalPosition: 'center' as const,
      verticalPosition: 'bottom' as const
    };

    this.snackBar.open(message, 'Close', config);
  }
}
