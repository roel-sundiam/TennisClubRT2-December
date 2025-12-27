import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';

interface WeatherData {
  temperature: number;
  description: string;
  humidity: number;
  windSpeed: number;
  icon: string;
  rainChance?: number;
  timestamp: Date;
}

interface WeatherSuitability {
  suitable: boolean;
  warnings: string[];
}

interface WeatherResponse {
  weather: WeatherData;
  suitability: WeatherSuitability;
  location: string;
  isMockData?: boolean;
}

interface HourlyWeatherForecast {
  datetime: string;
  date: string;
  hour: number;
  timeSlot: string;
  temperature: number;
  description: string;
  humidity: number;
  windSpeed: number;
  icon: string;
  rainChance?: number;
  suitability: {
    suitable: boolean;
    warnings: string[];
  };
}

interface HourlyForecastResponse {
  forecast: HourlyWeatherForecast[];
  location: string;
  generated: string;
  timezone: string;
}

interface DayForecast {
  date: string;
  hourlyForecast: HourlyWeatherForecast[];
}

interface ForecastResponse {
  forecast: DayForecast[];
  location: string;
  generated: string;
}

@Component({
  selector: 'app-weather',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatTooltipModule,
    MatChipsModule
  ],
  template: `
    <div class="weather-container">
      <!-- Header -->
      <div class="weather-header">
        <div class="header-content">
          <button mat-icon-button (click)="goBack()" class="back-button">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <div class="header-info">
            <h1>
              <mat-icon>wb_sunny</mat-icon>
              Weather Forecast
            </h1>
            <p>{{location}}</p>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div *ngIf="loading" class="loading-container">
        <mat-spinner></mat-spinner>
        <p>Loading weather data...</p>
      </div>

      <!-- Error State -->
      <div *ngIf="error && !loading" class="error-container">
        <mat-card class="error-card">
          <mat-card-content>
            <mat-icon class="error-icon">error_outline</mat-icon>
            <h3>Unable to load weather data</h3>
            <p>{{error}}</p>
            <button mat-raised-button color="primary" (click)="loadWeatherData()">
              <mat-icon>refresh</mat-icon>
              Try Again
            </button>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Weather Content -->
      <div *ngIf="!loading && !error" class="weather-content">
        
        <!-- Current Weather Card -->
        <mat-card class="current-weather-card" *ngIf="currentWeather">
          <mat-card-header>
            <div class="current-weather-header">
              <div class="weather-icon-large">
                <img [src]="getWeatherIconUrl(currentWeather.weather.icon)" 
                     [alt]="currentWeather.weather.description"
                     class="weather-icon-img">
              </div>
              <div class="current-temp-info">
                <div class="temperature">{{currentWeather.weather.temperature}}°C</div>
                <div class="description">{{currentWeather.weather.description | titlecase}}</div>
                <div class="location-info">
                  <mat-icon>location_on</mat-icon>
                  <span>{{currentWeather.location}}</span>
                </div>
              </div>
            </div>
          </mat-card-header>
          
          <mat-card-content>
            <!-- Weather Details -->
            <div class="weather-details">
              <div class="detail-item">
                <mat-icon>opacity</mat-icon>
                <div class="detail-info">
                  <span class="detail-label">Humidity</span>
                  <span class="detail-value">{{currentWeather.weather.humidity}}%</span>
                </div>
              </div>
              
              <div class="detail-item">
                <mat-icon>air</mat-icon>
                <div class="detail-info">
                  <span class="detail-label">Wind Speed</span>
                  <span class="detail-value">{{currentWeather.weather.windSpeed}} km/h</span>
                </div>
              </div>
              
              <div class="detail-item" *ngIf="currentWeather.weather.rainChance !== undefined">
                <mat-icon>water_drop</mat-icon>
                <div class="detail-info">
                  <span class="detail-label">Rain Chance</span>
                  <span class="detail-value rain-chance">{{currentWeather.weather.rainChance}}%</span>
                </div>
              </div>
              
              <div class="detail-item">
                <mat-icon>schedule</mat-icon>
                <div class="detail-info">
                  <span class="detail-label">Updated</span>
                  <span class="detail-value">{{formatTime(currentWeather.weather.timestamp)}}</span>
                </div>
              </div>
            </div>

            <!-- Suitability Warnings -->
            <div class="suitability-section">
              <div class="suitability-header">
                <mat-icon [class]="currentWeather.suitability.suitable ? 'suitable' : 'not-suitable'">
                  {{currentWeather.suitability.suitable ? 'check_circle' : 'warning'}}
                </mat-icon>
                <span class="suitability-text" [class]="currentWeather.suitability.suitable ? 'suitable' : 'not-suitable'">
                  {{currentWeather.suitability.suitable ? 'Good conditions for tennis' : 'Conditions may not be ideal'}}
                </span>
              </div>
              
              <div *ngIf="currentWeather.suitability.warnings.length > 0" class="warnings">
                <mat-chip-listbox>
                  <mat-chip *ngFor="let warning of currentWeather.suitability.warnings" class="warning-chip">
                    <mat-icon>info</mat-icon>
                    {{warning}}
                  </mat-chip>
                </mat-chip-listbox>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Weather Forecast -->
        <mat-card class="forecast-card" *ngIf="hourlyForecast">
          <mat-card-header>
            <div class="forecast-header">
              <div class="forecast-title">
                <mat-icon>schedule</mat-icon>
                <div>
                  <h2>Weather Forecast</h2>
                  <p>Court operating hours: 5:00 AM - 10:00 PM</p>
                </div>
              </div>
              <div class="view-toggle">
                <button mat-button 
                        [class.active]="selectedView === 'hourly'"
                        (click)="selectedView = 'hourly'">
                  <mat-icon>access_time</mat-icon>
                  Hourly
                </button>
                <button mat-button 
                        [class.active]="selectedView === 'daily'"
                        (click)="selectedView = 'daily'">
                  <mat-icon>calendar_view_day</mat-icon>
                  Daily
                </button>
              </div>
            </div>
          </mat-card-header>
          
          <mat-card-content>
            <!-- Hourly View -->
            <div *ngIf="selectedView === 'hourly'" class="hourly-view">
              <div class="forecast-scroll">
                <div class="forecast-timeline">
                  <div *ngFor="let forecast of hourlyForecast.forecast; let i = index" 
                       class="forecast-item"
                       [class.now]="isCurrentHour(forecast)"
                       [class.unsuitable]="!forecast.suitability.suitable">
                    <div class="forecast-time">
                      <div class="time-main">{{formatHour(forecast.hour)}}</div>
                      <div class="time-date" *ngIf="i === 0 || isDifferentDay(hourlyForecast.forecast[i-1], forecast)">
                        {{formatDayFromDate(forecast.date)}}
                      </div>
                    </div>
                    <div class="forecast-weather">
                      <div class="weather-icon">
                        <img [src]="getWeatherIconUrl(forecast.icon)" 
                             [alt]="forecast.description"
                             class="weather-icon-img">
                      </div>
                      <div class="weather-temp">{{forecast.temperature}}°C</div>
                    </div>
                    <div class="forecast-details">
                      <div class="weather-desc">{{forecast.description | titlecase}}</div>
                      <div class="weather-metrics">
                        <span class="metric">
                          <mat-icon>water_drop</mat-icon>
                          {{forecast.rainChance || 0}}%
                        </span>
                        <span class="metric">
                          <mat-icon>air</mat-icon>
                          {{forecast.windSpeed}}km/h
                        </span>
                        <span class="metric">
                          <mat-icon>opacity</mat-icon>
                          {{forecast.humidity}}%
                        </span>
                      </div>
                    </div>
                    <div class="forecast-suitability">
                      <div class="suitability-indicator" 
                           [class.suitable]="forecast.suitability.suitable"
                           [class.unsuitable]="!forecast.suitability.suitable"
                           [matTooltip]="getSuitabilityTooltip(forecast.suitability)">
                        <mat-icon>{{forecast.suitability.suitable ? 'check_circle' : 'warning'}}</mat-icon>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Daily View -->
            <div *ngIf="selectedView === 'daily'" class="daily-view">
              <mat-tab-group class="forecast-tabs" [selectedIndex]="0">
                <mat-tab *ngFor="let day of groupedForecast; let i = index" 
                         [label]="formatDayLabel(day.date, i)">
                  <div class="day-forecast">
                    <div class="hourly-scroll">
                      <div class="hourly-forecast">
                        <div *ngFor="let hour of day.hourlyForecast" 
                             class="hour-item"
                             [class.unsuitable]="!hour.suitability.suitable"
                             [matTooltip]="getDetailedHourTooltip(hour)">
                          <div class="hour-time">{{formatHour(hour.hour)}}</div>
                          <div class="hour-icon">
                            <img [src]="getWeatherIconUrl(hour.icon)" 
                                 [alt]="hour.description"
                                 class="hour-weather-icon">
                          </div>
                          <div class="hour-temp">{{hour.temperature}}°</div>
                          <div class="hour-desc">{{hour.description}}</div>
                          <div class="hour-rain" *ngIf="hour.rainChance !== undefined">
                            <mat-icon class="rain-icon">water_drop</mat-icon>
                            <span class="rain-percentage">{{hour.rainChance}}%</span>
                          </div>
                          <div class="hour-suitability">
                            <mat-icon class="suitability-icon" 
                                      [class.suitable]="hour.suitability.suitable"
                                      [class.unsuitable]="!hour.suitability.suitable">
                              {{hour.suitability.suitable ? 'check_circle' : 'warning'}}
                            </mat-icon>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </mat-tab>
              </mat-tab-group>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Action Cards -->
        <div class="action-cards">
          <mat-card class="action-card">
            <mat-card-content>
              <mat-icon>sports_tennis</mat-icon>
              <h3>Ready to Play?</h3>
              <p>Book your court now based on weather conditions</p>
              <button mat-raised-button color="primary" (click)="goToReservations()">
                <mat-icon>calendar_today</mat-icon>
                Reserve Court
              </button>
            </mat-card-content>
          </mat-card>

          <mat-card class="action-card">
            <mat-card-content>
              <mat-icon>refresh</mat-icon>
              <h3>Stay Updated</h3>
              <p>Get the latest weather updates</p>
              <button mat-raised-button color="accent" (click)="loadWeatherData()">
                <mat-icon>refresh</mat-icon>
                Refresh Data
              </button>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Debug Info Panel -->
        <mat-card class="debug-panel" *ngIf="showDebugInfo && currentWeather">
          <mat-card-header>
            <div class="debug-header">
              <div>
                <mat-icon>bug_report</mat-icon>
                <span>Debug Information</span>
              </div>
              <button mat-icon-button (click)="showDebugInfo = !showDebugInfo" matTooltip="Hide debug info">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          </mat-card-header>
          <mat-card-content>
            <div class="debug-content">
              <!-- Data Source -->
              <div class="debug-item">
                <div class="debug-label">
                  <mat-icon [class.real-data]="!currentWeather.isMockData"
                            [class.mock-data]="currentWeather.isMockData">
                    {{ currentWeather.isMockData ? 'science' : 'cloud_done' }}
                  </mat-icon>
                  <strong>Data Source:</strong>
                </div>
                <div class="debug-value">
                  <mat-chip [class.real-chip]="!currentWeather.isMockData"
                            [class.mock-chip]="currentWeather.isMockData">
                    {{ currentWeather.isMockData ? '⚠️ MOCK/SAMPLE DATA' : '✅ REAL OpenWeather API' }}
                  </mat-chip>
                </div>
              </div>

              <!-- Timezone -->
              <div class="debug-item" *ngIf="hourlyForecast">
                <div class="debug-label">
                  <mat-icon>schedule</mat-icon>
                  <strong>Timezone:</strong>
                </div>
                <div class="debug-value">{{ hourlyForecast.timezone || 'Asia/Manila' }}</div>
              </div>

              <!-- Location Coordinates -->
              <div class="debug-item">
                <div class="debug-label">
                  <mat-icon>my_location</mat-icon>
                  <strong>Coordinates:</strong>
                </div>
                <div class="debug-value">15.087°N, 120.6285°E</div>
              </div>

              <!-- Last Updated -->
              <div class="debug-item" *ngIf="hourlyForecast">
                <div class="debug-label">
                  <mat-icon>update</mat-icon>
                  <strong>Last Fetched:</strong>
                </div>
                <div class="debug-value">{{ hourlyForecast.generated | date:'medium' }}</div>
              </div>

              <!-- Current Time -->
              <div class="debug-item">
                <div class="debug-label">
                  <mat-icon>access_time</mat-icon>
                  <strong>Current Time (Manila):</strong>
                </div>
                <div class="debug-value">{{ getCurrentManilaTime() }}</div>
              </div>

              <!-- API Endpoint -->
              <div class="debug-item">
                <div class="debug-label">
                  <mat-icon>api</mat-icon>
                  <strong>API Endpoint:</strong>
                </div>
                <div class="debug-value api-url">{{apiUrl}}/weather</div>
              </div>

              <!-- Warning if Mock Data -->
              <div class="debug-warning" *ngIf="currentWeather.isMockData">
                <mat-icon>warning</mat-icon>
                <div>
                  <strong>Using Sample Data</strong>
                  <p>Check WEATHER_API_KEY in backend/.env file to use real OpenWeather data</p>
                </div>
              </div>

              <!-- Success if Real Data -->
              <div class="debug-success" *ngIf="!currentWeather.isMockData">
                <mat-icon>check_circle</mat-icon>
                <div>
                  <strong>Timezone Fix Active</strong>
                  <p>Weather times are accurately displayed in Asia/Manila timezone (UTC+8)</p>
                </div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styleUrl: './weather.component.scss'
})
export class WeatherComponent implements OnInit, OnDestroy {
  currentWeather: WeatherResponse | null = null;
  hourlyForecast: HourlyForecastResponse | null = null;
  groupedForecast: DayForecast[] = [];
  loading = true;
  error: string | null = null;
  location = 'San Fernando, Pampanga';
  selectedView: 'hourly' | 'daily' = 'hourly';
  showDebugInfo = false; // Debug panel hidden
  apiUrl = environment.apiUrl; // Public for template access

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadWeatherData();
  }

  ngOnDestroy(): void {
    // Clean up any subscriptions if needed
  }

  loadWeatherData(): void {
    this.loading = true;
    this.error = null;

    // Load both current weather and hourly forecast
    Promise.all([
      this.loadCurrentWeather(),
      this.loadHourlyForecast()
    ]).then(() => {
      this.loading = false;
    }).catch((error) => {
      this.loading = false;
      this.error = 'Failed to load weather data. Please try again later.';
      console.error('Weather loading error:', error);
    });
  }

  private async loadCurrentWeather(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.get<WeatherResponse>(`${this.apiUrl}/weather/current`).subscribe({
        next: (data) => {
          this.currentWeather = data;
          this.location = data.location;
          resolve();
        },
        error: (error) => {
          console.error('Current weather error:', error);
          reject(error);
        }
      });
    });
  }

  private async loadHourlyForecast(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.get<HourlyForecastResponse>(`${this.apiUrl}/weather/hourly`).subscribe({
        next: (data) => {
          this.hourlyForecast = data;
          this.groupForecastByDay(data.forecast);
          resolve();
        },
        error: (error) => {
          console.error('Hourly forecast error:', error);
          reject(error);
        }
      });
    });
  }

  private groupForecastByDay(forecasts: HourlyWeatherForecast[]): void {
    const grouped: { [key: string]: HourlyWeatherForecast[] } = {};
    
    forecasts.forEach(forecast => {
      if (!grouped[forecast.date]) {
        grouped[forecast.date] = [];
      }
      grouped[forecast.date].push(forecast);
    });

    this.groupedForecast = Object.keys(grouped).map(date => ({
      date,
      hourlyForecast: grouped[date].sort((a, b) => a.hour - b.hour)
    }));
  }

  getWeatherIconUrl(icon: string): string {
    return `https://openweathermap.org/img/wn/${icon}@2x.png`;
  }

  formatTime(timestamp: Date): string {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  formatDayLabel(dateStr: string, index: number): string {
    const date = new Date(dateStr);
    if (index === 0) return 'Today';
    if (index === 1) return 'Tomorrow';
    
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  formatHour(hour: number): string {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  }

  getDetailedHourTooltip(hour: HourlyWeatherForecast): string {
    let tooltip = `${hour.timeSlot}\n${hour.description} • Humidity: ${hour.humidity}% • Wind: ${hour.windSpeed} km/h`;
    if (hour.rainChance !== undefined) {
      tooltip += ` • Rain: ${hour.rainChance}%`;
    }
    if (hour.suitability.warnings.length > 0) {
      tooltip += `\nWarnings: ${hour.suitability.warnings.join(', ')}`;
    }
    return tooltip;
  }

  getSuitabilityTooltip(suitability: { suitable: boolean; warnings: string[] }): string {
    if (suitability.suitable && suitability.warnings.length === 0) {
      return 'Perfect conditions for tennis';
    }
    if (suitability.warnings.length > 0) {
      return suitability.warnings.join(', ');
    }
    return suitability.suitable ? 'Good for tennis' : 'Not ideal for tennis';
  }

  isCurrentHour(forecast: HourlyWeatherForecast): boolean {
    const now = new Date();
    const forecastTime = new Date(forecast.datetime);
    return now.getHours() === forecastTime.getHours() && 
           now.getDate() === forecastTime.getDate() &&
           now.getMonth() === forecastTime.getMonth();
  }

  isDifferentDay(prev: HourlyWeatherForecast, current: HourlyWeatherForecast): boolean {
    return prev.date !== current.date;
  }

  formatDayFromDate(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    }
  }

  getCurrentManilaTime(): string {
    return new Date().toLocaleString('en-PH', {
      timeZone: 'Asia/Manila',
      dateStyle: 'medium',
      timeStyle: 'medium'
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  goToReservations(): void {
    this.router.navigate(['/reservations']);
  }
}