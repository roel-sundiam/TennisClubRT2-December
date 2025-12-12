import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatRadioModule } from '@angular/material/radio';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { PlayerManagementDialogComponent } from '../player-management-dialog/player-management-dialog.component';
import { MedalAssignmentDialogComponent } from '../medal-assignment-dialog/medal-assignment-dialog.component';

interface Tournament {
  _id: string;
  name: string;
  date: string;
  createdBy: any;
  matches: TournamentMatch[];
  status: 'draft' | 'completed';
  totalMatches: number;
  createdAt: string;
  updatedAt: string;
}

interface TournamentMatch {
  matchType: 'singles' | 'doubles';
  // Singles fields
  player1?: string;
  player2?: string;
  player1Name?: string;
  player2Name?: string;
  // Doubles fields
  team1Player1?: string;
  team1Player2?: string;
  team2Player1?: string;
  team2Player2?: string;
  team1Player1Name?: string;
  team1Player2Name?: string;
  team2Player1Name?: string;
  team2Player2Name?: string;
  // Common fields
  score: string;
  winner: string;
  round: string;
  player1Games?: number;
  player2Games?: number;
  team1Games?: number;
  team2Games?: number;
  pointsProcessed: boolean;
}

interface Player {
  _id: string;
  fullName: string;
  email?: string;
  seedPoints?: number;
  isActive?: boolean;
  medals?: ('gold' | 'silver' | 'bronze')[];
}

@Component({
  selector: 'app-tournament-management',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatToolbarModule,
    MatExpansionModule,
    MatTooltipModule,
    MatChipsModule,
    MatRadioModule
  ],
  templateUrl: './tournament-management.component.html',
  styleUrls: ['./tournament-management.component.scss']
})
export class TournamentManagementComponent implements OnInit {
  tournaments: Tournament[] = [];
  players: Player[] = [];
  loading = false;
  showCreateForm = false;
  editingTournament: Tournament | null = null;
  tournamentForm!: FormGroup;
  displayedColumns: string[] = ['name', 'date', 'matches', 'status', 'actions'];
  debugData: any = null;
  showDebug = true;

  constructor(
    private http: HttpClient,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private authService: AuthService,
    private router: Router,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadPlayers();
    this.loadTournaments();
  }

  initForm(): void {
    this.tournamentForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      date: ['', Validators.required],
      matches: this.fb.array([])
    });
  }

  get matches(): FormArray {
    return this.tournamentForm.get('matches') as FormArray;
  }

  createMatchFormGroup(): FormGroup {
    const group = this.fb.group({
      matchType: ['singles', Validators.required],
      // Singles fields
      player1: [''],
      player2: [''],
      // Doubles fields
      team1Player1: [''],
      team1Player2: [''],
      team2Player1: [''],
      team2Player2: [''],
      // Common fields
      score: ['8-6', [Validators.required, Validators.pattern(/^\d+\s*-\s*\d+$/)]],
      winner: ['', Validators.required],
      round: ['Elimination', Validators.required],
      pointsProcessed: [false]
    });

    // Add conditional validators based on match type
    group.get('matchType')?.valueChanges.subscribe(matchType => {
      if (matchType === 'singles') {
        // Singles: require player1 and player2
        group.get('player1')?.setValidators([Validators.required]);
        group.get('player2')?.setValidators([Validators.required]);
        // Doubles: clear validators
        group.get('team1Player1')?.clearValidators();
        group.get('team1Player2')?.clearValidators();
        group.get('team2Player1')?.clearValidators();
        group.get('team2Player2')?.clearValidators();
      } else {
        // Doubles: require all 4 team players
        group.get('team1Player1')?.setValidators([Validators.required]);
        group.get('team1Player2')?.setValidators([Validators.required]);
        group.get('team2Player1')?.setValidators([Validators.required]);
        group.get('team2Player2')?.setValidators([Validators.required]);
        // Singles: clear validators
        group.get('player1')?.clearValidators();
        group.get('player2')?.clearValidators();
      }

      // Update validity for all player fields
      group.get('player1')?.updateValueAndValidity();
      group.get('player2')?.updateValueAndValidity();
      group.get('team1Player1')?.updateValueAndValidity();
      group.get('team1Player2')?.updateValueAndValidity();
      group.get('team2Player1')?.updateValueAndValidity();
      group.get('team2Player2')?.updateValueAndValidity();
    });

    // Trigger initial validation for singles (default)
    group.get('player1')?.setValidators([Validators.required]);
    group.get('player2')?.setValidators([Validators.required]);
    group.get('player1')?.updateValueAndValidity();
    group.get('player2')?.updateValueAndValidity();

    return group;
  }

  addMatch(): void {
    this.matches.push(this.createMatchFormGroup());
  }

  removeMatch(index: number): void {
    this.matches.removeAt(index);
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

  loadTournaments(): void {
    this.loading = true;
    this.http.get<any>(`${environment.apiUrl}/tournaments`)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.tournaments = response.data;
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading tournaments:', error);
          this.snackBar.open('Failed to load tournaments', 'Close', { duration: 3000 });
          this.loading = false;
        }
      });
  }

  toggleCreateForm(): void {
    this.showCreateForm = !this.showCreateForm;
    this.editingTournament = null;
    if (this.showCreateForm && this.matches.length === 0) {
      this.addMatch(); // Add one match by default
    }
  }

  editTournament(tournament: Tournament): void {
    this.editingTournament = tournament;
    this.showCreateForm = true;

    // Clear existing matches
    while (this.matches.length > 0) {
      this.matches.removeAt(0);
    }

    // Populate form with tournament data
    this.tournamentForm.patchValue({
      name: tournament.name,
      date: new Date(tournament.date)
    });

    // Add existing matches to form
    tournament.matches.forEach(match => {
      const matchGroup = this.createMatchFormGroup();
      matchGroup.patchValue({
        matchType: match.matchType,
        player1: this.extractId(match.player1),
        player2: this.extractId(match.player2),
        team1Player1: this.extractId(match.team1Player1),
        team1Player2: this.extractId(match.team1Player2),
        team2Player1: this.extractId(match.team2Player1),
        team2Player2: this.extractId(match.team2Player2),
        score: match.score,
        winner: match.winner,
        round: match.round,
        pointsProcessed: match.pointsProcessed || false
      });
      this.matches.push(matchGroup);
    });

    // If no matches, add one empty match
    if (this.matches.length === 0) {
      this.addMatch();
    }
  }

  // Helper function to extract ID from value (handles both strings and populated objects)
  private extractId(value: any): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value._id) return value._id;
    return '';
  }

  createTournament(): void {
    if (this.tournamentForm.invalid) {
      this.snackBar.open('Please fill all required fields correctly', 'Close', { duration: 3000 });
      return;
    }

    this.loading = true;
    const formValue = this.tournamentForm.value;

    try {
      const isEditing = this.editingTournament !== null;

      // Validate and clean up matches
      const cleanedMatches = formValue.matches.map((match: any, index: number) => {
        const matchType = match.matchType || 'singles';

        const cleanedMatch: any = {
          matchType: matchType,
          score: match.score,
          winner: match.winner,
          round: match.round,
          pointsProcessed: match.pointsProcessed || false
        };

        if (matchType === 'singles') {
          // Validate singles fields - all players must be selected
          if (!match.player1 || !match.player2) {
            throw new Error(`Match ${index + 1}: Please select both players from the registry`);
          }

          cleanedMatch.player1 = this.extractId(match.player1);
          cleanedMatch.player2 = this.extractId(match.player2);
        } else {
          // Validate doubles fields - all 4 players must be selected
          if (!match.team1Player1 || !match.team1Player2 || !match.team2Player1 || !match.team2Player2) {
            throw new Error(`Match ${index + 1}: Please select all 4 players from the registry`);
          }

          cleanedMatch.team1Player1 = this.extractId(match.team1Player1);
          cleanedMatch.team1Player2 = this.extractId(match.team1Player2);
          cleanedMatch.team2Player1 = this.extractId(match.team2Player1);
          cleanedMatch.team2Player2 = this.extractId(match.team2Player2);
        }

        return cleanedMatch;
      });

      const tournamentData = {
        name: formValue.name,
        date: formValue.date,
        matches: cleanedMatches
      };

      // Set debug data for UI display
      this.debugData = {
        tournament: tournamentData,
        rawFormValue: formValue,
        timestamp: new Date().toISOString()
      };

      const url = isEditing
        ? `${environment.apiUrl}/tournaments/${this.editingTournament!._id}`
        : `${environment.apiUrl}/tournaments`;
      const method = isEditing ? 'put' : 'post';

      console.log(`${isEditing ? 'Updating' : 'Creating'} tournament with data:`, tournamentData);

      this.http.request<any>(method, url, { body: tournamentData })
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.snackBar.open(
                `Tournament ${isEditing ? 'updated' : 'created'} successfully!`,
                'Close',
                { duration: 3000 }
              );
              this.loadTournaments();
              this.resetForm();
              this.showCreateForm = false;
              this.editingTournament = null;
            }
            this.loading = false;
          },
          error: (error) => {
            console.error(`Error ${isEditing ? 'updating' : 'creating'} tournament:`, error);
            const errorMsg = error.error?.error || `Failed to ${isEditing ? 'update' : 'create'} tournament`;
            this.snackBar.open(errorMsg, 'Close', { duration: 5000 });
            this.loading = false;
          }
        });
    } catch (error: any) {
      this.loading = false;
      this.snackBar.open(error.message || 'Validation error', 'Close', { duration: 5000 });
    }
  }

  processPoints(tournamentId: string): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Process Tournament Points',
        message: 'Are you sure you want to process points for this tournament? This action will award points to all players based on their match results.',
        confirmText: 'Process Points',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;

      this.loading = true;
      this.http.post<any>(`${environment.apiUrl}/tournaments/${tournamentId}/process-points`, {})
        .subscribe({
          next: (response) => {
            if (response.success) {
              const msg = `${response.message}. Processed: ${response.data.processed} matches`;
              this.snackBar.open(msg, 'Close', { duration: 5000 });
              this.loadTournaments();
            }
            this.loading = false;
          },
          error: (error) => {
            console.error('Error processing points:', error);
            const errorMsg = error.error?.error || 'Failed to process points';
            this.snackBar.open(errorMsg, 'Close', { duration: 5000 });
            this.loading = false;
          }
        });
    });
  }

  deleteTournament(tournamentId: string): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Tournament',
        message: 'Are you sure you want to delete this tournament? This action cannot be undone and all match data will be permanently removed.',
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;

      this.loading = true;
      this.http.delete<any>(`${environment.apiUrl}/tournaments/${tournamentId}`)
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.snackBar.open('Tournament deleted successfully', 'Close', { duration: 3000 });
              this.loadTournaments();
            }
            this.loading = false;
          },
          error: (error) => {
            console.error('Error deleting tournament:', error);
            const errorMsg = error.error?.error || error.error?.suggestion || 'Failed to delete tournament';
            this.snackBar.open(errorMsg, 'Close', { duration: 5000 });
            this.loading = false;
          }
        });
    });
  }

  resetForm(): void {
    this.tournamentForm.reset();
    this.editingTournament = null;
    while (this.matches.length > 0) {
      this.matches.removeAt(0);
    }
    this.addMatch(); // Add one default match
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  getPlayerName(playerId: string): string {
    const player = this.players.find(p => p._id === playerId);
    return player ? player.fullName : 'Unknown';
  }

  getMatchPreview(match: any): string {
    if (!match) return '';

    const matchType = match.get('matchType')?.value || 'singles';

    if (matchType === 'doubles') {
      const t1p1 = match.get('team1Player1')?.value;
      const t1p2 = match.get('team1Player2')?.value;
      const t2p1 = match.get('team2Player1')?.value;
      const t2p2 = match.get('team2Player2')?.value;

      if (t1p1 && t1p2 && t2p1 && t2p2) {
        return `${this.getPlayerName(t1p1)}/${this.getPlayerName(t1p2)} vs ${this.getPlayerName(t2p1)}/${this.getPlayerName(t2p2)}`;
      }
    } else {
      const p1 = match.get('player1')?.value;
      const p2 = match.get('player2')?.value;

      if (p1 && p2) {
        return `${this.getPlayerName(p1)} vs ${this.getPlayerName(p2)}`;
      }
    }

    return '';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  getMatchesByRound(matches: TournamentMatch[]): Record<string, number> {
    const roundCounts: Record<string, number> = {};

    matches.forEach(match => {
      const round = match.round || 'Unknown';
      roundCounts[round] = (roundCounts[round] || 0) + 1;
    });

    return roundCounts;
  }

  openPlayerManagement(): void {
    const dialogRef = this.dialog.open(PlayerManagementDialogComponent, {
      width: '900px',
      maxHeight: '90vh',
      disableClose: false
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Reload players list after dialog closes
        this.loadPlayers();
      }
    });
  }

  openMedalAssignment(): void {
    const dialogRef = this.dialog.open(MedalAssignmentDialogComponent, {
      width: '600px',
      maxHeight: '90vh',
      disableClose: false,
      data: { players: this.players }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadPlayers();
        this.snackBar.open('Player medal updated successfully', 'Close', { duration: 3000 });
      }
    });
  }
}
