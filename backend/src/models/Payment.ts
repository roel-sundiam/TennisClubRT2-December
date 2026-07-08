import mongoose, { Schema, Document } from 'mongoose';

export interface IPaymentDocument extends Document {
  reservationId?: string;
  pollId?: string; // For Open Play events
  userId: string;
  paidBy?: string; // User who actually made the payment (if different from userId)
  amount: number;
  currency: string;
  paymentMethod: 'cash' | 'bank_transfer' | 'gcash' | 'coins';
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'record';
  transactionId?: string;
  referenceNumber?: string;
  paymentDate?: Date;
  dueDate?: Date;
  description: string;
  notes?: string; // Additional notes, including admin overrides
  approvedBy?: string; // Admin who approved the payment
  approvedAt?: Date; // When payment was approved
  recordedBy?: string; // Admin who recorded the payment
  recordedAt?: Date; // When payment was recorded
  proofOfPaymentPath?: string; // Supabase Storage path (private bucket), not a public URL
  proofOfPaymentUploadedAt?: Date;
  proofOfPaymentUploadedBy?: string; // User who uploaded the proof
  paymentType?: 'court_usage' | 'membership_fee' | 'tournament_entry' | 'cancellation_fee'; // Type of payment
  membershipYear?: number; // Year for membership fee (e.g., 2026)
  metadata?: {
    timeSlot?: number;
    date?: Date;
    playerCount?: number;
    isPeakHour?: boolean;
    originalFee?: number;
    isAdminOverride?: boolean; // Flag for admin custom amounts
    discounts?: Array<{
      type: string;
      amount: number;
      description: string;
    }>;
    // Open Play specific metadata
    openPlayEventTitle?: string;
    openPlayEventDate?: Date;
    // Manual payment specific metadata
    isManualPayment?: boolean;
    playerNames?: string[];
    courtUsageDate?: Date;
    startTime?: number;
    endTime?: number;
    createdBy?: string;
    createdById?: string;
    // Cancellation metadata
    cancellation?: {
      reason: string;
      cancelledAt: Date;
      cancelledBy: string;
      previousStatus: string;
    };
    // Pay on behalf metadata
    paidOnBehalf?: boolean; // Indicates payment was made by someone else
    originalDebtor?: string; // Name of the person who owes the payment
    // Assigned expense metadata
    isAssignedExpense?: boolean; // Flag for admin-assigned expenses (e.g. tournament entry fees)
    reason?: string; // Optional reason/notes for assigned expense
  };
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPaymentDocument>({
  reservationId: {
    type: String,
    ref: 'Reservation',
    index: true
  },
  pollId: {
    type: String,
    ref: 'Poll',
    index: true
  },
  userId: {
    type: String,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  paidBy: {
    type: String,
    ref: 'User',
    index: true
  },
  paymentType: {
    type: String,
    enum: {
      values: ['court_usage', 'membership_fee', 'tournament_entry', 'cancellation_fee'],
      message: 'Payment type must be court_usage, membership_fee, tournament_entry, or cancellation_fee'
    },
    default: 'court_usage',
    index: true
  },
  membershipYear: {
    type: Number,
    index: true
  },
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [0, 'Amount cannot be negative'],
    validate: {
      validator: function(v: number) {
        return v >= 0;
      },
      message: 'Payment amount cannot be negative'
    }
  },
  currency: {
    type: String,
    enum: {
      values: ['PHP', 'USD'],
      message: 'Currency must be PHP or USD'
    },
    default: 'PHP'
  },
  paymentMethod: {
    type: String,
    enum: {
      values: ['cash', 'bank_transfer', 'gcash', 'coins'],
      message: 'Payment method must be cash, bank_transfer, gcash, or coins'
    },
    required: [true, 'Payment method is required'],
    index: true
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'completed', 'failed', 'refunded', 'record'],
      message: 'Status must be pending, completed, failed, refunded, or record'
    },
    default: 'completed', // Payments are automatically completed when made
    index: true
  },
  transactionId: {
    type: String,
    sparse: true,
    index: true
  },
  referenceNumber: {
    type: String,
    sparse: true,
    index: true
  },
  paymentDate: {
    type: Date,
    index: true
  },
  dueDate: {
    type: Date,
    index: true
  },
  description: {
    type: String,
    required: [true, 'Payment description is required'],
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  approvedBy: {
    type: String,
    ref: 'User',
    index: true
  },
  approvedAt: {
    type: Date,
    index: true
  },
  recordedBy: {
    type: String,
    ref: 'User',
    index: true
  },
  recordedAt: {
    type: Date,
    index: true
  },
  proofOfPaymentPath: {
    type: String
  },
  proofOfPaymentUploadedAt: {
    type: Date
  },
  proofOfPaymentUploadedBy: {
    type: String,
    ref: 'User'
  },
  metadata: {
    timeSlot: { type: Number },
    date: { type: Date },
    playerCount: { type: Number },
    isPeakHour: { type: Boolean },
    originalFee: { type: Number },
    isAdminOverride: { type: Boolean }, // Flag for admin custom amounts
    discounts: [{
      type: { type: String, required: true },
      amount: { type: Number, required: true },
      description: { type: String, required: true }
    }],
    // Open Play specific metadata
    openPlayEventTitle: { type: String },
    openPlayEventDate: { type: Date },
    // Manual payment specific metadata
    isManualPayment: { type: Boolean },
    playerNames: [{ type: String }],
    courtUsageDate: { type: Date },
    startTime: { type: Number },
    endTime: { type: Number },
    createdBy: { type: String },
    createdById: { type: String },
    // Cancellation metadata
    cancellation: {
      reason: { type: String },
      cancelledAt: { type: Date },
      cancelledBy: { type: String },
      previousStatus: { type: String }
    },
    // Pay on behalf metadata
    paidOnBehalf: { type: Boolean },
    originalDebtor: { type: String },
    // Assigned expense metadata
    isAssignedExpense: { type: Boolean },
    reason: { type: String }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for better query performance
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ reservationId: 1, status: 1 });
paymentSchema.index({ pollId: 1, status: 1 }); // For Open Play payments
paymentSchema.index({ paymentDate: -1, status: 1 });
paymentSchema.index({ dueDate: 1, status: 1 });
paymentSchema.index({ status: 1, paymentMethod: 1 });
paymentSchema.index({ paymentType: 1, status: 1 }); // For filtering by payment type
paymentSchema.index({ userId: 1, paymentType: 1, membershipYear: 1 }); // For membership fee queries

// Pre-save middleware to set payment date when status changes to completed
paymentSchema.pre('save', function(next) {
  const payment = this;

  // Check if this is a manual payment or membership fee
  const isManualPayment = payment.metadata?.isManualPayment;
  const isMembershipFee = payment.paymentType === 'membership_fee';
  const isAssignedExpense = payment.metadata?.isAssignedExpense === true;

  // Validate payment type requirements
  if (isMembershipFee) {
    // Membership fee payments must have a membership year
    if (!payment.membershipYear) {
      return next(new Error('Membership fee payments must have a membership year'));
    }

    // Membership fees should not have reservationId or pollId
    if (payment.reservationId || payment.pollId) {
      return next(new Error('Membership fee payments cannot have reservationId or pollId'));
    }
  } else if (isAssignedExpense) {
    // Admin-assigned expenses (e.g. tournament entry fees) — no reservationId/pollId required
  } else if (!isManualPayment) {
    // Regular court usage payments need reservationId or pollId
    if (!payment.reservationId && !payment.pollId) {
      return next(new Error('Either reservationId or pollId must be provided'));
    }

    // Validate that both are not provided at the same time
    if (payment.reservationId && payment.pollId) {
      return next(new Error('Cannot have both reservationId and pollId'));
    }
  } else {
    // Manual payments should not have reservationId or pollId
    if (payment.reservationId || payment.pollId) {
      return next(new Error('Manual payments cannot have reservationId or pollId'));
    }

    // Validate manual payment required fields
    if (!payment.metadata?.playerNames || payment.metadata.playerNames.length === 0) {
      return next(new Error('Manual payments must have player names'));
    }

    if (!payment.metadata?.courtUsageDate) {
      return next(new Error('Manual payments must have court usage date'));
    }
  }
  
  // Set payment date when status is completed or record
  // This ensures all completed/record payments have paymentDate for reporting
  if (!payment.paymentDate && ['completed', 'record'].includes(payment.status)) {
    if (payment.isNew || payment.isModified('status')) {
      // Status just changed or payment is new
      payment.paymentDate = new Date();
    } else if (payment.isModified()) {
      // Payment is being modified but status wasn't changed - still ensure paymentDate exists
      // Use recordedAt/approvedAt as fallback, or current time
      payment.paymentDate = payment.recordedAt || payment.approvedAt || payment.updatedAt || new Date();
    }
  }
  
  // Generate reference number if not provided
  if (payment.isNew && !payment.referenceNumber) {
    const timestamp = Date.now().toString();
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    payment.referenceNumber = `TC-${timestamp}-${randomSuffix}`;
  }
  
  next();
});

// Virtual for payment status display
paymentSchema.virtual('statusDisplay').get(function(this: IPaymentDocument) {
  const statusMap = {
    pending: 'Pending Payment',
    completed: 'Paid',
    failed: 'Payment Failed',
    refunded: 'Refunded',
    record: 'Record'
  };
  return statusMap[this.status];
});

// Virtual for formatted amount
paymentSchema.virtual('formattedAmount').get(function(this: IPaymentDocument) {
  if (this.currency === 'PHP') {
    return `₱${this.amount.toFixed(2)}`;
  }
  return `$${this.amount.toFixed(2)}`;
});

// Virtual for overdue status
paymentSchema.virtual('isOverdue').get(function(this: IPaymentDocument) {
  if (this.status === 'completed' || this.status === 'refunded' || this.status === 'record') {
    return false;
  }
  return this.dueDate ? new Date() > this.dueDate : false;
});

// Virtual for days until due
paymentSchema.virtual('daysUntilDue').get(function(this: IPaymentDocument) {
  if (this.status === 'completed' || this.status === 'refunded' || this.status === 'record') {
    return null;
  }
  if (!this.dueDate) return null;
  const today = new Date();
  const diffTime = this.dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for whether proof of payment has been uploaded
paymentSchema.virtual('hasProofOfPayment').get(function(this: IPaymentDocument) {
  return !!this.proofOfPaymentPath;
});

// Static method to calculate payment amount based on reservation details
paymentSchema.statics.calculatePaymentAmount = async function(
  timeSlot: number, 
  players: string[], 
  date: Date
): Promise<{
  amount: number;
  isPeakHour: boolean;
  breakdown: {
    baseRate: number;
    playerCount: number;
    memberCount: number;
    nonMemberCount: number;
    calculation: string;
  };
}> {
  const peakHours = (process.env.PEAK_HOURS || '5,18,19,20,21').split(',').map(h => parseInt(h));
  const peakHourFee = parseInt(process.env.PEAK_HOUR_FEE || '100');
  const offPeakFeePerMember = parseInt(process.env.OFF_PEAK_FEE_PER_MEMBER || '20');
  const offPeakFeePerNonMember = parseInt(process.env.OFF_PEAK_FEE_PER_NON_MEMBER || '50');
  
  const isPeakHour = peakHours.includes(timeSlot);
  
  // Get all active members for player categorization
  const mongoose = require('mongoose');
  const User = mongoose.model('User');
  const members = await User.find({
    role: { $in: ['member', 'admin'] },
    isActive: true,
    isApproved: true
  }).select('fullName').lean();
  
  const memberNames = members.map((m: any) => m.fullName.toLowerCase().trim());
  
  // Categorize players as members or non-members
  let memberCount = 0;
  let nonMemberCount = 0;
  
  players.forEach(playerName => {
    const cleanPlayerName = playerName.toLowerCase().trim();
    const isFoundInMembers = memberNames.includes(cleanPlayerName);
    
    if (isFoundInMembers) {
      memberCount++;
    } else {
      // Try fuzzy matching for common name variations
      const fuzzyMatch = memberNames.find((memberName: string) => {
        const similarity = calculateStringSimilarity(cleanPlayerName, memberName);
        return similarity > 0.8;
      });
      
      if (fuzzyMatch) {
        memberCount++;
      } else {
        nonMemberCount++;
      }
    }
  });
  
  if (isPeakHour) {
    // Peak hours: calculate fee with ₱100 minimum
    const calculatedFee = (memberCount * offPeakFeePerMember) + (nonMemberCount * offPeakFeePerNonMember);
    const amount = Math.max(peakHourFee, calculatedFee);
    return {
      amount,
      isPeakHour: true,
      breakdown: {
        baseRate: peakHourFee,
        playerCount: players.length,
        memberCount,
        nonMemberCount,
        calculation: `Peak hour: max(₱${peakHourFee}, ${memberCount} members × ₱${offPeakFeePerMember} + ${nonMemberCount} non-members × ₱${offPeakFeePerNonMember}) = ₱${amount}`
      }
    };
  } else {
    // Off-peak hours: member/non-member based pricing
    const amount = (memberCount * offPeakFeePerMember) + (nonMemberCount * offPeakFeePerNonMember);
    return {
      amount,
      isPeakHour: false,
      breakdown: {
        baseRate: offPeakFeePerMember,
        playerCount: players.length,
        memberCount,
        nonMemberCount,
        calculation: `${memberCount} members × ₱${offPeakFeePerMember} + ${nonMemberCount} non-members × ₱${offPeakFeePerNonMember} = ₱${amount}`
      }
    };
  }
};

// Helper function for string similarity
function calculateStringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (str1.length === 0 || str2.length === 0) return 0.0;
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0]![j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1,
          matrix[i]![j - 1]! + 1,
          matrix[i - 1]![j]! + 1
        );
      }
    }
  }
  
  const maxLength = Math.max(str1.length, str2.length);
  const distance = matrix[str2.length]?.[str1.length] ?? maxLength;
  
  return (maxLength - distance) / maxLength;
}

// Static method to get payments by user
paymentSchema.statics.getPaymentsByUser = function(userId: string, status?: string) {
  const filter: any = { userId };
  if (status) {
    filter.status = status;
  }
  
  return this.find(filter)
    .populate('reservationId', 'date timeSlot players tennisBalls')
    .sort({ createdAt: -1 });
};

// Static method to get overdue payments
paymentSchema.statics.getOverduePayments = function() {
  const today = new Date();
  return this.find({
    status: 'pending',
    dueDate: { $lt: today }
  })
    .populate('userId', 'username fullName email')
    .populate('reservationId', 'date timeSlot tennisBalls')
    .sort({ dueDate: 1 });
};

// Static method to get payment statistics
paymentSchema.statics.getPaymentStats = async function(startDate?: Date, endDate?: Date) {
  const matchStage: any = {};
  
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = startDate;
    if (endDate) matchStage.createdAt.$lte = endDate;
  }
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalPayments: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        completedPayments: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        completedAmount: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0] }
        },
        pendingPayments: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        pendingAmount: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] }
        },
        avgPaymentAmount: { $avg: '$amount' }
      }
    }
  ]);
  
  return stats[0] || {
    totalPayments: 0,
    totalAmount: 0,
    completedPayments: 0,
    completedAmount: 0,
    pendingPayments: 0,
    pendingAmount: 0,
    avgPaymentAmount: 0
  };
};

const Payment = mongoose.model<IPaymentDocument>('Payment', paymentSchema);

export default Payment;