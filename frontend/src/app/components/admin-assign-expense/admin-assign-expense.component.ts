import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ConfirmationDialogComponent, ConfirmationDialogData } from '../../shared/confirmation-dialog/confirmation-dialog.component';
import { MemberService, Member } from '../../services/member.service';
import { environment } from '../../../environments/environment';

interface ExpenseTemplate {
  title: string;
  amount: number;
  lastUsed: string;
  useCount: number;
  memberIds?: string[];
  reason?: string;
}

@Component({
  selector: 'app-admin-assign-expense',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatDialogModule
  ],
  templateUrl: './admin-assign-expense.component.html',
  styleUrl: './admin-assign-expense.component.scss'
})
export class AdminAssignExpenseComponent implements OnInit {
  private apiUrl = environment.apiUrl;

  // Form
  form = {
    title: '',
    description: '',
    amount: null as number | null
  };

  // Recent expense templates
  templates: ExpenseTemplate[] = [];
  templatesLoading = false;

  // Members
  allMembers: Member[] = [];
  filteredMembers: Member[] = [];
  selectedMemberIds = new Set<string>();
  memberSearchTerm = '';
  membersLoading = false;

  // Rename
  renamingTitle: string | null = null;
  renameValue = '';

  // Delete
  deletingTitle: string | null = null;

  // Submit
  submitting = false;

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private memberService: MemberService,
    private router: Router,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadMembers();
    this.loadTemplates();
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  loadTemplates(): void {
    this.templatesLoading = true;
    this.http.get<any>(
      `${this.apiUrl}/payments/expense-templates`,
      { headers: this.getAuthHeaders() }
    ).subscribe({
      next: (response) => {
        this.templates = response.data || [];
        this.templatesLoading = false;
      },
      error: () => {
        this.templatesLoading = false;
      }
    });
  }

  applyTemplate(template: ExpenseTemplate): void {
    this.form.title = template.title;
    this.form.amount = template.amount;
    this.form.description = template.reason || '';
    if (template.memberIds?.length) {
      const validIds = new Set(this.allMembers.map(m => m._id));
      this.selectedMemberIds.clear();
      template.memberIds.forEach(id => {
        if (validIds.has(id)) this.selectedMemberIds.add(id);
      });
    }
  }

  loadMembers(): void {
    this.membersLoading = true;
    this.memberService.getMembers({ limit: 500 }).subscribe({
      next: (response) => {
        this.allMembers = (response.data || []).sort((a, b) =>
          (a.fullName || a.username).localeCompare(b.fullName || b.username)
        );
        this.filteredMembers = [...this.allMembers];
        this.membersLoading = false;
      },
      error: () => {
        this.snackBar.open('Failed to load members', 'Close', { duration: 3000 });
        this.membersLoading = false;
      }
    });
  }

  filterMembers(): void {
    const term = this.memberSearchTerm.toLowerCase();
    this.filteredMembers = this.allMembers.filter(m =>
      (m.fullName || '').toLowerCase().includes(term) ||
      m.username.toLowerCase().includes(term)
    );
  }

  toggleMember(memberId: string): void {
    if (this.selectedMemberIds.has(memberId)) {
      this.selectedMemberIds.delete(memberId);
    } else {
      this.selectedMemberIds.add(memberId);
    }
  }

  isMemberSelected(memberId: string): boolean {
    return this.selectedMemberIds.has(memberId);
  }

  selectAll(): void {
    this.filteredMembers.forEach(m => this.selectedMemberIds.add(m._id));
  }

  clearSelection(): void {
    this.selectedMemberIds.clear();
  }

  submit(): void {
    if (!this.form.title?.trim()) {
      this.snackBar.open('Expense title is required', 'Close', { duration: 3000 });
      return;
    }
    if (!this.form.amount || this.form.amount <= 0) {
      this.snackBar.open('Amount must be greater than 0', 'Close', { duration: 3000 });
      return;
    }
    if (this.selectedMemberIds.size === 0) {
      this.snackBar.open('Please select at least one member', 'Close', { duration: 3000 });
      return;
    }

    this.submitting = true;

    const payload = {
      title: this.form.title.trim(),
      description: this.form.description?.trim() || '',
      amount: this.form.amount,
      memberIds: Array.from(this.selectedMemberIds)
    };

    this.http.post<any>(
      `${this.apiUrl}/payments/assign-expense`,
      payload,
      { headers: this.getAuthHeaders() }
    ).subscribe({
      next: (response) => {
        this.submitting = false;
        this.snackBar.open(response.message, 'Close', { duration: 6000 });
        this.reset();
        this.loadTemplates(); // Refresh templates after new assignment
      },
      error: (error) => {
        this.submitting = false;
        this.snackBar.open(error.error?.message || 'Failed to assign expense', 'Close', { duration: 5000 });
      }
    });
  }

  reset(): void {
    this.form = { title: '', description: '', amount: null };
    this.selectedMemberIds.clear();
    this.memberSearchTerm = '';
    this.filteredMembers = [...this.allMembers];
  }

  startRename(template: ExpenseTemplate, event: Event): void {
    event.stopPropagation();
    this.renamingTitle = template.title;
    this.renameValue = template.title;
  }

  confirmRename(template: ExpenseTemplate): void {
    const newTitle = this.renameValue.trim();
    if (!newTitle || newTitle === template.title) {
      this.cancelRename();
      return;
    }
    this.http.patch<any>(
      `${this.apiUrl}/payments/rename-assigned-expense`,
      { oldTitle: template.title, newTitle },
      { headers: this.getAuthHeaders() }
    ).subscribe({
      next: (response) => {
        this.snackBar.open(response.message || 'Expense renamed', 'Close', { duration: 3000 });
        if (this.form.title === template.title) this.form.title = newTitle;
        this.renamingTitle = null;
        this.renameValue = '';
        this.loadTemplates();
      },
      error: (error) => {
        this.snackBar.open(error.error?.message || 'Failed to rename expense', 'Close', { duration: 4000 });
      }
    });
  }

  cancelRename(): void {
    this.renamingTitle = null;
    this.renameValue = '';
  }

  deleteExpense(template: ExpenseTemplate, event: Event): void {
    event.stopPropagation();
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Delete Expense',
        message: `This will permanently delete all ${template.useCount} payment(s) for "${template.title}" from all members. This cannot be undone.`,
        confirmText: 'Delete All',
        cancelText: 'Cancel',
        type: 'danger',
        icon: 'delete_forever'
      } as ConfirmationDialogData
    });
    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.deletingTitle = template.title;
      this.http.delete<any>(
        `${this.apiUrl}/payments/delete-assigned-expense`,
        { headers: this.getAuthHeaders(), body: { title: template.title } }
      ).subscribe({
        next: (response) => {
          this.deletingTitle = null;
          this.snackBar.open(response.message || 'Expense deleted', 'Close', { duration: 4000 });
          if (this.form.title === template.title) this.form.title = '';
          this.loadTemplates();
        },
        error: (error) => {
          this.deletingTitle = null;
          this.snackBar.open(error.error?.message || 'Failed to delete expense', 'Close', { duration: 5000 });
        }
      });
    });
  }

  goBack(): void {
    this.router.navigate(['/admin/payments']);
  }
}
