import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Cinema from '../models/Cinema.model.js';

dotenv.config();

const cinemasData = [
  {
    name: 'CGV Vincom Center Đà Nẵng',
    address: '72 Lê Thánh Tôn, Quận 1',
    city: 'Đà Nẵng',
    phone: '1900 6017',
    location: {
      address: '72 Lê Thánh Tôn, Quận 1',
      city: 'Đà Nẵng',
      coordinates: {
        lat: 16.0544,
        lng: 108.2022
      }
    },
    screens: [
      { name: 'Phòng 1', capacity: 150, type: 'standard', totalSeats: 150 },
      { name: 'Phòng 2', capacity: 150, type: 'standard', totalSeats: 150 },
      { name: 'Phòng 3', capacity: 150, type: 'standard', totalSeats: 150 },
      { name: 'Phòng 4 - Premium', capacity: 100, type: 'premium', totalSeats: 100 },
      { name: 'Phòng 5 - IMAX', capacity: 200, type: 'imax', totalSeats: 200 },
      { name: 'Phòng 6 - 4DX', capacity: 120, type: '4dx', totalSeats: 120 }
    ],
    totalSeats: 870,
    facilities: ['parking', 'food-court', 'wifi', '3d-available'],
    operatingHours: {
      open: '9:00 AM',
      close: '11:00 PM'
    },
    isActive: true,
    rating: {
      average: 4.5,
      count: 100
    },
    images: ['https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800']
  },
  {
    name: 'Lotte Cinema Đà Nẵng',
    address: '34 Lê Duẩn, Quận Hải Châu',
    city: 'Đà Nẵng',
    phone: '1900 5454',
    location: {
      address: '34 Lê Duẩn, Quận Hải Châu',
      city: 'Đà Nẵng',
      coordinates: {
        lat: 16.0678,
        lng: 108.2208
      }
    },
    screens: [
      { name: 'Cinema 1', capacity: 150, type: 'standard', totalSeats: 150 },
      { name: 'Cinema 2', capacity: 150, type: 'standard', totalSeats: 150 },
      { name: 'Cinema 3', capacity: 150, type: 'standard', totalSeats: 150 },
      { name: 'Cinema 4 - Premium', capacity: 100, type: 'premium', totalSeats: 100 },
      { name: 'Cinema 5 - IMAX', capacity: 200, type: 'imax', totalSeats: 200 },
      { name: 'Cinema 6 - 4DX', capacity: 120, type: '4dx', totalSeats: 120 }
    ],
    totalSeats: 870,
    facilities: ['parking', 'food-court', 'wifi', 'imax'],
    operatingHours: {
      open: '9:00 AM',
      close: '11:00 PM'
    },
    isActive: true,
    rating: {
      average: 4.6,
      count: 120
    },
    images: ['https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=800']
  },
  {
    name: 'Galaxy Cinema Nguyễn Du',
    address: '116 Nguyễn Du, Quận Hải Châu',
    city: 'Đà Nẵng',
    phone: '1900 2224',
    location: {
      address: '116 Nguyễn Du, Quận Hải Châu',
      city: 'Đà Nẵng',
      coordinates: {
        lat: 16.0712,
        lng: 108.2187
      }
    },
    screens: [
      { name: 'Screen 1', capacity: 150, type: 'standard', totalSeats: 150 },
      { name: 'Screen 2', capacity: 150, type: 'standard', totalSeats: 150 },
      { name: 'Screen 3', capacity: 150, type: 'standard', totalSeats: 150 },
      { name: 'Screen 4 - Premium', capacity: 100, type: 'premium', totalSeats: 100 },
      { name: 'Screen 5 - IMAX', capacity: 200, type: 'imax', totalSeats: 200 },
      { name: 'Screen 6 - 4DX', capacity: 120, type: '4dx', totalSeats: 120 }
    ],
    totalSeats: 870,
    facilities: ['parking', 'food-court', 'wifi', 'arcade'],
    operatingHours: {
      open: '9:00 AM',
      close: '11:00 PM'
    },
    isActive: true,
    rating: {
      average: 4.4,
      count: 90
    },
    images: ['https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800']
  },
  {
    name: 'BHD Star Cineplex Đà Nẵng',
    address: '255 Trần Hưng Đạo, Quận Sơn Trà',
    city: 'Đà Nẵng',
    phone: '1900 2099',
    location: {
      address: '255 Trần Hưng Đạo, Quận Sơn Trà',
      city: 'Đà Nẵng',
      coordinates: {
        lat: 16.0831,
        lng: 108.2417
      }
    },
    screens: [
      { name: 'Hall 1', capacity: 150, type: 'standard', totalSeats: 150 },
      { name: 'Hall 2', capacity: 150, type: 'standard', totalSeats: 150 },
      { name: 'Hall 3', capacity: 150, type: 'standard', totalSeats: 150 },
      { name: 'Hall 4 - Premium', capacity: 100, type: 'premium', totalSeats: 100 },
      { name: 'Hall 5 - IMAX', capacity: 200, type: 'imax', totalSeats: 200 },
      { name: 'Hall 6 - 4DX', capacity: 120, type: '4dx', totalSeats: 120 }
    ],
    totalSeats: 870,
    facilities: ['parking', 'food-court', 'wifi', 'wheelchair-access'],
    operatingHours: {
      open: '9:00 AM',
      close: '11:00 PM'
    },
    isActive: true,
    rating: {
      average: 4.7,
      count: 150
    },
    images: ['https://images.unsplash.com/photo-1594908900066-3f47337549d8?w=800']
  }
];

async function seedCinemasQuick() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cinema_management';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Clear existing cinemas
    console.log('🗑️  Clearing old cinemas...');
    await Cinema.deleteMany({});
    console.log('✅ Old cinemas cleared\n');

    // Insert sample cinemas
    console.log(`🎬 Inserting ${cinemasData.length} cinemas...\n`);
    
    for (const cinemaData of cinemasData) {
      const cinema = new Cinema(cinemaData);
      await cinema.save();
      console.log(`   ✅ ${cinema.name}`);
    }

    console.log(`\n🎉 SUCCESS! Seeded ${cinemasData.length} cinemas`);
    console.log('\n📊 All cinemas are active (isActive: true)');
    console.log('\n✨ You can now run: node scripts/seedShowtimesAllDay.js');

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
seedCinemasQuick();
