import Showtime from '../models/Showtime.model.js';
import Booking from '../models/Booking.model.js';
import Movie from '../models/Movie.model.js';
import crowdPredictionAI from '../services/crowdPredictionAI.js';

// Factors that influence crowd levels
const calculateCrowdFactors = async (showtime, movie) => {
  const factors = [];
  let baseOccupancy = 50; // Base 50%

  // Movie popularity factor
  if (movie.rating.average >= 4.5) {
    baseOccupancy += 15;
    factors.push({ factor: 'Phim có rating cao', impact: 15 });
  } else if (movie.rating.average >= 4.0) {
    baseOccupancy += 10;
    factors.push({ factor: 'Phim có rating tốt', impact: 10 });
  }

  // New release factor
  const daysSinceRelease = (Date.now() - movie.releaseDate) / (1000 * 60 * 60 * 24);
  if (daysSinceRelease <= 3) {
    baseOccupancy += 20;
    factors.push({ factor: 'Phim mới ra mắt', impact: 20 });
  } else if (daysSinceRelease <= 7) {
    baseOccupancy += 10;
    factors.push({ factor: 'Phim mới trong tuần', impact: 10 });
  }

  // Time of day factor
  const hour = new Date(showtime.startTime).getHours();
  if (hour >= 19 && hour <= 22) {
    baseOccupancy += 15;
    factors.push({ factor: 'Giờ vàng (19h-22h)', impact: 15 });
  } else if (hour >= 14 && hour <= 18) {
    baseOccupancy += 5;
    factors.push({ factor: 'Chiều tối', impact: 5 });
  } else if (hour < 12) {
    baseOccupancy -= 15;
    factors.push({ factor: 'Buổi sáng', impact: -15 });
  }

  // Day of week factor
  const dayOfWeek = new Date(showtime.date).getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) { // Weekend
    baseOccupancy += 15;
    factors.push({ factor: 'Cuối tuần', impact: 15 });
  } else if (dayOfWeek === 5) { // Friday
    baseOccupancy += 10;
    factors.push({ factor: 'Thứ 6', impact: 10 });
  }

  // Historical data factor
  const historicalBookings = await Booking.countDocuments({
    showtimeId: showtime._id,
    status: { $in: ['confirmed', 'used'] }
  });
  
  const currentOccupancy = showtime.getOccupancy();
  const historicalFactor = currentOccupancy > 0 ? currentOccupancy - 50 : 0;
  baseOccupancy += historicalFactor;
  
  if (historicalFactor !== 0) {
    factors.push({ 
      factor: 'Dựa trên lượng đặt hiện tại', 
      impact: Math.round(historicalFactor) 
    });
  }

  // Weather factor (simplified - in production, use weather API)
  // Assuming good weather increases attendance
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  if (isWeekend) {
    factors.push({ factor: 'Thời tiết thuận lợi (cuối tuần)', impact: 5 });
    baseOccupancy += 5;
  }

  // Special events/holidays
  // TODO: Implement holiday detection
  
  // Normalize to 0-100 range
  baseOccupancy = Math.max(0, Math.min(100, baseOccupancy));

  return { predictedOccupancy: baseOccupancy, factors };
};

// Determine crowd level from occupancy percentage
const getCrowdLevel = (occupancy) => {
  if (occupancy < 40) return 'low';
  if (occupancy < 70) return 'medium';
  return 'high';
};

// @desc    Predict crowd level for a showtime
// @route   GET /api/crowd-prediction/showtime/:showtimeId
// @access  Public
export const predictShowtimeCrowd = async (req, res, next) => {
  try {
    const prediction = await crowdPredictionAI.predictShowtime(req.params.showtimeId);

    res.status(200).json({
      success: true,
      prediction
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get showtimes filtered by occupancy level
// @route   GET /api/crowd-prediction/filter
// @access  Public
export const getShowtimesByOccupancy = async (req, res, next) => {
  try {
    const { movieId, cinemaId, date, level } = req.query;

    const query = {
      isActive: true,
      date: date ? new Date(date) : { $gte: new Date() }
    };

    if (movieId) query.movieId = movieId;
    if (cinemaId) query.cinemaId = cinemaId;
    if (level) query['crowdPrediction.level'] = level;

    const showtimes = await Showtime.find(query)
      .populate('movieId', 'title poster duration')
      .populate('cinemaId', 'name location')
      .sort('startTime');

    // Update predictions if they're outdated (>1 hour old)
    const updatedShowtimes = await Promise.all(
      showtimes.map(async (showtime) => {
        const lastUpdate = showtime.crowdPrediction?.lastUpdated;
        const oneHourAgo = Date.now() - (60 * 60 * 1000);

        if (!lastUpdate || lastUpdate < oneHourAgo) {
          const movie = await Movie.findById(showtime.movieId);
          const { predictedOccupancy, factors } = await calculateCrowdFactors(showtime, movie);
          
          showtime.crowdPrediction = {
            level: getCrowdLevel(predictedOccupancy),
            percentage: Math.round(predictedOccupancy),
            factors,
            lastUpdated: Date.now()
          };
          await showtime.save();
        }

        return showtime;
      })
    );

    res.status(200).json({
      success: true,
      count: updatedShowtimes.length,
      showtimes: updatedShowtimes
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update all predictions
// @route   POST /api/crowd-prediction/update
// @access  Private/Admin
export const updatePredictions = async (req, res, next) => {
  try {
    const showtimes = await Showtime.find({
      date: { $gte: new Date() },
      isActive: true
    }).populate('movieId');

    let updated = 0;

    for (const showtime of showtimes) {
      if (showtime.movieId) {
        const { predictedOccupancy, factors } = await calculateCrowdFactors(
          showtime,
          showtime.movieId
        );

        showtime.crowdPrediction = {
          level: getCrowdLevel(predictedOccupancy),
          percentage: Math.round(predictedOccupancy),
          factors,
          lastUpdated: Date.now()
        };
        
        await showtime.save();
        updated++;
      }
    }

    res.status(200).json({
      success: true,
      message: `Updated predictions for ${updated} showtimes`
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get crowd trends for a cinema
// @route   GET /api/crowd-prediction/trends/:cinemaId
// @access  Public
export const getCrowdTrends = async (req, res, next) => {
  try {
    const { cinemaId } = req.params;
    const { days = 7 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const showtimes = await Showtime.find({
      cinemaId,
      date: { $gte: startDate },
      status: 'completed'
    });

    // Analyze trends by hour
    const trendsByHour = {};
    const trendsByDay = {};

    showtimes.forEach(showtime => {
      const hour = new Date(showtime.startTime).getHours();
      const dayOfWeek = new Date(showtime.date).getDay();
      const occupancy = showtime.getOccupancy();

      if (!trendsByHour[hour]) {
        trendsByHour[hour] = { total: 0, count: 0 };
      }
      trendsByHour[hour].total += occupancy;
      trendsByHour[hour].count += 1;

      if (!trendsByDay[dayOfWeek]) {
        trendsByDay[dayOfWeek] = { total: 0, count: 0 };
      }
      trendsByDay[dayOfWeek].total += occupancy;
      trendsByDay[dayOfWeek].count += 1;
    });

    // Calculate averages
    const hourlyTrends = Object.entries(trendsByHour).map(([hour, data]) => ({
      hour: parseInt(hour),
      averageOccupancy: Math.round(data.total / data.count)
    }));

    const dailyTrends = Object.entries(trendsByDay).map(([day, data]) => ({
      dayOfWeek: parseInt(day),
      averageOccupancy: Math.round(data.total / data.count)
    }));

    res.status(200).json({
      success: true,
      trends: {
        hourly: hourlyTrends.sort((a, b) => a.hour - b.hour),
        daily: dailyTrends.sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      }
    });
  } catch (error) {
    next(error);
  }
};
