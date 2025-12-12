import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { User as IUser } from '../types';

export interface IUserDocument extends Omit<IUser, '_id'>, Document {
  _id: mongoose.Types.ObjectId;
  password: string;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUserDocument>({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    minlength: [2, 'Full name must be at least 2 characters long'],
    maxlength: [100, 'Full name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false
  },
  gender: {
    type: String,
    required: [true, 'Gender is required'],
    enum: {
      values: ['male', 'female', 'other'],
      message: 'Gender must be male, female, or other'
    }
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[\+]?[\d\s\-\(\)]+$/, 'Please enter a valid phone number']
  },
  dateOfBirth: {
    type: Date,
    validate: {
      validator: function(v: Date) {
        return v < new Date();
      },
      message: 'Date of birth must be in the past'
    }
  },
  profilePicture: {
    type: String,
    default: null
  },
  isApproved: {
    type: Boolean,
    default: false,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  role: {
    type: String,
    enum: {
      values: ['member', 'admin', 'superadmin'],
      message: 'Role must be member, admin, or superadmin'
    },
    default: 'member',
    index: true
  },
  creditBalance: {
    type: Number,
    default: 0,
    min: [0, 'Credit balance cannot be negative'],
    index: true
  },
  registrationDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  membershipFeesPaid: {
    type: Boolean,
    default: false,
    index: true
  },
  membershipYearsPaid: {
    type: [Number],
    default: [],
    index: true
  },
  lastMembershipPaymentDate: {
    type: Date,
    default: null
  },
  seedPoints: {
    type: Number,
    default: 0,
    min: [0, 'Seed points cannot be negative'],
    index: true
  },
  matchesWon: {
    type: Number,
    default: 0,
    min: [0, 'Matches won cannot be negative']
  },
  matchesPlayed: {
    type: Number,
    default: 0,
    min: [0, 'Matches played cannot be negative']
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete (ret as any).password;
      delete (ret as any).__v;
      return ret;
    }
  },
  toObject: {
    transform: function(doc, ret) {
      delete (ret as any).password;
      delete (ret as any).__v;
      return ret;
    }
  }
});

// Indexes for better query performance (username and email are already unique)
userSchema.index({ role: 1, isApproved: 1, isActive: 1 });
userSchema.index({ registrationDate: -1 });
userSchema.index({ lastLogin: -1 });
userSchema.index({ seedPoints: -1, matchesWon: -1 }); // For rankings

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  const user = this as IUserDocument;
  
  if (!user.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(user.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Instance method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  const user = this as IUserDocument;
  return bcrypt.compare(candidatePassword, user.password);
};

// Static method to find active, approved users
userSchema.statics.findActiveMembers = function() {
  return this.find({
    isActive: true,
    isApproved: true,
    role: { $in: ['member', 'admin'] }
  });
};

// Virtual for user age
userSchema.virtual('age').get(function(this: IUserDocument) {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

const User = mongoose.model<IUserDocument>('User', userSchema);

export default User;