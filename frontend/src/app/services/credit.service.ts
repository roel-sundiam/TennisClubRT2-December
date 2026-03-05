import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, map } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CreditTransaction {
  _id: string;
  userId: string | { _id: string; username: string; fullName: string; email: string };
  type: 'deposit' | 'deduction' | 'refund' | 'adjustment';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  referenceId?: string;
  referenceType?: 'payment' | 'reservation' | 'poll' | 'admin_adjustment' | 'deposit';
  refundReason?: 'reservation_cancelled' | 'open_play_cancelled' | 'admin_refund' | 'partial_refund';
  metadata?: {
    source?: string;
    reason?: string;
    adminUserId?: string;
    originalAmount?: number;
    paymentMethod?: 'cash' | 'bank_transfer' | 'gcash';
    reservationDate?: string;
    timeSlot?: number;
    pollId?: string;
    eventTitle?: string;
    recordedBy?: string;
    recordedAt?: string;
  };
  status?: 'pending' | 'completed' | 'failed' | 'reversed' | 'recorded';
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreditBalance {
  balance: number;
  pendingTransactions: number;
  lastUpdated: string;
}

export interface CreditStats {
  totalDeposits: number;
  totalUsed: number;
  totalRefunds: number;
  currentBalance: number;
  transactionCount: number;
}

export interface DepositCreditsRequest {
  amount: number;
  paymentMethod: 'cash' | 'bank_transfer' | 'gcash';
  paymentReference?: string;
  description?: string;
}

export interface AdminCreditAction {
  userId: string;
  amount: number;
  type: 'deposit' | 'deduction';
  reason: string;
}

@Injectable({
  providedIn: 'root'
})
export class CreditService {
  private apiUrl = environment.apiUrl;
  private creditBalanceSubject = new BehaviorSubject<number>(0);
  
  public creditBalance$ = this.creditBalanceSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Get current user's credit balance
   */
  getCreditBalance(): Observable<{ success: boolean; data: CreditBalance }> {
    return this.http.get<{ success: boolean; data: CreditBalance }>(`${this.apiUrl}/credits/balance`)
      .pipe(
        tap(response => {
          if (response.success) {
            this.creditBalanceSubject.next(response.data.balance);
          }
        })
      );
  }

  /**
   * Get paginated credit transaction history
   */
  getCreditTransactions(page = 1, limit = 10, type?: string): Observable<{
    success: boolean;
    data: {
      transactions: CreditTransaction[];
      pagination: {
        current: number;
        pages: number;
        total: number;
      };
    };
  }> {
    const params: any = { page: page.toString(), limit: limit.toString() };
    if (type) {
      params.type = type;
    }

    return this.http.get<{
      success: boolean;
      data: {
        transactions: CreditTransaction[];
        pagination: {
          current: number;
          pages: number;
          total: number;
        };
      };
    }>(`${this.apiUrl}/credits/transactions`, { params });
  }

  /**
   * Get credit statistics for current user
   */
  getCreditStats(): Observable<{ success: boolean; data: CreditStats }> {
    return this.http.get<{ success: boolean; data: CreditStats }>(`${this.apiUrl}/credits/stats`);
  }

  /**
   * Deposit credits (request top-up)
   */
  depositCredits(request: DepositCreditsRequest): Observable<{
    success: boolean;
    data: CreditTransaction;
    message: string;
  }> {
    return this.http.post<{
      success: boolean;
      data: CreditTransaction;
      message: string;
    }>(`${this.apiUrl}/credits/deposit`, request)
      .pipe(
        tap(response => {
          if (response.success) {
            // Refresh balance after deposit request
            this.getCreditBalance().subscribe();
          }
        })
      );
  }

  /**
   * Admin: Get a specific user's credit transaction history
   */
  getUserCreditTransactions(userId: string, page = 1, limit = 10, type?: string): Observable<{
    success: boolean;
    data: {
      transactions: CreditTransaction[];
      pagination: {
        current: number;
        pages: number;
        total: number;
      };
    };
  }> {
    const params: any = { page: page.toString(), limit: limit.toString() };
    if (type) params.type = type;
    return this.http.get<{
      success: boolean;
      data: {
        transactions: CreditTransaction[];
        pagination: {
          current: number;
          pages: number;
          total: number;
        };
      };
    }>(`${this.apiUrl}/credits/admin/user/${userId}/transactions`, { params });
  }

  /**
   * Admin: Get all users' credit balances
   */
  getAllUserCredits(page = 1, limit = 20, search?: string): Observable<{
    success: boolean;
    data: {
      users: Array<{
        _id: string;
        username: string;
        fullName: string;
        email: string;
        creditBalance: number;
        isApproved: boolean;
        role: string;
        lastTransaction?: CreditTransaction;
      }>;
      pagination: {
        current: number;
        pages: number;
        total: number;
      };
    };
  }> {
    const params: any = { page: page.toString(), limit: limit.toString() };
    if (search) {
      params.search = search;
    }

    return this.http.get<{
      success: boolean;
      data: {
        users: Array<{
          _id: string;
          username: string;
          fullName: string;
          email: string;
          creditBalance: number;
          isApproved: boolean;
          role: string;
          lastTransaction?: CreditTransaction;
        }>;
        pagination: {
          current: number;
          pages: number;
          total: number;
        };
      };
    }>(`${this.apiUrl}/credits/admin/all-balances`, { params });
  }

  /**
   * Admin: Adjust user credits
   */
  adjustUserCredits(request: AdminCreditAction): Observable<{
    success: boolean;
    data: CreditTransaction;
    message: string;
  }> {
    return this.http.post<{
      success: boolean;
      data: CreditTransaction;
      message: string;
    }>(`${this.apiUrl}/credits/admin/adjust`, request);
  }

  /**
   * Admin: Manual refund
   */
  refundCredits(refundData: {
    reservationId?: string;
    pollId?: string;
    amount: number;
    reason: string;
  }): Observable<{
    success: boolean;
    data: CreditTransaction;
    message: string;
  }> {
    return this.http.post<{
      success: boolean;
      data: CreditTransaction;
      message: string;
    }>(`${this.apiUrl}/credits/admin/refund`, refundData);
  }

  /**
   * Get current credit balance value (from BehaviorSubject)
   */
  getCurrentBalance(): number {
    return this.creditBalanceSubject.value;
  }

  /**
   * Update the credit balance (for use after transactions)
   */
  updateBalance(newBalance: number): void {
    this.creditBalanceSubject.next(newBalance);
  }

  /**
   * Check if user has sufficient credits for a given amount
   */
  hasSufficientCredits(amount: number): Observable<boolean> {
    return this.getCreditBalance().pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data.balance >= amount;
        }
        return false;
      })
    );
  }

  /**
   * Get all credit deposits (admin only)
   */
  getAllCreditDeposits(page = 1, limit = 20, status?: string, startDate?: string, endDate?: string): Observable<{
    success: boolean;
    data: {
      transactions: CreditTransaction[];
      summary: {
        totalDeposits: number;
        totalAmount: number;
        pendingDeposits: number;
        completedDeposits: number;
        recordedDeposits: number;
        pendingAmount: number;
      };
      pagination: {
        current: number;
        pages: number;
        total: number;
      };
    };
  }> {
    const params: any = { page: page.toString(), limit: limit.toString() };
    if (status) params.status = status;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    return this.http.get<{
      success: boolean;
      data: {
        transactions: CreditTransaction[];
        summary: {
          totalDeposits: number;
          totalAmount: number;
          pendingDeposits: number;
          completedDeposits: number;
          recordedDeposits: number;
          pendingAmount: number;
        };
        pagination: {
          current: number;
          pages: number;
          total: number;
        };
      };
    }>(`${this.apiUrl}/credits/admin/deposits`, { params });
  }

  /**
   * Record a credit deposit (admin only)
   */
  recordCreditDeposit(transactionId: string): Observable<{
    success: boolean;
    data: CreditTransaction;
    message: string;
  }> {
    return this.http.post<{
      success: boolean;
      data: CreditTransaction;
      message: string;
    }>(`${this.apiUrl}/credits/admin/deposits/${transactionId}/record`, {});
  }
}