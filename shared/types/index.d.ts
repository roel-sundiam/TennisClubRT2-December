export interface User {
    _id: string;
    username: string;
    fullName: string;
    email: string;
    gender: 'male' | 'female' | 'other';
    phone?: string;
    dateOfBirth?: Date;
    profilePicture?: string;
    isApproved: boolean;
    isActive: boolean;
    role: 'member' | 'admin' | 'superadmin';
    registrationDate: Date;
    lastLogin?: Date;
    membershipFeesPaid: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface RegisterRequest {
    username: string;
    fullName: string;
    email: string;
    password: string;
    gender: 'male' | 'female' | 'other';
    phone?: string;
    dateOfBirth?: string;
}
export interface LoginRequest {
    username: string;
    password: string;
}
export interface AuthResponse {
    token: string;
    user: Omit<User, 'password'>;
    expiresIn: string;
}
export interface CourtReservation {
    _id: string;
    userId: string;
    user?: User;
    date: Date;
    timeSlot: number;
    players: string[];
    status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
    paymentStatus: 'pending' | 'paid' | 'overdue';
    totalFee: number;
    weatherForecast?: WeatherInfo;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateReservationRequest {
    date: string;
    timeSlot: number;
    players: string[];
}
export interface UpdateReservationRequest {
    date?: string;
    timeSlot?: number;
    players?: string[];
}
export interface Payment {
    _id: string;
    userId: string;
    user?: User;
    reservationId: string;
    reservation?: CourtReservation;
    amount: number;
    paymentDate: Date;
    playerName: string;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreatePaymentRequest {
    reservationId: string;
    amount: number;
    playerName: string;
    notes?: string;
}
export interface PaymentSummary {
    totalAmount: number;
    totalPayments: number;
    pendingAmount: number;
    pendingPayments: number;
}
export interface WeatherInfo {
    temperature: number;
    description: string;
    humidity: number;
    windSpeed: number;
    icon: string;
    timestamp: Date;
}
export interface WeatherForecast {
    date: string;
    hourlyForecast: {
        hour: number;
        weather: WeatherInfo;
    }[];
}
export interface CoinTransaction {
    _id: string;
    userId: string;
    user?: User;
    type: 'earned' | 'spent' | 'admin_added' | 'admin_removed';
    amount: number;
    reason: string;
    relatedEntity?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface CoinRequest {
    _id: string;
    userId: string;
    user?: User;
    requestedAmount: number;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    approvedBy?: string;
    approvedAt?: Date;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateCoinRequestRequest {
    requestedAmount: number;
    reason: string;
}
export interface Poll {
    _id: string;
    title: string;
    description: string;
    options: PollOption[];
    createdBy: string;
    createdByUser?: User;
    status: 'draft' | 'active' | 'closed' | 'cancelled';
    isAnonymous: boolean;
    allowMultipleVotes: boolean;
    startDate: Date;
    endDate?: Date;
    totalVotes: number;
    eligibleVoters: string[];
    metadata?: {
        category?: string;
        priority?: 'low' | 'medium' | 'high';
        adminNotes?: string;
    };
    createdAt: Date;
    updatedAt: Date;
}
export interface PollOption {
    _id: string;
    text: string;
    votes: number;
    voters: string[];
}
export interface CreatePollRequest {
    title: string;
    description: string;
    options: string[];
    isAnonymous?: boolean;
    allowMultipleVotes?: boolean;
    startDate: string;
    endDate?: string;
    eligibleVoters?: string[];
    metadata?: {
        category?: string;
        priority?: 'low' | 'medium' | 'high';
        adminNotes?: string;
    };
}
export interface VoteRequest {
    optionIds: string[];
}
export interface PollStats {
    totalPolls: number;
    pollsByStatus: {
        _id: string;
        count: number;
    }[];
    recentPolls: number;
    averageParticipation: number;
    pollsByCategory: {
        _id: string;
        count: number;
    }[];
    period: {
        startDate: string;
        endDate: string;
    };
}
export interface Suggestion {
    _id: string;
    userId: string;
    user?: User;
    type: 'suggestion' | 'complaint';
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    status: 'pending' | 'in_review' | 'resolved' | 'dismissed';
    adminResponse?: string;
    respondedBy?: string;
    respondedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateSuggestionRequest {
    type: 'suggestion' | 'complaint';
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
}
export interface AdminSuggestionResponse {
    adminResponse: string;
    status: 'in_review' | 'resolved' | 'dismissed';
}
export interface PageVisit {
    _id: string;
    userId: string;
    user?: User;
    pageName: string;
    url: string;
    timestamp: Date;
    coinsCost: number;
    sessionId?: string;
    userAgent?: string;
    ipAddress?: string;
}
export interface AnalyticsSummary {
    totalUsers: number;
    activeUsers: number;
    totalReservations: number;
    totalRevenue: number;
    popularPages: {
        page: string;
        visits: number;
    }[];
    recentActivity: PageVisit[];
}
export interface DashboardStats {
    memberStats: {
        totalMembers: number;
        newMembersThisMonth: number;
        activeMembersThisMonth: number;
        membersWithFeesOwed: number;
        averageCoinBalance: number;
    };
    reservationStats: {
        totalReservations: number;
        reservationsThisMonth: number;
        completedReservations: number;
        cancelledReservations: number;
        averagePlayersPerReservation: number;
    };
    revenueStats: {
        totalRevenue: number;
        revenueThisMonth: number;
        totalOutstandingFees: number;
        averageRevenuePerReservation: number;
    };
    coinStats: {
        totalCoinsInCirculation: number;
        coinsEarnedThisMonth: number;
        coinsSpentThisMonth: number;
        totalCoinTransactions: number;
    };
    recentActivity: any[];
}
export interface MemberActivityReport {
    mostActiveMembers: {
        user: User;
        totalReservations: number;
        totalCoinsEarned: number;
        lastReservation: Date;
    }[];
    memberGrowthData: {
        period: string;
        newMembers: number;
        totalMembers: number;
    }[];
    memberEngagement: {
        averageReservationsPerMember: number;
        averageCoinsPerMember: number;
        memberRetentionRate: number;
    };
    genderDistribution: {
        _id: string;
        count: number;
    }[];
    period: {
        startDate: string;
        endDate: string;
    };
}
export interface RevenueReport {
    totalRevenue: number;
    revenueByMonth: {
        month: string;
        revenue: number;
        reservations: number;
    }[];
    revenueByPaymentMethod: {
        method: string;
        amount: number;
        percentage: number;
    }[];
    outstandingPayments: {
        totalAmount: number;
        count: number;
        oldestDate: Date;
    };
    averageRevenueMetrics: {
        perReservation: number;
        perMember: number;
        perDay: number;
    };
    topPayingMembers: {
        user: User;
        totalPaid: number;
        reservationCount: number;
    }[];
    period: {
        startDate: string;
        endDate: string;
    };
}
export interface CoinSystemReport {
    totalCoinsInCirculation: number;
    coinDistribution: {
        earned: number;
        spent: number;
        adminAdded: number;
        adminRemoved: number;
        bonus: number;
        refunded: number;
    };
    topCoinEarners: {
        user: User;
        totalEarned: number;
        totalSpent: number;
        currentBalance: number;
    }[];
    coinTransactionTrends: {
        date: string;
        earned: number;
        spent: number;
        netChange: number;
    }[];
    balanceDistribution: {
        range: string;
        memberCount: number;
    }[];
    averageTransactionSize: {
        earned: number;
        spent: number;
    };
    period: {
        startDate: string;
        endDate: string;
    };
}
export interface ReservationReport {
    totalReservations: number;
    reservationsByStatus: {
        status: string;
        count: number;
        percentage: number;
    }[];
    reservationsByTimeSlot: {
        timeSlot: number;
        count: number;
        revenue: number;
    }[];
    reservationTrends: {
        date: string;
        reservations: number;
        revenue: number;
    }[];
    busyDays: {
        dayOfWeek: string;
        averageReservations: number;
    }[];
    cancellationRate: {
        totalCancellations: number;
        cancellationPercentage: number;
        commonReasons: string[];
    };
    peakUsageHours: {
        hour: number;
        reservationCount: number;
        utilizationRate: number;
    }[];
    period: {
        startDate: string;
        endDate: string;
    };
}
export interface MemberStats {
    totalMembers: number;
    newMembers: number;
    activeMembers: number;
    genderDistribution: {
        _id: string;
        count: number;
    }[];
    membersWithPaidFees: number;
    coinStats: {
        avgBalance: number;
        totalCoins: number;
    };
    period: {
        startDate: string;
        endDate: string;
    };
}
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}
export interface PaginatedResponse<T = any> {
    success: boolean;
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
    message?: string;
}
export interface ValidationError {
    field: string;
    message: string;
    value?: any;
}
export interface UserFilters {
    role?: string;
    isApproved?: boolean;
    isActive?: boolean;
    search?: string;
}
export interface ReservationFilters {
    userId?: string;
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    paymentStatus?: string;
}
export interface PaymentFilters {
    userId?: string;
    reservationId?: string;
    dateFrom?: string;
    dateTo?: string;
}
export interface PaginationQuery {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export interface CourtConfig {
    operatingHours: {
        start: number;
        end: number;
    };
    pricing: {
        peakHours: number[];
        peakHourFee: number;
        offPeakFeePerMember: number;
    };
    maxPlayersPerReservation: number;
    advanceBookingDays: number;
}
export interface EnvironmentConfig {
    port: number;
    nodeEnv: string;
    mongodbUri: string;
    jwtSecret: string;
    jwtExpiresIn: string;
    weatherApiKey: string;
    weatherApiBaseUrl: string;
    weatherLat: number;
    weatherLon: number;
    freeCoinsNewUser: number;
    coinCostPerPageVisit: number;
    lowBalanceWarningThreshold: number;
}
//# sourceMappingURL=index.d.ts.map