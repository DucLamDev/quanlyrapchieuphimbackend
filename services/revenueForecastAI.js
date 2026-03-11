import Booking from '../models/Booking.model.js';
import Movie from '../models/Movie.model.js';
import Showtime from '../models/Showtime.model.js';
import { logger } from '../utils/logger.js';

/**
 * Revenue Forecasting AI
 * Predicts future revenue based on historical data
 */
class RevenueForecastAI {
  async forecastRevenue(days = 7) {
    try {
      const historical = await this._getHistoricalData(30);
      const upcoming = await this._getUpcomingShowtimes(days);
      
      const predictions = [];
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        
        const forecast = await this._predictDay(date, historical, upcoming);
        predictions.push(forecast);
      }

      return {
        predictions,
        totalForecast: predictions.reduce((sum, p) => sum + p.revenue, 0),
        confidence: this._calculateConfidence(historical)
      };
    } catch (error) {
      logger.error('Revenue Forecast Error:', error);
      throw error;
    }
  }

  async _getHistoricalData(days) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const bookings = await Booking.find({
      createdAt: { $gte: startDate },
      status: { $in: ['confirmed', 'paid'] }
    });

    const dailyRevenue = {};
    bookings.forEach(booking => {
      const day = booking.createdAt.toISOString().split('T')[0];
      dailyRevenue[day] = (dailyRevenue[day] || 0) + booking.totalPrice;
    });

    return Object.entries(dailyRevenue).map(([date, revenue]) => ({
      date, revenue
    }));
  }

  async _getUpcomingShowtimes(days) {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    return await Showtime.find({
      startTime: { $gte: new Date(), $lte: endDate }
    }).populate('movieId');
  }

  async _predictDay(date, historical, upcoming) {
    const dayOfWeek = date.getDay();
    const avgRevenue = historical.reduce((sum, h) => sum + h.revenue, 0) / historical.length;
    
    // Weekend multiplier
    const weekendMultiplier = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.5 : 1;
    
    const revenue = avgRevenue * weekendMultiplier;

    return {
      date: date.toISOString().split('T')[0],
      revenue: Math.round(revenue),
      confidence: 0.75
    };
  }

  _calculateConfidence(historical) {
    return historical.length >= 30 ? 0.8 : 0.6;
  }
}

export default new RevenueForecastAI();
