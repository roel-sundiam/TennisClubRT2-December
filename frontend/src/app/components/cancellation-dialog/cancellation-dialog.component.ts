import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';

export interface CancellationDialogData {
  paymentId: string;
  paymentAmount: string;
  reservationDate: string;
  reservationTime: string;
  isReservationCancellation?: boolean;
  isLateCancellation?: boolean;
}

export interface CancellationResult {
  cancelled: boolean;
  reason: string;
}

@Component({
  selector: 'app-cancellation-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatRadioModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule
  ],
  template: `
    <div class="cancellation-dialog">
      <!-- Header -->
      <div mat-dialog-title class="dialog-header">
        <div class="header-icon">
          <mat-icon>cancel</mat-icon>
        </div>
        <div class="header-text">
          <h2>Cancel Reservation</h2>
          <p class="payment-details">
            {{data.paymentAmount}} for {{data.reservationDate}} at {{data.reservationTime}}
          </p>
        </div>
      </div>

      <!-- Content -->
      <div mat-dialog-content class="dialog-content">
        <form [formGroup]="cancellationForm" class="cancellation-form">
          
          <div class="question-section">
            <h3>Why are you cancelling this reservation?</h3>
            <p class="help-text">Please select the reason for cancellation to help us improve our service.</p>
          </div>

          <mat-divider></mat-divider>

          <!-- Reason Selection -->
          <div class="reason-selection">
            <mat-radio-group formControlName="selectedReason" class="reason-radio-group">
              <mat-radio-button 
                *ngFor="let reason of cancellationReasons" 
                [value]="reason"
                class="reason-option">
                <div class="reason-content">
                  <div class="reason-icon">
                    <mat-icon>{{getReasonIcon(reason)}}</mat-icon>
                  </div>
                  <div class="reason-text">
                    <span class="reason-title">{{reason}}</span>
                    <span class="reason-description">{{getReasonDescription(reason)}}</span>
                  </div>
                </div>
              </mat-radio-button>
            </mat-radio-group>
          </div>

          <!-- Custom Reason Input -->
          <div class="custom-reason-section" *ngIf="cancellationForm.get('selectedReason')?.value === 'Other reason'">
            <mat-divider></mat-divider>
            <mat-form-field appearance="outline" class="custom-reason-field">
              <mat-label>Please specify the reason</mat-label>
              <input 
                matInput 
                formControlName="customReason"
                placeholder="Enter specific reason for cancellation..."
                maxlength="200">
              <mat-hint>Help us understand what happened</mat-hint>
              <mat-error *ngIf="cancellationForm.get('customReason')?.hasError('required')">
                Please provide a specific reason
              </mat-error>
            </mat-form-field>
          </div>
        </form>
      </div>

      <!-- Actions -->
      <div mat-dialog-actions class="dialog-actions">
        <button 
          mat-raised-button
          (click)="onCancel()"
          class="cancel-action-btn">
          <mat-icon>check_circle</mat-icon>
          <span class="button-text">
            <span class="button-title">Keep Reservation</span>
          </span>
        </button>
        
        <button 
          mat-raised-button
          color="warn"
          (click)="onConfirmCancellation()"
          [disabled]="!isFormValid()"
          class="confirm-cancel-btn">
          <mat-icon>cancel</mat-icon>
          <span class="button-text">
            <span class="button-title">Cancel Reservation</span>
            <span class="button-subtitle">Process refund</span>
          </span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .cancellation-dialog {
      min-width: 500px;
      max-width: 600px;
      font-family: 'Roboto', sans-serif;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 24px 24px 16px 24px !important;
      margin: 0 !important;
      border-bottom: 1px solid #e0e0e0;
      
      .header-icon {
        background: rgba(244, 67, 54, 0.1);
        border-radius: 50%;
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        
        mat-icon {
          color: #f44336;
          font-size: 24px;
          width: 24px;
          height: 24px;
        }
      }
      
      .header-text {
        flex: 1;
        
        h2 {
          margin: 0 0 4px 0;
          font-size: 20px;
          font-weight: 500;
          color: #212121;
        }
        
        .payment-details {
          margin: 0;
          font-size: 14px;
          color: #666;
          font-weight: 400;
        }
      }
    }

    .dialog-content {
      padding: 20px 24px !important;
      
      .question-section {
        margin-bottom: 20px;
        
        h3 {
          margin: 0 0 8px 0;
          font-size: 16px;
          font-weight: 500;
          color: #212121;
        }
        
        .help-text {
          margin: 0;
          font-size: 14px;
          color: #666;
          line-height: 1.4;
        }
      }
    }

    .reason-selection {
      margin: 20px 0;
      
      .reason-radio-group {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .reason-option {
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 0;
        margin: 0;
        transition: all 0.3s ease;
        
        &:hover {
          border-color: #2196f3;
          background: rgba(33, 150, 243, 0.04);
        }
        
        &.mat-mdc-radio-checked {
          border-color: #2196f3;
          background: rgba(33, 150, 243, 0.08);
        }
        
        ::ng-deep .mdc-radio {
          margin: 16px;
        }
        
        .reason-content {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 16px 16px 0;
          width: 100%;
          text-align: left;
          
          .reason-icon {
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            
            mat-icon {
              font-size: 20px;
              width: 20px;
              height: 20px;
              color: #666;
            }
          }
          
          .reason-text {
            flex: 1;
            text-align: left;
            
            .reason-title {
              display: block;
              font-size: 14px;
              font-weight: 500;
              color: #212121;
              margin-bottom: 2px;
              text-align: left;
            }
            
            .reason-description {
              display: block;
              font-size: 12px;
              color: #666;
              line-height: 1.3;
              text-align: left;
            }
          }
        }
      }
    }

    .custom-reason-section {
      margin-top: 20px;
      
      mat-divider {
        margin-bottom: 20px;
      }
      
      .custom-reason-field {
        width: 100%;
      }
    }

    .dialog-actions {
      padding: 16px 24px 24px 24px !important;
      border-top: 1px solid #e0e0e0;
      display: flex !important;
      flex-direction: row !important;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin: 0 !important;
      box-sizing: border-box;
      width: 100%;
      
      .cancel-action-btn {
        background: #4caf50;
        color: white;
        min-width: 160px;
        min-height: 56px;
        flex: 0 0 auto;
        order: 1;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(76, 175, 80, 0.3);
        transition: all 0.3s ease;
        
        &:hover {
          background: #45a049;
          box-shadow: 0 4px 8px rgba(76, 175, 80, 0.4);
          transform: translateY(-1px);
        }
        
        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
        }
        
        .button-text {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
          
          .button-title {
            font-size: 14px;
            font-weight: 600;
            line-height: 1.2;
          }
          
          .button-subtitle {
            font-size: 11px;
            font-weight: 400;
            opacity: 0.9;
            line-height: 1.2;
          }
        }
      }
      
      .confirm-cancel-btn {
        background: #f44336;
        color: white;
        min-width: 160px;
        min-height: 56px;
        flex: 0 0 auto;
        order: 2;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(244, 67, 54, 0.3);
        transition: all 0.3s ease;
        
        &:hover:not(:disabled) {
          background: #e53935;
          box-shadow: 0 4px 8px rgba(244, 67, 54, 0.4);
          transform: translateY(-1px);
        }
        
        &:disabled {
          opacity: 0.6;
          transform: none;
          box-shadow: none;
        }
        
        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
        }
        
        .button-text {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
          
          .button-title {
            font-size: 14px;
            font-weight: 600;
            line-height: 1.2;
          }
          
          .button-subtitle {
            font-size: 11px;
            font-weight: 400;
            opacity: 0.9;
            line-height: 1.2;
          }
        }
      }
    }

    @media (max-width: 600px) {
      .cancellation-dialog {
        min-width: auto;
        width: 100%;
        max-width: 100%;
        margin: 0;
        max-height: 85vh;
        overflow-y: auto;
      }

      .dialog-header {
        flex-direction: row;
        text-align: left;
        gap: 12px;
        padding: 12px 16px !important;

        .header-icon {
          width: 36px;
          height: 36px;

          mat-icon {
            font-size: 20px;
            width: 20px;
            height: 20px;
          }
        }

        .header-text {
          h2 {
            font-size: 18px;
            margin: 0 0 2px 0;
          }

          .payment-details {
            font-size: 13px;
          }
        }
      }

      .dialog-content {
        padding: 12px 16px !important;

        .question-section {
          margin-bottom: 16px;

          h3 {
            font-size: 15px;
            margin: 0 0 6px 0;
          }

          .help-text {
            font-size: 13px;
          }
        }
      }

      .reason-selection {
        margin: 16px 0;

        .reason-radio-group {
          gap: 8px;
        }

        .reason-option {
          .reason-content {
            padding: 12px 12px 12px 0;
            gap: 10px;

            .reason-icon {
              width: 20px;
              height: 20px;

              mat-icon {
                font-size: 18px;
                width: 18px;
                height: 18px;
              }
            }

            .reason-text {
              .reason-title {
                font-size: 13px;
              }

              .reason-description {
                font-size: 11px;
              }
            }
          }
        }
      }

      .custom-reason-section {
        margin-top: 16px;

        mat-divider {
          margin-bottom: 16px;
        }
      }

      .dialog-actions {
        flex-direction: row !important;
        justify-content: space-between;
        gap: 4px;
        padding: 12px 16px !important;
        flex-wrap: nowrap;
        position: sticky;
        bottom: 0;
        background: white;
        border-top: 1px solid #e0e0e0;
        box-sizing: border-box;
        width: 100%;
        max-width: 100%;

        .cancel-action-btn {
          min-width: 100px;
          min-height: 48px;
          flex: 0 0 auto;
          max-width: 45%;
          font-size: 12px;
          padding: 8px 10px;
          box-sizing: border-box;

          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
          }

          .button-text {
            .button-title {
              font-size: 10px;
              font-weight: 600;
            }

            .button-subtitle {
              font-size: 8px;
              display: none;
            }
          }
        }

        .confirm-cancel-btn {
          min-width: 100px;
          min-height: 48px;
          flex: 0 0 auto;
          max-width: 45%;
          font-size: 12px;
          padding: 8px 10px;
          box-sizing: border-box;

          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
          }

          .button-text {
            .button-title {
              font-size: 10px;
              font-weight: 600;
            }

            .button-subtitle {
              font-size: 8px;
              display: none;
            }
          }
        }
      }
    }

    @media (max-width: 480px) {
      .cancellation-dialog {
        width: calc(100vw - 16px);
        max-width: calc(100vw - 16px);
        max-height: 90vh;
      }

      .dialog-header {
        padding: 10px 12px !important;

        .header-icon {
          width: 32px;
          height: 32px;

          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
          }
        }

        .header-text {
          h2 {
            font-size: 16px;
          }

          .payment-details {
            font-size: 12px;
          }
        }
      }

      .dialog-content {
        padding: 10px 12px !important;

        .question-section {
          margin-bottom: 12px;

          h3 {
            font-size: 14px;
            margin: 0 0 4px 0;
          }

          .help-text {
            font-size: 12px;
          }
        }
      }

      .reason-selection {
        margin: 12px 0;

        .reason-radio-group {
          gap: 6px;
        }

        .reason-option {
          .reason-content {
            padding: 10px 10px 10px 0;
            gap: 8px;

            .reason-text {
              .reason-title {
                font-size: 12px;
              }

              .reason-description {
                font-size: 10px;
              }
            }
          }
        }
      }

      .dialog-actions {
        flex-direction: row !important;
        gap: 3px;
        padding: 10px 12px !important;
        box-sizing: border-box;
        width: 100%;
        max-width: 100%;

        .cancel-action-btn,
        .confirm-cancel-btn {
          min-width: 90px;
          max-width: 45%;
          flex: 0 0 auto;
          min-height: 44px;
          padding: 6px 8px;
          box-sizing: border-box;

          mat-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
          }

          .button-text {
            .button-title {
              font-size: 11px;
              font-weight: 600;
            }

            .button-subtitle {
              display: none;
            }
          }
        }
      }
    }
  `]
})
export class CancellationDialogComponent {
  cancellationForm: FormGroup;

  cancellationReasons = [
    'Weather conditions (rain, storm, etc.)',
    'Player(s) did not show up',
    'Court maintenance/unavailable',
    'Personal emergency',
    'Duplicate payment',
    'Other reason'
  ];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<CancellationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CancellationDialogData
  ) {
    this.cancellationForm = this.fb.group({
      selectedReason: ['', Validators.required],
      customReason: ['']
    });

    // Add conditional validator for custom reason
    this.cancellationForm.get('selectedReason')?.valueChanges.subscribe(value => {
      const customReasonControl = this.cancellationForm.get('customReason');
      if (value === 'Other reason') {
        customReasonControl?.setValidators([Validators.required, Validators.minLength(3)]);
      } else {
        customReasonControl?.clearValidators();
      }
      customReasonControl?.updateValueAndValidity();
    });
  }

  getReasonIcon(reason: string): string {
    const iconMap: { [key: string]: string } = {
      'Weather conditions (rain, storm, etc.)': 'cloud_queue',
      'Player(s) did not show up': 'person_off',
      'Court maintenance/unavailable': 'build',
      'Personal emergency': 'local_hospital',
      'Duplicate payment': 'content_copy',
      'Other reason': 'help'
    };
    return iconMap[reason] || 'info';
  }

  getReasonDescription(reason: string): string {
    const descriptionMap: { [key: string]: string } = {
      'Weather conditions (rain, storm, etc.)': 'Rain, storm, or unsafe playing conditions',
      'Player(s) did not show up': 'Some players cancelled or were no-shows',
      'Court maintenance/unavailable': 'Court was closed or under maintenance',
      'Personal emergency': 'Unexpected personal situation arose',
      'Duplicate payment': 'This payment was made by mistake',
      'Other reason': 'Please specify your reason below'
    };
    return descriptionMap[reason] || '';
  }

  isFormValid(): boolean {
    const selectedReason = this.cancellationForm.get('selectedReason')?.value;
    if (!selectedReason) return false;

    if (selectedReason === 'Other reason') {
      const customReason = this.cancellationForm.get('customReason')?.value;
      return customReason && customReason.trim().length >= 3;
    }

    return true;
  }

  onCancel(): void {
    this.dialogRef.close({ cancelled: false, reason: '' });
  }

  onConfirmCancellation(): void {
    if (!this.isFormValid()) return;

    const selectedReason = this.cancellationForm.get('selectedReason')?.value;
    let finalReason = selectedReason;

    if (selectedReason === 'Other reason') {
      finalReason = this.cancellationForm.get('customReason')?.value.trim();
    }

    this.dialogRef.close({
      cancelled: true,
      reason: finalReason
    } as CancellationResult);
  }
}