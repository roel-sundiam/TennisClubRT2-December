import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { Router } from '@angular/router';

@Component({
  selector: 'app-rules-and-regulations',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule
  ],
  template: `
    <div class="rules-container">
      <div class="header-section">
        <button mat-icon-button (click)="goBack()" class="back-button">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h1 class="page-title">
          <mat-icon class="title-icon">gavel</mat-icon>
          Rules and Regulations
        </h1>
      </div>

      <!-- Tennis Court Rules -->
      <mat-card class="rules-card">
        <mat-card-header>
          <mat-icon mat-card-avatar class="section-icon">sports_tennis</mat-icon>
          <mat-card-title>Rich Town 2 Tennis Club</mat-card-title>
          <mat-card-subtitle>Court Usage and General Rules</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="rules-section">
            <div class="rule-item">
              <mat-icon class="rule-icon">schedule</mat-icon>
              <div class="rule-content">
                <h3>Reservation Policy</h3>
                <p>Reservation is on per schedule basis. Only members are allowed to reserve the tennis court.</p>
              </div>
            </div>

            <div class="rule-item">
              <mat-icon class="rule-icon">person_pin</mat-icon>
              <div class="rule-content">
                <h3>Member Presence</h3>
                <p>Member who reserved the court must be present or playing inside the court. Gate will be open for you on your scheduled time.</p>
              </div>
            </div>

            <div class="rule-item">
              <mat-icon class="rule-icon">payment</mat-icon>
              <div class="rule-content">
                <h3>Payment Policy</h3>
                <p><strong>Play first, pay after.</strong> Payment button is enabled after your reservation time passes.</p>
                <h4>Court Fees (Per Hour)</h4>
                <ul>
                  <li><strong>Peak Hours</strong> (5AM, 6PM, 7PM, 8PM, 9PM): ₱150 base fee</li>
                  <li><strong>Non-Peak Hours</strong>: ₱100 base fee</li>
                  <li><strong>Guest Fee</strong>: ₱70 per guest (added to reserver's payment)</li>
                </ul>
                <p class="fee-note"><mat-icon class="inline-icon">info</mat-icon> Base fee is split equally among all members. Only the reserver pays for guests.</p>
              </div>
            </div>

            <div class="rule-item">
              <mat-icon class="rule-icon">cancel</mat-icon>
              <div class="rule-content">
                <h3>Cancellation Policy</h3>
                <p>Cancellation/reservation must be communicated through group chat.</p>
                <ul>
                  <li>Cancellation should be made at least 12 hours before the schedule</li>
                  <li>Immediate cancellation will be charged ₱100</li>
                </ul>
              </div>
            </div>

            <div class="rule-item">
              <mat-icon class="rule-icon">block</mat-icon>
              <div class="rule-content">
                <h3>Non-Payment Consequences</h3>
                <p>Non-payment for 3 times will result in denial of playing inside the court and will not be given any schedule.</p>
              </div>
            </div>

            <div class="rule-item">
              <mat-icon class="rule-icon">home</mat-icon>
              <div class="rule-content">
                <h3>Property Respect</h3>
                <p>Rich Town 2 Club property is to be respected at all times.</p>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Footer -->
      <div class="footer-section">
        <p class="footer-text">
          <mat-icon>info</mat-icon>
          These rules are subject to updates and amendments by club management. 
          Members will be notified of any changes through official communications.
        </p>
        <button mat-raised-button color="primary" (click)="goBack()">
          <mat-icon>arrow_back</mat-icon>
          Back to Dashboard
        </button>
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