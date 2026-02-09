import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SystemSettings {
  _id: string;
  tennisBallCostPerCan: number;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SystemSettingsResponse {
  success: boolean;
  data: SystemSettings;
  message?: string;
}

export interface TennisBallsPurchase {
  reserverName: string;
  date: string;
  quantity: number;
  costPerCan: number;
  totalCost: number;
  paymentStatus: string;
}

export interface TennisBallsStats {
  totalCansPurchased: number;
  totalCansPaid: number;
  totalCansPending: number;
  totalRevenue: number;
  pendingRevenue: number;
  currentCostPerCan: number;
  totalReservationsWithBalls: number;
  paidReservationsWithBalls: number;
  purchases: TennisBallsPurchase[];
}

export interface TennisBallsStatsResponse {
  success: boolean;
  data: TennisBallsStats;
}

@Injectable({
  providedIn: 'root'
})
export class SystemSettingsService {
  private apiUrl = `${environment.apiUrl}/system-settings`;

  constructor(private http: HttpClient) {}

  /**
   * Get current system settings
   * Accessible by all authenticated users
   */
  getSettings(): Observable<SystemSettingsResponse> {
    return this.http.get<SystemSettingsResponse>(this.apiUrl);
  }

  /**
   * Update system settings
   * Admin/SuperAdmin only
   */
  updateSettings(settings: Partial<SystemSettings>): Observable<SystemSettingsResponse> {
    return this.http.put<SystemSettingsResponse>(this.apiUrl, settings);
  }

  /**
   * Initialize system settings (first-time setup)
   * SuperAdmin only
   */
  initializeSettings(): Observable<SystemSettingsResponse> {
    return this.http.post<SystemSettingsResponse>(`${this.apiUrl}/initialize`, {});
  }

  /**
   * Get tennis balls statistics
   * Admin/SuperAdmin only
   */
  getTennisBallsStats(): Observable<TennisBallsStatsResponse> {
    return this.http.get<TennisBallsStatsResponse>(`${this.apiUrl}/tennis-balls-stats`);
  }
}
