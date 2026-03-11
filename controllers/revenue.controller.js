import Booking from '../models/Booking.model.js';
import Movie from '../models/Movie.model.js';
import Cinema from '../models/Cinema.model.js';
import Showtime from '../models/Showtime.model.js';

// @desc    Get dashboard statistics
// @route   GET /api/revenue/dashboard
// @access  Private/Admin
export const getDashboardStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    // Today's revenue
    const todayRevenue = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: today, $lt: tomorrow },
          paymentStatus: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$finalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // This month's revenue
    const monthRevenue = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: thisMonth },
          paymentStatus: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$finalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Last month's revenue for comparison
    const lastMonthRevenue = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: lastMonth, $lt: thisMonth },
          paymentStatus: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$finalAmount' }
        }
      }
    ]);

    // Active movies
    const activeMovies = await Movie.countDocuments({
      status: 'now-showing',
      isActive: true
    });

    // Total customers
    const totalCustomers = await Booking.distinct('userId');

    // Top movies
    const topMovies = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: thisMonth },
          status: { $in: ['confirmed', 'used'] }
        }
      },
      {
        $group: {
          _id: '$movieId',
          revenue: { $sum: '$finalAmount' },
          tickets: { $sum: { $size: '$seats' } }
        }
      },
      {
        $sort: { revenue: -1 }
      },
      {
        $limit: 5
      },
      {
        $lookup: {
          from: 'movies',
          localField: '_id',
          foreignField: '_id',
          as: 'movie'
        }
      },
      {
        $unwind: '$movie'
      },
      {
        $project: {
          title: '$movie.title',
          poster: '$movie.poster',
          revenue: 1,
          tickets: 1
        }
      }
    ]);

    // Calculate growth percentage
    const growth = lastMonthRevenue[0]?.total
      ? ((monthRevenue[0]?.total - lastMonthRevenue[0].total) / lastMonthRevenue[0].total) * 100
      : 0;

    res.status(200).json({
      success: true,
      stats: {
        today: {
          revenue: todayRevenue[0]?.total || 0,
          bookings: todayRevenue[0]?.count || 0
        },
        thisMonth: {
          revenue: monthRevenue[0]?.total || 0,
          bookings: monthRevenue[0]?.count || 0,
          growth: Math.round(growth)
        },
        activeMovies,
        totalCustomers: totalCustomers.length,
        topMovies
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get revenue by period
// @route   GET /api/revenue/period
// @access  Private/Admin
export const getRevenueByPeriod = async (req, res, next) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const start = new Date(startDate || Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = new Date(endDate || Date.now());

    let groupFormat;
    switch (groupBy) {
      case 'hour':
        groupFormat = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
          hour: { $hour: '$createdAt' }
        };
        break;
      case 'day':
        groupFormat = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
        break;
      case 'month':
        groupFormat = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        };
        break;
      default:
        groupFormat = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
    }

    const revenue = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          paymentStatus: 'completed'
        }
      },
      {
        $group: {
          _id: groupFormat,
          revenue: { $sum: '$finalAmount' },
          bookings: { $sum: 1 },
          tickets: { $sum: { $size: '$seats' } }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 }
      }
    ]);

    res.status(200).json({
      success: true,
      count: revenue.length,
      data: revenue
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get revenue by movie
// @route   GET /api/revenue/by-movie
// @access  Private/Admin
export const getRevenueByMovie = async (req, res, next) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;

    const query = { paymentStatus: 'completed' };
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const revenue = await Booking.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$movieId',
          totalRevenue: { $sum: '$finalAmount' },
          totalBookings: { $sum: 1 },
          totalTickets: { $sum: { $size: '$seats' } }
        }
      },
      {
        $sort: { totalRevenue: -1 }
      },
      {
        $limit: parseInt(limit)
      },
      {
        $lookup: {
          from: 'movies',
          localField: '_id',
          foreignField: '_id',
          as: 'movie'
        }
      },
      {
        $unwind: '$movie'
      },
      {
        $project: {
          movieId: '$_id',
          title: '$movie.title',
          poster: '$movie.poster',
          totalRevenue: 1,
          totalBookings: 1,
          totalTickets: 1,
          averagePerBooking: { $divide: ['$totalRevenue', '$totalBookings'] }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      count: revenue.length,
      data: revenue
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get revenue by cinema
// @route   GET /api/revenue/by-cinema
// @access  Private/Admin
export const getRevenueByCinema = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const query = { paymentStatus: 'completed' };
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const revenue = await Booking.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$cinemaId',
          totalRevenue: { $sum: '$finalAmount' },
          totalBookings: { $sum: 1 },
          totalTickets: { $sum: { $size: '$seats' } }
        }
      },
      {
        $sort: { totalRevenue: -1 }
      },
      {
        $lookup: {
          from: 'cinemas',
          localField: '_id',
          foreignField: '_id',
          as: 'cinema'
        }
      },
      {
        $unwind: '$cinema'
      },
      {
        $project: {
          cinemaId: '$_id',
          name: '$cinema.name',
          location: '$cinema.location',
          totalRevenue: 1,
          totalBookings: 1,
          totalTickets: 1
        }
      }
    ]);

    res.status(200).json({
      success: true,
      count: revenue.length,
      data: revenue
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get booking statistics
// @route   GET /api/revenue/booking-stats
// @access  Private/Admin
export const getBookingStats = async (req, res, next) => {
  try {
    const { period = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    // Status distribution
    const statusStats = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Payment method distribution
    const paymentStats = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          paymentStatus: 'completed'
        }
      },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          totalAmount: { $sum: '$finalAmount' }
        }
      }
    ]);

    // Average booking value
    const avgBooking = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          paymentStatus: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          avgValue: { $avg: '$finalAmount' },
          avgTickets: { $avg: { $size: '$seats' } }
        }
      }
    ]);

    // Cancellation rate
    const totalBookings = await Booking.countDocuments({
      createdAt: { $gte: startDate }
    });
    
    const cancelledBookings = await Booking.countDocuments({
      createdAt: { $gte: startDate },
      status: 'cancelled'
    });

    const cancellationRate = totalBookings > 0 
      ? (cancelledBookings / totalBookings) * 100 
      : 0;

    res.status(200).json({
      success: true,
      stats: {
        period: `${period} days`,
        statusDistribution: statusStats,
        paymentMethodDistribution: paymentStats,
        averageBookingValue: avgBooking[0]?.avgValue || 0,
        averageTicketsPerBooking: avgBooking[0]?.avgTickets || 0,
        cancellationRate: Math.round(cancellationRate * 100) / 100,
        totalBookings,
        cancelledBookings
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Export revenue report
// @route   GET /api/revenue/export
// @access  Private/Admin
export const exportReport = async (req, res, next) => {
  try {
    const { startDate, endDate, format = 'json' } = req.query;

    const query = { paymentStatus: 'completed' };
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const bookings = await Booking.find(query)
      .populate('movieId', 'title')
      .populate('cinemaId', 'name')
      .populate('userId', 'fullName email')
      .select('bookingCode createdAt finalAmount seats paymentMethod status')
      .sort('-createdAt');

    if (format === 'csv') {
      // Generate CSV
      let csv = 'Booking Code,Date,Movie,Cinema,Customer,Amount,Tickets,Status\n';
      bookings.forEach(booking => {
        csv += `${booking.bookingCode},${booking.createdAt},${booking.movieId?.title},${booking.cinemaId?.name},${booking.userId?.fullName},${booking.finalAmount},${booking.seats.length},${booking.status}\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=revenue-report.csv');
      return res.send(csv);
    }

    // Return JSON
    const totalRevenue = bookings.reduce((sum, b) => sum + b.finalAmount, 0);
    const totalTickets = bookings.reduce((sum, b) => sum + b.seats.length, 0);

    res.status(200).json({
      success: true,
      summary: {
        totalBookings: bookings.length,
        totalRevenue,
        totalTickets,
        averageBookingValue: totalRevenue / bookings.length || 0
      },
      bookings
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get recent activities for dashboard
// @route   GET /api/revenue/recent-activities
// @access  Private/Admin
export const getRecentActivities = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const limitNum = parseInt(limit);

    // Get recent bookings
    const recentBookings = await Booking.find()
      .populate('userId', 'fullName email')
      .populate('movieId', 'title')
      .populate('cinemaId', 'name')
      .sort('-createdAt')
      .limit(limitNum)
      .lean();

    const activities = recentBookings.map(booking => {
      const timeAgo = getTimeAgo(booking.createdAt);
      
      if (booking.status === 'cancelled') {
        return {
          type: 'cancel',
          text: `Khách hàng ${booking.userId?.fullName || 'Ẩn danh'} hủy vé ${booking.movieId?.title || 'N/A'}`,
          time: timeAgo,
          icon: 'AlertCircle',
          bookingCode: booking.bookingCode
        };
      } else if (booking.status === 'confirmed' || booking.status === 'used') {
        return {
          type: 'booking',
          text: `${booking.userId?.fullName || 'Khách hàng'} đặt ${booking.seats.length} vé cho ${booking.movieId?.title || 'N/A'}`,
          time: timeAgo,
          icon: 'Ticket',
          bookingCode: booking.bookingCode
        };
      } else if (booking.status === 'pending') {
        return {
          type: 'pending',
          text: `Đơn hàng ${booking.bookingCode} đang chờ thanh toán`,
          time: timeAgo,
          icon: 'Clock',
          bookingCode: booking.bookingCode
        };
      }
      return null;
    }).filter(Boolean);

    res.status(200).json({
      success: true,
      count: activities.length,
      data: activities
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to calculate time ago
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  
  if (seconds < 60) return `${seconds} giây trước`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}
