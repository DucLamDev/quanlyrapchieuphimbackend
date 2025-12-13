import mongoose from 'mongoose';
import dotenv from 'dotenv';
import showtimeGeneratorService from '../services/showtimeGenerator.service.js';
import { logger } from '../utils/logger.js';

dotenv.config();

async function generateShowtimes() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cinema_management';
    await mongoose.connect(mongoUri);
    
    console.log('✅ Connected to MongoDB');
    console.log('\n📅 Generating showtimes for next 7 days...\n');
    
    // Tạo suất chiếu cho 7 ngày (bao gồm hôm nay)
    const result = await showtimeGeneratorService.generateShowtimesForMultipleDays(7);
    
    if (result.success) {
      console.log('\n✅ SUCCESS!');
      console.log(`📊 Total showtimes created: ${result.totalCount}`);
      console.log('\n📋 Details by day:');
      result.details.forEach((day, index) => {
        console.log(`   Day ${index + 1}: ${day.count} showtimes${day.date ? ` (${day.date})` : ''}`);
      });
    } else {
      console.log('\n⚠️  Generation completed with warnings');
      console.log(`Message: ${result.message || 'Unknown issue'}`);
    }
    
    console.log('\n🎬 Done! You can now see showtimes on the frontend.');
    
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
generateShowtimes();
