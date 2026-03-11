import mongoose from 'mongoose';

const movieSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Movie title is required'],
    trim: true
  },
  originalTitle: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  director: {
    type: String,
    required: true
  },
  cast: [{
    type: String
  }],
  genres: [{
    type: String,
    required: true
  }],
  duration: {
    type: Number, // in minutes
    required: [true, 'Duration is required']
  },
  language: {
    type: String,
    required: true
  },
  subtitles: [{
    type: String
  }],
  country: {
    type: String,
    required: true
  },
  releaseDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date
  },
  ageRating: {
    type: String,
    enum: ['P', 'K', 'T13', 'T16', 'T18', 'C'],
    required: true
  },
  poster: {
    type: String,
    required: true
  },
  backdrop: {
    type: String
  },
  trailer: {
    type: String
  },
  status: {
    type: String,
    enum: ['coming-soon', 'now-showing', 'ended'],
    default: 'coming-soon'
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 10
    },
    count: {
      type: Number,
      default: 0
    }
  },
  viewCount: {
    type: Number,
    default: 0
  },
  ticketsSold: {
    type: Number,
    default: 0
  },
  revenue: {
    type: Number,
    default: 0
  },
  tags: [{
    type: String
  }],
  awards: [{
    name: String,
    year: Number
  }],
  isFeature: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for search
movieSchema.index({ title: 'text', description: 'text', director: 'text' });

// Update status based on dates
movieSchema.methods.updateStatus = function() {
  const now = new Date();
  if (now < this.releaseDate) {
    this.status = 'coming-soon';
  } else if (this.endDate && now > this.endDate) {
    this.status = 'ended';
  } else {
    this.status = 'now-showing';
  }
};

export default mongoose.model('Movie', movieSchema);
