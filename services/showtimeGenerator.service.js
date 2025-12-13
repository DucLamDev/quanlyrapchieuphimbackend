import Movie from '../models/Movie.model.js';
import Cinema from '../models/Cinema.model.js';
import Showtime from '../models/Showtime.model.js';
import { logger } from '../utils/logger.js';

class ShowtimeGeneratorService {
  /**
   * Tự động tạo suất chiếu cho ngày tiếp theo
   * Chạy vào lúc 00:00 hàng ngày
   * @param {Date} targetDate - Ngày cần tạo suất chiếu (mặc định: ngày mai)
   */
  async generateShowtimesForNextDay(targetDate = null) {
    try {
      // Nếu không truyền targetDate, mặc định là ngày mai
      const tomorrow = targetDate ? new Date(targetDate) : new Date();
      if (!targetDate) {
        tomorrow.setDate(tomorrow.getDate() + 1);
      }
      tomorrow.setHours(0, 0, 0, 0);

      logger.info(`Starting auto-generation of showtimes for ${tomorrow.toDateString()}...`);

      const nextDay = new Date(tomorrow);
      nextDay.setHours(23, 59, 59, 999);

      // Kiểm tra xem đã có suất chiếu cho ngày mai chưa
      const existingShowtimes = await Showtime.find({
        startTime: {
          $gte: tomorrow,
          $lte: nextDay
        }
      });

      if (existingShowtimes.length > 0) {
        logger.info(`Showtimes already exist for ${tomorrow.toDateString()}. Skipping generation.`);
        return {
          success: true,
          message: 'Showtimes already exist',
          count: existingShowtimes.length
        };
      }

      // Lấy tất cả phim đang chiếu
      const nowShowingMovies = await Movie.find({
        status: 'now-showing',
        releaseDate: { $lte: new Date() }
      }).select('_id title duration');

      if (nowShowingMovies.length === 0) {
        logger.warn('No now-showing movies found. Cannot generate showtimes.');
        return {
          success: false,
          message: 'No movies available for showtimes'
        };
      }

      // Lấy tất cả rạp
      const cinemas = await Cinema.find({ isActive: true });

      if (cinemas.length === 0) {
        logger.warn('No active cinemas found. Cannot generate showtimes.');
        return {
          success: false,
          message: 'No cinemas available'
        };
      }

      const showtimes = [];
      const timeSlots = this.generateTimeSlots(); // ['09:00', '11:30', '14:00', '16:30', '19:00', '21:30']

      // Tạo suất chiếu cho mỗi rạp
      for (const cinema of cinemas) {
        // Cinema có field 'screens' array, cần convert sang rooms hoặc dùng default
        let rooms;
        if (cinema.screens && cinema.screens.length > 0) {
          // Convert screens sang rooms format
          rooms = cinema.screens.map(screen => ({
            name: screen.name || 'Screen',
            capacity: screen.capacity || screen.seats?.total || 150,
            type: screen.screenType === 'IMAX' ? 'imax' : screen.screenType === '4DX' ? '4dx' : 'standard'
          }));
        } else {
          // Không có screens, tạo default rooms
          rooms = this.generateDefaultRooms(5);
        }

        // Phân bổ phim cho các phòng
        for (const room of rooms) {
          // Chọn ngẫu nhiên phim cho phòng này
          const movie = nowShowingMovies[Math.floor(Math.random() * nowShowingMovies.length)];
          
          // Tạo suất chiếu cho TẤT CẢ các khung giờ (sáng, chiều, tối)
          for (let i = 0; i < timeSlots.length; i++) {
            const timeSlot = timeSlots[i];
            const [hours, minutes] = timeSlot.split(':').map(Number);
            
            const startTime = new Date(tomorrow);
            startTime.setHours(hours, minutes, 0, 0);

            // Tính thời gian kết thúc (duration + 15 phút dọn dẹp)
            const endTime = new Date(startTime);
            endTime.setMinutes(endTime.getMinutes() + movie.duration + 15);

            showtimes.push({
              movieId: movie._id,
              cinemaId: cinema._id,
              room: {
                name: room.name,
                capacity: room.capacity,
                type: room.type || 'standard'
              },
              startTime,
              endTime,
              price: this.generatePricing(timeSlot, room.type),
              availableSeats: room.capacity,
              bookedSeats: [],
              status: 'scheduled',
              isActive: true
            });
          }
        }
      }

      // Lưu tất cả suất chiếu vào database
      const result = await Showtime.insertMany(showtimes);

      logger.info(`Successfully generated ${result.length} showtimes for ${tomorrow.toDateString()}`);

      return {
        success: true,
        message: 'Showtimes generated successfully',
        count: result.length,
        date: tomorrow.toDateString()
      };

    } catch (error) {
      logger.error('Error generating showtimes:', error);
      throw error;
    }
  }

  /**
   * Tạo các khung giờ chiếu phim trong ngày
   */
  generateTimeSlots() {
    return [
      '09:00', // Buổi sáng
      '11:30',
      '14:00', // Buổi trưa
      '16:30',
      '19:00', // Buổi tối (giờ vàng)
      '21:30'  // Buổi tối muộn
    ];
  }

  /**
   * Tạo danh sách phòng mặc định nếu cinema không có
   */
  generateDefaultRooms(screenCount = 5) {
    const rooms = [];
    for (let i = 1; i <= screenCount; i++) {
      rooms.push({
        name: `Phòng ${i}`,
        capacity: i <= 2 ? 200 : 150, // Phòng 1-2 lớn hơn
        type: i === 1 ? 'imax' : i === 2 ? 'vip' : 'standard'
      });
    }
    return rooms;
  }

  /**
   * Tạo giá vé theo khung giờ và loại phòng
   */
  generatePricing(timeSlot, roomType = 'standard') {
    const [hours] = timeSlot.split(':').map(Number);
    
    // Giá cơ bản
    let standardPrice = 80000;
    let vipPrice = 120000;
    let couplePrice = 150000;

    // Giờ vàng (19:00 - 22:00) tăng giá 20%
    if (hours >= 19 && hours < 22) {
      standardPrice *= 1.2;
      vipPrice *= 1.2;
      couplePrice *= 1.2;
    }

    // Phòng đặc biệt
    if (roomType === 'imax') {
      standardPrice *= 1.5;
      vipPrice *= 1.5;
      couplePrice *= 1.5;
    } else if (roomType === 'vip') {
      standardPrice *= 1.3;
      vipPrice *= 1.3;
      couplePrice *= 1.3;
    }

    return {
      standard: Math.round(standardPrice / 1000) * 1000, // Làm tròn đến nghìn
      vip: Math.round(vipPrice / 1000) * 1000,
      couple: Math.round(couplePrice / 1000) * 1000
    };
  }

  /**
   * Xóa suất chiếu cũ (quá 7 ngày)
   */
  async cleanupOldShowtimes() {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const result = await Showtime.deleteMany({
        startTime: { $lt: sevenDaysAgo },
        status: { $in: ['completed', 'cancelled'] }
      });

      logger.info(`Cleaned up ${result.deletedCount} old showtimes`);

      return {
        success: true,
        deletedCount: result.deletedCount
      };
    } catch (error) {
      logger.error('Error cleaning up old showtimes:', error);
      throw error;
    }
  }

  /**
   * Tạo suất chiếu cho nhiều ngày (dùng khi setup lần đầu)
   * @param {number} days - Số ngày cần tạo (bắt đầu từ HÔM NAY)
   */
  async generateShowtimesForMultipleDays(days = 7) {
    try {
      logger.info(`Generating showtimes for next ${days} days (starting from TODAY)...`);

      const results = [];
      for (let i = 0; i < days; i++) {
        // Tạo cho từng ngày, bắt đầu từ HÔM NAY (i=0)
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + i);
        targetDate.setHours(0, 0, 0, 0);

        const result = await this.generateShowtimesForNextDay(targetDate);
        results.push(result);
      }

      const totalCount = results.reduce((sum, r) => sum + (r.count || 0), 0);

      logger.info(`Successfully generated ${totalCount} showtimes for ${days} days`);

      return {
        success: true,
        totalCount,
        details: results
      };
    } catch (error) {
      logger.error('Error generating multiple days showtimes:', error);
      throw error;
    }
  }

  /**
   * Đảm bảo luôn có suất chiếu khi server khởi động
   * Tự động tạo suất chiếu cho hôm nay và 7 ngày tiếp theo nếu chưa có
   */
  async ensureShowtimesExist() {
    try {
      logger.info('🎬 Checking and ensuring showtimes exist...');

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(23, 59, 59, 999);

      // Check if we have any showtimes for the next 7 days
      const existingCount = await Showtime.countDocuments({
        startTime: { $gte: today, $lte: nextWeek },
        isActive: true
      });

      if (existingCount > 0) {
        logger.info(`✅ Found ${existingCount} existing showtimes for the next 7 days`);
        
        // Still check each day and fill in missing days
        let generatedCount = 0;
        for (let i = 0; i < 7; i++) {
          const targetDate = new Date(today);
          targetDate.setDate(targetDate.getDate() + i);
          
          const dayStart = new Date(targetDate);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(targetDate);
          dayEnd.setHours(23, 59, 59, 999);

          const dayCount = await Showtime.countDocuments({
            startTime: { $gte: dayStart, $lte: dayEnd },
            isActive: true
          });

          if (dayCount === 0) {
            logger.info(`📅 No showtimes for ${targetDate.toDateString()}, generating...`);
            const result = await this.generateShowtimesForNextDay(targetDate);
            generatedCount += result.count || 0;
          }
        }

        if (generatedCount > 0) {
          logger.info(`✅ Generated ${generatedCount} additional showtimes for missing days`);
        }

        return {
          success: true,
          message: 'Showtimes verified and updated',
          existingCount,
          generatedCount
        };
      }

      // No showtimes exist, generate for next 7 days
      logger.info('⚠️ No showtimes found, generating for next 7 days...');
      const result = await this.generateShowtimesForMultipleDays(7);

      return {
        success: true,
        message: 'Generated showtimes for next 7 days',
        ...result
      };
    } catch (error) {
      logger.error('❌ Error ensuring showtimes exist:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

export default new ShowtimeGeneratorService();
