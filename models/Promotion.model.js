import mongoose from 'mongoose';

const promotionSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  type: {
    type: String,
    enum: ['percentage', 'fixed-amount', 'combo-deal', 'loyalty-bonus'],
    required: true
  },
  value: {
    type: Number,
    required: true
  },
  minPurchaseAmount: {
    type: Number,
    default: 0
  },
  maxDiscountAmount: Number,
  applicableFor: {
    movies: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Movie'
    }],
    cinemas: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cinema'
    }],
    showtimes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Showtime'
    }],
    userTiers: [{
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum']
    }],
    days: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],
    timeRanges: [{
      start: String,
      end: String
    }]
  },
  usageLimit: {
    total: Number,
    perUser: Number
  },
  usageCount: {
    type: Number,
    default: 0
  },
  validFrom: {
    type: Date,
    required: true
  },
  validUntil: {
    type: Date,
    required: true
  },
  autoApply: {
    type: Boolean,
    default: false
  },
  autoApplyRules: {
    occupancyThreshold: Number,
    timeBeforeShowtime: Number
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Check if promotion is valid
promotionSchema.methods.isValid = function() {
  const now = new Date();
  return this.isActive && 
         now >= this.validFrom && 
         now <= this.validUntil &&
         (!this.usageLimit.total || this.usageCount < this.usageLimit.total);
};

export default mongoose.model('Promotion', promotionSchema);
