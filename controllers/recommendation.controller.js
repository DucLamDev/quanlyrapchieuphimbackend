import Movie from '../models/Movie.model.js';
import User from '../models/User.model.js';
import Booking from '../models/Booking.model.js';
import Review from '../models/Review.model.js';
import recommendationAI from '../services/recommendationAI.js';

// Calculate similarity score between two movies
const calculateMovieSimilarity = (movie1, movie2) => {
  let score = 0;

  // Genre similarity (40%)
  const commonGenres = movie1.genres.filter(g => movie2.genres.includes(g));
  score += (commonGenres.length / Math.max(movie1.genres.length, movie2.genres.length)) * 0.4;

  // Director similarity (20%)
  if (movie1.director === movie2.director) {
    score += 0.2;
  }

  // Language similarity (10%)
  if (movie1.language === movie2.language) {
    score += 0.1;
  }

  // Rating similarity (15%)
  const ratingDiff = Math.abs(movie1.rating.average - movie2.rating.average);
  score += (1 - ratingDiff / 5) * 0.15;

  // Age rating similarity (15%)
  if (movie1.ageRating === movie2.ageRating) {
    score += 0.15;
  }

  return score;
};

// @desc    Get personalized movie recommendations
// @route   GET /api/recommendations/personalized
// @access  Private
export const getPersonalizedRecommendations = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 12;

    const recommendations = await recommendationAI.getRecommendations(userId, limit);

    res.status(200).json({
      success: true,
      count: recommendations.length,
      recommendations
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get similar movies
// @route   GET /api/recommendations/similar/:movieId
// @access  Public
export const getSimilarMovies = async (req, res, next) => {
  try {
    const movie = await Movie.findById(req.params.movieId);

    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    // Find movies with similar characteristics
    const candidates = await Movie.find({
      _id: { $ne: movie._id },
      isActive: true,
      $or: [
        { genres: { $in: movie.genres } },
        { director: movie.director },
        { language: movie.language }
      ]
    }).limit(50);

    // Calculate similarity scores
    const similarMovies = candidates.map(candidate => ({
      ...candidate.toObject(),
      similarityScore: calculateMovieSimilarity(movie, candidate)
    }));

    // Sort by similarity score
    similarMovies.sort((a, b) => b.similarityScore - a.similarityScore);

    res.status(200).json({
      success: true,
      count: similarMovies.length,
      movies: similarMovies.slice(0, 10)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get trending movies
// @route   GET /api/recommendations/trending
// @access  Public
export const getTrendingMovies = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const trending = await recommendationAI.getTrending(limit);

    res.status(200).json({
      success: true,
      count: trending.length,
      movies: trending
    });
  } catch (error) {
    next(error);
  }
};
