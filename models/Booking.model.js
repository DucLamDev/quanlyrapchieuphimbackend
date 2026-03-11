import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  bookingCode: {
    type: String,
    unique: true,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false  // Không bắt buộc cho khách vãng lai
  },
  customerInfo: {
    phone: String,
    name: String
  },
  showtimeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Showtime',
    required: true
  },
  movieId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie',
    required: true
  },
  cinemaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cinema',
    required: true
  },
  seats: [{
    row: String,
    number: Number,
    type: {
      type: String,
      enum: ['standard', 'vip', 'couple']
    },
    price: Number
  }],
  combos: [{
    comboId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Combo'
    },
    name: String,
    quantity: Number,
    price: Number
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  discount: {
    amount: Number,
    code: String,
    type: String
  },
  loyaltyPointsUsed: {
    type: Number,
    default: 0
  },
  loyaltyPointsEarned: {
    type: Number,
    default: 0
  },
  finalAmount: {
    type: Number,
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['credit-card', 'debit-card', 'e-wallet', 'cash', 'loyalty-points']
  },
  paymentDetails: {
    transactionId: String,
    paymentTime: Date,
    provider: String
  },
  status: {
    type: String,
    enum: ['confirmed', 'pending', 'cancelled', 'used', 'expired'],
    default: 'pending'
  },
  qrCode: {
    type: String
  },
  bookingType: {
    type: String,
    enum: ['online', 'counter'],
    default: 'online'
  },
  bookedBy: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: String,
    name: String
  },
  checkInTime: Date,
  cancellationReason: String,
  refundAmount: Number,
  refundTime: Date,
  groupBooking: {
    isGroup: {
      type: Boolean,
      default: false
    },
    shareLink: String,
    participants: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      status: String
    }]
  },
  notes: String
}, {
  timestamps: true
});

// Generate unique booking code
bookingSchema.pre('save', async function(next) {
  if (!this.bookingCode) {
    this.bookingCode = `BK${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }
  next();
});

// Index for efficient queries
bookingSchema.index({ userId: 1, createdAt: -1 });
// bookingCode already has unique index from schema definition
bookingSchema.index({ showtimeId: 1 });
bookingSchema.index({ status: 1, paymentStatus: 1 });

export default mongoose.model('Booking', bookingSchema);
