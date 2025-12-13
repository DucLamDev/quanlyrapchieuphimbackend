import mongoose from 'mongoose';

const seatSchema = new mongoose.Schema({
  row: String,
  number: Number,
  type: {
    type: String,
    enum: ['standard', 'vip', 'couple'],
    default: 'standard'
  },
  status: {
    type: String,
    enum: ['available', 'maintenance'],
    default: 'available'
  }
});

const screenSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  capacity: {
    type: Number,
    required: true
  },
  screenType: {
    type: String,
    enum: ['2D', '3D', 'IMAX', '4DX'],
    default: '2D'
  },
  seats: {
    layout: [[seatSchema]], // 2D array representing seat layout
    total: Number,
    vip: Number,
    couple: Number,
    standard: Number
  },
  amenities: [{
    type: String
  }],
  isActive: {
    type: Boolean,
    default: true
  }
});

const cinemaSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Cinema name is required'],
    trim: true
  },
  location: {
    address: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    district: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  screens: [screenSchema],
  facilities: [{
    type: String,
    enum: ['parking', 'food-court', 'arcade', 'wifi', 'wheelchair-access', '3d-available', 'imax']
  }],
  images: [{
    type: String
  }],
  contactInfo: {
    phone: String,
    email: String,
    website: String
  },
  operatingHours: {
    open: String,
    close: String
  },
  priceList: {
    standard: {
      weekday: Number,
      weekend: Number
    },
    vip: {
      weekday: Number,
      weekend: Number
    },
    couple: {
      weekday: Number,
      weekend: Number
    }
  },
  rating: {
    average: {
      type: Number,
      default: 0
    },
    count: {
      type: Number,
      default: 0
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for location-based queries
cinemaSchema.index({ 'location.coordinates': '2dsphere' });

export default mongoose.model('Cinema', cinemaSchema);
