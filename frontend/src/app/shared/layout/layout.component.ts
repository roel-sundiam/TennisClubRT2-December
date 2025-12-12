import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import { PaymentAlertsComponent } from '../../components/payment-alerts/payment-alerts.component';
import { PWAInstallPromptComponent } from '../../components/pwa-install-prompt/pwa-install-prompt.component';
import { UpdateBannerComponent } from '../../components/update-banner/update-banner.component';
import { ChatWindowComponent } from '../../components/chat-window/chat-window.component';
import { ResurfacingBannerComponent } from '../../components/resurfacing-banner/resurfacing-banner.component';
import { ImpersonationBannerComponent } from '../../components/impersonation-banner/impersonation-banner.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    ToolbarComponent,
    PaymentAlertsComponent,
    PWAInstallPromptComponent,
    UpdateBannerComponent,
    ChatWindowComponent,
    ResurfacingBannerComponent,
    ImpersonationBannerComponent
  ],
  template: `
    <div class="app-layout" [class.authenticated]="isAuthenticated" [class.loading]="isAuthLoading">
      <!-- Global Toolbar (only on authenticated pages) -->
      <app-toolbar *ngIf="isAuthenticated"></app-toolbar>

      <!-- Resurfacing Banner (only on authenticated pages) -->
      <app-resurfacing-banner *ngIf="isAuthenticated && !isAuthLoading"></app-resurfacing-banner>

      <!-- Impersonation Banner (only on authenticated pages) -->
      <app-impersonation-banner *ngIf="isAuthenticated"></app-impersonation-banner>

      <!-- Update Banner (always available) -->
      <app-update-banner></app-update-banner>

      <!-- Payment Alerts (only on authenticated pages and not loading) -->
      <app-payment-alerts *ngIf="isAuthenticated && !isAuthLoading"></app-payment-alerts>

      <!-- Page Content -->
      <div class="page-container" [class.with-toolbar]="isAuthenticated">
        <router-outlet></router-outlet>
      </div>

      <!-- PWA Install Prompt (always available) -->
      <app-pwa-install-prompt></app-pwa-install-prompt>

      <!-- Chat Window (only on authenticated pages) -->
      <app-chat-window *ngIf="isAuthenticated && !isAuthLoading"></app-chat-window>
    </div>
  `,
  styleUrl: './layout.component.scss'
})
export class LayoutComponent implements OnInit {
  isAuthenticated = false;
  isAuthLoading = true;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Subscribe to authentication state
    this.authService.currentUser$.subscribe(user => {
      this.isAuthenticated = !!user;
    });

    // Subscribe to auth loading state
    this.authService.isLoading$.subscribe(isLoading => {
      this.isAuthLoading = isLoading;
    });
  }
}