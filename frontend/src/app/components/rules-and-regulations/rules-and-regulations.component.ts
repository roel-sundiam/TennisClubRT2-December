import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-rules-and-regulations',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="rules-page">
      <button mat-icon-button class="back-button" (click)="goBack()">
        <mat-icon>arrow_back</mat-icon>
      </button>
      <div class="image-wrapper">
        <img src="rules-and-regulations.png" alt="Rich Town 2 Tennis Club Rules and Regulations" />
      </div>
    </div>
  `,
  styleUrl: './rules-and-regulations.component.scss'
})
export class RulesAndRegulationsComponent {
  constructor(private router: Router) {}

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}