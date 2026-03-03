import mongoose, { Schema, Document } from 'mongoose';

export interface ICreditTransactionDocument extends Document {
  userId: string;
  type: 'deposit' | 'deduction' | 'refund' | 'adjustment';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  referenceId?: string; // Payment ID, Reservation ID, Poll ID, etc.
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
    // Recording metadata
    recordedBy?: string;
    recordedAt?: Date;
  };
  status: 'pending' | 'completed' | 'failed' | 'reversed' | 'recorded';
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreditTransactionModel extends mongoose.Model<ICreditTransactionDocument> {
  createTransaction(
    userId: string,
    type: 'deposit' | 'deduction' | 'refund' | 'adjustment',
    amount: number,
    description: string,
    options?: {
      referenceId?: string;
      referenceType?: 'payment' | 'reservation' | 'poll' | 'admin_adjustment' | 'deposit';
      refundReason?: 'reservation_cancelled' | 'open_play_cancelled' | 'admin_refund' | 'partial_refund';
      metadata?: any;
      status?: 'pending' | 'completed' | 'failed' | 'reversed' | 'recorded';
    }
  ): Promise<ICreditTransactionDocument>;
  
  reverseTransaction(
    transactionId: string,
    reason: string,
    adminUserId: string
  ): Promise<ICreditTransactionDocument>;
  
  refundReservation(
    userId: string,
    reservationId: string,
    amount: number,
    reason: 'reservation_cancelled' | 'partial_refund' | 'admin_refund'
  ): Promise<ICreditTransactionDocument>;
  
  refundOpenPlay(
    userId: string,
    pollId: string,
    amount: number
  ): Promise<ICreditTransactionDocument>;
}

const creditTransactionSchema = new Schema<ICreditTransactionDocument>({
  userId: {
    type: String,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  type: {
    type: String,
    enum: {
      values: ['deposit', 'deduction', 'refund', 'adjustment'],
      message: 'Type must be deposit, deduction, refund, or adjustment'
    },
    required: [true, 'Transaction type is required'],
    index: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    validate: {
      validator: function(v: number) {
        return v !== 0;
      },
      message: 'Amount cannot be zero'
    }
  },
  balanceBefore: {
    type: Number,
    required: [true, 'Balance before is required'],
    min: [0, 'Balance cannot be negative']
  },
  balanceAfter: {
    type: Number,
    required: [true, 'Balance after is required'],
    min: [0, 'Balance cannot be negative']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  referenceId: {
    type: String,
    sparse: true,
    index: true
  },
  referenceType: {
    type: String,
    enum: {
      values: ['payment', 'reservation', 'poll', 'admin_adjustment', 'deposit'],
      message: 'Reference type must be payment, reservation, poll, admin_adjustment, or deposit'
    },
    sparse: true
  },
  refundReason: {
    type: String,
    enum: {
      values: ['reservation_cancelled', 'open_play_cancelled', 'admin_refund', 'partial_refund'],
      message: 'Refund reason must be reservation_cancelled, open_play_cancelled, admin_refund, or partial_refund'
    },
    sparse: true
  },
  metadata: {
    source: { type: String },
    reason: { type: String },
    adminUserId: { type: String, ref: 'User' },
    originalAmount: { type: Number },
    paymentMethod: { 
      type: String,
      enum: ['cash', 'bank_transfer', 'gcash']
    },
    // Reservation specific metadata
    reservationDate: { type: Date },
    timeSlot: { type: Number },
    // Open Play specific metadata
    pollId: { type: String },
    eventTitle: { type: String },
    // Recording metadata
    recordedBy: { type: String, ref: 'User' },
    recordedAt: { type: Date }
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'completed', 'failed', 'reversed', 'recorded'],
      message: 'Status must be pending, completed, failed, reversed, or recorded'
    },
    default: 'completed',
    index: true
  },
  processedAt: {
    type: Date,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for better query performance
creditTransactionSchema.index({ userId: 1, createdAt: -1 });
creditTransactionSchema.index({ userId: 1, type: 1 });
creditTransactionSchema.index({ status: 1, createdAt: -1 });
creditTransactionSchema.index({ referenceId: 1, referenceType: 1 });
creditTransactionSchema.index({ type: 1, refundReason: 1 });

// Pre-save middleware
creditTransactionSchema.pre('save', function(next) {
  const transaction = this;
  
  // Set processedAt when status changes to completed
  if (transaction.isModified('status') && transaction.status === 'completed' && !transaction.processedAt) {
    transaction.processedAt = new Date();
  }
  
  // Validate balance calculation
  if (transaction.type === 'deposit' || transaction.type === 'refund') {
    // Adding credits
    if (transaction.balanceAfter !== transaction.balanceBefore + Math.abs(transaction.amount)) {
      return next(new Error('Invalid balance calculation for credit transaction'));
    }
  } else {
    // Deducting/adjusting credits
    if (transaction.balanceAfter !== transaction.balanceBefore - Math.abs(transaction.amount)) {
      return next(new Error('Invalid balance calculation for debit transaction'));
    }
  }
  
  next();
});

// Virtual for transaction direction
creditTransactionSchema.virtual('direction').get(function(this: ICreditTransactionDocument) {
  return ['deposit', 'refund'].includes(this.type) ? 'credit' : 'debit';
});

// Virtual for formatted amount
creditTransactionSchema.virtual('formattedAmount').get(function(this: ICreditTransactionDocument) {
  const direction = this.amount >= 0 ? 'credit' : 'debit';
  const amount = Math.abs(this.amount);
  return `₱${amount.toFixed(2)}`;
});

// Virtual for formatted amount with direction
creditTransactionSchema.virtual('formattedAmountWithDirection').get(function(this: ICreditTransactionDocument) {
  const isCredit = ['deposit', 'refund'].includes(this.type);
  const amount = Math.abs(this.amount);
  return isCredit ? `+₱${amount.toFixed(2)}` : `-₱${amount.toFixed(2)}`;
});

// Static method to create a credit transaction and update user balance
creditTransactionSchema.statics.createTransaction = async function(
  userId: string,
  type: string,
  amount: number,
  description: string,
  options: {
    referenceId?: string;
    referenceType?: string;
    refundReason?: string;
    metadata?: any;
    status?: string;
  } = {}
) {
  const User = mongoose.model('User');

  // Get current user balance
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const balanceBefore = user.creditBalance || 0;
  let balanceAfter: number;

  // Calculate new balance
  if (['deposit', 'refund'].includes(type)) {
    balanceAfter = balanceBefore + Math.abs(amount);
  } else {
    balanceAfter = balanceBefore - Math.abs(amount);

    // Check if user has sufficient balance for deductions
    if (balanceAfter < 0 && type === 'deduction') {
      throw new Error('Insufficient credit balance');
    }
  }

  // Create transaction record
  const transactionStatus = options.status || 'completed';
  const transaction = new this({
    userId,
    type,
    amount,
    balanceBefore,
    balanceAfter,
    description,
    referenceId: options.referenceId,
    referenceType: options.referenceType,
    refundReason: options.refundReason,
    metadata: options.metadata,
    status: transactionStatus
  });

  await transaction.save();

  // Only update user balance if transaction is completed
  if (transactionStatus === 'completed') {
    user.creditBalance = balanceAfter;
    await user.save();
  }

  return transaction;
};

// Static method to refund a reservation
creditTransactionSchema.statics.refundReservation = async function(
  userId: string,
  reservationId: string,
  amount: number,
  reason: 'reservation_cancelled' | 'partial_refund' | 'admin_refund' = 'reservation_cancelled'
) {
  // Get reservation details for metadata
  const Reservation = mongoose.model('Reservation');
  const reservation = await Reservation.findById(reservationId);
  
  const description = reason === 'reservation_cancelled' 
    ? `Refund for cancelled reservation on ${reservation?.date ? new Date(reservation.date).toLocaleDateString() : 'unknown date'}`
    : `Partial refund for reservation on ${reservation?.date ? new Date(reservation.date).toLocaleDateString() : 'unknown date'}`;
  
  return await (this as any).createTransaction(
    userId,
    'refund',
    amount,
    description,
    {
      referenceId: reservationId,
      referenceType: 'reservation',
      refundReason: reason,
      metadata: {
        reason: `Reservation ${reason.replace('_', ' ')}`,
        reservationDate: reservation?.date,
        timeSlot: reservation?.timeSlot
      }
    }
  );
};

// Static method to refund open play
creditTransactionSchema.statics.refundOpenPlay = async function(
  userId: string,
  pollId: string,
  amount: number
) {
  // Get poll details for metadata
  const Poll = mongoose.model('Poll');
  const poll = await Poll.findById(pollId);
  
  const description = `Refund for cancelled open play: ${poll?.title || 'Unknown event'}`;
  
  return await (this as any).createTransaction(
    userId,
    'refund',
    amount,
    description,
    {
      referenceId: pollId,
      referenceType: 'poll',
      refundReason: 'open_play_cancelled',
      metadata: {
        reason: 'Open play event cancelled',
        pollId,
        eventTitle: poll?.title
      }
    }
  );
};

// Static method to get user's credit transaction history
creditTransactionSchema.statics.getUserTransactions = function(
  userId: string, 
  page: number = 1, 
  limit: number = 10,
  type?: string
) {
  const filter: any = { userId };
  if (type) {
    filter.type = type;
  }
  
  const skip = (page - 1) * limit;
  
  return this.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('userId', 'username fullName email')
    .populate('metadata.adminUserId', 'username fullName');
};

// Static method to get credit statistics
creditTransactionSchema.statics.getCreditStats = async function(startDate?: Date, endDate?: Date) {
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
        totalTransactions: { $sum: 1 },
        totalCreditsAdded: {
          $sum: {
            $cond: [
              { $in: ['$type', ['deposit', 'refund']] },
              '$amount',
              0
            ]
          }
        },
        totalCreditsUsed: {
          $sum: {
            $cond: [
              { $in: ['$type', ['deduction', 'adjustment']] },
              '$amount',
              0
            ]
          }
        }
      }
    }
  ]);
  
  const typeBreakdown = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);
  
  return {
    ...(stats[0] || {
      totalTransactions: 0,
      totalCreditsAdded: 0,
      totalCreditsUsed: 0
    }),
    typeBreakdown
  };
};

// Static method to reverse a transaction
creditTransactionSchema.statics.reverseTransaction = async function(transactionId: string, reason: string, adminUserId?: string) {
  const originalTransaction = await this.findById(transactionId);
  if (!originalTransaction) {
    throw new Error('Transaction not found');
  }

  if (originalTransaction.status === 'reversed') {
    throw new Error('Transaction already reversed');
  }

  // Create reverse transaction
  const reverseType = originalTransaction.type === 'deduction' ? 'refund' :
                     originalTransaction.type === 'deposit' ? 'adjustment' :
                     originalTransaction.type === 'refund' ? 'deduction' : 'deposit';

  const reverseTransaction = await (this as any).createTransaction(
    originalTransaction.userId,
    reverseType,
    Math.abs(originalTransaction.amount),
    `Reversal: ${reason}`,
    {
      referenceId: originalTransaction._id.toString(),
      referenceType: 'admin_adjustment',
      metadata: {
        reason,
        adminUserId,
        originalTransactionId: originalTransaction._id
      }
    }
  );

  // Mark original transaction as reversed
  originalTransaction.status = 'reversed';
  await originalTransaction.save();

  return reverseTransaction;
};

const CreditTransaction = mongoose.model<ICreditTransactionDocument, ICreditTransactionModel>('CreditTransaction', creditTransactionSchema);

export default CreditTransaction;