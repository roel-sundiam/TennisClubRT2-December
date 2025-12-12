import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { ContributionFormDialogComponent } from '../contribution-form-dialog/contribution-form-dialog.component';
import { ConfirmDeleteDialogComponent } from '../confirm-delete-dialog/confirm-delete-dialog.component';

interface ContributionStats {
  pledged: { count: number; amount: number };
  received: { count: number; amount: number };
  cancelled: { count: number; amount: number };
  overall: { count: number; amount: number };
}

interface Contributor {
  _id: string;
  contributorName: string;
  amount: number;
  status: 'pledged' | 'received' | 'cancelled';
  paymentMethod?: 'cash' | 'gcash' | 'bank_transfer';
  notes?: string;
  createdAt: string;
}

@Component({
  selector: 'app-resurfacing-contributions',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    MatButtonModule,
    MatDialogModule,
    MatSnackBarModule,
    MatMenuModule
  ],
  templateUrl: './resurfacing-contributions.component.html',
  styleUrls: ['./resurfacing-contributions.component.scss']
})
export class ResurfacingContributionsComponent implements OnInit {
  stats: ContributionStats | null = null;
  contributors: Contributor[] = [];
  isLoading = true;
  goalAmount = 400000; // ₱400,000 goal

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadStats();
    this.loadContributors();
  }

  loadStats(): void {
    this.isLoading = true;

    this.http.get<any>(`${environment.apiUrl}/resurfacing/public-stats`).subscribe({
      next: (response) => {
        this.stats = response.data;
        this.isLoading = false;
        console.log('✅ Public stats loaded:', this.stats);
      },
      error: (error) => {
        console.error('❌ Error loading stats:', error);
        this.isLoading = false;
      }
    });
  }

  loadContributors(): void {
    this.http.get<any>(`${environment.apiUrl}/resurfacing/public-contributors`).subscribe({
      next: (response) => {
        this.contributors = response.data;
        console.log('✅ Contributors loaded:', this.contributors);
        console.log('👤 Current user is admin?', this.authService.isAdmin());
        console.log('👤 Current user role:', this.authService.currentUser?.role);
      },
      error: (error) => {
        console.error('❌ Error loading contributors:', error);
      }
    });
  }

  openContributionForm(): void {
    const dialogRef = this.dialog.open(ContributionFormDialogComponent, {
      width: '500px',
      maxWidth: '95vw',
      panelClass: 'contribution-dialog-container',
      disableClose: false
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.success) {
        console.log('✅ Contribution submitted:', result.data);

        // If reload flag is set, reload the entire page to update banner and all components
        if (result?.reload) {
          this.snackBar.open('Contribution submitted successfully! Refreshing...', 'Close', { duration: 2000 });
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          // Fallback: just reload local data
          this.loadStats();
          this.loadContributors();
        }
      }
    });
  }

  getStatusBadgeClass(status: string): string {
    return status === 'received' ? 'status-confirmed' : 'status-pending';
  }

  getStatusLabel(status: string): string {
    return status === 'received' ? 'Confirmed' : 'Pending';
  }

  editContribution(contributor: Contributor): void {
    const dialogRef = this.dialog.open(ContributionFormDialogComponent, {
      width: '500px',
      maxWidth: '95vw',
      panelClass: 'contribution-dialog-container',
      disableClose: false,
      data: {
        isEdit: true,
        contribution: {
          id: contributor._id,
          contributorName: contributor.contributorName,
          amount: contributor.amount,
          paymentMethod: contributor.paymentMethod,
          notes: contributor.notes
        }
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.success) {
        this.snackBar.open('Contribution updated successfully!', 'Close', { duration: 3000 });
        this.loadStats();
        this.loadContributors();
      }
    });
  }

  deleteContribution(contributor: Contributor): void {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      maxWidth: '95vw',
      data: {
        title: 'Delete Contribution?',
        message: `Are you sure you want to delete the contribution from ${contributor.contributorName} for ${this.formatCurrency(contributor.amount)}? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.http.delete(`${environment.apiUrl}/resurfacing/contributions/${contributor._id}`).subscribe({
          next: () => {
            this.snackBar.open('Contribution deleted successfully!', 'Close', { duration: 3000 });
            this.loadStats();
            this.loadContributors();
          },
          error: (error) => {
            console.error('Error deleting contribution:', error);
            this.snackBar.open('Failed to delete contribution. Please try again.', 'Close', { duration: 5000 });
          }
        });
      }
    });
  }

  getProgressPercentage(): number {
    if (!this.stats) return 0;
    return Math.min((this.stats.overall.amount / this.goalAmount) * 100, 100);
  }

  getRemainingAmount(): number {
    if (!this.stats) return this.goalAmount;
    return Math.max(this.goalAmount - this.stats.overall.amount, 0);
  }

  formatCurrency(amount: number): string {
    return `₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}
