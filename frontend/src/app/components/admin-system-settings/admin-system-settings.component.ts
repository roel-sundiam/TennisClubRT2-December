import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { SystemSettingsService, SystemSettings, TennisBallsStats } from '../../services/system-settings.service';

@Component({
  selector: 'app-admin-system-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './admin-system-settings.component.html',
  styleUrls: ['./admin-system-settings.component.css']
})
export class AdminSystemSettingsComponent implements OnInit {
  settingsForm: FormGroup;
  loading = false;
  saving = false;
  loadingStats = false;
  currentSettings: SystemSettings | null = null;
  stats: TennisBallsStats | null = null;

  constructor(
    private fb: FormBuilder,
    private systemSettingsService: SystemSettingsService
  ) {
    this.settingsForm = this.fb.group({
      tennisBallCostPerCan: [
        120,
        [
          Validators.required,
          Validators.min(50),
          Validators.max(500),
          this.multipleOf10Validator
        ]
      ]
    });
  }

  ngOnInit(): void {
    this.loadSettings();
    this.loadStats();
  }

  /**
   * Custom validator to ensure value is a multiple of 10
   */
  multipleOf10Validator(control: any) {
    const value = control.value;
    if (value && value % 10 !== 0) {
      return { notMultipleOf10: true };
    }
    return null;
  }

  /**
   * Load current settings from backend
   */
  loadSettings(): void {
    this.loading = true;

    this.systemSettingsService.getSettings().subscribe({
      next: (response) => {
        this.currentSettings = response.data;
        this.settingsForm.patchValue({
          tennisBallCostPerCan: response.data.tennisBallCostPerCan
        });
        this.loading = false;
      },
      error: (error) => {
        console.error('Failed to load settings:', error);
        this.showNotification('Failed to load settings. Using defaults.', 'error');
        this.loading = false;
      }
    });
  }

  /**
   * Save updated settings
   */
  saveSettings(): void {
    if (this.settingsForm.invalid) {
      this.showNotification('Please fix validation errors before saving', 'error');
      return;
    }

    this.saving = true;
    const updatedSettings = {
      tennisBallCostPerCan: this.settingsForm.value.tennisBallCostPerCan
    };

    this.systemSettingsService.updateSettings(updatedSettings).subscribe({
      next: (response) => {
        this.currentSettings = response.data;
        this.saving = false;
        this.showNotification('✅ Settings saved successfully!', 'success');
      },
      error: (error) => {
        console.error('Failed to save settings:', error);
        this.saving = false;
        this.showNotification(
          `❌ Failed to save settings: ${error.error?.message || 'Unknown error'}`,
          'error'
        );
      }
    });
  }

  /**
   * Load tennis balls statistics
   */
  loadStats(): void {
    this.loadingStats = true;

    this.systemSettingsService.getTennisBallsStats().subscribe({
      next: (response) => {
        this.stats = response.data;
        this.loadingStats = false;
      },
      error: (error) => {
        console.error('Failed to load tennis balls stats:', error);
        this.loadingStats = false;
      }
    });
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  }

  /**
   * Format reservation date for display
   */
  formatReservationDate(dateString: string): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  /**
   * Get error message for tennis ball cost field
   */
  getTennisBallCostError(): string {
    const control = this.settingsForm.get('tennisBallCostPerCan');
    if (control?.hasError('required')) {
      return 'Cost per can is required';
    }
    if (control?.hasError('min')) {
      return 'Minimum cost is ₱50';
    }
    if (control?.hasError('max')) {
      return 'Maximum cost is ₱500';
    }
    if (control?.hasError('notMultipleOf10')) {
      return 'Cost must be a multiple of ₱10';
    }
    return '';
  }

  /**
   * Show native browser notification
   */
  private showNotification(message: string, type: 'success' | 'error'): void {
    // Log to console
    if (type === 'success') {
      console.log(message);
    } else {
      console.error(message);
    }

    // You can add toast notifications here if desired
    // For now, we use console and the form's validation messages
  }
}
