import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../environments/environment';
import { FormsModule } from '@angular/forms';
import { ConfirmDeleteDialogComponent } from '../confirm-delete-dialog/confirm-delete-dialog.component';
import { ContributionFormDialogComponent } from '../contribution-form-dialog/contribution-form-dialog.component';

interface Contribution {
  _id: string;
  contributorName: string;
  amount: number;
  paymentMethod: 'cash' | 'gcash' | 'bank_transfer';
  status: 'pledged' | 'received' | 'cancelled';
  notes?: string;
  receivedBy?: { firstName: string; lastName: string };
  receivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface ContributionStats {
  pledged: { count: number; amount: number };
  received: { count: number; amount: number };
  cancelled: { count: number; amount: number };
  overall: { count: number; amount: number };
}

@Component({
  selector: 'app-admin-resurfacing-contributions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule
  ],
  templateUrl: './admin-resurfacing-contributions.component.html',
  styleUrls: ['./admin-resurfacing-contributions.component.scss']
})
export class AdminResurfacingContributionsComponent implements OnInit {
  contributions: Contribution[] = [];
  stats: ContributionStats | null = null;
  isLoading = false;
  errorMessage = '';
  selectedStatus: string = 'all';

  displayedColumns: string[] = ['contributorName', 'amount', 'paymentMethod', 'status', 'date', 'actions'];

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadContributions();
    this.loadStats();
  }

  loadContributions(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const url = this.selectedStatus === 'all'
      ? `${environment.apiUrl}/resurfacing/contributions`
      : `${environment.apiUrl}/resurfacing/contributions?status=${this.selectedStatus}`;

    this.http.get<any>(url).subscribe({
      next: (response) => {
        this.contributions = response.data.contributions;
        this.isLoading = false;
        console.log('✅ Contributions loaded:', this.contributions.length);
      },
      error: (error) => {
        console.error('❌ Error loading contributions:', error);
        this.errorMessage = 'Failed to load contributions';
        this.isLoading = false;
      }
    });
  }

  loadStats(): void {
    this.http.get<any>(`${environment.apiUrl}/resurfacing/stats`).subscribe({
      next: (response) => {
        this.stats = response.data;
        console.log('✅ Stats loaded:', this.stats);
      },
      error: (error) => {
        console.error('❌ Error loading stats:', error);
      }
    });
  }

  onStatusFilterChange(): void {
    this.loadContributions();
  }

  updateStatus(contribution: Contribution, newStatus: 'pledged' | 'received' | 'cancelled'): void {
    const url = `${environment.apiUrl}/resurfacing/contributions/${contribution._id}`;
    const body = { status: newStatus };

    this.http.patch(url, body).subscribe({
      next: (response: any) => {
        console.log('✅ Status updated:', response);
        // Update the contribution in the list
        const index = this.contributions.findIndex(c => c._id === contribution._id);
        if (index !== -1) {
          this.contributions[index] = response.data;
        }
        this.loadStats(); // Reload stats
      },
      error: (error) => {
        console.error('❌ Error updating status:', error);
        alert('Failed to update status. Please try again.');
      }
    });
  }

  editContribution(contribution: Contribution): void {
    const dialogRef = this.dialog.open(ContributionFormDialogComponent, {
      width: '500px',
      maxWidth: '95vw',
      panelClass: 'contribution-dialog-container',
      disableClose: false,
      data: {
        isEdit: true,
        contribution: {
          id: contribution._id,
          contributorName: contribution.contributorName,
          amount: contribution.amount,
          paymentMethod: contribution.paymentMethod,
          notes: contribution.notes
        }
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.success) {
        this.snackBar.open('Contribution updated successfully! Refreshing...', 'Close', { duration: 2000 });
        // Reload the page after a short delay to show the snackbar
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    });
  }

  deleteContribution(contribution: Contribution): void {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      maxWidth: '95vw',
      data: {
        title: 'Delete Contribution?',
        message: `Are you sure you want to delete the contribution from ${contribution.contributorName} for ${this.formatCurrency(contribution.amount)}? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        const url = `${environment.apiUrl}/resurfacing/contributions/${contribution._id}`;

        this.http.delete(url).subscribe({
          next: () => {
            this.snackBar.open('Contribution deleted successfully! Refreshing...', 'Close', { duration: 2000 });
            // Reload the page after a short delay to show the snackbar
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          },
          error: (error) => {
            console.error('❌ Error deleting contribution:', error);
            this.snackBar.open('Failed to delete contribution. Please try again.', 'Close', { duration: 5000 });
          }
        });
      }
    });
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'pledged':
        return 'primary';
      case 'received':
        return 'accent';
      case 'cancelled':
        return 'warn';
      default:
        return '';
    }
  }

  getPaymentMethodIcon(method: string): string {
    switch (method) {
      case 'cash':
        return 'money';
      case 'gcash':
        return 'smartphone';
      case 'bank_transfer':
        return 'account_balance';
      default:
        return 'payment';
    }
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  formatCurrency(amount: number): string {
    return `₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}
