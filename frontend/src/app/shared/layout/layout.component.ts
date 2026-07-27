import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AnnouncementService } from '../../services/announcement.service';
import { WebSocketService } from '../../services/websocket.service';
import { ModalManagerService } from '../../services/modal-manager.service';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import { PaymentAlertsComponent } from '../../components/payment-alerts/payment-alerts.component';
import { PWAInstallPromptComponent } from '../../components/pwa-install-prompt/pwa-install-prompt.component';
import { UpdateBannerComponent } from '../../components/update-banner/update-banner.component';
import { ChatWindowComponent } from '../../components/chat-window/chat-window.component';
// import { ResurfacingBannerComponent } from '../../components/resurfacing-banner/resurfacing-banner.component'; // HIDDEN
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
    // ResurfacingBannerComponent, // HIDDEN
    ImpersonationBannerComponent
  ],
  template: `
    <div class="app-layout" [class.authenticated]="isAuthenticated" [class.loading]="isAuthLoading">
      <!-- Global Toolbar (only on authenticated pages) -->
      <app-toolbar *ngIf="isAuthenticated"></app-toolbar>

      <!-- Resurfacing Banner (only on authenticated pages) -->
      <!-- HIDDEN: uncomment to re-enable the banner -->
      <!-- <app-resurfacing-banner *ngIf="isAuthenticated && !isAuthLoading"></app-resurfacing-banner> -->

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
    private router: Router,
    private announcementService: AnnouncementService,
    private webSocketService: WebSocketService,
    private modalManager: ModalManagerService
  ) {
    // Set up WebSocket service reference to announcement service
    this.webSocketService.setAnnouncementService(this.announcementService);
  }

  ngOnInit(): void {
    // Subscribe to authentication state
    this.authService.currentUser$.subscribe(user => {
      this.isAuthenticated = !!user;

      // Load active announcements when user logs in
      if (user && !this.isAuthLoading) {
        this.loadActiveAnnouncements();
      }
    });

    // Subscribe to auth loading state
    this.authService.isLoading$.subscribe(isLoading => {
      this.isAuthLoading = isLoading;

      // Load announcements when auth loading completes and user is authenticated
      if (!isLoading && this.isAuthenticated) {
        this.loadActiveAnnouncements();
      }
    });

    // Subscribe to new announcements from WebSocket
    this.announcementService.newAnnouncement$.subscribe(announcement => {
      if (announcement && this.isAuthenticated) {
        console.log('📢 Layout: Received new announcement:', announcement.title);
        this.modalManager.showAnnouncementModal(announcement);
      }
    });
  }

  /**
   * Load active announcements (not dismissed by current user)
   * This handles the case where user was offline when announcements were created
   */
  private loadActiveAnnouncements(): void {
    this.announcementService.loadActiveAnnouncements().subscribe({
      next: (response) => {
        if (response.success && response.data && Array.isArray(response.data)) {
          console.log('📢 Layout: Loaded active announcements:', response.data.length);

          // Show first unread announcement if any exist
          if (response.data.length > 0) {
            // Show first announcement immediately
            this.modalManager.showAnnouncementModal(response.data[0]);

            // Queue remaining announcements
            for (let i = 1; i < response.data.length; i++) {
              this.modalManager.showAnnouncementModal(response.data[i]);
            }
          }
        }
      },
      error: (error) => {
        console.error('📢 Layout: Error loading active announcements:', error);
      }
    });
  }
}