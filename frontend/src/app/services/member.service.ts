import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export interface Member {
  _id: string;
  username: string;
  fullName: string;
  email: string;
  gender?: 'male' | 'female' | 'other';
  phone?: string;
  dateOfBirth?: Date;
  profilePicture?: string;
  role: 'member' | 'admin' | 'superadmin';
  coinBalance: number;
  registrationDate: Date;
  lastLogin?: Date;
  isApproved: boolean;
  isActive: boolean;
  membershipFeesPaid: boolean;
  isHomeowner?: boolean;
  isCoach?: boolean;
  membershipYearsPaid?: number[];
}

export interface MemberDirectory {
  success: boolean;
  data: Member[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface MemberStats {
  totalMembers: number;
  approvedMembers: number;
  pendingApproval: number;
  activeMembers: number;
  paidMembers: number;
}

export interface MemberProfileResponse {
  success: boolean;
  data: Member & {
    stats: {
      totalReservations: number;
      completedReservations: number;
      totalCoinsEarned: number;
      recentActivity: any[];
    };
  };
}

export interface MemberSearchResponse {
  success: boolean;
  data: Member[];
}

export interface MemberActivity {
  _id: string;
  type: 'reservation' | 'payment' | 'coin_transaction';
  description: string;
  date: Date;
  amount?: number;
}

export interface MemberSearchParams {
  search?: string;
  gender?: 'male' | 'female' | 'other';
  role?: 'member' | 'admin' | 'superadmin';
  approved?: boolean;
  active?: boolean;
  paid?: boolean;
  sortBy?: 'name' | 'registrationDate' | 'lastActivity';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  includeAll?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class MemberService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getHeaders(): HttpHeaders {
    const token = this.authService.token;
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  getMembers(params: MemberSearchParams = {}): Observable<MemberDirectory> {
    let httpParams = new HttpParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, value.toString());
      }
    });

    return this.http.get<MemberDirectory>(`${this.apiUrl}/members`, {
      headers: this.getHeaders(),
      params: httpParams
    });
  }

  searchMembers(query: string): Observable<MemberSearchResponse> {
    const params = new HttpParams().set('q', query);
    
    return this.http.get<MemberSearchResponse>(`${this.apiUrl}/members/search`, {
      headers: this.getHeaders(),
      params
    });
  }

  getMemberProfile(memberId: string): Observable<MemberProfileResponse> {
    return this.http.get<MemberProfileResponse>(`${this.apiUrl}/members/${memberId}`, {
      headers: this.getHeaders()
    });
  }

  getMemberActivity(memberId: string): Observable<MemberActivity[]> {
    return this.http.get<MemberActivity[]>(`${this.apiUrl}/members/${memberId}/activity`, {
      headers: this.getHeaders()
    });
  }

  getMemberStats(): Observable<MemberStats> {
    return this.http.get<MemberStats>(`${this.apiUrl}/members/stats`, {
      headers: this.getHeaders()
    });
  }

  resetMemberPassword(memberId: string): Observable<{success: boolean, message: string}> {
    return this.http.put<{success: boolean, message: string}>(`${this.apiUrl}/members/${memberId}/reset-password`, {}, {
      headers: this.getHeaders()
    });
  }
}