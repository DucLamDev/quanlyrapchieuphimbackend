import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Movie from '../models/Movie.model.js';

dotenv.config();

async function updateMoviesStatus() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cinema_management';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Get all movies
    const movies = await Movie.find({});
    console.log(`📽️  Found ${movies.length} total movies\n`);

    if (movies.length === 0) {
      console.log('⚠️  No movies found. Please seed movies first using: node scripts/seedMovies.js\n');
      return;
    }

    // Update status of all movies to "now_showing"
    console.log('🔄 Updating all movies to status "now_showing"...\n');
    
    const result = await Movie.updateMany(
      {},
      { $set: { status: 'now-showing' } }
    );

    console.log(`✅ Updated ${result.modifiedCount} movies`);
    console.log(`\n📊 Current status:`);
    
    const nowShowing = await Movie.countDocuments({ status: 'now-showing' });
    const comingSoon = await Movie.countDocuments({ status: 'coming-soon' });
    const ended = await Movie.countDocuments({ status: 'ended' });
    
    console.log(`   - Now showing: ${nowShowing}`);
    console.log(`   - Coming soon: ${comingSoon}`);
    console.log(`   - Ended: ${ended}`);
    
    console.log('\n✨ Done! You can now run: node scripts/seedShowtimesAllDay.js');

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
updateMoviesStatus();
