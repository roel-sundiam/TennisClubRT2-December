import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { AuthService } from '../../services/auth.service';
import { AnalyticsService } from '../../services/analytics.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' }))
      ])
    ])
  ],
  template: `
    <div class="login-container">
      <!-- Left Panel - How It Works -->
      <div class="info-panel">
        <div class="info-header">
          <div class="logo-section">
            <div class="logo-icon">
              <img src="/rich-town-2-tennis-logo.png" alt="Rich Town 2 Tennis Club Logo" class="logo-image">
            </div>
            <div>
              <h1 class="app-title">Rich Town 2 Tennis Club</h1>
              <p class="app-tagline">Modern Court Reservation System</p>
            </div>
          </div>
        </div>
        
        <div class="features-section">
          <h2 class="features-title">How It Works</h2>
          <div class="features-subtitle">
            <p>Join our competitive tennis community with rankings, open court play, and professional court management</p>
          </div>
          
          <div class="feature-item">
            <div class="feature-icon">
              <i class="pi pi-calendar-plus"></i>
            </div>
            <div class="feature-content">
              <h3>Reserve Courts</h3>
              <p>Book tennis courts with flexible scheduling. Choose from available time slots between 5 AM - 10 PM.</p>
            </div>
          </div>
          
          <div class="feature-item">
            <div class="feature-icon">
              <i class="pi pi-trophy"></i>
            </div>
            <div class="feature-content">
              <h3>Open Court & Rankings</h3>
              <p>Participate in open court sessions, earn points from competitive matches, and climb the seeding rankings. Build your tennis reputation!</p>
            </div>
          </div>

          <div class="feature-item">
            <div class="feature-icon">
              <i class="pi pi-users"></i>
            </div>
            <div class="feature-content">
              <h3>Member Community</h3>
              <p>Join our approved tennis club community. Connect with players and improve your ranking together.</p>
            </div>
          </div>
          
          <div class="feature-item">
            <div class="feature-icon">
              <i class="pi pi-credit-card"></i>
            </div>
            <div class="feature-content">
              <h3>Easy Payments</h3>
              <p>Handle membership fees and court bookings seamlessly. Peak hours ₱100, off-peak ₱20 per player.</p>
            </div>
          </div>
          
          <div class="feature-item">
            <div class="feature-icon">
              <i class="pi pi-cloud"></i>
            </div>
            <div class="feature-content">
              <h3>Weather Integration</h3>
              <p>Get real-time weather updates for Delapaz Norte, San Fernando, Pampanga before your game.</p>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Right Panel - Login Form -->
      <div class="login-panel">
        <div class="login-card">
          <div class="card-header">
            <div class="header-icon">
              <i class="pi pi-sign-in"></i>
            </div>
            <div class="header-text">
              <h2 class="login-title">Welcome Back</h2>
              <p class="login-subtitle">Please sign in to your account</p>
            </div>
          </div>
          
          <div class="card-content">
            <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="login-form" novalidate>
              
              <!-- Username Field -->
              <div class="field">
                <label for="username" class="field-label">Username</label>
                <div class="input-icon-wrapper">
                  <input 
                    type="text"
                    id="username"
                    formControlName="username" 
                    placeholder="Enter your username"
                    class="modern-input"
                    autocomplete="username"
                    [class.invalid]="false">
                  <i class="pi pi-user input-icon"></i>
                </div>
              </div>
              
              <!-- Password Field -->
              <div class="field">
                <label for="password" class="field-label">Password</label>
                <div class="input-icon-wrapper">
                  <input 
                    [type]="hidePassword ? 'password' : 'text'"
                    id="password"
                    formControlName="password"
                    placeholder="Enter your password"
                    class="modern-input"
                    autocomplete="current-password"
                    (keydown.enter)="onSubmit()"
                    [class.invalid]="false">
                  <button 
                    type="button" 
                    class="password-toggle"
                    (click)="hidePassword = !hidePassword"
                    aria-label="Toggle password visibility">
                    <i [class]="hidePassword ? 'pi pi-eye' : 'pi pi-eye-slash'"></i>
                  </button>
                </div>
              </div>

              <!-- Modern Error Message -->
              <div *ngIf="loginError" class="error-container" [@slideIn]>
                <div class="modern-error-alert">
                  <div class="error-icon">
                    <i class="pi pi-exclamation-triangle"></i>
                  </div>
                  <div class="error-content">
                    <div class="error-title">Login Failed</div>
                    <div class="error-message">{{ loginError }}</div>
                  </div>
                  <button 
                    type="button"
                    class="error-close" 
                    (click)="clearError()"
                    aria-label="Close error message">
                    <i class="pi pi-times"></i>
                  </button>
                </div>
              </div>
              
              <!-- Login Actions -->
              <div class="login-actions">
                <button 
                  type="submit"
                  class="login-button"
                  [disabled]="loading">
                  <i *ngIf="loading" class="pi pi-spinner pi-spin loading-icon"></i>
                  <i *ngIf="!loading" class="pi pi-sign-in button-icon"></i>
                  <span>{{ loading ? 'Signing In...' : 'Sign In' }}</span>
                </button>
              </div>
            </form>
          </div>
          
          <div class="login-help">
            <div class="help-text">
              <i class="pi pi-info-circle"></i>
              <span>New to Rich Town 2 Tennis Club?</span>
              <button 
                type="button"
                class="register-link"
                (click)="goToRegister()">
                Create your account here
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  loading = false;
  hidePassword = true;
  loginError: string = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private analyticsService: AnalyticsService
  ) {
    console.log('LoginComponent constructor called');
    this.loginForm = this.fb.group({
      username: [''],
      password: ['']
    });
  }


  goToRegister(): void {
    // Track navigation to register page
    this.analyticsService.trackButtonClick('Create Account', 'login', { destination: 'register' });
    this.router.navigate(['/register']);
  }

  clearError(): void {
    this.loginError = '';
  }


  ngOnInit(): void {
    console.log('LoginComponent ngOnInit called');
    console.log('Auth service authenticated:', this.authService.isAuthenticated());
    
    // Redirect if already authenticated
    if (this.authService.isAuthenticated()) {
      console.log('Already authenticated, redirecting to calendar');
      this.router.navigate(['/calendar']);
    }
    
  }

  onSubmit(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    console.log('onSubmit called');
    console.log('Form valid:', this.loginForm.valid);
    console.log('Form value:', this.loginForm.value);
    console.log('Loading:', this.loading);
    
    // Clear any previous errors
    this.loginError = '';
    
    // Custom validation
    const username = this.loginForm.get('username')?.value?.trim();
    const password = this.loginForm.get('password')?.value?.trim();
    
    if (!username || !password) {
      this.loginError = 'Please enter both username and password.';
      return;
    }
    
    if (!this.loading) {
      this.loading = true;
      console.log('Making login request...');
      
      this.authService.login(this.loginForm.value).subscribe({
        next: (response: any) => {
          console.log('Login successful, response:', response);
          this.loading = false;

          // Track successful login
          const username = this.loginForm.value.username;
          this.analyticsService.trackLogin(username);

          // Check for intended route
          const intendedRoute = this.authService.getIntendedRoute();
          if (intendedRoute) {
            console.log('Redirecting to intended route:', intendedRoute);
            this.authService.clearIntendedRoute();
            this.router.navigate([intendedRoute]);
          } else {
            // Success - no toast needed, just navigate to default
            console.log('Navigating to calendar...');
            this.router.navigate(['/calendar']);
          }
        },
        error: (error: any) => {
          console.log('Login error:', error);
          this.loading = false;
          
          // Set custom error message for modern error display (no more toast)
          if (error.status === 401) {
            this.loginError = 'Invalid username or password. Please check your credentials and try again.';
          } else if (error.status === 403) {
            this.loginError = 'Your account is pending approval or missing membership fees payment.';
          } else {
            this.loginError = error.error?.error || 'Login failed. Please try again later.';
          }
          
          // Don't show toast for login errors anymore - we use the modern inline error
        }
      });
    } else {
      console.log('Form validation failed or already loading');
      if (!this.loginForm.valid) {
        console.log('Form errors:', this.loginForm.errors);
        console.log('Username errors:', this.loginForm.get('username')?.errors);
        console.log('Password errors:', this.loginForm.get('password')?.errors);
      }
    }
  }
}