import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

interface ContributionStats {
  pledged: { count: number; amount: number };
  received: { count: number; amount: number };
  cancelled: { count: number; amount: number };
  overall: { count: number; amount: number };
}

@Component({
  selector: 'app-resurfacing-banner',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatDialogModule],
  templateUrl: './resurfacing-banner.component.html',
  styleUrls: ['./resurfacing-banner.component.scss']
})
export class ResurfacingBannerComponent implements OnInit {
  stats: ContributionStats | null = null;
  goalAmount = 400000; // ₱400,000 goal

  constructor(
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.http.get<any>(`${environment.apiUrl}/resurfacing/public-stats`).subscribe({
      next: (response) => {
        this.stats = response.data;
      },
      error: (error) => {
        console.error('❌ Error loading stats for banner:', error);
      }
    });
  }

  navigateToContributions(): void {
    this.router.navigate(['/resurfacing-contributions']);
  }

  formatCurrency(amount: number): string {
    return `₱${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
}
