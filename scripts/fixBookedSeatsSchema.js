import mongoose from 'mongoose';
import Showtime from '../models/Showtime.model.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

/**
 * Script để fix bookedSeats schema trong database
 * 
 * Vấn đề: Showtime documents cũ có thể có bookedSeats với schema khác
 * Giải pháp: Clear tất cả bookedSeats và để user đặt vé lại
 * 
 * Chạy: node scripts/fixBookedSeatsSchema.js
 */

async function fixBookedSeatsSchema() {
  try {
    // Get MONGO_URI
    let mongoUri = process.env.MONGO_URI;
    
    if (process.argv.includes('--local')) {
      mongoUri = 'mongodb://localhost:27017/rapphim';
      console.log('🔧 Using local MongoDB');
    }
    
    if (!mongoUri) {
      mongoUri = "mongodb+srv://lamhung24082002_db_user:BdLf6i3gkVyjaaN4@cluster0.enl1ybd.mongodb.net/?appName=Cluster0";
      console.log('🔧 Using hardcoded MongoDB URI');
    }

    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Get all showtimes
    const showtimes = await Showtime.find();
    console.log(`📍 Found ${showtimes.length} showtimes`);

    if (showtimes.length === 0) {
      console.log('⚠️  No showtimes found.');
      process.exit(0);
    }

    console.log('\n🔧 Fixing bookedSeats schema...\n');

    let fixed = 0;
    let errors = 0;

    for (const showtime of showtimes) {
      try {
        // Check if bookedSeats exists and has wrong type
        if (showtime.bookedSeats) {
          console.log(`  Fixing showtime ${showtime._id}...`);
          
          // Clear bookedSeats - reset to empty array
          await Showtime.updateOne(
            { _id: showtime._id },
            { 
              $set: { 
                bookedSeats: [],
                availableSeats: showtime.room.capacity || 100
              } 
            }
          );
          
          fixed++;
          console.log(`    ✓ Fixed (cleared bookedSeats)`);
        }
      } catch (error) {
        console.error(`    ✗ Error fixing ${showtime._id}:`, error.message);
        errors++;
      }
    }

    console.log(`\n✅ Fixed ${fixed} showtimes`);
    if (errors > 0) {
      console.log(`⚠️  ${errors} errors occurred`);
    }
    
    console.log('\n💡 TIP: Người dùng cần đặt vé lại vì bookedSeats đã được reset');
    console.log('    Hoặc có thể giữ booking records và rebuild bookedSeats từ bookings\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Option 2: Rebuild bookedSeats from existing bookings
async function rebuildBookedSeatsFromBookings() {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb+srv://lamhung24082002_db_user:BdLf6i3gkVyjaaN4@cluster0.enl1ybd.mongodb.net/?appName=Cluster0";
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Import Booking model
    const Booking = (await import('../models/Booking.model.js')).default;

    // Get all confirmed bookings
    const bookings = await Booking.find({ paymentStatus: 'paid' });
    console.log(`📍 Found ${bookings.length} paid bookings`);

    // Group by showtime
    const showtimeBookings = {};
    for (const booking of bookings) {
      const showtimeId = booking.showtimeId.toString();
      if (!showtimeBookings[showtimeId]) {
        showtimeBookings[showtimeId] = [];
      }
      
      // Add seats from this booking
      for (const seat of booking.seats) {
        showtimeBookings[showtimeId].push({
          row: seat.row,
          number: seat.number,
          type: seat.type,
          bookingId: booking._id
        });
      }
    }

    console.log(`\n🔧 Rebuilding bookedSeats for ${Object.keys(showtimeBookings).length} showtimes...\n`);

    let rebuilt = 0;
    for (const [showtimeId, seats] of Object.entries(showtimeBookings)) {
      try {
        await Showtime.updateOne(
          { _id: showtimeId },
          { 
            $set: { 
              bookedSeats: seats 
            } 
          }
        );
        
        console.log(`  ✓ Rebuilt showtime ${showtimeId} with ${seats.length} seats`);
        rebuilt++;
      } catch (error) {
        console.error(`  ✗ Error rebuilding ${showtimeId}:`, error.message);
      }
    }

    console.log(`\n✅ Rebuilt ${rebuilt} showtimes`);
    console.log('💡 bookedSeats đã được rebuild từ bookings data\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Chạy script
const mode = process.argv[2];

if (mode === 'rebuild') {
  console.log('🔄 Mode: Rebuild from bookings\n');
  rebuildBookedSeatsFromBookings();
} else {
  console.log('🧹 Mode: Clear bookedSeats\n');
  fixBookedSeatsSchema();
}
