import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
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
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { MemberService } from '../../services/member.service';
import { ConfirmationDialogComponent, ConfirmationDialogData } from '../../shared/confirmation-dialog/confirmation-dialog.component';
import { environment } from '../../../environments/environment';

interface Member {
  _id: string;
  username: string;
  fullName: string;
  email: string;
  gender?: 'male' | 'female' | 'other';
  phone?: string;
  role: 'member' | 'admin' | 'superadmin';
  coinBalance: number;
  registrationDate: Date;
  lastLogin?: Date;
  isApproved: boolean;
  isActive: boolean;
  membershipFeesPaid: boolean;
}

interface MemberResponse {
  success: boolean;
  data: Member[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

@Component({
  selector: 'app-admin-member-management',
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
    MatTooltipModule
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
              <mat-icon>admin_panel_settings</mat-icon>
              Member Management
            </h1>
            <p class="page-subtitle">Manage member registrations and approvals</p>
          </div>
        </div>
      </div>

      <!-- Page Content -->
      <div class="page-content">
        <mat-tab-group class="management-tabs">
          <!-- Pending Approvals Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>pending</mat-icon>
              Pending Approvals
              <mat-chip *ngIf="pendingMembers.length > 0" class="count-chip">
                {{pendingMembers.length}}
              </mat-chip>
            </ng-template>

            <div class="tab-content">
              <div class="loading-container" *ngIf="loadingPending">
                <mat-spinner></mat-spinner>
                <p>Loading pending members...</p>
              </div>

              <div class="empty-state" *ngIf="!loadingPending && pendingMembers.length === 0">
                <mat-icon class="empty-icon">check_circle</mat-icon>
                <h3>No Pending Approvals</h3>
                <p>All member registrations have been processed.</p>
              </div>

              <div class="members-grid" *ngIf="!loadingPending && pendingMembers.length > 0">
                <mat-card *ngFor="let member of pendingMembers" class="member-card pending-card">
                  <mat-card-header>
                    <div mat-card-avatar class="member-avatar">
                      <mat-icon>person</mat-icon>
                    </div>
                    <mat-card-title>{{member.fullName}}</mat-card-title>
                    <mat-card-subtitle>@{{member.username}}</mat-card-subtitle>
                  </mat-card-header>

                  <mat-card-content>
                    <div class="member-details">
                      <div class="detail-row">
                        <mat-icon>email</mat-icon>
                        <span>{{member.email}}</span>
                      </div>
                      <div class="detail-row" *ngIf="member.phone">
                        <mat-icon>phone</mat-icon>
                        <span>{{member.phone}}</span>
                      </div>
                      <div class="detail-row" *ngIf="member.gender">
                        <mat-icon>wc</mat-icon>
                        <span>{{member.gender | titlecase}}</span>
                      </div>
                      <div class="detail-row">
                        <mat-icon>calendar_today</mat-icon>
                        <span>Registered: {{member.registrationDate | date:'short'}}</span>
                      </div>
                    </div>

                    <div class="status-chips">
                      <mat-chip class="status-chip pending">
                        <mat-icon>pending</mat-icon>
                        Pending Approval
                      </mat-chip>
                      <mat-chip 
                        [class]="member.membershipFeesPaid ? 'status-chip paid' : 'status-chip unpaid'"
                        [matTooltip]="member.membershipFeesPaid ? 'Membership fees paid' : 'Membership fees not paid'">
                        <mat-icon>{{member.membershipFeesPaid ? 'paid' : 'payment'}}</mat-icon>
                        {{member.membershipFeesPaid ? 'Paid' : 'Unpaid'}}
                      </mat-chip>
                    </div>
                  </mat-card-content>

                  <mat-card-actions class="member-actions">
                    <button 
                      mat-raised-button 
                      color="primary" 
                      (click)="approveMember(member)"
                      [disabled]="updating === member._id">
                      <mat-spinner *ngIf="updating === member._id" diameter="16"></mat-spinner>
                      <mat-icon *ngIf="updating !== member._id">check</mat-icon>
                      Approve
                    </button>
                    
                    <button 
                      mat-stroked-button 
                      color="warn" 
                      (click)="rejectMember(member)"
                      [disabled]="updating === member._id">
                      <mat-icon>close</mat-icon>
                      Reject
                    </button>

                    <button 
                      mat-button 
                      (click)="viewMemberDetails(member)">
                      <mat-icon>visibility</mat-icon>
                      Details
                    </button>
                  </mat-card-actions>
                </mat-card>
              </div>
            </div>
          </mat-tab>

          <!-- All Members Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>people</mat-icon>
              All Members
            </ng-template>

            <div class="tab-content">
              <div class="loading-container" *ngIf="loadingAll">
                <mat-spinner></mat-spinner>
                <p>Loading all members...</p>
              </div>

              <div class="members-table" *ngIf="!loadingAll">
                <table mat-table [dataSource]="allMembers" class="members-data-table">
                  <ng-container matColumnDef="name">
                    <th mat-header-cell *matHeaderCellDef>Member</th>
                    <td mat-cell *matCellDef="let member">
                      <div class="member-info">
                        <strong>{{member.fullName}}</strong>
                        <span class="username">@{{member.username}}</span>
                      </div>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="contact">
                    <th mat-header-cell *matHeaderCellDef>Contact</th>
                    <td mat-cell *matCellDef="let member">
                      <div class="contact-info">
                        <span>{{member.email}}</span>
                        <span *ngIf="member.phone" class="phone">{{member.phone}}</span>
                      </div>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="status">
                    <th mat-header-cell *matHeaderCellDef>Status</th>
                    <td mat-cell *matCellDef="let member">
                      <div class="status-badges">
                        <mat-chip [class]="member.isActive !== false ? 'status-chip active' : 'status-chip inactive'">
                          <mat-icon>{{member.isActive !== false ? 'check_circle' : 'cancel'}}</mat-icon>
                          {{member.isActive !== false ? 'Active' : 'Inactive'}}
                        </mat-chip>
                        <mat-chip [class]="member.isApproved ? 'status-chip approved' : 'status-chip pending'">
                          <mat-icon>{{member.isApproved ? 'verified' : 'pending'}}</mat-icon>
                          {{member.isApproved ? 'Approved' : 'Pending'}}
                        </mat-chip>
                        <mat-chip [class]="member.membershipFeesPaid ? 'status-chip paid' : 'status-chip unpaid'">
                          <mat-icon>{{member.membershipFeesPaid ? 'paid' : 'payment'}}</mat-icon>
                          {{member.membershipFeesPaid ? 'Paid' : 'Unpaid'}}
                        </mat-chip>
                      </div>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="registered">
                    <th mat-header-cell *matHeaderCellDef>Registered</th>
                    <td mat-cell *matCellDef="let member">{{member.registrationDate | date:'mediumDate'}}</td>
                  </ng-container>

                  <ng-container matColumnDef="coins">
                    <th mat-header-cell *matHeaderCellDef>Coins</th>
                    <td mat-cell *matCellDef="let member">
                      <span class="coin-balance">{{member.coinBalance}}</span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef>Actions</th>
                    <td mat-cell *matCellDef="let member">
                      <div class="table-actions">
                        <button mat-icon-button (click)="viewMemberDetails(member)" matTooltip="View Details">
                          <mat-icon>visibility</mat-icon>
                        </button>
                        <button
                          mat-icon-button
                          color="primary"
                          (click)="toggleApproval(member)"
                          [matTooltip]="member.isApproved ? 'Revoke Approval' : 'Approve Member'">
                          <mat-icon>{{member.isApproved ? 'block' : 'check'}}</mat-icon>
                        </button>
                        <button
                          mat-icon-button
                          color="accent"
                          (click)="impersonateUser(member)"
                          matTooltip="Impersonate User (Login as them)"
                          [disabled]="member.role === 'admin' || member.role === 'superadmin'">
                          <mat-icon>supervisor_account</mat-icon>
                        </button>
                        <button
                          mat-icon-button
                          color="accent"
                          (click)="resetPassword(member)"
                          matTooltip="Reset Password to RT2Tennis"
                          [disabled]="updating === member._id">
                          <mat-icon>lock_reset</mat-icon>
                        </button>
                        <button
                          mat-icon-button
                          color="warn"
                          (click)="deactivateMember(member)"
                          matTooltip="Deactivate Member">
                          <mat-icon>delete</mat-icon>
                        </button>
                      </div>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
                </table>

                <mat-paginator 
                  [length]="allMembersPagination?.total || 0"
                  [pageSize]="allMembersPagination?.limit || 20"
                  [pageIndex]="(allMembersPagination?.page || 1) - 1"
                  [pageSizeOptions]="[10, 20, 50, 100]"
                  (page)="onPageChange($event)"
                  showFirstLastButtons>
                </mat-paginator>
              </div>
            </div>
          </mat-tab>
        </mat-tab-group>
      </div>
    </div>
  `,
  styleUrl: './admin-member-management.component.scss'
})
export class AdminMemberManagementComponent implements OnInit {
  pendingMembers: Member[] = [];
  allMembers: Member[] = [];
  allMembersPagination: any = null;

  loadingPending = false;
  loadingAll = false;
  updating = '';

  displayedColumns: string[] = ['name', 'contact', 'status', 'registered', 'coins', 'actions'];

  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private memberService: MemberService,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadPendingMembers();
    this.loadAllMembers();
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  loadPendingMembers(): void {
    this.loadingPending = true;
    const headers = { 'Authorization': `Bearer ${this.authService.token}` };

    this.http.get<MemberResponse>(`${this.apiUrl}/members/admin/pending`, { headers })
      .subscribe({
        next: (response) => {
          this.pendingMembers = response.data;
          this.loadingPending = false;
        },
        error: (error) => {
          console.error('Error loading pending members:', error);
          this.loadingPending = false;
          this.snackBar.open('Failed to load pending members', 'Close', { duration: 3000 });
        }
      });
  }

  loadAllMembers(page: number = 1): void {
    this.loadingAll = true;
    const headers = { 'Authorization': `Bearer ${this.authService.token}` };

    this.http.get<MemberResponse>(`${this.apiUrl}/members?includeAll=true&page=${page}`, { headers })
      .subscribe({
        next: (response) => {
          this.allMembers = response.data;
          this.allMembersPagination = response.pagination;
          this.loadingAll = false;
        },
        error: (error) => {
          console.error('Error loading all members:', error);
          this.loadingAll = false;
          this.snackBar.open('Failed to load members', 'Close', { duration: 3000 });
        }
      });
  }

  approveMember(member: Member): void {
    this.updating = member._id;
    const headers = { 'Authorization': `Bearer ${this.authService.token}` };

    this.http.put<any>(`${this.apiUrl}/members/${member._id}/approval`, 
      { isApproved: true }, { headers })
      .subscribe({
        next: (response) => {
          this.updating = '';
          this.snackBar.open(`${member.fullName} has been approved!`, 'Close', { 
            duration: 3000,
            panelClass: ['success-snackbar']
          });
          this.loadPendingMembers();
          this.loadAllMembers();
        },
        error: (error) => {
          this.updating = '';
          console.error('Error approving member:', error);
          this.snackBar.open('Failed to approve member', 'Close', { duration: 3000 });
        }
      });
  }

  rejectMember(member: Member): void {
    this.updating = member._id;
    const headers = { 'Authorization': `Bearer ${this.authService.token}` };

    this.http.delete<any>(`${this.apiUrl}/members/${member._id}`, { headers })
      .subscribe({
        next: (response) => {
          this.updating = '';
          this.snackBar.open(`${member.fullName} has been rejected`, 'Close', { 
            duration: 3000,
            panelClass: ['warning-snackbar']
          });
          this.loadPendingMembers();
          this.loadAllMembers();
        },
        error: (error) => {
          this.updating = '';
          console.error('Error rejecting member:', error);
          this.snackBar.open('Failed to reject member', 'Close', { duration: 3000 });
        }
      });
  }

  toggleApproval(member: Member): void {
    const headers = { 'Authorization': `Bearer ${this.authService.token}` };
    const newStatus = !member.isApproved;

    this.http.put<any>(`${this.apiUrl}/members/${member._id}/approval`, 
      { isApproved: newStatus }, { headers })
      .subscribe({
        next: (response) => {
          const action = newStatus ? 'approved' : 'revoked approval for';
          this.snackBar.open(`${member.fullName} has been ${action}`, 'Close', { duration: 3000 });
          this.loadAllMembers();
        },
        error: (error) => {
          console.error('Error updating member approval:', error);
          this.snackBar.open('Failed to update member status', 'Close', { duration: 3000 });
        }
      });
  }

  deactivateMember(member: Member): void {
    const dialogData: ConfirmationDialogData = {
      title: 'Deactivate Member',
      message: `Are you sure you want to deactivate ${member.fullName}? This action cannot be undone and will remove their access to the system.`,
      confirmText: 'Deactivate',
      cancelText: 'Cancel',
      type: 'danger',
      icon: 'person_remove'
    };

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '450px',
      data: dialogData,
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        const headers = { 'Authorization': `Bearer ${this.authService.token}` };

        this.http.delete<any>(`${this.apiUrl}/members/${member._id}`, { headers })
          .subscribe({
            next: (response) => {
              this.snackBar.open(`${member.fullName} has been deactivated`, 'Close', { 
                duration: 3000,
                panelClass: ['warning-snackbar']
              });
              this.loadAllMembers();
            },
            error: (error) => {
              console.error('Error deactivating member:', error);
              this.snackBar.open('Failed to deactivate member', 'Close', { duration: 3000 });
            }
          });
      }
    });
  }

  viewMemberDetails(member: Member): void {
    this.router.navigate(['/members', member._id]);
  }

  resetPassword(member: Member): void {
    const dialogData: ConfirmationDialogData = {
      title: 'Reset Password',
      message: `Are you sure you want to reset the password for ${member.fullName} to "RT2Tennis"? This action cannot be undone.`,
      confirmText: 'Reset Password',
      cancelText: 'Cancel',
      type: 'warning',
      icon: 'lock_reset'
    };

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '450px',
      data: dialogData,
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        this.updating = member._id;
        
        this.memberService.resetMemberPassword(member._id)
          .subscribe({
            next: (response) => {
              this.updating = '';
              this.snackBar.open(response.message, 'Close', { 
                duration: 5000,
                panelClass: ['success-snackbar']
              });
            },
            error: (error) => {
              this.updating = '';
              console.error('Error resetting password:', error);
              this.snackBar.open('Failed to reset password', 'Close', { duration: 3000 });
            }
          });
      }
    });
  }

  impersonateUser(member: Member): void {
    const dialogData: ConfirmationDialogData = {
      title: 'Impersonate User',
      message: `You are about to view the application as ${member.fullName} (@${member.username}). You will see exactly what they see. Continue?`,
      confirmText: 'Start Impersonation',
      cancelText: 'Cancel',
      type: 'warning',
      icon: 'supervisor_account'
    };

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '450px',
      data: dialogData,
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        this.authService.startImpersonation(member._id).subscribe({
          next: () => {
            const snackBarRef = this.snackBar.open(
              `Now viewing as ${member.fullName}`,
              'Exit Impersonation',
              {
                duration: 0,
                horizontalPosition: 'center',
                verticalPosition: 'bottom',
                panelClass: ['impersonation-snackbar']
              }
            );

            snackBarRef.onAction().subscribe(() => {
              this.authService.stopImpersonation().subscribe();
            });

            this.router.navigate(['/dashboard']);
          },
          error: (error) => {
            console.error('Impersonation error:', error);
            this.snackBar.open(
              error.error?.error || 'Failed to start impersonation',
              'Close',
              { duration: 3000 }
            );
          }
        });
      }
    });
  }

  onPageChange(event: PageEvent): void {
    const page = event.pageIndex + 1;
    this.loadAllMembers(page);
  }
}