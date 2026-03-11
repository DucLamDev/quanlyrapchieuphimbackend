import Booking from '../models/Booking.model.js';
import Showtime from '../models/Showtime.model.js';
import Movie from '../models/Movie.model.js';
import { logger } from '../utils/logger.js';
import axios from 'axios';

/**
 * Crowd Prediction AI Service
 * Predicts crowd levels for showtimes using historical data and external factors
 */

class CrowdPredictionAI {
  constructor() {
    this.crowdLevels = {
      LOW: { threshold: 0.3, label: 'Thấp', color: 'green' },
      MEDIUM: { threshold: 0.6, label: 'Trung bình', color: 'orange' },
      HIGH: { threshold: 1.0, label: 'Cao', color: 'red' }
    };
  }

  /**
   * Predict crowd level for a specific showtime
   * @param {String} showtimeId - Showtime ID
   * @returns {Object} Prediction result
   */
  async predictShowtime(showtimeId) {
    try {
      const showtime = await Showtime.findById(showtimeId)
        .populate('movieId')
        .populate('cinemaId');

      if (!showtime) throw new Error('Showtime not found');

      // Get current booking count
      const currentBookings = await Booking.countDocuments({ 
        showtimeId,
        status: { $in: ['confirmed', 'paid'] }
      });

      const currentOccupancy = currentBookings / showtime.totalSeats;

      // Historical analysis
      const historicalScore = await this._analyzeHistoricalData(showtime);

      // Movie popularity score
      const movieScore = this._analyzeMoviePopularity(showtime.movieId);

      // Time slot score
      const timeScore = this._analyzeTimeSlot(showtime.startTime);

      // Day of week score
      const dayScore = this._analyzeDayOfWeek(showtime.startTime);

      // Weather impact (mock API)
      const weatherScore = await this._analyzeWeather(showtime.startTime);

      // Calculate final prediction
      const weights = {
        current: 0.3,
        historical: 0.25,
        movie: 0.2,
        time: 0.1,
        day: 0.1,
        weather: 0.05
      };

      const predictedOccupancy = 
        currentOccupancy * weights.current +
        historicalScore * weights.historical +
        movieScore * weights.movie +
        timeScore * weights.time +
        dayScore * weights.day +
        weatherScore * weights.weather;

      // Determine crowd level
      const crowdLevel = this._getCrowdLevel(predictedOccupancy);

      // Generate reasons
      const reasons = this._generateReasons({
        currentOccupancy,
        historicalScore,
        movieScore,
        timeScore,
        dayScore,
        weatherScore,
        showtime
      });

      return {
        showtimeId,
        crowdLevel: crowdLevel.label,
        color: crowdLevel.color,
        predictedOccupancy: Math.round(predictedOccupancy * 100),
        currentOccupancy: Math.round(currentOccupancy * 100),
        availableSeats: showtime.totalSeats - currentBookings,
        totalSeats: showtime.totalSeats,
        reasons,
        confidence: this._calculateConfidence(showtime),
        movieTitle: showtime.movieId?.title,
        startTime: showtime.startTime,
        cinema: showtime.cinemaId?.name
      };

    } catch (error) {
      logger.error('Crowd Prediction Error:', error);
      throw error;
    }
  }

  /**
   * Analyze historical booking patterns
   */
  async _analyzeHistoricalData(showtime) {
    try {
      const dayOfWeek = new Date(showtime.startTime).getDay();
      const hour = new Date(showtime.startTime).getHours();

      // Find similar past showtimes (same movie, similar time)
      const historicalShowtimes = await Showtime.find({
        movieId: showtime.movieId._id,
        startTime: { $lt: new Date() },
        _id: { $ne: showtime._id }
      }).limit(20);

      if (historicalShowtimes.length === 0) return 0.5;

      let totalOccupancy = 0;
      let count = 0;

      for (const hist of historicalShowtimes) {
        const bookings = await Booking.countDocuments({
          showtimeId: hist._id,
          status: { $in: ['confirmed', 'paid'] }
        });

        const occupancy = bookings / hist.totalSeats;
        totalOccupancy += occupancy;
        count++;
      }

      return count > 0 ? totalOccupancy / count : 0.5;

    } catch (error) {
      logger.error('Historical Analysis Error:', error);
      return 0.5;
    }
  }

  /**
   * Analyze movie popularity
   */
  _analyzeMoviePopularity(movie) {
    if (!movie) return 0.5;

    const viewScore = Math.min((movie.viewCount || 0) / 5000, 1);
    const ratingScore = (movie.averageRating || 0) / 5;
    const reviewScore = Math.min((movie.totalReviews || 0) / 100, 1);

    // Check if movie is new (released within last 2 weeks)
    const isNew = movie.releaseDate && 
      (new Date() - new Date(movie.releaseDate)) < 14 * 24 * 60 * 60 * 1000;
    const newBonus = isNew ? 0.2 : 0;

    return (viewScore * 0.4 + ratingScore * 0.3 + reviewScore * 0.3 + newBonus);
  }

  /**
   * Analyze time slot preference
   */
  _analyzeTimeSlot(startTime) {
    const hour = new Date(startTime).getHours();

    // Prime time: 18:00 - 22:00
    if (hour >= 18 && hour < 22) return 0.9;
    
    // Afternoon: 14:00 - 18:00
    if (hour >= 14 && hour < 18) return 0.7;
    
    // Morning: 9:00 - 12:00
    if (hour >= 9 && hour < 14) return 0.4;
    
    // Late night: 22:00 - 01:00
    if (hour >= 22 || hour < 2) return 0.6;
    
    return 0.3;
  }

  /**
   * Analyze day of week
   */
  _analyzeDayOfWeek(startTime) {
    const day = new Date(startTime).getDay();

    // Weekend (Friday, Saturday, Sunday)
    if (day === 5 || day === 6 || day === 0) return 0.9;
    
    // Wednesday, Thursday
    if (day === 3 || day === 4) return 0.6;
    
    // Monday, Tuesday
    return 0.5;
  }

  /**
   * Mock weather API - in production, use real weather service
   */
  async _analyzeWeather(startTime) {
    try {
      // Mock weather data - replace with real API like OpenWeatherMap
      const weather = this._getMockWeather();

      // Good weather (sunny, clear) = people go out = higher crowd
      if (weather === 'sunny' || weather === 'clear') return 0.8;
      
      // Bad weather (rain, storm) = people stay home = lower crowd  
      if (weather === 'rain' || weather === 'storm') return 0.4;
      
      // Neutral weather
      return 0.6;

    } catch (error) {
      logger.error('Weather Analysis Error:', error);
      return 0.6;
    }
  }

  /**
   * Mock weather generator
   */
  _getMockWeather() {
    const weathers = ['sunny', 'clear', 'cloudy', 'rain', 'storm'];
    const weights = [0.3, 0.2, 0.3, 0.15, 0.05]; // Vietnam weather pattern
    
    const random = Math.random();
    let sum = 0;
    
    for (let i = 0; i < weathers.length; i++) {
      sum += weights[i];
      if (random <= sum) return weathers[i];
    }
    
    return 'clear';
  }

  /**
   * Get crowd level from occupancy percentage
   */
  _getCrowdLevel(occupancy) {
    if (occupancy < this.crowdLevels.LOW.threshold) {
      return this.crowdLevels.LOW;
    } else if (occupancy < this.crowdLevels.MEDIUM.threshold) {
      return this.crowdLevels.MEDIUM;
    } else {
      return this.crowdLevels.HIGH;
    }
  }

  /**
   * Generate reasons for prediction
   */
  _generateReasons(data) {
    const reasons = [];

    // Current status
    if (data.currentOccupancy > 0.7) {
      reasons.push('Suất chiếu gần đầy');
    } else if (data.currentOccupancy < 0.3) {
      reasons.push('Còn nhiều chỗ trống');
    }

    // Movie popularity
    if (data.movieScore > 0.7) {
      reasons.push('Phim đang rất hot');
    }

    // Time slot
    if (data.timeScore > 0.8) {
      reasons.push('Khung giờ vàng');
    } else if (data.timeScore < 0.5) {
      reasons.push('Khung giờ thấp điểm');
    }

    // Day of week
    if (data.dayScore > 0.8) {
      reasons.push('Cuối tuần đông khách');
    }

    // Weather
    if (data.weatherScore > 0.7) {
      reasons.push('Thời tiết đẹp');
    } else if (data.weatherScore < 0.5) {
      reasons.push('Thời tiết không thuận lợi');
    }

    // Historical
    if (data.historicalScore > 0.7) {
      reasons.push('Lịch sử suất này thường đông');
    }

    return reasons.length > 0 ? reasons : ['Mức độ bình thường'];
  }

  /**
   * Calculate prediction confidence
   */
  _calculateConfidence(showtime) {
    // More historical data = higher confidence
    // Closer to showtime = higher confidence
    
    const timeUntilShow = new Date(showtime.startTime) - new Date();
    const hoursUntil = timeUntilShow / (1000 * 60 * 60);

    if (hoursUntil < 2) return 0.95;
    if (hoursUntil < 6) return 0.85;
    if (hoursUntil < 24) return 0.75;
    if (hoursUntil < 72) return 0.65;
    
    return 0.55;
  }

  /**
   * Get all showtimes with predictions for a movie
   */
  async predictMovie(movieId, days = 7) {
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);

      const showtimes = await Showtime.find({
        movieId,
        startTime: { $gte: startDate, $lte: endDate },
        status: 'scheduled'
      }).sort({ startTime: 1 });

      const predictions = await Promise.all(
        showtimes.map(showtime => this.predictShowtime(showtime._id))
      );

      return predictions;

    } catch (error) {
      logger.error('Movie Prediction Error:', error);
      throw error;
    }
  }

  /**
   * Find quiet showtimes (low crowd prediction)
   */
  async findQuietShowtimes(movieId, limit = 5) {
    try {
      const predictions = await this.predictMovie(movieId);
      
      return predictions
        .filter(p => p.crowdLevel === 'Thấp' || p.predictedOccupancy < 40)
        .sort((a, b) => a.predictedOccupancy - b.predictedOccupancy)
        .slice(0, limit);

    } catch (error) {
      logger.error('Find Quiet Showtimes Error:', error);
      throw error;
    }
  }

  /**
   * Find popular showtimes (high crowd prediction)
   */
  async findPopularShowtimes(movieId, limit = 5) {
    try {
      const predictions = await this.predictMovie(movieId);
      
      return predictions
        .filter(p => p.crowdLevel === 'Cao' || p.predictedOccupancy > 60)
        .sort((a, b) => b.predictedOccupancy - a.predictedOccupancy)
        .slice(0, limit);

    } catch (error) {
      logger.error('Find Popular Showtimes Error:', error);
      throw error;
    }
  }
}

export default new CrowdPredictionAI();
