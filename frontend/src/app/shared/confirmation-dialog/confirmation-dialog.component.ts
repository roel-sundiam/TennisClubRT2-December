import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmationDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info';
  icon?: string;
}

@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="modern-confirmation-dialog">
      <div class="dialog-icon-wrapper" [ngClass]="'icon-' + (data.type || 'info')">
        <div class="icon-circle">
          <mat-icon class="dialog-icon">{{ data.icon || getDefaultIcon() }}</mat-icon>
        </div>
      </div>

      <div class="dialog-body">
        <h2 class="dialog-title">{{ data.title }}</h2>
        <p class="dialog-message">{{ data.message }}</p>
      </div>

      <div class="dialog-actions">
        <button class="modern-dialog-btn cancel-btn" (click)="onCancel()" type="button">
          <mat-icon>close</mat-icon>
          <span>{{ data.cancelText || 'Cancel' }}</span>
        </button>

        <button
          class="modern-dialog-btn confirm-btn"
          [ngClass]="'confirm-' + (data.type || 'info')"
          (click)="onConfirm()"
          type="button"
        >
          <mat-icon>{{ getConfirmIcon() }}</mat-icon>
          <span>{{ data.confirmText || 'Confirm' }}</span>
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .modern-confirmation-dialog {
        min-width: 380px;
        max-width: 500px;
        padding: 2rem;
        background: white;
        border-radius: 16px;
        text-align: center;
        animation: dialogEnter 0.3s ease-out;
      }

      @keyframes dialogEnter {
        from {
          opacity: 0;
          transform: scale(0.9) translateY(-20px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }

      .dialog-icon-wrapper {
        display: flex;
        justify-content: center;
        margin-bottom: 1.5rem;

        .icon-circle {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          animation: iconPulse 2s ease-in-out infinite;

          &::before {
            content: '';
            position: absolute;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            opacity: 0.2;
            animation: ripple 2s ease-out infinite;
          }
        }

        &.icon-warning .icon-circle {
          background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);

          &::before {
            background: #ff9800;
          }
        }

        &.icon-danger .icon-circle {
          background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%);

          &::before {
            background: #f44336;
          }
        }

        &.icon-info .icon-circle {
          background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);

          &::before {
            background: #2196f3;
          }
        }

        .dialog-icon {
          font-size: 40px;
          width: 40px;
          height: 40px;
          z-index: 1;
        }
      }

      @keyframes iconPulse {
        0%,
        100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.05);
        }
      }

      @keyframes ripple {
        0% {
          transform: scale(1);
          opacity: 0.2;
        }
        100% {
          transform: scale(1.4);
          opacity: 0;
        }
      }

      .icon-warning .dialog-icon {
        color: #f57c00;
      }

      .icon-danger .dialog-icon {
        color: #d32f2f;
      }

      .icon-info .dialog-icon {
        color: #1976d2;
      }

      .dialog-body {
        margin-bottom: 2rem;
      }

      .dialog-title {
        margin: 0 0 0.75rem;
        font-size: 1.5rem;
        font-weight: 600;
        color: #212529;
        line-height: 1.3;
      }

      .dialog-message {
        margin: 0;
        font-size: 1rem;
        line-height: 1.6;
        color: #6c757d;
      }

      .dialog-actions {
        display: flex;
        gap: 0.75rem;
        justify-content: center;
      }

      .modern-dialog-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.75rem 1.75rem;
        font-size: 0.95rem;
        font-weight: 600;
        font-family: inherit;
        border: 2px solid;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s ease;
        min-width: 120px;

        mat-icon {
          font-size: 1.2rem;
          width: 1.2rem;
          height: 1.2rem;
        }

        &:active {
          transform: translateY(1px);
        }

        &:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.1);
        }
      }

      .cancel-btn {
        background: white;
        color: #6c757d;
        border-color: #dee2e6;

        &:hover {
          background: #f8f9fa;
          border-color: #adb5bd;
          color: #495057;
          transform: translateY(-1px);
        }
      }

      .confirm-btn {
        color: white;

        &.confirm-warning {
          background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
          border-color: #f57c00;
          box-shadow: 0 4px 12px rgba(255, 152, 0, 0.3);

          &:hover {
            background: linear-gradient(135deg, #fb8c00 0%, #ef6c00 100%);
            box-shadow: 0 6px 16px rgba(255, 152, 0, 0.4);
            transform: translateY(-2px);
          }
        }

        &.confirm-danger {
          background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
          border-color: #d32f2f;
          box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3);

          &:hover {
            background: linear-gradient(135deg, #e53935 0%, #c62828 100%);
            box-shadow: 0 6px 16px rgba(244, 67, 54, 0.4);
            transform: translateY(-2px);
          }
        }

        &.confirm-info {
          background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
          border-color: #1976d2;
          box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);

          &:hover {
            background: linear-gradient(135deg, #1e88e5 0%, #1565c0 100%);
            box-shadow: 0 6px 16px rgba(33, 150, 243, 0.4);
            transform: translateY(-2px);
          }
        }
      }

      @media (max-width: 480px) {
        .modern-confirmation-dialog {
          min-width: 280px;
          max-width: 95vw;
          padding: 1.5rem;
        }

        .dialog-icon-wrapper .icon-circle {
          width: 70px;
          height: 70px;

          .dialog-icon {
            font-size: 36px;
            width: 36px;
            height: 36px;
          }
        }

        .dialog-title {
          font-size: 1.25rem;
        }

        .dialog-message {
          font-size: 0.9rem;
        }

        .dialog-actions {
          flex-direction: column-reverse;
          gap: 0.5rem;
        }

        .modern-dialog-btn {
          width: 100%;
          padding: 0.875rem 1.5rem;
        }
      }

      /* Make the dialog backdrop darker */
      ::ng-deep .cdk-overlay-dark-backdrop {
        background: rgba(0, 0, 0, 0.6);
      }

      /* Remove default Material dialog padding */
      ::ng-deep .mat-mdc-dialog-container .mdc-dialog__surface {
        padding: 0 !important;
        border-radius: 16px !important;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3) !important;
      }
    `,
  ],
})
export class ConfirmationDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmationDialogData,
  ) {}

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  getDefaultIcon(): string {
    switch (this.data.type) {
      case 'warning':
        return 'warning';
      case 'danger':
        return 'error';
      case 'info':
      default:
        return 'info';
    }
  }

  getConfirmIcon(): string {
    switch (this.data.type) {
      case 'danger':
        return 'delete_forever';
      case 'warning':
        return 'warning_amber';
      case 'info':
      default:
        return 'check_circle';
    }
  }

  getButtonColor(): string {
    switch (this.data.type) {
      case 'danger':
        return 'warn';
      case 'warning':
        return 'accent';
      case 'info':
      default:
        return 'primary';
    }
  }
}
