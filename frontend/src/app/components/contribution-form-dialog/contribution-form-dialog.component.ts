import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface ContributionDialogData {
  isEdit?: boolean;
  contribution?: {
    id: string;
    contributorName: string;
    amount: number;
    paymentMethod: 'cash' | 'gcash' | 'bank_transfer';
    notes?: string;
  };
}

@Component({
  selector: 'app-contribution-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatRadioModule,
    MatIconModule
  ],
  templateUrl: './contribution-form-dialog.component.html',
  styleUrls: ['./contribution-form-dialog.component.scss']
})
export class ContributionFormDialogComponent implements OnInit {
  contributionForm!: FormGroup;
  isSubmitting = false;
  submitSuccess = false;
  submitError = '';
  isEditMode = false;
  contributionId?: string;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private dialogRef: MatDialogRef<ContributionFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ContributionDialogData
  ) {}

  ngOnInit(): void {
    this.isEditMode = this.data?.isEdit || false;
    this.contributionId = this.data?.contribution?.id;

    this.contributionForm = this.fb.group({
      contributorName: [this.data?.contribution?.contributorName || '', [Validators.required, Validators.minLength(2)]],
      amount: [this.data?.contribution?.amount || '', [Validators.required, Validators.min(1)]],
      paymentMethod: [this.data?.contribution?.paymentMethod || 'cash', Validators.required],
      notes: [this.data?.contribution?.notes || '']
    });
  }

  onSubmit(): void {
    if (this.contributionForm.invalid) {
      this.contributionForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.submitError = '';

    const contributionData = this.contributionForm.value;

    const request = this.isEditMode && this.contributionId
      ? this.http.patch(`${environment.apiUrl}/resurfacing/contributions/${this.contributionId}`, contributionData)
      : this.http.post(`${environment.apiUrl}/resurfacing/contributions`, contributionData);

    request.subscribe({
      next: (response: any) => {
        console.log(`✅ Contribution ${this.isEditMode ? 'updated' : 'submitted'} successfully:`, response);
        this.submitSuccess = true;
        this.isSubmitting = false;

        // Close dialog and reload page after showing success message
        setTimeout(() => {
          this.dialogRef.close({ success: true, data: response.data, reload: true });
        }, 2000);
      },
      error: (error) => {
        console.error(`❌ Error ${this.isEditMode ? 'updating' : 'submitting'} contribution:`, error);
        this.submitError = error.error?.message || `Failed to ${this.isEditMode ? 'update' : 'submit'} contribution. Please try again.`;
        this.isSubmitting = false;
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close({ success: false });
  }

  get contributorName() {
    return this.contributionForm.get('contributorName');
  }

  get amount() {
    return this.contributionForm.get('amount');
  }

  get paymentMethod() {
    return this.contributionForm.get('paymentMethod');
  }
}
