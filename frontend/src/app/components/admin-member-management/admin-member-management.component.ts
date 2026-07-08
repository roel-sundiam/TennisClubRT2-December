import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormsModule } from '@angular/forms';
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
import { MatSelectModule } from '@angular/material/select';
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
  role: 'member' | 'admin' | 'superadmin' | 'treasurer';
  coinBalance: number;
  registrationDate: Date;
  lastLogin?: Date;
  isApproved: boolean;
  isActive: boolean;
  isHomeowner?: boolean;
  isCoach?: boolean;
  membershipFeesPaid: boolean;
  membershipYearsPaid?: number[];
  membership2026Amount?: number;
  deletedAt?: Date;
  deletedBy?: {
    _id: string;
    fullName: string;
  };
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

interface GroupedMemberData {
  label: string;
  value: string;
  members: Member[];
}

@Component({
  selector: 'app-admin-member-management',
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
    MatSelectModule
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
          <!-- Active Members Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>people</mat-icon>
              Active Members
            </ng-template>

            <div class="tab-content">
              <div class="loading-container" *ngIf="loadingAll">
                <mat-spinner></mat-spinner>
                <p>Loading all members...</p>
              </div>

              <mat-tab-group class="sub-tabs" *ngIf="!loadingAll">
                <!-- Homeowners Sub-tab -->
                <mat-tab>
                  <ng-template mat-tab-label>
                    <mat-icon>home</mat-icon>
                    Homeowners
                    <mat-chip class="count-chip homeowner-count">
                      {{homeownerMembers.length}}
                    </mat-chip>
                  </ng-template>

                  <div class="members-table">
                    <table mat-table [dataSource]="homeownerMembers" class="members-data-table">
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

                  <ng-container matColumnDef="role">
                    <th mat-header-cell *matHeaderCellDef>Role</th>
                    <td mat-cell *matCellDef="let member">
                      <mat-select
                        [value]="member.role"
                        (selectionChange)="onRoleChange(member, $event.value)"
                        [disabled]="!authService.isSuperAdmin() || member._id === authService.currentUser?._id"
                        class="role-selector"
                        [ngClass]="getRoleClass(member.role)">
                        <mat-option value="member">
                          <mat-icon class="role-icon member-icon">person</mat-icon>
                          Member
                        </mat-option>
                        <mat-option value="treasurer">
                          <mat-icon class="role-icon treasurer-icon">account_balance</mat-icon>
                          Treasurer
                        </mat-option>
                        <mat-option value="admin">
                          <mat-icon class="role-icon admin-icon">admin_panel_settings</mat-icon>
                          Admin
                        </mat-option>
                        <mat-option value="superadmin">
                          <mat-icon class="role-icon superadmin-icon">shield</mat-icon>
                          Superadmin
                        </mat-option>
                      </mat-select>
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
                        <mat-chip
                          [class]="hasPaidFor2026(member) ? 'status-chip paid' : 'status-chip unpaid'"
                          [matTooltip]="hasPaidFor2026(member) ? '2026 membership fees paid' : '2026 membership fees not paid'">
                          <mat-icon>{{hasPaidFor2026(member) ? 'paid' : 'payment'}}</mat-icon>
                          {{hasPaidFor2026(member) ? (member.membership2026Amount ? 'Paid - ₱' + member.membership2026Amount : 'Paid') : 'Unpaid'}}
                        </mat-chip>
                        <mat-chip *ngIf="member.isCoach" class="status-chip coach" matTooltip="Coach">
                          <mat-icon>sports_tennis</mat-icon>
                          Coach
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
                          color="primary"
                          (click)="toggleCoach(member)"
                          [matTooltip]="member.isCoach ? 'Revoke Coach Status' : 'Grant Coach Status'">
                          <mat-icon>{{member.isCoach ? 'cancel' : 'sports_tennis'}}</mat-icon>
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
                          [color]="member.isActive !== false ? 'warn' : 'primary'"
                          (click)="member.isActive !== false ? deactivateMember(member) : reactivateMember(member)"
                          [matTooltip]="member.isActive !== false ? 'Deactivate Member' : 'Reactivate Member'">
                          <mat-icon>{{member.isActive !== false ? 'person_remove' : 'person_add'}}</mat-icon>
                        </button>
                      </div>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
                </table>

                    <mat-paginator
                      [length]="homeownerMembersPagination?.total || homeownerMembers.length"
                      [pageSize]="100"
                      [pageSizeOptions]="[10, 20, 50, 100]"
                      showFirstLastButtons>
                    </mat-paginator>
                  </div>
                </mat-tab>

                <!-- Non-Homeowners Sub-tab -->
                <mat-tab>
                  <ng-template mat-tab-label>
                    <mat-icon>people</mat-icon>
                    Non-Homeowners
                    <mat-chip class="count-chip">
                      {{nonHomeownerMembers.length}}
                    </mat-chip>
                  </ng-template>

                  <div class="members-table">
                    <table mat-table [dataSource]="nonHomeownerMembers" class="members-data-table">
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

                      <ng-container matColumnDef="role">
                        <th mat-header-cell *matHeaderCellDef>Role</th>
                        <td mat-cell *matCellDef="let member">
                          <mat-select
                            [value]="member.role"
                            (selectionChange)="onRoleChange(member, $event.value)"
                            [disabled]="!authService.isSuperAdmin() || member._id === authService.currentUser?._id"
                            class="role-selector"
                            [ngClass]="getRoleClass(member.role)">
                            <mat-option value="member">
                              <mat-icon class="role-icon member-icon">person</mat-icon>
                              Member
                            </mat-option>
                            <mat-option value="treasurer">
                              <mat-icon class="role-icon treasurer-icon">account_balance</mat-icon>
                              Treasurer
                            </mat-option>
                            <mat-option value="admin">
                              <mat-icon class="role-icon admin-icon">admin_panel_settings</mat-icon>
                              Admin
                            </mat-option>
                            <mat-option value="superadmin">
                              <mat-icon class="role-icon superadmin-icon">shield</mat-icon>
                              Superadmin
                            </mat-option>
                          </mat-select>
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
                            <mat-chip
                              [class]="hasPaidFor2026(member) ? 'status-chip paid' : 'status-chip unpaid'"
                              [matTooltip]="hasPaidFor2026(member) ? '2026 membership fees paid' : '2026 membership fees not paid'">
                              <mat-icon>{{hasPaidFor2026(member) ? 'paid' : 'payment'}}</mat-icon>
                              {{hasPaidFor2026(member) ? (member.membership2026Amount ? 'Paid - ₱' + member.membership2026Amount : 'Paid') : 'Unpaid'}}
                            </mat-chip>
                            <mat-chip *ngIf="member.isCoach" class="status-chip coach" matTooltip="Coach">
                              <mat-icon>sports_tennis</mat-icon>
                              Coach
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
                              color="primary"
                              (click)="toggleCoach(member)"
                              [matTooltip]="member.isCoach ? 'Revoke Coach Status' : 'Grant Coach Status'">
                              <mat-icon>{{member.isCoach ? 'cancel' : 'sports_tennis'}}</mat-icon>
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
                              [color]="member.isActive !== false ? 'warn' : 'primary'"
                              (click)="member.isActive !== false ? deactivateMember(member) : reactivateMember(member)"
                              [matTooltip]="member.isActive !== false ? 'Deactivate Member' : 'Reactivate Member'">
                              <mat-icon>{{member.isActive !== false ? 'person_remove' : 'person_add'}}</mat-icon>
                            </button>
                          </div>
                        </td>
                      </ng-container>

                      <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                      <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
                    </table>

                    <mat-paginator
                      [length]="nonHomeownerMembersPagination?.total || nonHomeownerMembers.length"
                      [pageSize]="100"
                      [pageSizeOptions]="[10, 20, 50, 100]"
                      showFirstLastButtons>
                    </mat-paginator>
                  </div>
                </mat-tab>
              </mat-tab-group>
            </div>
          </mat-tab>

          <!-- Pending Approvals Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>pending</mat-icon>
              Pending Approvals
              <mat-chip *ngIf="pendingMembers.length > 0" class="count-chip pending-count">
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
                        [class]="hasPaidFor2026(member) ? 'status-chip paid' : 'status-chip unpaid'"
                        [matTooltip]="hasPaidFor2026(member) ? '2026 membership fees paid' : '2026 membership fees not paid'">
                        <mat-icon>{{hasPaidFor2026(member) ? 'paid' : 'payment'}}</mat-icon>
                        {{hasPaidFor2026(member) ? (member.membership2026Amount ? 'Paid - ₱' + member.membership2026Amount : 'Paid') : 'Unpaid'}}
                      </mat-chip>
                      <mat-chip *ngIf="member.isHomeowner" class="status-chip homeowner" matTooltip="Homeowner">
                        <mat-icon>home</mat-icon>
                        Homeowner
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

          <!-- Inactive Members Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>person_off</mat-icon>
              Inactive Members
              <mat-chip *ngIf="inactiveMembers.length > 0" class="count-chip inactive-count">
                {{inactiveMembersPagination?.total || inactiveMembers.length}}
              </mat-chip>
            </ng-template>

            <div class="tab-content">
              <div class="loading-container" *ngIf="loadingInactive">
                <mat-spinner></mat-spinner>
                <p>Loading inactive members...</p>
              </div>

              <div class="empty-state" *ngIf="!loadingInactive && inactiveMembers.length === 0">
                <mat-icon class="empty-icon">check_circle</mat-icon>
                <h3>No Inactive Members</h3>
                <p>All members are currently active.</p>
              </div>

              <div class="members-table" *ngIf="!loadingInactive && inactiveMembers.length > 0">
                <table mat-table [dataSource]="inactiveMembers" class="members-data-table">
                  <!-- Name Column -->
                  <ng-container matColumnDef="name">
                    <th mat-header-cell *matHeaderCellDef>Member</th>
                    <td mat-cell *matCellDef="let member">
                      <div class="member-info">
                        <strong>{{member.fullName}}</strong>
                        <span class="username">@{{member.username}}</span>
                      </div>
                    </td>
                  </ng-container>

                  <!-- Contact Column -->
                  <ng-container matColumnDef="contact">
                    <th mat-header-cell *matHeaderCellDef>Contact</th>
                    <td mat-cell *matCellDef="let member">
                      <div class="contact-info">
                        <span>{{member.email}}</span>
                        <span *ngIf="member.phone" class="phone">{{member.phone}}</span>
                      </div>
                    </td>
                  </ng-container>

                  <!-- Role Column (Display Only) -->
                  <ng-container matColumnDef="role">
                    <th mat-header-cell *matHeaderCellDef>Role</th>
                    <td mat-cell *matCellDef="let member">
                      <mat-chip [class]="'role-chip ' + getRoleClass(member.role)">
                        <mat-icon class="role-icon">{{getRoleIcon(member.role)}}</mat-icon>
                        {{member.role | titlecase}}
                      </mat-chip>
                    </td>
                  </ng-container>

                  <!-- Deactivation Info Column -->
                  <ng-container matColumnDef="deactivationInfo">
                    <th mat-header-cell *matHeaderCellDef>Deactivated</th>
                    <td mat-cell *matCellDef="let member">
                      <div class="deactivation-info">
                        <span class="date">{{member.deletedAt | date:'mediumDate'}}</span>
                        <span class="by" *ngIf="member.deletedBy">
                          by {{member.deletedBy.fullName}}
                        </span>
                      </div>
                    </td>
                  </ng-container>

                  <!-- Status Column (Hide Active badge) -->
                  <ng-container matColumnDef="status">
                    <th mat-header-cell *matHeaderCellDef>Status</th>
                    <td mat-cell *matCellDef="let member">
                      <div class="status-badges">
                        <mat-chip [class]="member.isApproved ? 'status-chip approved' : 'status-chip pending'">
                          <mat-icon>{{member.isApproved ? 'verified' : 'pending'}}</mat-icon>
                          {{member.isApproved ? 'Approved' : 'Pending'}}
                        </mat-chip>
                        <mat-chip
                          [class]="hasPaidFor2026(member) ? 'status-chip paid' : 'status-chip unpaid'"
                          [matTooltip]="hasPaidFor2026(member) ? '2026 membership fees paid' : '2026 membership fees not paid'">
                          <mat-icon>{{hasPaidFor2026(member) ? 'paid' : 'payment'}}</mat-icon>
                          {{hasPaidFor2026(member) ? (member.membership2026Amount ? 'Paid - ₱' + member.membership2026Amount : 'Paid') : 'Unpaid'}}
                        </mat-chip>
                      </div>
                    </td>
                  </ng-container>

                  <!-- Registered Column -->
                  <ng-container matColumnDef="registered">
                    <th mat-header-cell *matHeaderCellDef>Registered</th>
                    <td mat-cell *matCellDef="let member">{{member.registrationDate | date:'mediumDate'}}</td>
                  </ng-container>

                  <!-- Actions Column -->
                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef>Actions</th>
                    <td mat-cell *matCellDef="let member">
                      <div class="table-actions">
                        <button mat-icon-button (click)="viewMemberDetails(member)" matTooltip="View Details">
                          <mat-icon>visibility</mat-icon>
                        </button>
                        <button
                          mat-raised-button
                          color="primary"
                          (click)="reactivateMember(member)"
                          matTooltip="Reactivate Member">
                          <mat-icon>person_add</mat-icon>
                          Reactivate
                        </button>
                      </div>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="displayedColumnsInactive"></tr>
                  <tr mat-row *matRowDef="let row; columns: displayedColumnsInactive;"></tr>
                </table>

                <mat-paginator
                  [length]="inactiveMembersPagination?.total || 0"
                  [pageSize]="inactiveMembersPagination?.limit || 100"
                  [pageIndex]="(inactiveMembersPagination?.page || 1) - 1"
                  [pageSizeOptions]="[10, 20, 50, 100]"
                  (page)="onInactivePageChange($event)"
                  showFirstLastButtons>
                </mat-paginator>
              </div>
            </div>
          </mat-tab>

          <!-- Member Reports Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>assessment</mat-icon>
              Member Reports
            </ng-template>

            <div class="tab-content reports-tab">
              <!-- Controls Row -->
              <div class="controls-row">
                <!-- Grouping selector -->
                <mat-form-field appearance="outline">
                  <mat-label>Group By</mat-label>
                  <mat-select [(value)]="selectedGrouping" (selectionChange)="onGroupingChange()">
                    <mat-option value="gender">Gender</mat-option>
                    <mat-option value="homeowner">Homeowner Status</mat-option>
                    <mat-option value="membership">Membership Status</mat-option>
                  </mat-select>
                </mat-form-field>

                <!-- Membership filter -->
                <mat-form-field appearance="outline">
                  <mat-label>2026 Membership</mat-label>
                  <mat-select [(value)]="membershipFilter" (selectionChange)="onFilterChange()">
                    <mat-option value="all">All Members</mat-option>
                    <mat-option value="paid">Paid 2026</mat-option>
                    <mat-option value="unpaid">Not Paid 2026</mat-option>
                  </mat-select>
                </mat-form-field>

                <!-- Homeowner filter -->
                <mat-form-field appearance="outline">
                  <mat-label>Homeowner Filter</mat-label>
                  <mat-select [(value)]="homeownerFilter" (selectionChange)="onFilterChange()">
                    <mat-option value="all">All Members</mat-option>
                    <mat-option value="homeowner">Homeowners Only</mat-option>
                    <mat-option value="non-homeowner">Non-Homeowners Only</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <!-- Grouped summary cards -->
              <div class="grouped-cards">
                <mat-card *ngFor="let group of groupedData" class="group-card">
                  <mat-card-header>
                    <mat-card-title>
                      {{ group.label }}
                      <mat-chip class="count-chip">{{ group.members.length }}</mat-chip>
                    </mat-card-title>
                  </mat-card-header>

                  <mat-card-content>
                    <!-- Members list - always visible -->
                    <div class="members-list">
                      <div *ngFor="let member of group.members" class="member-item">
                        <span class="member-name">{{ member.fullName }}</span>
                        <span class="member-email">{{ member.email }}</span>
                        <mat-chip class="role-chip">{{ member.role }}</mat-chip>
                      </div>
                    </div>
                  </mat-card-content>
                </mat-card>
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

  inactiveMembers: Member[] = [];
  inactiveMembersPagination: any = null;

  loadingPending = false;
  loadingAll = false;
  loadingInactive = false;
  updating = '';

  // Reports tab properties
  selectedGrouping: 'gender' | 'homeowner' | 'membership' = 'gender';
  groupedData: GroupedMemberData[] = [];

  // Filter properties
  membershipFilter: 'all' | 'paid' | 'unpaid' = 'all';
  homeownerFilter: 'all' | 'homeowner' | 'non-homeowner' = 'all';

  displayedColumns: string[] = ['name', 'contact', 'role', 'status', 'registered', 'actions'];
  displayedColumnsInactive: string[] = ['name', 'contact', 'role', 'deactivationInfo', 'status', 'registered', 'actions'];

  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    public authService: AuthService,
    private memberService: MemberService,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadPendingMembers();
    this.loadAllMembers();
    this.loadInactiveMembers();
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

  loadAllMembers(page: number = 1, limit: number = 100): void {
    this.loadingAll = true;
    const headers = {
      'Authorization': `Bearer ${this.authService.token}`
    };

    // Add cache buster to force fresh data
    const cacheBuster = Date.now();
    const url = `${this.apiUrl}/members?page=${page}&limit=${limit}&_=${cacheBuster}`;

    this.http.get<MemberResponse>(url, { headers })
      .subscribe({
        next: (response) => {
          // Sort members: paid status first, then by name
          const sorted = response.data.sort((a, b) => {
            // Primary sort: paid members first
            const aPaid = this.hasPaidFor2026(a) ? 1 : 0;
            const bPaid = this.hasPaidFor2026(b) ? 1 : 0;
            if (bPaid !== aPaid) {
              return bPaid - aPaid; // Paid (1) comes before Unpaid (0)
            }
            // Secondary sort: alphabetical by full name
            return a.fullName.localeCompare(b.fullName);
          });

          this.allMembers = sorted;
          this.allMembersPagination = response.pagination;
          this.loadingAll = false;

          // Update grouped data for reports tab
          this.updateGroupedData();
        },
        error: (error) => {
          console.error('Error loading all members:', error);
          this.loadingAll = false;
          this.snackBar.open('Failed to load members', 'Close', { duration: 3000 });
        }
      });
  }

  loadInactiveMembers(page: number = 1, limit: number = 100): void {
    this.loadingInactive = true;
    const headers = { 'Authorization': `Bearer ${this.authService.token}` };

    this.http.get<MemberResponse>(`${this.apiUrl}/members/admin/inactive?page=${page}&limit=${limit}`, { headers })
      .subscribe({
        next: (response) => {
          this.inactiveMembers = response.data;
          this.inactiveMembersPagination = response.pagination;
          this.loadingInactive = false;
        },
        error: (error) => {
          console.error('Error loading inactive members:', error);
          this.loadingInactive = false;
          this.snackBar.open('Failed to load inactive members', 'Close', { duration: 3000 });
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

  toggleCoach(member: Member): void {
    const headers = { 'Authorization': `Bearer ${this.authService.token}` };
    const newStatus = !member.isCoach;

    this.http.put<any>(`${this.apiUrl}/members/${member._id}/approval`,
      { isCoach: newStatus }, { headers })
      .subscribe({
        next: (response) => {
          const action = newStatus ? 'granted coach status to' : 'revoked coach status for';
          this.snackBar.open(`Successfully ${action} ${member.fullName}`, 'Close', { duration: 3000 });
          this.loadAllMembers();
        },
        error: (error) => {
          console.error('Error updating coach status:', error);
          this.snackBar.open('Failed to update coach status', 'Close', { duration: 3000 });
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

  reactivateMember(member: Member): void {
    const dialogData: ConfirmationDialogData = {
      title: 'Reactivate Member',
      message: `Are you sure you want to reactivate ${member.fullName}? This will restore their access to the system.`,
      confirmText: 'Reactivate',
      cancelText: 'Cancel',
      type: 'info',
      icon: 'person_add'
    };

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '450px',
      data: dialogData,
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        const headers = { 'Authorization': `Bearer ${this.authService.token}` };

        this.http.put<any>(`${this.apiUrl}/members/${member._id}/reactivate`, {}, { headers })
          .subscribe({
            next: (response) => {
              this.snackBar.open(`${member.fullName} has been reactivated`, 'Close', {
                duration: 3000,
                panelClass: ['success-snackbar']
              });
              this.loadAllMembers();
              this.loadInactiveMembers();
            },
            error: (error) => {
              console.error('Error reactivating member:', error);
              this.snackBar.open('Failed to reactivate member', 'Close', { duration: 3000 });
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

  onInactivePageChange(event: PageEvent): void {
    const page = event.pageIndex + 1;
    this.loadInactiveMembers(page);
  }

  onRoleChange(member: Member, newRole: string): void {
    const roleNames: any = {
      'member': 'Member',
      'treasurer': 'Treasurer',
      'admin': 'Admin',
      'superadmin': 'Superadmin'
    };

    const dialogData: ConfirmationDialogData = {
      title: 'Change User Role',
      message: `Are you sure you want to change ${member.fullName}'s role from ${roleNames[member.role]} to ${roleNames[newRole]}?`,
      confirmText: 'Change Role',
      cancelText: 'Cancel',
      type: 'warning',
      icon: 'admin_panel_settings'
    };

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '450px',
      data: dialogData,
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        const headers = { 'Authorization': `Bearer ${this.authService.token}` };

        this.http.put<any>(`${this.apiUrl}/members/${member._id}/role`, { role: newRole }, { headers })
          .subscribe({
            next: (response) => {
              this.snackBar.open(response.message || 'Role updated successfully', 'Close', {
                duration: 3000,
                panelClass: ['success-snackbar']
              });
              // Update the local member object
              member.role = newRole as any;
            },
            error: (error) => {
              console.error('Error updating role:', error);
              this.snackBar.open(
                error.error?.error || 'Failed to update role',
                'Close',
                { duration: 3000, panelClass: ['error-snackbar'] }
              );
              // Refresh to revert the UI change
              this.loadAllMembers();
            }
          });
      } else {
        // User cancelled - refresh to revert the select
        this.loadAllMembers();
      }
    });
  }

  getRoleClass(role: string): string {
    const classes: any = {
      'member': 'role-member',
      'treasurer': 'role-treasurer',
      'admin': 'role-admin',
      'superadmin': 'role-superadmin'
    };
    return classes[role] || 'role-member';
  }

  getRoleIcon(role: string): string {
    const icons: any = {
      'member': 'person',
      'treasurer': 'account_balance',
      'admin': 'admin_panel_settings',
      'superadmin': 'shield'
    };
    return icons[role] || 'person';
  }

  /**
   * Check if member has paid membership fee for 2026
   */
  hasPaidFor2026(member: Member): boolean {
    return member.membershipYearsPaid?.includes(2026) || false;
  }

  // Getter for homeowner members
  get homeownerMembers(): Member[] {
    return this.allMembers.filter(member => member.isHomeowner === true);
  }

  // Getter for non-homeowner members
  get nonHomeownerMembers(): Member[] {
    return this.allMembers.filter(member => !member.isHomeowner);
  }

  // Reports tab grouping methods
  onGroupingChange(): void {
    this.updateGroupedData();
  }

  onFilterChange(): void {
    this.updateGroupedData();
  }

  // Get filtered members based on active filters
  private getFilteredMembers(): Member[] {
    let filtered = [...this.allMembers];

    // Apply membership filter (based on 2026 payment)
    if (this.membershipFilter === 'paid') {
      filtered = filtered.filter(m => m.membershipYearsPaid?.includes(2026) || false);
    } else if (this.membershipFilter === 'unpaid') {
      filtered = filtered.filter(m => !m.membershipYearsPaid?.includes(2026));
    }

    // Apply homeowner filter
    if (this.homeownerFilter === 'homeowner') {
      filtered = filtered.filter(m => m.isHomeowner === true);
    } else if (this.homeownerFilter === 'non-homeowner') {
      filtered = filtered.filter(m => !m.isHomeowner);
    }

    return filtered;
  }

  updateGroupedData(): void {
    switch (this.selectedGrouping) {
      case 'gender':
        this.groupedData = this.groupByGender();
        break;
      case 'homeowner':
        this.groupedData = this.groupByHomeowner();
        break;
      case 'membership':
        this.groupedData = this.groupByMembership();
        break;
    }
  }

  private groupByGender(): GroupedMemberData[] {
    const members = this.getFilteredMembers();
    const male = members.filter(m => m.gender === 'male');
    const female = members.filter(m => m.gender === 'female');
    const other = members.filter(m => m.gender === 'other' || !m.gender);

    const groups = [
      { label: 'Male', value: 'male', members: male },
      { label: 'Female', value: 'female', members: female },
      { label: 'Other', value: 'other', members: other }
    ];

    // Only return groups that have members
    return groups.filter(group => group.members.length > 0);
  }

  private groupByHomeowner(): GroupedMemberData[] {
    const members = this.getFilteredMembers();
    const homeowners = members.filter(m => m.isHomeowner === true);
    const nonHomeowners = members.filter(m => !m.isHomeowner);

    const groups = [
      { label: 'Homeowners', value: 'true', members: homeowners },
      { label: 'Non-Homeowners', value: 'false', members: nonHomeowners }
    ];

    // Only return groups that have members
    return groups.filter(group => group.members.length > 0);
  }

  private groupByMembership(): GroupedMemberData[] {
    const members = this.getFilteredMembers();
    const paid = members.filter(m => m.membershipFeesPaid === true);
    const unpaid = members.filter(m => !m.membershipFeesPaid);

    const groups = [
      { label: 'Membership Paid', value: 'paid', members: paid },
      { label: 'Membership Unpaid', value: 'unpaid', members: unpaid }
    ];

    // Only return groups that have members
    return groups.filter(group => group.members.length > 0);
  }

  // Pagination objects for sub-tabs (client-side pagination)
  homeownerMembersPagination: any = null;
  nonHomeownerMembersPagination: any = null;
}