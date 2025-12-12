// Local type definitions for backend
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
  membershipYearsPaid: number[];
  lastMembershipPaymentDate?: Date;
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

// Analytics interfaces
export interface PageViewData {
  userId?: string;
  sessionId: string;
  page: string;
  path: string;
  referrer?: string;
  userAgent: string;
  ipAddress: string;
  duration?: number;
  deviceType: 'desktop' | 'tablet' | 'mobile';
  browser: string;
  os: string;
}

export interface UserActivityData {
  userId: string;
  sessionId: string;
  action: string;
  component: string;
  details?: any;
  ipAddress: string;
  userAgent: string;
}

export interface SessionData {
  sessionId: string;
  userId?: string;
  startTime: Date;
  ipAddress: string;
  userAgent: string;
  deviceInfo: {
    type: 'desktop' | 'tablet' | 'mobile';
    browser: string;
    os: string;
  };
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
}

// December 2025 changes: Player structure for member/guest tracking
export interface ReservationPlayer {
  name: string;
  userId?: string | null;  // MongoDB User ID for members, null for guests
  isMember: boolean;
  isGuest: boolean;
}

export interface CourtReservation {
  _id: string;
  userId: string;
  user?: User;
  date: Date;
  timeSlot: number;
  players: string[] | ReservationPlayer[]; // Support both formats for backward compatibility
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no-show' | 'blocked';
  paymentStatus: 'pending' | 'paid' | 'overdue' | 'not_applicable';
  paymentIds?: string[]; // Track multiple payment IDs (December 2025 changes)
  totalFee: number;
  weatherForecast?: {
    temperature: number;
    description: string;
    humidity: number;
    windSpeed: number;
    icon: string;
    rainChance?: number;
    timestamp: Date;
  };
  tournamentTier: '100' | '250' | '500';
  matchResults?: Array<{
    winnerId: string;
    participants: string[];
    score?: string;
  }>;
  pointsProcessed: boolean;
  // Multi-hour reservation support
  duration: number;
  endTimeSlot?: number; // Calculated automatically
  isMultiHour?: boolean; // Calculated automatically
  // Court blocking fields
  blockReason?: 'maintenance' | 'private_event' | 'weather' | 'other';
  blockNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReservationRequest {
  date: string;
  timeSlot: number;
  players: string[];
  duration?: number; // Default to 1 hour if not specified
  tournamentTier?: '100' | '250' | '500';
  totalFee?: number; // Fee calculated by frontend
}

export interface UpdateReservationRequest {
  date?: string;
  timeSlot?: number;
  endTimeSlot?: number;
  duration?: number;
  isMultiHour?: boolean;
  timeSlotDisplay?: string;
  players?: string[];
}

export interface Payment {
  _id: string;
  reservationId: string;
  userId: string;
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
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentRequest {
  reservationId: string;
  paymentMethod: 'cash' | 'bank_transfer' | 'gcash' | 'coins';
  amount?: number;
}

export interface ProcessPaymentRequest {
  transactionId?: string;
  referenceNumber?: string;
  notes?: string;
}

export interface PaymentCalculation {
  amount: number;
  isPeakHour: boolean;
  breakdown: {
    baseRate: number;
    playerCount: number;
    calculation: string;
  };
}

export interface CoinTransaction {
  _id: string;
  userId: string;
  type: 'earned' | 'spent' | 'purchased' | 'refunded' | 'bonus' | 'penalty';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  referenceId?: string;
  referenceType?: 'payment' | 'reservation' | 'purchase' | 'bonus' | 'admin_adjustment';
  metadata?: {
    source?: string;
    reason?: string;
    adminUserId?: string;
    originalAmount?: number;
    conversionRate?: number;
  };
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PurchaseCoinsRequest {
  amount: number;
  paymentMethod: 'cash' | 'bank_transfer' | 'gcash';
  paymentReference?: string;
}

export interface AwardCoinsRequest {
  userId: string;
  amount: number;
  reason: string;
}

export interface DeductCoinsRequest {
  userId: string;
  amount: number;
  reason: string;
}

export interface UseCoinsRequest {
  paymentId: string;
}

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

// Suggestion/Complaint System Types
export interface Suggestion {
  _id: string;
  userId: string;
  user?: User;
  type: 'suggestion' | 'complaint';
  category: 'facility' | 'service' | 'booking' | 'payments' | 'general' | 'staff' | 'maintenance';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  status: 'open' | 'in_review' | 'in_progress' | 'resolved' | 'closed';
  isAnonymous: boolean;
  attachments?: Array<{
    filename: string;
    path: string;
    mimetype: string;
    size: number;
  }>;
  adminResponse?: {
    responderId: string;
    responder?: User;
    response: string;
    responseDate: Date;
    actionTaken?: string;
  };
  internalNotes?: Array<{
    adminId: string;
    admin?: User;
    note: string;
    timestamp: Date;
  }>;
  resolutionDate?: Date;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSuggestionRequest {
  type: 'suggestion' | 'complaint';
  category: 'facility' | 'service' | 'booking' | 'payments' | 'general' | 'staff' | 'maintenance';
  title: string;
  description: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  isAnonymous?: boolean;
  tags?: string[];
}

export interface AdminResponseRequest {
  response: string;
  actionTaken?: string;
  status?: 'in_review' | 'in_progress' | 'resolved' | 'closed';
}

export interface InternalNoteRequest {
  note: string;
}

// Credit Management Types
export interface CreditTransaction {
  _id: string;
  userId: string;
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
    // Reservation specific metadata
    reservationDate?: Date;
    timeSlot?: number;
    // Open Play specific metadata
    pollId?: string;
    eventTitle?: string;
  };
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DepositCreditsRequest {
  amount: number;
  paymentMethod: 'cash' | 'bank_transfer' | 'gcash';
  paymentReference?: string;
  description?: string;
}

export interface AdjustCreditsRequest {
  userId: string;
  amount: number;
  type: 'deposit' | 'deduction';
  reason: string;
}

export interface CreditBalance {
  balance: number;
  pendingTransactions: number;
  lastUpdated: Date;
}

export interface CreditStats {
  totalDeposits: number;
  totalUsed: number;
  totalRefunds: number;
  currentBalance: number;
  transactionCount: number;
}

export interface RefundRequest {
  reservationId?: string;
  pollId?: string;
  amount: number;
  reason: string;
}

// Chat System Types
export interface ChatRoom {
  _id: string;
  name: string;
  description?: string;
  type: 'general' | 'admin' | 'announcement';
  isActive: boolean;
  participantRoles?: ('member' | 'admin' | 'superadmin')[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  _id: string;
  roomId: string;
  userId: string;
  user?: User;
  content: string;
  type: 'text' | 'system' | 'announcement';
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    path: string;
    mimetype: string;
    size: number;
  }>;
  metadata?: {
    systemType?: 'user_joined' | 'user_left' | 'room_created';
    mentions?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatParticipant {
  _id: string;
  roomId: string;
  userId: string;
  user?: User;
  joinedAt: Date;
  lastReadAt?: Date;
  isActive: boolean;
  notifications: boolean;
  role?: 'member' | 'moderator' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateChatRoomRequest {
  name: string;
  description?: string;
  type: 'general' | 'admin' | 'announcement';
  participantRoles?: ('member' | 'admin' | 'superadmin')[];
}

export interface SendMessageRequest {
  content: string;
  type?: 'text' | 'announcement';
  replyTo?: string;
}

export interface UpdateChatParticipantRequest {
  lastReadAt?: Date;
  notifications?: boolean;
}

export interface ChatRoomWithUnreadCount extends ChatRoom {
  unreadCount: number;
  lastMessage?: ChatMessage;
  participantCount: number;
}

export interface ChatStats {
  totalMessages: number;
  activeParticipants: number;
  todayMessages: number;
  topUsers: Array<{
    userId: string;
    username: string;
    messageCount: number;
  }>;
}

// Financial Report Types
export interface ServiceFeeLiability {
  totalAccrued: number;
  totalPaid: number;
  remainingLiability: number;
}

export interface FinancialStatementData {
  clubName: string;
  location: string;
  period: string;
  beginningBalance: {
    date: string;
    amount: number;
  };
  receiptsCollections: Array<{
    description: string;
    amount: number;
    highlighted?: boolean;
  }>;
  totalReceipts: number;
  disbursementsExpenses: Array<{
    description: string;
    amount: number;
  }>;
  totalDisbursements: number;
  netIncome: number;
  fundBalance: number;
  lastUpdated: string;
  liabilities?: {
    appServiceFee: ServiceFeeLiability;
  };
}