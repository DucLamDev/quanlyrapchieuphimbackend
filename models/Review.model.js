import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  movieId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie',
    required: true
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: 1,
    max: 10
  },
  title: {
    type: String,
    trim: true
  },
  content: {
    type: String,
    required: [true, 'Review content is required'],
    trim: true
  },
  sentiment: {
    score: Number,
    label: {
      type: String,
      enum: ['positive', 'negative', 'neutral']
    }
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  dislikes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isVerifiedPurchase: {
    type: Boolean,
    default: false
  },
  isVisible: {
    type: Boolean,
    default: true
  },
  moderationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
  },
  moderationReason: String
}, {
  timestamps: true
});

// Index for efficient queries
reviewSchema.index({ movieId: 1, createdAt: -1 });
reviewSchema.index({ userId: 1 });

export default mongoose.model('Review', reviewSchema);
