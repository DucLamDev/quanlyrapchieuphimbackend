import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Movie from '../models/Movie.model.js';
import Cinema from '../models/Cinema.model.js';
import Showtime from '../models/Showtime.model.js';

dotenv.config();

// Các khung giờ chiếu trong ngày (9h sáng - 23h tối)
const TIME_SLOTS = [
  { hour: 9, minute: 0 },   // 09:00
  { hour: 11, minute: 30 }, // 11:30
  { hour: 14, minute: 0 },  // 14:00
  { hour: 16, minute: 30 }, // 16:30
  { hour: 19, minute: 0 },  // 19:00
  { hour: 21, minute: 30 }  // 21:30
];

// Giá vé theo loại phòng
const PRICES = {
  standard: {
    standard: 80000,
    vip: 120000,
    couple: 150000
  },
  imax: {
    standard: 150000,
    vip: 200000,
    couple: 250000
  },
  '4dx': {
    standard: 180000,
    vip: 230000,
    couple: 280000
  },
  premium: {
    standard: 120000,
    vip: 160000,
    couple: 200000
  }
};

// Các loại phòng và số lượng ghế
const ROOM_TYPES = [
  { type: 'standard', capacity: 150, count: 3 },
  { type: 'premium', capacity: 100, count: 1 },
  { type: 'imax', capacity: 200, count: 1 },
  { type: '4dx', capacity: 120, count: 1 }
];

async function seedShowtimesAllDay() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cinema_management';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Lấy tất cả phim đang chiếu
    const movies = await Movie.find({ status: 'now-showing' });
    console.log(`📽️  Found ${movies.length} now-showing movies`);

    if (movies.length === 0) {
      console.log('⚠️  No movies with status "now_showing". Please add movies first.');
      return;
    }

    // Lấy tất cả rạp
    const cinemas = await Cinema.find({ isActive: true });
    console.log(`🎬 Found ${cinemas.length} active cinemas\n`);

    if (cinemas.length === 0) {
      console.log('⚠️  No active cinemas. Please add cinemas first.');
      return;
    }

    // Xóa tất cả suất chiếu cũ
    console.log('🗑️  Clearing old showtimes...');
    await Showtime.deleteMany({});
    console.log('✅ Old showtimes cleared\n');

    let totalShowtimes = 0;
    const daysToGenerate = 7; // Tạo cho 7 ngày

    console.log(`📅 Generating showtimes for ${daysToGenerate} days...\n`);

    // Tạo suất chiếu cho mỗi ngày
    for (let dayOffset = 0; dayOffset < daysToGenerate; dayOffset++) {
      const date = new Date();
      date.setDate(date.getDate() + dayOffset);
      date.setHours(0, 0, 0, 0);

      console.log(`\n📆 Day ${dayOffset + 1}: ${date.toLocaleDateString('vi-VN')}`);
      let dayShowtimes = 0;

      // Cho mỗi rạp
      for (const cinema of cinemas) {
        let cinemaShowtimes = 0;

        // Tạo phòng cho rạp (nếu chưa có)
        const rooms = [];
        let roomNumber = 1;
        
        for (const roomType of ROOM_TYPES) {
          for (let i = 0; i < roomType.count; i++) {
            rooms.push({
              name: `Phòng ${roomNumber}`,
              capacity: roomType.capacity,
              type: roomType.type
            });
            roomNumber++;
          }
        }

        // Cho mỗi phòng
        for (const room of rooms) {
          // Shuffle movies để không lặp lại phim liên tục
          const shuffledMovies = [...movies].sort(() => Math.random() - 0.5);
          let movieIndex = 0;

          // Cho mỗi khung giờ
          for (const timeSlot of TIME_SLOTS) {
            const movie = shuffledMovies[movieIndex % shuffledMovies.length];
            movieIndex++;

            // Skip nếu là quá khứ (chỉ cho ngày hôm nay)
            if (dayOffset === 0) {
              const now = new Date();
              const slotTime = new Date(date);
              slotTime.setHours(timeSlot.hour, timeSlot.minute, 0, 0);
              
              if (slotTime <= now) {
                continue; // Bỏ qua suất đã qua
              }
            }

            const startTime = new Date(date);
            startTime.setHours(timeSlot.hour, timeSlot.minute, 0, 0);

            const endTime = new Date(startTime);
            endTime.setMinutes(endTime.getMinutes() + (movie.duration || 120) + 15); // +15 phút dọn dẹp

            // Kiểm tra không trùng giờ với suất khác trong cùng phòng
            const existingShowtime = await Showtime.findOne({
              cinemaId: cinema._id,
              'room.name': room.name,
              $or: [
                {
                  startTime: { $lte: startTime },
                  endTime: { $gt: startTime }
                },
                {
                  startTime: { $lt: endTime },
                  endTime: { $gte: endTime }
                }
              ]
            });

            if (existingShowtime) {
              continue; // Bỏ qua nếu trùng giờ
            }

            const showtime = new Showtime({
              movieId: movie._id,
              cinemaId: cinema._id,
              room: room,
              startTime: startTime,
              endTime: endTime,
              date: date,
              price: PRICES[room.type] || PRICES.standard,
              availableSeats: room.capacity,
              bookedSeats: [],
              status: 'scheduled',
              isActive: true,
              crowdPrediction: {
                level: 'medium',
                percentage: 50,
                factors: []
              }
            });

            await showtime.save();
            cinemaShowtimes++;
            totalShowtimes++;
          }
        }

        console.log(`   ${cinema.name}: ${cinemaShowtimes} showtimes`);
        dayShowtimes += cinemaShowtimes;
      }

      console.log(`   ✅ Total for day ${dayOffset + 1}: ${dayShowtimes} showtimes`);
    }

    console.log(`\n🎉 SUCCESS! Generated ${totalShowtimes} showtimes in total`);
    console.log('\n📊 Summary:');
    console.log(`   - Days: ${daysToGenerate}`);
    console.log(`   - Cinemas: ${cinemas.length}`);
    console.log(`   - Movies: ${movies.length}`);
    console.log(`   - Time slots per day: ${TIME_SLOTS.length}`);
    console.log(`   - Total showtimes: ${totalShowtimes}`);
    console.log('\n✨ You can now see showtimes on the frontend!');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run
seedShowtimesAllDay();
