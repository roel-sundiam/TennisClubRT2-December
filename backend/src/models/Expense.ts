import mongoose, { Schema, Document } from 'mongoose';

export interface IExpenseDocument extends Document {
  date: Date;
  amount: number;
  details: string;
  category: string;
  createdBy?: string; // Admin who created the expense
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<IExpenseDocument>({
  date: {
    type: Date,
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  details: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  category: {
    type: String,
    required: true,
    trim: true,
    enum: [
      'Purchase - Miscelleanous',
      'Delivery Fee',
      'Mineral Water',
      'Court Service',
      'Court Maintenance',
      'Purchase - Tennis Net',
      'Tennis Score Board',
      'Purchase - Lights',
      'Water System Project Expense',
      'Tournament Expense',
      'Financial Donation',
      'App Service Fee'
    ]
  },
  createdBy: {
    type: String,
    required: false
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc: any, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Index for efficient querying
ExpenseSchema.index({ date: -1, category: 1 });
ExpenseSchema.index({ amount: -1 });

const Expense = mongoose.model<IExpenseDocument>('Expense', ExpenseSchema);

export default Expense;