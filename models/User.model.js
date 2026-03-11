import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  avatar: {
    type: String,
    default: 'https://res.cloudinary.com/demo/image/upload/avatar-default.png'
  },
  role: {
    type: String,
    enum: ['customer', 'staff', 'admin'],
    default: 'customer'
  },
  cinemaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cinema'
    // Không bắt buộc ở schema level
    // Sẽ validate trong booking controller
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
  },
  preferences: {
    favoriteGenres: [String],
    preferredLanguages: [String],
    notificationEnabled: {
      type: Boolean,
      default: true
    }
  },
  loyaltyPoints: {
    type: Number,
    default: 0
  },
  loyaltyTier: {
    type: String,
    enum: ['bronze', 'silver', 'gold', 'platinum'],
    default: 'bronze'
  },
  watchHistory: [{
    movieId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Movie'
    },
    watchedAt: {
      type: Date,
      default: Date.now
    },
    rating: Number
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  lastLogin: Date
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Update loyalty tier based on points
userSchema.methods.updateLoyaltyTier = function() {
  if (this.loyaltyPoints >= 10000) {
    this.loyaltyTier = 'platinum';
  } else if (this.loyaltyPoints >= 5000) {
    this.loyaltyTier = 'gold';
  } else if (this.loyaltyPoints >= 2000) {
    this.loyaltyTier = 'silver';
  } else {
    this.loyaltyTier = 'bronze';
  }
};

export default mongoose.model('User', userSchema);
