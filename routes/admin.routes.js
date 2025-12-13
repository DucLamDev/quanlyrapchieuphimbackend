import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware.js';
import showtimeGeneratorService from '../services/showtimeGenerator.service.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * @route   POST /api/admin/showtimes/generate
 * @desc    Tạo suất chiếu cho ngày tiếp theo (manual trigger)
 * @access  Admin only
 */
router.post('/showtimes/generate', protect, authorize('admin'), async (req, res) => {
  try {
    logger.info(`Admin ${req.user.email} triggered manual showtime generation`);
    
    const result = await showtimeGeneratorService.generateShowtimesForNextDay();
    
    res.json({
      success: result.success,
      message: result.message,
      data: {
        count: result.count,
        date: result.date
      }
    });
  } catch (error) {
    logger.error('Error in manual showtime generation:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo suất chiếu',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/admin/showtimes/generate-today
 * @desc    Tạo suất chiếu cho ngày hôm nay
 * @access  Admin only
 */
router.post('/showtimes/generate-today', protect, authorize('admin'), async (req, res) => {
  try {
    logger.info(`Admin ${req.user.email} triggered showtime generation for today`);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const result = await showtimeGeneratorService.generateShowtimesForNextDay(today);
    
    res.json({
      success: result.success,
      message: result.message || 'Đã tạo suất chiếu cho hôm nay',
      data: {
        count: result.count,
        date: today.toDateString()
      }
    });
  } catch (error) {
    logger.error('Error generating showtimes for today:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo suất chiếu cho hôm nay',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/admin/showtimes/ensure
 * @desc    Đảm bảo có suất chiếu cho 7 ngày tới
 * @access  Admin only
 */
router.post('/showtimes/ensure', protect, authorize('admin'), async (req, res) => {
  try {
    logger.info(`Admin ${req.user.email} triggered ensure showtimes`);
    
    const result = await showtimeGeneratorService.ensureShowtimesExist();
    
    res.json({
      success: result.success,
      message: result.message || 'Đã kiểm tra và tạo suất chiếu',
      data: result
    });
  } catch (error) {
    logger.error('Error ensuring showtimes:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi đảm bảo suất chiếu',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/admin/showtimes/regenerate-today
 * @desc    Xóa và tạo lại suất chiếu cho hôm nay (tất cả khung giờ)
 * @access  Admin only
 */
router.post('/showtimes/regenerate-today', protect, authorize('admin'), async (req, res) => {
  try {
    const Showtime = (await import('../models/Showtime.model.js')).default;
    
    logger.info(`Admin ${req.user.email} triggered regenerate showtimes for today`);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Delete existing showtimes for today that have no bookings
    const deleteResult = await Showtime.deleteMany({
      startTime: { $gte: today, $lt: tomorrow },
      $or: [
        { bookedSeats: { $size: 0 } },
        { bookedSeats: { $exists: false } }
      ]
    });
    
    logger.info(`Deleted ${deleteResult.deletedCount} showtimes for today`);
    
    // Generate new showtimes for today
    const result = await showtimeGeneratorService.generateShowtimesForNextDay(today);
    
    res.json({
      success: true,
      message: `Đã xóa ${deleteResult.deletedCount} suất chiếu cũ và tạo ${result.count || 0} suất chiếu mới cho hôm nay`,
      data: {
        deleted: deleteResult.deletedCount,
        created: result.count || 0
      }
    });
  } catch (error) {
    logger.error('Error regenerating showtimes for today:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo lại suất chiếu',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/admin/showtimes/generate-multiple
 * @desc    Tạo suất chiếu cho nhiều ngày
 * @access  Admin only
 */
router.post('/showtimes/generate-multiple', protect, authorize('admin'), async (req, res) => {
  try {
    const { days = 7 } = req.body;
    
    if (days < 1 || days > 30) {
      return res.status(400).json({
        success: false,
        message: 'Số ngày phải từ 1 đến 30'
      });
    }
    
    logger.info(`Admin ${req.user.email} triggered generation for ${days} days`);
    
    const result = await showtimeGeneratorService.generateShowtimesForMultipleDays(days);
    
    res.json({
      success: result.success,
      message: `Đã tạo suất chiếu cho ${days} ngày`,
      data: {
        totalCount: result.totalCount,
        details: result.details
      }
    });
  } catch (error) {
    logger.error('Error in multiple days generation:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo suất chiếu',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/admin/showtimes/cleanup
 * @desc    Xóa suất chiếu cũ (manual trigger)
 * @access  Admin only
 */
router.post('/showtimes/cleanup', protect, authorize('admin'), async (req, res) => {
  try {
    logger.info(`Admin ${req.user.email} triggered manual cleanup`);
    
    const result = await showtimeGeneratorService.cleanupOldShowtimes();
    
    res.json({
      success: result.success,
      message: `Đã xóa ${result.deletedCount} suất chiếu cũ`,
      data: {
        deletedCount: result.deletedCount
      }
    });
  } catch (error) {
    logger.error('Error in cleanup:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa suất chiếu cũ',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/admin/showtimes/stats
 * @desc    Thống kê suất chiếu
 * @access  Admin only
 */
router.get('/showtimes/stats', protect, authorize('admin'), async (req, res) => {
  try {
    const Showtime = (await import('../models/Showtime.model.js')).default;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const [todayCount, tomorrowCount, weekCount, totalCount] = await Promise.all([
      Showtime.countDocuments({
        startTime: { $gte: today, $lt: tomorrow }
      }),
      Showtime.countDocuments({
        startTime: { $gte: tomorrow, $lt: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000) }
      }),
      Showtime.countDocuments({
        startTime: { $gte: today, $lt: nextWeek }
      }),
      Showtime.countDocuments()
    ]);
    
    res.json({
      success: true,
      data: {
        today: todayCount,
        tomorrow: tomorrowCount,
        nextWeek: weekCount,
        total: totalCount
      }
    });
  } catch (error) {
    logger.error('Error getting showtime stats:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thống kê',
      error: error.message
    });
  }
});

export default router;
