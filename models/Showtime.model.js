import mongoose from 'mongoose';

const showtimeSchema = new mongoose.Schema({
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
  room: {
    name: {
      type: String,
      required: true
    },
    capacity: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      enum: ['standard', 'imax', '4dx', 'premium'],
      default: 'standard'
    }
  },
  screenId: {
    type: mongoose.Schema.Types.ObjectId
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  date: {
    type: Date
  },
  price: {
    standard: Number,
    vip: Number,
    couple: Number
  },
  availableSeats: {
    type: Number,
    required: true
  },
  bookedSeats: [{
    row: String,
    number: Number,
    type: String,
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    }
  }],
  crowdPrediction: {
    level: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    percentage: {
      type: Number,
      default: 50
    },
    factors: [{
      factor: String,
      impact: Number
    }],
    lastUpdated: Date
  },
  status: {
    type: String,
    enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  specialPrice: {
    isActive: Boolean,
    discount: Number,
    reason: String
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
showtimeSchema.index({ movieId: 1, cinemaId: 1, date: 1 });
showtimeSchema.index({ startTime: 1 });
showtimeSchema.index({ 'crowdPrediction.level': 1 });

// Update status based on time
showtimeSchema.methods.updateStatus = function() {
  const now = new Date();
  if (now < this.startTime) {
    this.status = 'scheduled';
  } else if (now >= this.startTime && now < this.endTime) {
    this.status = 'ongoing';
  } else {
    this.status = 'completed';
  }
};

// Calculate occupancy percentage
showtimeSchema.methods.getOccupancy = function() {
  const totalSeats = this.availableSeats + this.bookedSeats.length;
  return totalSeats > 0 ? (this.bookedSeats.length / totalSeats) * 100 : 0;
};

export default mongoose.model('Showtime', showtimeSchema);
