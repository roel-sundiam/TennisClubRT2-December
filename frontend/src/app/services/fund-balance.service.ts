import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface FundBalanceRollup {
  previousMonth: {
    label: string;
    balance: number;
  };
  currentMonth: {
    label: string;
    collections: {
      amount: number;
      description: string;
    };
    disbursements: {
      amount: number;
      description: string;
    };
  };
  total: number;
}

interface FundBalanceAPIResponse {
  success: boolean;
  data: FundBalanceRollup;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FundBalanceService {
  private apiUrl = environment.apiUrl || 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  getRollup(): Observable<FundBalanceRollup> {
    return this.http.get<FundBalanceAPIResponse>(`${this.apiUrl}/reports/fund-balance-rollup`).pipe(
      map(response => response.data)
    );
  }
}
