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
          paymentStatus: { $in: ['completed', 'paid'] }
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
          paymentStatus: { $in: ['completed', 'paid'] }
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
          paymentStatus: { $in: ['completed', 'paid'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$finalAmount' }
        }
      }
    ]);

    // Total revenue (all-time)
    const totalRevenue = await Booking.aggregate([
      {
        $match: {
          paymentStatus: { $in: ['completed', 'paid'] }
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
        totalRevenue: totalRevenue[0]?.total || 0,
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
          paymentStatus: { $in: ['completed', 'paid'] }
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

    const query = { paymentStatus: { $in: ['completed', 'paid'] } };
    
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

    const query = { paymentStatus: { $in: ['completed', 'paid'] } };
    
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
          paymentStatus: { $in: ['completed', 'paid'] }
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
          paymentStatus: { $in: ['completed', 'paid'] }
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

    const query = { paymentStatus: { $in: ['completed', 'paid'] } };
    
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

    const totalRevenue = bookings.reduce((sum, b) => sum + b.finalAmount, 0);
    const totalTickets = bookings.reduce((sum, b) => sum + b.seats.length, 0);

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

    if (format === 'pdf') {
      // Generate HTML for PDF printing
      const formatCurrency = (amount) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
      };
      
      const formatDate = (date) => {
        return new Date(date).toLocaleDateString('vi-VN', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      };

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>B\u00e1o c\u00e1o doanh thu</title>
  <style>
    @page { size: A4; margin: 20mm; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #333; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e11d48; padding-bottom: 20px; }
    .header h1 { color: #e11d48; margin: 0; font-size: 28px; }
    .header p { margin: 5px 0; color: #666; }
    .summary { background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
    .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
    .summary-item { }
    .summary-item label { font-weight: bold; color: #666; display: block; margin-bottom: 5px; }
    .summary-item value { font-size: 18px; color: #e11d48; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #e11d48; color: white; padding: 12px; text-align: left; font-size: 11px; }
    td { padding: 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
    tr:nth-child(even) { background: #f9fafb; }
    .footer { margin-top: 30px; text-align: center; color: #999; font-size: 10px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
    @media print {
      .no-print { display: none; }
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>\ud83c\udfac CINEMA - B\u00c1O C\u00c1O DOANH THU</h1>
    <p>Ng\u00e0y xu\u1ea5t: ${formatDate(new Date())}</p>
    ${startDate || endDate ? `<p>K\u1ef3 b\u00e1o c\u00e1o: ${startDate ? formatDate(startDate) : 'T\u1eeb \u0111\u1ea7u'} - ${endDate ? formatDate(endDate) : 'Hi\u1ec7n t\u1ea1i'}</p>` : ''}
  </div>

  <div class="summary">
    <h2 style="margin-top: 0; color: #e11d48;">T\u1ed5ng k\u1ebft</h2>
    <div class="summary-grid">
      <div class="summary-item">
        <label>T\u1ed5ng \u0111\u01a1n h\u00e0ng:</label>
        <value>${bookings.length}</value>
      </div>
      <div class="summary-item">
        <label>T\u1ed5ng doanh thu:</label>
        <value>${formatCurrency(totalRevenue)}</value>
      </div>
      <div class="summary-item">
        <label>T\u1ed5ng v\u00e9 b\u00e1n:</label>
        <value>${totalTickets}</value>
      </div>
      <div class="summary-item">
        <label>Gi\u00e1 tr\u1ecb trung b\u00ecnh/\u0111\u01a1n:</label>
        <value>${formatCurrency(totalRevenue / bookings.length || 0)}</value>
      </div>
    </div>
  </div>

  <h2 style="color: #e11d48;">Chi ti\u1ebft \u0111\u01a1n h\u00e0ng</h2>
  <table>
    <thead>
      <tr>
        <th>M\u00e3 \u0111\u01a1n</th>
        <th>Ng\u00e0y</th>
        <th>Phim</th>
        <th>Kh\u00e1ch h\u00e0ng</th>
        <th>S\u1ed1 v\u00e9</th>
        <th>S\u1ed1 ti\u1ec1n</th>
        <th>TT</th>
      </tr>
    </thead>
    <tbody>
      ${bookings.map(booking => `
        <tr>
          <td><strong>${booking.bookingCode}</strong></td>
          <td>${formatDate(booking.createdAt)}</td>
          <td>${booking.movieId?.title || 'N/A'}</td>
          <td>${booking.userId?.fullName || 'N/A'}</td>
          <td style="text-align: center">${booking.seats.length}</td>
          <td style="text-align: right"><strong>${formatCurrency(booking.finalAmount)}</strong></td>
          <td><span style="color: ${booking.status === 'confirmed' || booking.status === 'used' ? '#10b981' : '#ef4444'}">${booking.status === 'confirmed' ? '\u0110\u00e3 x\u00e1c nh\u1eadn' : booking.status === 'used' ? '\u0110\u00e3 s\u1eed d\u1ee5ng' : '\u0110\u00e3 h\u1ee7y'}</span></td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    <p>B\u00e1o c\u00e1o n\u00e0y \u0111\u01b0\u1ee3c t\u1ea1o t\u1ef1 \u0111\u1ed9ng b\u1edfi h\u1ec7 th\u1ed1ng qu\u1ea3n l\u00fd r\u1ea1p chi\u1ebfu phim</p>
    <p>\u00a9 ${new Date().getFullYear()} Cinema Management System. All rights reserved.</p>
  </div>

  <script>
    window.onload = function() {
      setTimeout(() => window.print(), 500);
    };
  </script>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }

    // Return JSON
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
