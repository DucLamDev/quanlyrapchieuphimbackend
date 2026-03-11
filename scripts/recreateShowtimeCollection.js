import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

/**
 * Script để recreate Showtime collection với schema đúng
 * 
 * Vấn đề: MongoDB collection metadata vẫn có schema cũ
 * Giải pháp: Drop collection và recreate với schema mới
 */

async function recreateShowtimeCollection() {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb+srv://lamhung24082002_db_user:BdLf6i3gkVyjaaN4@cluster0.enl1ybd.mongodb.net/?appName=Cluster0";
    
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Get database
    const db = mongoose.connection.db;
    
    // Check if showtimes collection exists
    const collections = await db.listCollections({ name: 'showtimes' }).toArray();
    
    if (collections.length > 0) {
      console.log('📍 Found showtimes collection');
      console.log('⚠️  WARNING: This will DROP all showtime data!');
      console.log('💡 Make sure you have a backup or can reseed the data\n');
      
      // Backup showtime data
      const Showtime = mongoose.model('Showtime', new mongoose.Schema({}, { strict: false }));
      const showtimes = await Showtime.find().lean();
      console.log(`📦 Backing up ${showtimes.length} showtimes...\n`);
      
      // Drop collection
      console.log('🗑️  Dropping showtimes collection...');
      await db.collection('showtimes').drop();
      console.log('✅ Collection dropped');
      
      // Import proper model to recreate collection with correct schema
      const ShowtimeModel = (await import('../models/Showtime.model.js')).default;
      
      // Create collection with new schema
      console.log('🔨 Creating collection with new schema...');
      await ShowtimeModel.createCollection();
      console.log('✅ Collection recreated with correct schema');
      
      // Restore data
      console.log(`\n📥 Restoring ${showtimes.length} showtimes...`);
      for (const showtime of showtimes) {
        // Clear bookedSeats to ensure new schema
        showtime.bookedSeats = [];
        delete showtime._id; // Let MongoDB generate new IDs
        
        await ShowtimeModel.create(showtime);
      }
      console.log('✅ Data restored');
      
    } else {
      console.log('⚠️  No showtimes collection found');
    }
    
    console.log('\n✅ Done! Collection now has correct schema\n');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

recreateShowtimeCollection();
