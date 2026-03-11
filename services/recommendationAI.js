import Movie from '../models/Movie.model.js';
import Booking from '../models/Booking.model.js';
import Review from '../models/Review.model.js';
import User from '../models/User.model.js';
import { logger } from '../utils/logger.js';

/**
 * AI Recommendation Service
 * Uses Collaborative Filtering + Content-based Filtering
 */

class RecommendationAI {
  /**
   * Get personalized movie recommendations for a user
   * @param {String} userId - User ID
   * @param {Number} limit - Number of recommendations
   * @returns {Array} Recommended movies with scores
   */
  async getRecommendations(userId, limit = 10) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      // Get user's viewing history
      const bookings = await Booking.find({ userId })
        .populate('showtimeId')
        .sort({ createdAt: -1 })
        .limit(50);

      // Get user's reviews
      const reviews = await Review.find({ userId })
        .sort({ createdAt: -1 })
        .limit(30);

      // Extract movie IDs and preferences
      const watchedMovieIds = new Set();
      const genrePreferences = {};
      const timePreferences = {};

      // Analyze booking patterns
      bookings.forEach(booking => {
        if (booking.showtimeId?.movieId) {
          watchedMovieIds.add(booking.showtimeId.movieId.toString());
          
          // Track time preferences
          const hour = new Date(booking.showtimeId.startTime).getHours();
          const timeSlot = this._getTimeSlot(hour);
          timePreferences[timeSlot] = (timePreferences[timeSlot] || 0) + 1;
        }
      });

      // Analyze review patterns
      const highRatedMovies = await Review.find({ 
        userId, 
        rating: { $gte: 4 } 
      }).populate('movieId');

      highRatedMovies.forEach(review => {
        if (review.movieId?.genres) {
          review.movieId.genres.forEach(genre => {
            genrePreferences[genre] = (genrePreferences[genre] || 0) + 1;
          });
        }
      });

      // Get collaborative filtering suggestions
      const collaborativeMovies = await this._collaborativeFiltering(userId, watchedMovieIds);

      // Get content-based suggestions
      const contentBasedMovies = await this._contentBasedFiltering(
        genrePreferences, 
        watchedMovieIds
      );

      // Combine and score recommendations
      const recommendations = this._combineRecommendations(
        collaborativeMovies,
        contentBasedMovies,
        genrePreferences,
        timePreferences
      );

      // Sort by score and limit
      return recommendations
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    } catch (error) {
      logger.error('Recommendation AI Error:', error);
      throw error;
    }
  }

  /**
   * Collaborative Filtering - find similar users and their preferences
   */
  async _collaborativeFiltering(userId, watchedMovieIds) {
    try {
      // Find users who watched similar movies
      const similarUsers = await Booking.aggregate([
        {
          $lookup: {
            from: 'showtimes',
            localField: 'showtimeId',
            foreignField: '_id',
            as: 'showtime'
          }
        },
        { $unwind: '$showtime' },
        {
          $match: {
            'showtime.movieId': { $in: Array.from(watchedMovieIds).map(id => id) },
            userId: { $ne: userId }
          }
        },
        {
          $group: {
            _id: '$userId',
            commonMovies: { $sum: 1 }
          }
        },
        { $sort: { commonMovies: -1 } },
        { $limit: 20 }
      ]);

      // Get movies watched by similar users
      const similarUserIds = similarUsers.map(u => u._id);
      
      const recommendations = await Booking.aggregate([
        {
          $match: {
            userId: { $in: similarUserIds }
          }
        },
        {
          $lookup: {
            from: 'showtimes',
            localField: 'showtimeId',
            foreignField: '_id',
            as: 'showtime'
          }
        },
        { $unwind: '$showtime' },
        {
          $group: {
            _id: '$showtime.movieId',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ]);

      // Populate movie details
      const movieIds = recommendations.map(r => r._id);
      const movies = await Movie.find({ 
        _id: { $in: movieIds },
        status: 'now_showing'
      });

      return movies.map(movie => {
        const rec = recommendations.find(r => r._id.toString() === movie._id.toString());
        return {
          movie,
          collaborativeScore: rec ? rec.count : 0
        };
      });

    } catch (error) {
      logger.error('Collaborative Filtering Error:', error);
      return [];
    }
  }

  /**
   * Content-based Filtering - recommend based on genre preferences
   */
  async _contentBasedFiltering(genrePreferences, watchedMovieIds) {
    try {
      const topGenres = Object.entries(genrePreferences)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([genre]) => genre);

      if (topGenres.length === 0) {
        // No preferences, return trending movies
        const trending = await Movie.find({ 
          status: 'now_showing',
          _id: { $nin: Array.from(watchedMovieIds) }
        })
        .sort({ viewCount: -1 })
        .limit(10);

        return trending.map(movie => ({
          movie,
          contentScore: 5
        }));
      }

      const movies = await Movie.find({
        genres: { $in: topGenres },
        status: 'now_showing',
        _id: { $nin: Array.from(watchedMovieIds) }
      }).limit(15);

      return movies.map(movie => {
        const matchingGenres = movie.genres.filter(g => topGenres.includes(g));
        const contentScore = matchingGenres.reduce((sum, genre) => {
          return sum + (genrePreferences[genre] || 0);
        }, 0);

        return {
          movie,
          contentScore
        };
      });

    } catch (error) {
      logger.error('Content-based Filtering Error:', error);
      return [];
    }
  }

  /**
   * Combine collaborative and content-based recommendations
   */
  _combineRecommendations(collaborative, contentBased, genrePreferences, timePreferences) {
    const movieMap = new Map();

    // Add collaborative recommendations
    collaborative.forEach(({ movie, collaborativeScore }) => {
      movieMap.set(movie._id.toString(), {
        movie,
        collaborativeScore: collaborativeScore * 2, // Weight collaborative higher
        contentScore: 0,
        timeScore: 0,
        popularityScore: 0
      });
    });

    // Add/update with content-based recommendations
    contentBased.forEach(({ movie, contentScore }) => {
      const key = movie._id.toString();
      if (movieMap.has(key)) {
        movieMap.get(key).contentScore = contentScore;
      } else {
        movieMap.set(key, {
          movie,
          collaborativeScore: 0,
          contentScore,
          timeScore: 0,
          popularityScore: 0
        });
      }
    });

    // Calculate final scores
    const recommendations = Array.from(movieMap.values()).map(rec => {
      // Popularity score (views + ratings)
      const popularityScore = (rec.movie.viewCount || 0) / 100 + 
                             (rec.movie.averageRating || 0) * 2;

      // Time score (if movie showtimes match user's preferred times)
      const timeScore = 0; // Could be enhanced with showtime data

      // Final weighted score
      const score = 
        rec.collaborativeScore * 0.4 +
        rec.contentScore * 0.3 +
        popularityScore * 0.2 +
        timeScore * 0.1;

      return {
        ...rec.movie.toObject(),
        score,
        reason: this._generateReason(rec, genrePreferences)
      };
    });

    return recommendations;
  }

  /**
   * Generate explanation for recommendation
   */
  _generateReason(rec, genrePreferences) {
    const reasons = [];

    if (rec.collaborativeScore > 5) {
      reasons.push('Người xem tương tự bạn thích phim này');
    }

    if (rec.contentScore > 3) {
      const topGenre = rec.movie.genres?.find(g => genrePreferences[g]);
      if (topGenre) {
        reasons.push(`Bạn thường thích thể loại ${topGenre}`);
      }
    }

    if (rec.movie.averageRating >= 4.5) {
      reasons.push('Đánh giá cao từ khán giả');
    }

    if (rec.movie.viewCount > 1000) {
      reasons.push('Phim đang hot');
    }

    return reasons.length > 0 
      ? reasons.join(' • ') 
      : 'Phim mới đáng xem';
  }

  /**
   * Get time slot from hour
   */
  _getTimeSlot(hour) {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }

  /**
   * Get trending movies globally
   */
  async getTrending(limit = 10) {
    try {
      const movies = await Movie.find({ status: 'now_showing' })
        .sort({ viewCount: -1, averageRating: -1 })
        .limit(limit);

      return movies.map(movie => ({
        ...movie.toObject(),
        score: (movie.viewCount || 0) / 100 + (movie.averageRating || 0) * 2,
        reason: 'Phim đang trending'
      }));
    } catch (error) {
      logger.error('Get Trending Error:', error);
      return [];
    }
  }
}

export default new RecommendationAI();
