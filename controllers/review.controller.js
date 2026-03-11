import Review from '../models/Review.model.js';
import Movie from '../models/Movie.model.js';
import Booking from '../models/Booking.model.js';
import User from '../models/User.model.js';
import Sentiment from 'sentiment';

const sentiment = new Sentiment();

// Update movie rating
const updateMovieRating = async (movieId) => {
  const reviews = await Review.find({ movieId, isVisible: true });
  
  if (reviews.length === 0) return;

  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = totalRating / reviews.length;

  await Movie.findByIdAndUpdate(movieId, {
    'rating.average': averageRating,
    'rating.count': reviews.length
  });
};

// @desc    Get reviews for a movie
// @route   GET /api/reviews/movie/:movieId
// @access  Public
export const getReviews = async (req, res, next) => {
  try {
    const { movieId } = req.params;
    const { page = 1, limit = 10, sort = '-createdAt' } = req.query;

    const reviews = await Review.find({
      movieId,
      isVisible: true,
      moderationStatus: 'approved'
    })
      .populate('userId', 'fullName avatar')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Review.countDocuments({
      movieId,
      isVisible: true,
      moderationStatus: 'approved'
    });

    res.status(200).json({
      success: true,
      count: reviews.length,
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      reviews
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check if user can review a movie
// @route   GET /api/reviews/can-review/:movieId
// @access  Private
export const canReviewMovie = async (req, res, next) => {
  try {
    const { movieId } = req.params;

    // Check if user already reviewed this movie
    const existingReview = await Review.findOne({
      userId: req.user.id,
      movieId
    });

    if (existingReview) {
      return res.status(200).json({
        success: true,
        canReview: false,
        reason: 'already_reviewed',
        message: 'Bạn đã đánh giá phim này rồi'
      });
    }

    // Check if user has a confirmed/used booking for this movie
    const booking = await Booking.findOne({
      userId: req.user.id,
      movieId,
      $or: [
        { status: 'used' },
        { status: 'confirmed', paymentStatus: { $in: ['completed', 'paid'] } }
      ]
    });

    if (!booking) {
      return res.status(200).json({
        success: true,
        canReview: false,
        reason: 'no_purchase',
        message: 'Bạn cần mua vé xem phim này trước khi đánh giá'
      });
    }

    return res.status(200).json({
      success: true,
      canReview: true,
      message: 'Bạn có thể đánh giá phim này'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create review
// @route   POST /api/reviews
// @access  Private
export const createReview = async (req, res, next) => {
  try {
    const { movieId, rating, title, content } = req.body;

    // Check if user already reviewed this movie
    const existingReview = await Review.findOne({
      userId: req.user.id,
      movieId
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã đánh giá phim này rồi'
      });
    }

    // REQUIRED: Check if user has purchased ticket for this movie
    const booking = await Booking.findOne({
      userId: req.user.id,
      movieId,
      $or: [
        { status: 'used' },
        { status: 'confirmed', paymentStatus: { $in: ['completed', 'paid'] } }
      ]
    });

    if (!booking) {
      return res.status(403).json({
        success: false,
        message: 'Bạn cần mua vé xem phim này trước khi đánh giá'
      });
    }

    // Analyze sentiment
    const sentimentResult = sentiment.analyze(content);
    const sentimentLabel = sentimentResult.score > 0 ? 'positive' : 
                          sentimentResult.score < 0 ? 'negative' : 'neutral';

    const review = await Review.create({
      userId: req.user.id,
      movieId,
      rating,
      title,
      content,
      sentiment: {
        score: sentimentResult.score,
        label: sentimentLabel
      },
      isVerifiedPurchase: true // Always true now since we require purchase
    });

    // Update movie rating
    await updateMovieRating(movieId);

    // Update user watch history
    const user = await User.findById(req.user.id);
    const watchIndex = user.watchHistory.findIndex(
      w => w.movieId.toString() === movieId
    );
    
    if (watchIndex === -1) {
      user.watchHistory.push({
        movieId,
        rating
      });
    } else {
      user.watchHistory[watchIndex].rating = rating;
    }
    await user.save();

    res.status(201).json({
      success: true,
      review
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update review
// @route   PUT /api/reviews/:id
// @access  Private
export const updateReview = async (req, res, next) => {
  try {
    let review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check ownership
    if (review.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this review'
      });
    }

    // Update sentiment if content changed
    if (req.body.content) {
      const sentimentResult = sentiment.analyze(req.body.content);
      req.body.sentiment = {
        score: sentimentResult.score,
        label: sentimentResult.score > 0 ? 'positive' : 
               sentimentResult.score < 0 ? 'negative' : 'neutral'
      };
    }

    review = await Review.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    // Update movie rating if rating changed
    if (req.body.rating) {
      await updateMovieRating(review.movieId);
    }

    res.status(200).json({
      success: true,
      review
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete review
// @route   DELETE /api/reviews/:id
// @access  Private
export const deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check ownership or admin
    if (review.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this review'
      });
    }

    await review.deleteOne();

    // Update movie rating
    await updateMovieRating(review.movieId);

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Like/unlike review
// @route   POST /api/reviews/:id/like
// @access  Private
export const likeReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    const likeIndex = review.likes.indexOf(req.user.id);
    const dislikeIndex = review.dislikes.indexOf(req.user.id);

    if (req.body.action === 'like') {
      if (likeIndex === -1) {
        review.likes.push(req.user.id);
        if (dislikeIndex !== -1) {
          review.dislikes.splice(dislikeIndex, 1);
        }
      } else {
        review.likes.splice(likeIndex, 1);
      }
    } else if (req.body.action === 'dislike') {
      if (dislikeIndex === -1) {
        review.dislikes.push(req.user.id);
        if (likeIndex !== -1) {
          review.likes.splice(likeIndex, 1);
        }
      } else {
        review.dislikes.splice(dislikeIndex, 1);
      }
    }

    await review.save();

    res.status(200).json({
      success: true,
      likes: review.likes.length,
      dislikes: review.dislikes.length
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all reviews (Admin)
// @route   GET /api/reviews
// @access  Private/Admin
export const getAllReviews = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      sort = '-createdAt', 
      sentiment: sentimentFilter,
      status,
      movieId,
      search 
    } = req.query;

    const query = {};
    
    if (sentimentFilter && sentimentFilter !== 'all') {
      query['sentiment.label'] = sentimentFilter;
    }
    
    if (status && status !== 'all') {
      query.moderationStatus = status;
    }
    
    if (movieId) {
      query.movieId = movieId;
    }

    const reviews = await Review.find(query)
      .populate('userId', 'fullName email avatar')
      .populate('movieId', 'title poster')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const count = await Review.countDocuments(query);
    
    // Get stats
    const stats = await Review.aggregate([
      {
        $group: {
          _id: '$moderationStatus',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const statsObj = {
      total: count,
      pending: 0,
      approved: 0,
      rejected: 0
    };
    
    stats.forEach(s => {
      statsObj[s._id] = s.count;
    });

    res.status(200).json({
      success: true,
      count: reviews.length,
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      stats: statsObj,
      data: reviews
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Moderate review (Admin)
// @route   PUT /api/reviews/:id/moderate
// @access  Private/Admin
export const moderateReview = async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Trạng thái không hợp lệ'
      });
    }

    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đánh giá'
      });
    }

    review.moderationStatus = status;
    review.moderationReason = reason || '';
    review.isVisible = status === 'approved';
    
    await review.save();

    // Update movie rating
    await updateMovieRating(review.movieId);

    res.status(200).json({
      success: true,
      message: `Đánh giá đã được ${status === 'approved' ? 'phê duyệt' : status === 'rejected' ? 'từ chối' : 'đặt chờ duyệt'}`,
      review
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle review visibility (Admin)
// @route   PUT /api/reviews/:id/visibility
// @access  Private/Admin
export const toggleReviewVisibility = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đánh giá'
      });
    }

    review.isVisible = !review.isVisible;
    await review.save();

    // Update movie rating
    await updateMovieRating(review.movieId);

    res.status(200).json({
      success: true,
      message: review.isVisible ? 'Đánh giá đã được hiển thị' : 'Đánh giá đã được ẩn',
      isVisible: review.isVisible
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's review for a movie
// @route   GET /api/reviews/my-review/:movieId
// @access  Private
export const getMyReview = async (req, res, next) => {
  try {
    const { movieId } = req.params;

    const review = await Review.findOne({
      userId: req.user.id,
      movieId
    }).populate('userId', 'fullName avatar');

    res.status(200).json({
      success: true,
      review: review || null
    });
  } catch (error) {
    next(error);
  }
};
