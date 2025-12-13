import mongoose from 'mongoose';
import dotenv from 'dotenv';
import showtimeGeneratorService from '../services/showtimeGenerator.service.js';
import { logger } from '../utils/logger.js';

dotenv.config();

async function fixAndGenerate() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cinema_management';
    await mongoose.connect(mongoUri);
    
    console.log('✅ Connected to MongoDB\n');
    
    // Step 1: Clean up invalid showtimes
    console.log('🧹 Step 1: Cleaning up invalid showtimes (status: "available")...');
    const Showtime = (await import('../models/Showtime.model.js')).default;
    
    const deleteResult = await Showtime.deleteMany({
      status: 'available'  // Xóa các showtimes có status không hợp lệ
    });
    
    console.log(`   ✅ Deleted ${deleteResult.deletedCount} invalid showtimes\n`);
    
    // Step 2: Update existing showtimes to ensure isActive = true
    console.log('🔧 Step 2: Updating existing showtimes...');
    const updateResult = await Showtime.updateMany(
      { status: { $in: ['scheduled', 'ongoing'] } },
      { $set: { isActive: true } }
    );
    
    console.log(`   ✅ Updated ${updateResult.modifiedCount} showtimes with isActive=true\n`);
    
    // Step 3: Check if we have data
    console.log('📊 Step 3: Checking database...');
    const Movie = (await import('../models/Movie.model.js')).default;
    const Cinema = (await import('../models/Cinema.model.js')).default;
    
    const moviesCount = await Movie.countDocuments({ status: 'now-showing' });
    const cinemasCount = await Cinema.countDocuments({ isActive: true });
    
    console.log(`   Movies (now-showing): ${moviesCount}`);
    console.log(`   Cinemas (isActive=true): ${cinemasCount}\n`);
    
    if (moviesCount === 0 || cinemasCount === 0) {
      console.log('⚠️  WARNING: Not enough data to generate showtimes');
      
      if (moviesCount === 0) {
        console.log('   Updating movies to "now-showing"...');
        const movieUpdate = await Movie.updateMany(
          { releaseDate: { $lte: new Date() } },
          { $set: { status: 'now-showing' } }
        );
        console.log(`   ✅ Updated ${movieUpdate.modifiedCount} movies\n`);
      }
      
      if (cinemasCount === 0) {
        console.log('   Updating cinemas to isActive=true...');
        const cinemaUpdate = await Cinema.updateMany(
          {},
          { $set: { isActive: true } }
        );
        console.log(`   ✅ Updated ${cinemaUpdate.modifiedCount} cinemas\n`);
      }
    }
    
    // Step 4: Generate showtimes for today + next 6 days
    console.log('📅 Step 4: Generating showtimes for 7 days (today + 6 more)...\n');
    
    const result = await showtimeGeneratorService.generateShowtimesForMultipleDays(7);
    
    if (result.success) {
      console.log('\n✅ ========== SUCCESS ==========');
      console.log(`📊 Total showtimes created: ${result.totalCount}`);
      console.log('\n📋 Details by day:');
      result.details.forEach((day, index) => {
        const status = day.success ? '✅' : '⚠️ ';
        console.log(`   ${status} Day ${index + 1}: ${day.count} showtimes${day.date ? ` (${day.date})` : ''}`);
        if (day.message && !day.success) {
          console.log(`      Message: ${day.message}`);
        }
      });
      console.log('\n🎬 Done! Refresh frontend to see showtimes.');
    } else {
      console.log('\n⚠️  Generation completed with issues');
      console.log(`Message: ${result.message || 'Unknown issue'}`);
    }
    
    // Step 5: Verify results
    console.log('\n🔍 Step 5: Verifying results...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayCount = await Showtime.countDocuments({
      startTime: { $gte: today, $lt: tomorrow },
      isActive: true,
      status: 'scheduled'
    });
    
    const totalCount = await Showtime.countDocuments({
      isActive: true,
      status: 'scheduled'
    });
    
    console.log(`   Today (${today.toLocaleDateString()}): ${todayCount} showtimes`);
    console.log(`   Total scheduled: ${totalCount} showtimes`);
    
    if (todayCount > 0) {
      console.log('\n✅ ========== VERIFICATION PASSED ==========');
      console.log('🎉 Showtimes are now available on frontend!');
    } else {
      console.log('\n❌ ========== VERIFICATION FAILED ==========');
      console.log('⚠️  No showtimes found for today. Check logs above.');
    }
    
  } catch (error) {
    console.error('\n❌ ========== ERROR ==========');
    console.error('Error:', error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run
console.log('🚀 ========== FIX & GENERATE SHOWTIMES ==========\n');
fixAndGenerate();
