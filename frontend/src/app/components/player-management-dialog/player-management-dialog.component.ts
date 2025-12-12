import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

interface Player {
  _id: string;
  fullName: string;
  email?: string;
  phone?: string;
  gender?: 'male' | 'female' | 'other';
  seedPoints?: number;
  matchesWon?: number;
  matchesPlayed?: number;
  isActive?: boolean;
}

@Component({
  selector: 'app-player-management-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './player-management-dialog.component.html',
  styleUrls: ['./player-management-dialog.component.scss']
})
export class PlayerManagementDialogComponent implements OnInit {
  players: Player[] = [];
  playerForm!: FormGroup;
  loading = false;
  showForm = false;
  editingPlayer: Player | null = null;
  displayedColumns: string[] = ['fullName', 'email', 'phone', 'gender', 'stats', 'actions'];

  constructor(
    private dialogRef: MatDialogRef<PlayerManagementDialogComponent>,
    private http: HttpClient,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadPlayers();
  }

  initForm(): void {
    this.playerForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.email]],
      phone: [''],
      gender: ['']
    });
  }

  loadPlayers(): void {
    this.loading = true;
    this.http.get<any>(`${environment.apiUrl}/players?limit=1000`)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.players = response.data.filter((p: Player) => p.isActive !== false);
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading players:', error);
          this.snackBar.open('Failed to load players', 'Close', { duration: 3000 });
          this.loading = false;
        }
      });
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (!this.showForm) {
      this.editingPlayer = null;
      this.playerForm.reset();
    }
  }

  editPlayer(player: Player): void {
    this.editingPlayer = player;
    this.showForm = true;
    this.playerForm.patchValue({
      fullName: player.fullName,
      email: player.email || '',
      phone: player.phone || '',
      gender: player.gender || ''
    });
  }

  savePlayer(): void {
    if (this.playerForm.invalid) {
      this.snackBar.open('Please fill all required fields correctly', 'Close', { duration: 3000 });
      return;
    }

    this.loading = true;
    const playerData = this.playerForm.value;

    const request = this.editingPlayer
      ? this.http.put<any>(`${environment.apiUrl}/players/${this.editingPlayer._id}`, playerData)
      : this.http.post<any>(`${environment.apiUrl}/players`, playerData);

    request.subscribe({
      next: (response) => {
        if (response.success) {
          this.snackBar.open(
            `Player ${this.editingPlayer ? 'updated' : 'created'} successfully!`,
            'Close',
            { duration: 3000 }
          );
          this.loadPlayers();
          this.toggleForm();
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error saving player:', error);
        const errorMsg = error.error?.error || `Failed to ${this.editingPlayer ? 'update' : 'create'} player`;
        this.snackBar.open(errorMsg, 'Close', { duration: 5000 });
        this.loading = false;
      }
    });
  }

  deletePlayer(player: Player): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Player',
        message: `Are you sure you want to delete ${player.fullName}? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;

      this.loading = true;
      this.http.delete<any>(`${environment.apiUrl}/players/${player._id}`)
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.snackBar.open('Player deleted successfully', 'Close', { duration: 3000 });
              this.loadPlayers();
            }
            this.loading = false;
          },
          error: (error) => {
            console.error('Error deleting player:', error);
            const errorMsg = error.error?.error || 'Failed to delete player';
            this.snackBar.open(errorMsg, 'Close', { duration: 5000 });
            this.loading = false;
          }
        });
    });
  }

  close(): void {
    this.dialogRef.close(true);
  }
}
