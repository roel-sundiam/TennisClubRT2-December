import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { BehaviorSubject, Observable, filter, map, debounceTime, takeUntil } from 'rxjs';
import { AuthService } from './auth.service';
import { AnalyticsPageView, AnalyticsUserActivity, AnalyticsStats } from '../../../../shared/types';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private apiUrl = environment.apiUrl;
  private sessionId: string;
  private pageStartTime: number = 0;
  private currentPage: string = '';
  private currentPath: string = '';
  private isTrackingEnabled = true;
  
  // Session management
  private sessionSubject = new BehaviorSubject<string>('');
  public session$ = this.sessionSubject.asObservable();

  // Page mapping for friendly names
  private pageMapping: Record<string, string> = {
    '/calendar': 'Court Calendar',
    '/dashboard': 'Dashboard',
    '/reservations': 'Reserve Court',
    '/my-reservations': 'My Reservations',
    '/payments': 'Payments',
    '/profile': 'Profile',
    '/members': 'Members Directory',
    '/members/*': 'Member Profile',
    '/polls': 'Polls & Voting',
    '/credits': 'Credits',
    '/credit-topup': 'Credit Top-Up',
    '/credit-history': 'Credit History',
    '/rankings': 'Rankings',
    '/weather': 'Weather',
    '/suggestions': 'Suggestions',
    '/rules': 'Club Rules',
    '/gallery': 'Gallery',
    '/court-usage-report': 'Court Usage Report',
    '/resurfacing-contributions': 'Resurfacing Contributions',
    '/admin/members': 'Admin - Members',
    '/admin/payments': 'Admin - Payments',
    '/admin/credits': 'Admin - Credits',
    '/admin/suggestions': 'Admin - Suggestions',
    '/admin/reports': 'Admin - Reports',
    '/admin/analytics': 'Admin - Analytics',
    '/admin/polls': 'Admin - Polls',
    '/admin/gallery-upload': 'Admin - Gallery Upload',
    '/admin/financial-report': 'Admin - Financial Report',
    '/admin/expense-report': 'Admin - Expense Report',
    '/admin/manual-court-usage': 'Admin - Manual Court Usage',
    '/admin/block-court': 'Admin - Block Court',
    '/admin/membership-payments': 'Admin - Membership Payments',
    '/admin/tournaments': 'Admin - Tournaments',
    '/admin/resurfacing-contributions': 'Admin - Resurfacing',
    '/admin/announcements': 'Admin - Announcements',
    '/admin/settings': 'Admin - Settings',
    '/admin/superadmin-dashboard': 'Superadmin Dashboard',
    '/login': 'Login',
    '/register': 'Registration'
  };

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService
  ) {
    this.sessionId = this.generateSessionId();
    this.sessionSubject.next(this.sessionId);
    
    // Initialize session tracking
    this.initializeSession();
    
    // Track route changes
    this.trackRouteChanges();
    
    // Track page visibility changes
    this.trackPageVisibility();
    
    // Track window beforeunload
    this.trackWindowUnload();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }


  private initializeSession(): void {
    if (!this.isTrackingEnabled) return;

    const userId = this.authService.currentUser?._id;
    
    this.http.post(`${this.apiUrl}/analytics/session/start`, {
      sessionId: this.sessionId,
      userId
    }).subscribe({
      next: () => {
        console.log('📊 Analytics session started:', this.sessionId);
      },
      error: (error) => {
        console.warn('⚠️ Failed to start analytics session:', error);
      }
    });
  }

  private trackRouteChanges(): void {
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        map(event => event as NavigationEnd)
      )
      .subscribe((event: NavigationEnd) => {
        // Send previous page duration if available
        if (this.currentPage && this.pageStartTime > 0) {
          const duration = Date.now() - this.pageStartTime;
          this.trackPageView(this.currentPage, this.currentPath, undefined, duration);
        }

        // Update current page info
        this.currentPath = event.urlAfterRedirects;
        this.currentPage = this.getPageName(this.currentPath);
        this.pageStartTime = Date.now();

        // Track new page view
        setTimeout(() => {
          this.trackPageView(this.currentPage, this.currentPath, document.referrer);
        }, 100);
      });
  }

  private trackPageVisibility(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Page is now hidden, track the duration
        if (this.currentPage && this.pageStartTime > 0) {
          const duration = Date.now() - this.pageStartTime;
          this.trackPageView(this.currentPage, this.currentPath, undefined, duration);
        }
      } else {
        // Page is now visible, reset start time
        this.pageStartTime = Date.now();
      }
    });
  }

  private trackWindowUnload(): void {
    window.addEventListener('beforeunload', () => {
      if (this.currentPage && this.pageStartTime > 0) {
        const duration = Date.now() - this.pageStartTime;
        // Use sendBeacon for reliable tracking on page unload
        this.trackPageViewBeacon(this.currentPage, this.currentPath, undefined, duration);
      }
      this.endSession();
    });
  }

  private getPageName(path: string): string {
    // Remove query parameters and fragments
    const cleanPath = path.split('?')[0].split('#')[0];
    
    // Check exact matches first
    if (this.pageMapping[cleanPath]) {
      return this.pageMapping[cleanPath];
    }
    
    // Check for dynamic routes
    for (const [pattern, name] of Object.entries(this.pageMapping)) {
      if (cleanPath.startsWith(pattern.replace('*', ''))) {
        return name;
      }
    }
    
    // Default to path if no mapping found
    return cleanPath || 'Unknown Page';
  }

  // Public methods for tracking

  trackPageView(page: string, path: string, referrer?: string, duration?: number): void {
    if (!this.isTrackingEnabled || !this.sessionId) return;

    const userId = this.authService.currentUser?._id;
    
    const pageViewData: AnalyticsPageView = {
      userId,
      sessionId: this.sessionId,
      page,
      path,
      referrer,
      duration
    };

    this.http.post(`${this.apiUrl}/analytics/pageview`, pageViewData).subscribe({
      next: () => {
        // Optional: Log successful tracking in development
        if (!isProduction) {
          console.log('📊 Page view tracked:', page);
        }
      },
      error: (error) => {
        console.warn('⚠️ Failed to track page view:', error);
      }
    });
  }

  private trackPageViewBeacon(page: string, path: string, referrer?: string, duration?: number): void {
    if (!this.isTrackingEnabled || !this.sessionId) return;
    
    const userId = this.authService.currentUser?._id;
    
    const pageViewData: AnalyticsPageView = {
      userId,
      sessionId: this.sessionId,
      page,
      path,
      referrer,
      duration
    };

    // Use sendBeacon for reliable tracking during page unload
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(pageViewData)], { type: 'application/json' });
      navigator.sendBeacon(`${this.apiUrl}/analytics/pageview`, blob);
    }
  }

  trackUserActivity(action: string, component: string, details?: any): void {
    if (!this.isTrackingEnabled || !this.sessionId) return;

    const userId = this.authService.currentUser?._id;
    if (!userId) return; // Only track activities for logged-in users

    const activityData: AnalyticsUserActivity = {
      userId,
      sessionId: this.sessionId,
      action,
      component,
      details
    };

    this.http.post(`${this.apiUrl}/analytics/activity`, activityData).subscribe({
      next: () => {
        // Optional: Log successful tracking in development
        if (!isProduction) {
          console.log('📊 User activity tracked:', action, component);
        }
      },
      error: (error) => {
        console.warn('⚠️ Failed to track user activity:', error);
      }
    });
  }

  // Convenience methods for common actions
  trackLogin(username: string): void {
    this.trackUserActivity('login', 'auth', { username });
  }

  trackLogout(): void {
    this.trackUserActivity('logout', 'auth');
    this.endSession();
  }

  trackFormSubmit(formName: string, details?: any): void {
    this.trackUserActivity('form_submit', formName, details);
  }

  trackButtonClick(buttonName: string, component: string, details?: any): void {
    this.trackUserActivity('click_button', component, { button: buttonName, ...details });
  }

  trackNavigation(from: string, to: string): void {
    this.trackUserActivity('navigation', 'router', { from, to });
  }

  trackSearch(query: string, component: string, results?: number): void {
    this.trackUserActivity('search', component, { query, results });
  }

  trackFilter(filterType: string, filterValue: any, component: string): void {
    this.trackUserActivity('filter', component, { filterType, filterValue });
  }

  trackDownload(fileName: string, fileType: string, component: string): void {
    this.trackUserActivity('download', component, { fileName, fileType });
  }

  // Admin methods for retrieving analytics data
  getAnalyticsDashboard(dateFrom?: Date, dateTo?: Date, period?: string): Observable<AnalyticsStats> {
    console.log('📊 Getting analytics dashboard data...');
    console.log('📊 Auth service token available:', !!this.authService.token);
    console.log('📊 Current user available:', !!this.authService.currentUser);
    
    const params: any = {};
    if (dateFrom) params.dateFrom = dateFrom.toISOString();
    if (dateTo) params.dateTo = dateTo.toISOString();
    if (period) params.period = period;

    // Let the HTTP interceptor handle authentication automatically
    return this.http.get<{ success: boolean; data: AnalyticsStats }>(`${this.apiUrl}/analytics/dashboard`, { params })
      .pipe(map(response => response.data));
  }

  getActivityHistory(filters?: {
    page?: number;
    limit?: number;
    userId?: string;
    action?: string;
    component?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Observable<any> {
    const params: any = {};
    if (filters) {
      Object.keys(filters).forEach(key => {
        const value = filters[key as keyof typeof filters];
        if (value !== undefined && value !== null) {
          if (value instanceof Date) {
            params[key] = value.toISOString();
          } else {
            params[key] = value.toString();
          }
        }
      });
    }

    // Let the HTTP interceptor handle authentication automatically
    return this.http.get<{ success: boolean; data: any; pagination: any }>(`${this.apiUrl}/analytics/activity-history`, { params })
      .pipe(map(response => ({ data: response.data, pagination: response.pagination })));
  }

  // Session management
  endSession(): void {
    if (!this.sessionId) return;

    this.http.post(`${this.apiUrl}/analytics/session/end`, {
      sessionId: this.sessionId
    }).subscribe({
      next: () => {
        console.log('📊 Analytics session ended');
      },
      error: (error) => {
        console.warn('⚠️ Failed to end analytics session:', error);
      }
    });
  }

  // Control methods
  enableTracking(): void {
    this.isTrackingEnabled = true;
  }

  disableTracking(): void {
    this.isTrackingEnabled = false;
  }

  isTrackingActive(): boolean {
    return this.isTrackingEnabled;
  }

  getCurrentSession(): string {
    return this.sessionId;
  }
}

// Check if we're in production (simple check)
const isProduction = window.location.hostname !== 'localhost';