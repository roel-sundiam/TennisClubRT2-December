// User Management Types
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
  creditBalance: number;
  registrationDate: Date;
  lastLogin?: Date;
  membershipFeesPaid: boolean;
  seedPoints: number;
  matchesWon: number;
  matchesPlayed: number;
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

// Analytics Types
export interface AnalyticsPageView {
  userId?: string;
  sessionId: string;
  page: string;
  path: string;
  referrer?: string;
  duration?: number;
}

export interface AnalyticsUserActivity {
  userId: string;
  sessionId: string;
  action: string;
  component: string;
  details?: any;
}

export interface AnalyticsStats {
  pageViews: {
    totalViews: number;
    uniqueUsers: number;
    uniqueSessions: number;
    avgDuration: number;
  };
  popularPages: Array<{
    page: string;
    views: number;
    uniqueUsers: number;
    avgDuration: number;
    lastVisit: Date;
  }>;
  userActivity: Array<{
    action: string;
    count: number;
    uniqueUsers: number;
  }>;
  engagement: {
    totalSessions: number;
    avgDuration: number;
    avgPageViews: number;
    avgActions: number;
    bounceRate: number;
  };
  deviceBreakdown: Record<string, number>;
  browserBreakdown: Record<string, number>;
  dateRange: {
    from: Date;
    to: Date;
  };
}

// Court Reservation Types
export interface CourtReservation {
  _id: string;
  userId: string;
  user?: User;
  date: Date;
  timeSlot: number; // Hour (5-22)
  players: string[]; // Array of player names
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  paymentStatus: 'pending' | 'paid' | 'overdue';
  totalFee: number;
  tournamentTier: '100' | '250' | '500';
  matchResults?: Array<{
    winnerId: string;
    participants: string[];
    score?: string;
  }>;
  pointsProcessed: boolean;
  weatherForecast?: WeatherInfo;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReservationRequest {
  date: string;
  timeSlot: number;
  players: string[];
  tournamentTier?: '100' | '250' | '500';
}

export interface UpdateReservationRequest {
  date?: string;
  timeSlot?: number;
  players?: string[];
}

// Payment Types
export interface Payment {
  _id: string;
  reservationId?: string;
  pollId?: string; // For Open Play events
  userId: string;
  user?: User;
  reservation?: CourtReservation;
  poll?: {
    _id: string;
    title: string;
    openPlayEvent?: {
      eventDate: Date;
      startTime: number;
      endTime: number;
    };
  };
  amount: number;
  currency: string;
  paymentMethod: 'cash' | 'bank_transfer' | 'gcash' | 'coins';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  transactionId?: string;
  referenceNumber?: string;
  paymentDate?: Date;
  dueDate: Date;
  description: string;
  metadata?: {
    timeSlot?: number;
    date?: Date;
    playerCount?: number;
    isPeakHour?: boolean;
    originalFee?: number;
    discounts?: Array<{
      type: string;
      amount: number;
      description: string;
    }>;
    // Open Play specific metadata
    openPlayEventTitle?: string;
    openPlayEventDate?: Date;
  };
  // Computed fields
  formattedAmount?: string;
  statusDisplay?: string;
  isOverdue?: boolean;
  daysUntilDue?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentRequest {
  reservationId?: string;
  pollId?: string; // For Open Play events
  paymentMethod: 'cash' | 'bank_transfer' | 'gcash' | 'coins';
  amount?: number;
  transactionId?: string;
  notes?: string;
}

export interface PaymentSummary {
  totalAmount: number;
  totalPayments: number;
  pendingAmount: number;
  pendingPayments: number;
}

// Weather Types
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

// Coin System Types
export interface CoinTransaction {
  _id: string;
  userId: string;
  user?: User;
  type: 'earned' | 'spent' | 'admin_added' | 'admin_removed';
  amount: number;
  reason: string;
  relatedEntity?: string; // page visited, feature used, etc.
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

// Poll System Types
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
  voters: string[]; // User IDs who voted for this option
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
  pollsByStatus: { _id: string; count: number }[];
  recentPolls: number;
  averageParticipation: number;
  pollsByCategory: { _id: string; count: number }[];
  period: {
    startDate: string;
    endDate: string;
  };
}

// Suggestion/Complaint Types
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

// Analytics Types
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
  popularPages: { page: string; visits: number }[];
  recentActivity: PageVisit[];
}

// Report Types
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
  genderDistribution: { _id: string; count: number }[];
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
  genderDistribution: { _id: string; count: number }[];
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

// API Response Types
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

// Validation Types
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// Filter and Query Types
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
  pollId?: string; // For Open Play events
  status?: string;
  paymentMethod?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Court Configuration Types
export interface CourtConfig {
  operatingHours: {
    start: number; // 5 (5 AM)
    end: number;   // 22 (10 PM)
  };
  pricing: {
    peakHours: number[];
    peakHourFee: number;
    offPeakFeePerMember: number;
  };
  maxPlayersPerReservation: number;
  advanceBookingDays: number;
}

// Environment Configuration Types
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

// Seeding & Rankings Types
export interface MatchResult {
  winnerId: string;
  participants: string[];
  score?: string;
}

export interface CompleteReservationRequest {
  matchResults?: MatchResult[];
}

export interface PlayerRanking {
  _id: string;
  username: string;
  fullName: string;
  seedPoints: number;
  matchesWon: number;
  matchesPlayed: number;
  winRate: number;
  rank: number;
}

export interface PlayerStats {
  user: User;
  rank: number;
  totalPlayers: number;
  recentMatches: Array<{
    date: Date;
    tournamentTier: string;
    result: 'won' | 'played';
    points: number;
    opponents: string[];
  }>;
}

export interface TournamentStats {
  totalMatches: number;
  matchesByTier: Record<string, number>;
  totalPointsAwarded: number;
  activeRankedPlayers: number;
}