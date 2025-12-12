import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService, ImpersonationState } from '../../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-impersonation-banner',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule
  ],
  template: `
    <div class="impersonation-banner" *ngIf="impersonationState.isImpersonating">
      <div class="banner-content">
        <div class="banner-icon">
          <mat-icon>supervisor_account</mat-icon>
        </div>
        <div class="banner-text">
          <strong>Impersonation Mode Active</strong>
          <span>
            Viewing as <strong>{{ impersonationState.impersonatedUser?.fullName }}</strong>
            <span class="admin-info">(Admin: {{ impersonationState.adminUser?.fullName }})</span>
          </span>
        </div>
        <button
          mat-raised-button
          color="warn"
          (click)="exitImpersonation()"
          class="exit-button"
          matTooltip="Return to your admin account">
          <mat-icon>exit_to_app</mat-icon>
          Exit Impersonation
        </button>
      </div>
    </div>
  `,
  styles: [`
    .impersonation-banner {
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
      color: white;
      padding: 12px 20px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      position: fixed;
      top: 155px;
      left: 0;
      right: 0;
      z-index: 999;
      animation: slideDown 0.3s ease-out;
    }

    .banner-content {
      display: flex;
      align-items: center;
      gap: 16px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .banner-icon {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .banner-icon mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .banner-text {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 14px;
    }

    .banner-text strong {
      font-size: 16px;
      font-weight: 600;
    }

    .admin-info {
      opacity: 0.9;
      margin-left: 8px;
      font-size: 13px;
    }

    .exit-button {
      white-space: nowrap;
      background-color: rgba(255, 255, 255, 0.2) !important;
      color: white !important;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }

    .exit-button:hover {
      background-color: rgba(255, 255, 255, 0.3) !important;
    }

    .exit-button mat-icon {
      margin-right: 8px;
    }

    @keyframes slideDown {
      from {
        transform: translateY(-100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    /* Mobile responsive */
    @media (max-width: 768px) {
      .banner-content {
        flex-direction: column;
        gap: 12px;
        text-align: center;
      }

      .banner-text {
        align-items: center;
      }

      .exit-button {
        width: 100%;
      }
    }
  `]
})
export class ImpersonationBannerComponent implements OnInit, OnDestroy {
  impersonationState: ImpersonationState = {
    isImpersonating: false,
    adminUser: null,
    impersonatedUser: null,
    startedAt: null
  };

  private subscription: Subscription = new Subscription();

  constructor(
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    // Subscribe to impersonation state changes
    this.subscription = this.authService.impersonation$.subscribe(state => {
      this.impersonationState = state;
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  exitImpersonation(): void {
    this.authService.stopImpersonation().subscribe({
      next: () => {
        this.snackBar.open('Returned to your admin account', 'Close', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
      },
      error: (error) => {
        console.error('Error exiting impersonation:', error);
        this.snackBar.open('Failed to exit impersonation', 'Close', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
      }
    });
  }
}
