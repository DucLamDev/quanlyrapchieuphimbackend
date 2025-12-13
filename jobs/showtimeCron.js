import cron from 'node-cron';
import showtimeGeneratorService from '../services/showtimeGenerator.service.js';
import { logger } from '../utils/logger.js';

/**
 * Cron job tự động tạo suất chiếu mỗi ngày
 * Chạy vào lúc 00:00 (nửa đêm) hàng ngày
 */
export function scheduleShowtimeGeneration() {
  // Chạy vào 00:00 mỗi ngày
  // Format: second minute hour day month dayOfWeek
  cron.schedule('0 0 * * *', async () => {
    try {
      logger.info('===== CRON JOB: Auto-generating showtimes for next day =====');
      
      const result = await showtimeGeneratorService.generateShowtimesForNextDay();
      
      if (result.success) {
        logger.info(`✅ Successfully generated ${result.count} showtimes for ${result.date}`);
      } else {
        logger.warn(`⚠️ Showtime generation completed with warning: ${result.message}`);
      }
    } catch (error) {
      logger.error('❌ Error in showtime generation cron job:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Ho_Chi_Minh"
  });

  logger.info('📅 Showtime generation cron job scheduled (runs daily at 00:00 VN time)');
}

/**
 * Cron job xóa suất chiếu cũ
 * Chạy vào lúc 02:00 mỗi ngày
 */
export function scheduleShowtimeCleanup() {
  // Chạy vào 02:00 mỗi ngày
  cron.schedule('0 2 * * *', async () => {
    try {
      logger.info('===== CRON JOB: Cleaning up old showtimes =====');
      
      const result = await showtimeGeneratorService.cleanupOldShowtimes();
      
      logger.info(`✅ Cleaned up ${result.deletedCount} old showtimes`);
    } catch (error) {
      logger.error('❌ Error in showtime cleanup cron job:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Ho_Chi_Minh"
  });

  logger.info('🧹 Showtime cleanup cron job scheduled (runs daily at 02:00 VN time)');
}

/**
 * Cron job cập nhật trạng thái suất chiếu đã qua
 * Chạy mỗi giờ
 */
export function scheduleShowtimeStatusUpdate() {
  // Chạy mỗi giờ
  cron.schedule('0 * * * *', async () => {
    try {
      const Showtime = (await import('../models/Showtime.model.js')).default;
      
      // Cập nhật các suất chiếu đã qua thành 'completed'
      const now = new Date();
      const result = await Showtime.updateMany(
        {
          endTime: { $lt: now },
          status: 'available'
        },
        {
          $set: { status: 'completed' }
        }
      );

      if (result.modifiedCount > 0) {
        logger.info(`✅ Updated ${result.modifiedCount} showtimes to 'completed' status`);
      }
    } catch (error) {
      logger.error('❌ Error in showtime status update cron job:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Ho_Chi_Minh"
  });

  logger.info('🔄 Showtime status update cron job scheduled (runs hourly)');
}

/**
 * Khởi tạo tất cả cron jobs và đảm bảo có suất chiếu
 */
export async function initializeShowtimeCronJobs() {
  // Schedule cron jobs
  scheduleShowtimeGeneration();
  scheduleShowtimeCleanup();
  scheduleShowtimeStatusUpdate();
  
  logger.info('✅ All showtime cron jobs initialized successfully');

  // Ensure showtimes exist on startup (after a short delay to ensure DB is ready)
  setTimeout(async () => {
    try {
      logger.info('🎬 Running startup showtime check...');
      const result = await showtimeGeneratorService.ensureShowtimesExist();
      if (result.success) {
        logger.info('✅ Startup showtime check completed successfully');
      } else {
        logger.warn('⚠️ Startup showtime check completed with warning:', result.message);
      }
    } catch (error) {
      logger.error('❌ Error during startup showtime check:', error);
    }
  }, 5000); // Wait 5 seconds for DB connection to be stable
}

export default {
  scheduleShowtimeGeneration,
  scheduleShowtimeCleanup,
  scheduleShowtimeStatusUpdate,
  initializeShowtimeCronJobs
};
