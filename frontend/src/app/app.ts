import { Component, signal, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AnalyticsService } from './services/analytics.service';
import { PWANotificationService } from './services/pwa-notification.service';
import { WebSocketService } from './services/websocket.service';
import { AppUpdateService } from './services/app-update.service';
import { SessionMonitorService } from './services/session-monitor.service';
import { LayoutComponent } from './shared/layout/layout.component';

@Component({
  selector: 'app-root',
  imports: [LayoutComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('Rich Town 2 Tennis Club');

  constructor(
    private analyticsService: AnalyticsService,
    private pwaNotificationService: PWANotificationService,
    private webSocketService: WebSocketService,
    private appUpdateService: AppUpdateService,
    private sessionMonitorService: SessionMonitorService
  ) {
    console.log('🚀 App component constructor called');
    // Services will be initialized automatically
    // AnalyticsService handles page view tracking and session management
    console.log('📊 Analytics service initialized');
    // Initialize PWA notification service
    this.pwaNotificationService.init();
    console.log('📱 PWA notification service initialized');
    // Initialize app update service
    this.appUpdateService.init();
    console.log('🔄 App update service initialized');
    // WebSocket service will auto-initialize when user is authenticated
    console.log('🔌 WebSocket service initialized');
    // SessionMonitorService will auto-initialize and start monitoring when user logs in
    console.log('📊 Session monitor service initialized');
  }

  ngOnInit() {
    console.log('🚀 App component ngOnInit called');
    console.log('🚀 Current URL:', window.location.href);
    console.log('📊 Analytics session ID:', this.analyticsService.getCurrentSession());
  }
}
