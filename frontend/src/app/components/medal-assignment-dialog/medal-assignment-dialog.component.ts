import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface Medal {
  type: 'gold' | 'silver' | 'bronze';
  tournamentName?: string;
  awardedAt: Date;
}

interface Player {
  _id: string;
  fullName: string;
  medals?: Medal[];
}

@Component({
  selector: 'app-medal-assignment-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSnackBarModule
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="header-icon">
          <mat-icon>emoji_events</mat-icon>
        </div>
        <div class="header-content">
          <h2 mat-dialog-title>Award Medal to Player</h2>
          <p class="header-subtitle">Recognize outstanding tournament performance</p>
        </div>
        <button mat-icon-button class="close-button" (click)="onCancel()" [disabled]="loading">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-dialog-content class="dialog-content">
        <!-- Toggle Button -->
        <div class="view-toggle">
          <button mat-raised-button (click)="toggleView()" [disabled]="loading" class="toggle-btn">
            <mat-icon>{{ showMedalList ? 'add' : 'list' }}</mat-icon>
            {{ showMedalList ? 'Award New Medal' : 'View Medal List' }}
          </button>
        </div>

        <!-- Medal List View -->
        <div *ngIf="showMedalList" class="medal-list-view">
          <div *ngIf="playersWithMedals.length === 0" class="no-medals">
            <mat-icon>emoji_events</mat-icon>
            <p>No medals awarded yet</p>
          </div>

          <div *ngIf="playersWithMedals.length > 0" class="medals-list-container">
            <div *ngFor="let player of playersWithMedals" class="medal-row">
              <div class="player-info">
                <mat-icon class="player-icon">person</mat-icon>
                <span class="player-name">{{ player.fullName }}</span>
              </div>
              <div class="medals-wrapper">
                <div *ngFor="let medal of player.medals; let i = index" class="medal-badge">
                  <span class="medal-emoji">{{ getMedalEmoji(medal.type) }}</span>
                  <span class="tournament-name">{{ medal.tournamentName || 'No tournament' }}</span>
                  <button mat-icon-button
                          (click)="editMedal(player, i)"
                          [disabled]="loading"
                          class="edit-btn"
                          matTooltip="Edit tournament">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button
                          (click)="deleteMedal(player, i)"
                          [disabled]="loading"
                          class="delete-btn"
                          matTooltip="Remove medal">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Award Medal Form -->
        <form *ngIf="!showMedalList" [formGroup]="medalForm" class="medal-form">
          <div class="form-section">
            <label class="section-label">
              <mat-icon>person</mat-icon>
              Player Selection
            </label>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Select Player</mat-label>
              <mat-select formControlName="playerId" required>
                <mat-option value="">-- Choose a player --</mat-option>
                <mat-option *ngFor="let player of players" [value]="player._id">
                  <div class="player-option">
                    <span class="player-name">{{ player.fullName }}</span>
                    <span *ngIf="player.medals && player.medals.length > 0" class="current-medals">
                      <ng-container *ngFor="let medal of player.medals">
                        {{ getMedalEmoji(medal.type) }}
                      </ng-container>
                    </span>
                  </div>
                </mat-option>
              </mat-select>
              <mat-icon matPrefix>search</mat-icon>
              <mat-error>Please select a player</mat-error>
            </mat-form-field>
          </div>

          <div class="form-section">
            <label class="section-label">
              <mat-icon>military_tech</mat-icon>
              Medal Achievement
            </label>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Medal Type</mat-label>
              <mat-select formControlName="medal" required>
                <mat-option [value]="null">-- Select Medal Type --</mat-option>
                <mat-option value="gold">
                  <div class="medal-option gold">
                    <span class="medal-emoji">🥇</span>
                    <span>Gold Medal</span>
                  </div>
                </mat-option>
                <mat-option value="silver">
                  <div class="medal-option silver">
                    <span class="medal-emoji">🥈</span>
                    <span>Silver Medal</span>
                  </div>
                </mat-option>
                <mat-option value="bronze">
                  <div class="medal-option bronze">
                    <span class="medal-emoji">🥉</span>
                    <span>Bronze Medal</span>
                  </div>
                </mat-option>
              </mat-select>
              <mat-icon matPrefix>emoji_events</mat-icon>
              <mat-error>Please select a medal type</mat-error>
            </mat-form-field>
          </div>

          <div class="form-section">
            <label class="section-label">
              <mat-icon>sports_tennis</mat-icon>
              Tournament Information
            </label>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Tournament Name</mat-label>
              <input matInput formControlName="tournamentName" required placeholder="e.g., Club Championship 2024">
              <mat-icon matPrefix>emoji_events</mat-icon>
              <mat-error>Please enter tournament name</mat-error>
            </mat-form-field>
          </div>
        </form>

        <div *ngIf="loading" class="loading-overlay">
          <mat-spinner diameter="50"></mat-spinner>
          <p>{{ showMedalList ? 'Updating...' : 'Awarding medal...' }}</p>
        </div>

        <div *ngIf="errorMessage" class="error-message">
          <mat-icon>error_outline</mat-icon>
          <div class="error-content">
            <strong>Error</strong>
            <p>{{ errorMessage }}</p>
          </div>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-actions">
        <button mat-stroked-button class="cancel-button" (click)="onCancel()" [disabled]="loading">
          <mat-icon>close</mat-icon>
          Close
        </button>
        <button *ngIf="!showMedalList" mat-raised-button class="save-button" (click)="onSubmit()"
                [disabled]="medalForm.invalid || loading">
          <mat-icon>check_circle</mat-icon>
          Award Medal
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-container {
      display: flex;
      flex-direction: column;
      min-height: 400px;
      background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 28px 32px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      margin: -24px -24px 0 -24px;
      position: relative;
      overflow: hidden;

      &::before {
        content: '';
        position: absolute;
        top: 0;
        right: 0;
        width: 200px;
        height: 200px;
        background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
        border-radius: 50%;
      }
    }

    .header-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
      box-shadow: 0 4px 16px rgba(255, 215, 0, 0.4);
      position: relative;
      z-index: 1;

      mat-icon {
        color: white;
        font-size: 32px;
        width: 32px;
        height: 32px;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
      }
    }

    .header-content {
      flex: 1;
      position: relative;
      z-index: 1;

      h2 {
        margin: 0;
        font-size: 22px;
        font-weight: 700;
        color: white;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }

      .header-subtitle {
        margin: 4px 0 0 0;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.9);
        font-weight: 300;
      }
    }

    .close-button {
      position: relative;
      z-index: 1;
      color: white;
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(10px);

      &:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.25);
      }
    }

    .dialog-content {
      padding: 32px 32px 24px !important;
      overflow-y: auto;
      max-height: 500px;
    }

    .medal-form {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .form-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .section-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #667eea;
      text-transform: uppercase;
      letter-spacing: 0.5px;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .full-width {
      width: 100%;
    }

    .player-option {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 4px 0;

      .player-name {
        flex: 1;
        font-size: 14px;
        color: #2d3748;
      }

      .current-medal {
        font-size: 18px;
        padding: 2px 8px;
        background: rgba(102, 126, 234, 0.1);
        border-radius: 8px;
      }
    }

    .medal-option {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14px;
      font-weight: 500;
      padding: 4px 0;

      .medal-emoji {
        font-size: 20px;
        line-height: 1;
      }

      &.gold span {
        background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      &.silver span {
        background: linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      &.bronze span {
        background: linear-gradient(135deg, #cd7f32 0%, #e8a860 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      &.remove {
        color: #6c757d;

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
        }
      }
    }

    .loading-overlay {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      gap: 16px;

      p {
        margin: 0;
        font-size: 14px;
        color: #667eea;
        font-weight: 500;
      }
    }

    .error-message {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      background: linear-gradient(135deg, #fff5f5 0%, #ffebee 100%);
      border-left: 4px solid #ef4444;
      border-radius: 8px;
      margin-top: 16px;
      box-shadow: 0 2px 8px rgba(239, 68, 68, 0.1);

      mat-icon {
        color: #ef4444;
        font-size: 24px;
        width: 24px;
        height: 24px;
        flex-shrink: 0;
      }

      .error-content {
        flex: 1;

        strong {
          display: block;
          font-size: 14px;
          font-weight: 700;
          color: #c62828;
          margin-bottom: 4px;
        }

        p {
          margin: 0;
          font-size: 13px;
          color: #ef4444;
          line-height: 1.5;
        }
      }
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 20px 32px !important;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      margin: 0 -24px -24px -24px;
      border-top: 1px solid rgba(102, 126, 234, 0.1);

      button {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        font-size: 13px;
        padding: 0 24px;
        height: 42px;
        border-radius: 10px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
        }
      }

      .cancel-button {
        color: #6c757d;
        border-color: #dee2e6;

        &:hover:not(:disabled) {
          background: white;
          border-color: #adb5bd;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
      }

      .save-button {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);

        &:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }

        &:active {
          transform: translateY(0);
        }

        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      }
    }

    .view-toggle {
      display: flex;
      justify-content: center;
      margin-bottom: 24px;

      .toggle-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        font-weight: 600;
        padding: 0 24px;
        height: 42px;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        transition: all 0.3s ease;

        &:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }
      }
    }

    .medal-list-view {
      min-height: 200px;
    }

    .no-medals {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      color: #9ca3af;

      mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        margin-bottom: 16px;
        opacity: 0.5;
      }

      p {
        margin: 0;
        font-size: 16px;
        font-weight: 500;
      }
    }

    .medals-list-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px 0;
    }

    .medal-row {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 16px;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      transition: all 0.2s ease;

      &:hover {
        border-color: #667eea;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
      }

      .player-info {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 150px;

        .player-icon {
          color: #667eea;
          font-size: 20px;
          width: 20px;
          height: 20px;
        }

        .player-name {
          font-size: 14px;
          font-weight: 600;
          color: #1f2937;
        }
      }

      .medals-wrapper {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        flex-wrap: wrap;
      }

      .medal-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 20px;
        transition: all 0.2s ease;

        &:hover {
          background: #f3f4f6;
          border-color: #cbd5e1;
        }

        .medal-emoji {
          font-size: 18px;
          line-height: 1;
        }

        .tournament-name {
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .edit-btn,
        .delete-btn {
          width: 28px;
          height: 28px;
          transition: all 0.2s ease;

          mat-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
          }
        }

        .edit-btn {
          color: #667eea;

          &:hover:not(:disabled) {
            background: #eef2ff;
            transform: scale(1.1);
          }
        }

        .delete-btn {
          color: #ef4444;

          &:hover:not(:disabled) {
            background: #fee2e2;
            transform: scale(1.1);
          }
        }

        .edit-btn:disabled,
        .delete-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      }
    }

    ::ng-deep .mat-mdc-dialog-container {
      border-radius: 20px;
      overflow: hidden;
    }
  `]
})
export class MedalAssignmentDialogComponent implements OnInit {
  medalForm: FormGroup;
  players: Player[] = [];
  playersWithMedals: Player[] = [];
  loading = false;
  errorMessage = '';
  showMedalList = true; // Show list by default
  private apiUrl = environment.apiUrl;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<MedalAssignmentDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { players: Player[] }
  ) {
    this.players = data.players || [];
    this.medalForm = this.fb.group({
      playerId: ['', Validators.required],
      medal: [null, Validators.required],
      tournamentName: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadPlayersWithMedals();
  }

  loadPlayersWithMedals(): void {
    this.playersWithMedals = this.players.filter(p => p.medals && p.medals.length > 0);
  }

  toggleView(): void {
    this.showMedalList = !this.showMedalList;
    if (this.showMedalList) {
      this.loadPlayersWithMedals();
    }
  }

  getMedalEmoji(medal: 'gold' | 'silver' | 'bronze'): string {
    return medal === 'gold' ? '🥇' : medal === 'silver' ? '🥈' : '🥉';
  }

  editMedal(player: Player, medalIndex: number): void {
    const medal = player.medals![medalIndex];
    const dialogRef = this.dialog.open(EditTournamentDialogComponent, {
      width: '500px',
      data: {
        medalEmoji: this.getMedalEmoji(medal.type),
        playerName: player.fullName,
        currentTournament: medal.tournamentName || ''
      }
    });

    dialogRef.afterClosed().subscribe(tournamentName => {
      if (tournamentName !== null && tournamentName !== undefined) {
        this.loading = true;
        this.errorMessage = '';

        this.http.patch(`${this.apiUrl}/players/${player._id}/medal`, {
          medalIndex,
          tournamentName: tournamentName.trim() || undefined
        }).subscribe({
          next: (response: any) => {
            this.loading = false;
            // Update local player data
            const updatedPlayer = this.players.find(p => p._id === player._id);
            if (updatedPlayer && updatedPlayer.medals && updatedPlayer.medals[medalIndex]) {
              updatedPlayer.medals[medalIndex].tournamentName = tournamentName.trim() || undefined;
            }
            this.loadPlayersWithMedals();

            // Show success message
            const medalEmoji = this.getMedalEmoji(medal.type);
            const tournamentInfo = tournamentName.trim() ? ` to "${tournamentName.trim()}"` : '';
            this.snackBar.open(`${medalEmoji} Tournament updated${tournamentInfo} for ${player.fullName}`, 'Close', {
              duration: 4000,
              horizontalPosition: 'center',
              verticalPosition: 'top',
              panelClass: ['success-snackbar']
            });
          },
          error: (error) => {
            this.loading = false;
            this.errorMessage = error.error?.error || 'Failed to update medal';
            console.error('Error updating medal:', error);

            // Show error message
            this.snackBar.open(this.errorMessage, 'Close', {
              duration: 5000,
              horizontalPosition: 'center',
              verticalPosition: 'top',
              panelClass: ['error-snackbar']
            });
          }
        });
      }
    });
  }

  deleteMedal(player: Player, medalIndex: number): void {
    const medal = player.medals![medalIndex];
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Remove Medal',
        message: `Are you sure you want to remove the ${medal.type} medal from ${player.fullName}?`,
        medalEmoji: this.getMedalEmoji(medal.type),
        confirmText: 'Remove',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loading = true;
        this.errorMessage = '';

        this.http.request('delete', `${this.apiUrl}/players/${player._id}/medal`, {
          body: { medalIndex }
        }).subscribe({
          next: (response: any) => {
            this.loading = false;
            // Update local player data
            const updatedPlayer = this.players.find(p => p._id === player._id);
            if (updatedPlayer && updatedPlayer.medals) {
              updatedPlayer.medals.splice(medalIndex, 1);
            }
            this.loadPlayersWithMedals();

            // Show success message
            this.snackBar.open(`${medal.type.charAt(0).toUpperCase() + medal.type.slice(1)} medal removed from ${player.fullName}`, 'Close', {
              duration: 3000,
              horizontalPosition: 'center',
              verticalPosition: 'top',
              panelClass: ['success-snackbar']
            });
          },
          error: (error) => {
            this.loading = false;
            this.errorMessage = error.error?.error || 'Failed to delete medal';
            console.error('Error deleting medal:', error);

            // Show error message
            this.snackBar.open(this.errorMessage, 'Close', {
              duration: 5000,
              horizontalPosition: 'center',
              verticalPosition: 'top',
              panelClass: ['error-snackbar']
            });
          }
        });
      }
    });
  }

  onSubmit(): void {
    if (this.medalForm.valid && !this.loading) {
      this.loading = true;
      this.errorMessage = '';

      const { playerId, medal, tournamentName } = this.medalForm.value;

      this.http.put(`${this.apiUrl}/players/${playerId}/medal`, {
        medal: medal || null,
        tournamentName: tournamentName?.trim() || undefined
      }).subscribe({
        next: (response: any) => {
          this.loading = false;
          // Update local player data
          const updatedPlayer = this.players.find(p => p._id === playerId);
          if (updatedPlayer) {
            if (!updatedPlayer.medals) {
              updatedPlayer.medals = [];
            }
            // Push medal object with tournament info
            updatedPlayer.medals.push({
              type: medal,
              tournamentName: tournamentName?.trim() || undefined,
              awardedAt: new Date()
            });

            // Show success message with tournament name
            const medalEmoji = this.getMedalEmoji(medal);
            const tournamentInfo = tournamentName ? ` for ${tournamentName}` : '';
            this.snackBar.open(`${medalEmoji} ${medal.charAt(0).toUpperCase() + medal.slice(1)} medal awarded to ${updatedPlayer.fullName}${tournamentInfo}!`, 'Close', {
              duration: 4000,
              horizontalPosition: 'center',
              verticalPosition: 'top',
              panelClass: ['success-snackbar']
            });
          }
          // Reset form and switch to list view
          this.medalForm.reset();
          this.medalForm.patchValue({ playerId: '', medal: null, tournamentName: '' });
          this.loadPlayersWithMedals();
          this.showMedalList = true;
        },
        error: (error) => {
          this.loading = false;
          this.errorMessage = error.error?.error || 'Failed to update player medal';
          console.error('Error updating medal:', error);

          // Show error message
          this.snackBar.open(this.errorMessage, 'Close', {
            duration: 5000,
            horizontalPosition: 'center',
            verticalPosition: 'top',
            panelClass: ['error-snackbar']
          });
        }
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}

// Confirmation Dialog Component
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="confirm-dialog">
      <div class="confirm-header">
        <mat-icon class="warning-icon">warning</mat-icon>
        <h2 mat-dialog-title>{{ data.title }}</h2>
      </div>
      <mat-dialog-content class="confirm-content">
        <div class="medal-display" *ngIf="data.medalEmoji">
          <span class="medal-emoji">{{ data.medalEmoji }}</span>
        </div>
        <p>{{ data.message }}</p>
      </mat-dialog-content>
      <mat-dialog-actions class="confirm-actions">
        <button mat-stroked-button [mat-dialog-close]="false" class="cancel-btn">
          <mat-icon>close</mat-icon>
          {{ data.cancelText }}
        </button>
        <button mat-raised-button [mat-dialog-close]="true" class="confirm-btn">
          <mat-icon>delete</mat-icon>
          {{ data.confirmText }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .confirm-dialog {
      padding: 0;
    }

    .confirm-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 24px 24px 16px;
      background: linear-gradient(135deg, #fff5f5 0%, #ffebee 100%);
      border-bottom: 2px solid #ffcdd2;

      .warning-icon {
        color: #ef4444;
        font-size: 32px;
        width: 32px;
        height: 32px;
      }

      h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        color: #c62828;
      }
    }

    .confirm-content {
      padding: 24px !important;
      text-align: center;

      .medal-display {
        margin-bottom: 16px;

        .medal-emoji {
          font-size: 48px;
          line-height: 1;
          display: inline-block;
          animation: pulse 2s ease-in-out infinite;
        }
      }

      p {
        margin: 0;
        font-size: 15px;
        color: #424242;
        line-height: 1.6;
      }
    }

    .confirm-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px !important;
      background: #fafafa;
      border-top: 1px solid #e0e0e0;

      button {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
        font-size: 13px;
        padding: 0 20px;
        height: 40px;
        border-radius: 8px;
        transition: all 0.3s ease;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }

      .cancel-btn {
        color: #616161;
        border-color: #e0e0e0;

        &:hover {
          background: #f5f5f5;
          border-color: #bdbdbd;
        }
      }

      .confirm-btn {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        color: white;
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
        }

        &:active {
          transform: translateY(0);
        }
      }
    }

    @keyframes pulse {
      0%, 100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.1);
      }
    }
  `]
})
export class ConfirmDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: { title: string; message: string; medalEmoji?: string; confirmText: string; cancelText: string }) {}
}

// Edit Tournament Dialog Component
@Component({
  selector: 'app-edit-tournament-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, FormsModule],
  template: `
    <div class="edit-dialog">
      <div class="edit-header">
        <mat-icon class="edit-icon">edit</mat-icon>
        <h2 mat-dialog-title>Edit Tournament Name</h2>
      </div>
      <mat-dialog-content class="edit-content">
        <div class="medal-display">
          <span class="medal-emoji">{{ data.medalEmoji }}</span>
        </div>
        <p class="player-name">{{ data.playerName }}</p>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Tournament Name</mat-label>
          <input matInput [(ngModel)]="tournamentName" placeholder="e.g., Club Championship 2024" autofocus (keydown.enter)="onSave()">
          <mat-icon matPrefix>emoji_events</mat-icon>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions class="edit-actions">
        <button mat-stroked-button [mat-dialog-close]="null" class="cancel-btn">
          <mat-icon>close</mat-icon>
          Cancel
        </button>
        <button mat-raised-button (click)="onSave()" class="save-btn">
          <mat-icon>check</mat-icon>
          Save
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .edit-dialog {
      padding: 0;
      min-width: 400px;
    }

    .edit-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 24px 24px 16px;
      background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
      border-bottom: 2px solid #90caf9;

      .edit-icon {
        color: #1976d2;
        font-size: 28px;
        width: 28px;
        height: 28px;
      }

      h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        color: #1565c0;
      }
    }

    .edit-content {
      padding: 24px !important;
      text-align: center;

      .medal-display {
        margin-bottom: 12px;

        .medal-emoji {
          font-size: 48px;
          line-height: 1;
          display: inline-block;
        }
      }

      .player-name {
        margin: 0 0 24px;
        font-size: 16px;
        font-weight: 600;
        color: #424242;
      }

      .full-width {
        width: 100%;
      }
    }

    .edit-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px !important;
      background: #fafafa;
      border-top: 1px solid #e0e0e0;

      button {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
        font-size: 13px;
        padding: 0 20px;
        height: 40px;
        border-radius: 8px;
        transition: all 0.3s ease;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }

      .cancel-btn {
        color: #666;
        border-color: #ddd;

        &:hover:not(:disabled) {
          background: #f5f5f5;
          border-color: #999;
        }
      }

      .save-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);

        &:hover:not(:disabled) {
          box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4);
          transform: translateY(-2px);
        }
      }
    }
  `]
})
export class EditTournamentDialogComponent {
  tournamentName: string;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { medalEmoji: string; playerName: string; currentTournament: string },
    private dialogRef: MatDialogRef<EditTournamentDialogComponent>
  ) {
    this.tournamentName = data.currentTournament || '';
  }

  onSave(): void {
    this.dialogRef.close(this.tournamentName);
  }
}
