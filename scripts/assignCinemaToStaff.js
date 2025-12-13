import mongoose from 'mongoose';
import User from '../models/User.model.js';
import Cinema from '../models/Cinema.model.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

/**
 * Script để gán cinemaId cho staff accounts hiện có
 * 
 * Cách chạy:
 * 1. Nếu có .env file:
 *    node scripts/assignCinemaToStaff.js
 * 
 * 2. Nếu không có .env, truyền MONGO_URI:
 *    MONGO_URI="mongodb://..." node scripts/assignCinemaToStaff.js
 * 
 * 3. Hoặc dùng default local MongoDB:
 *    node scripts/assignCinemaToStaff.js --local
 */

async function assignCinemaToStaff() {
  try {
    // Get MONGO_URI from env or use default
    let mongoUri = "mongodb+srv://lamhung24082002_db_user:BdLf6i3gkVyjaaN4@cluster0.enl1ybd.mongodb.net/?appName=Cluster0";
    
    // Check for --local flag
    if (process.argv.includes('--local')) {
      mongoUri = 'mongodb://localhost:27017/rapphim';
      console.log('🔧 Using local MongoDB');
    }
    
    // Check if MONGO_URI is available
    if (!mongoUri) {
      console.error('❌ MONGO_URI not found');
      console.error('\n💡 Cách sử dụng:');
      console.error('   1. Tạo file .env trong backend/ với MONGO_URI');
      console.error('   2. Hoặc chạy: MONGO_URI="mongodb://..." node scripts/assignCinemaToStaff.js');
      console.error('   3. Hoặc dùng local: node scripts/assignCinemaToStaff.js --local');
      console.error(`\n📁 .env path: ${path.join(__dirname, '..', '.env')}`);
      process.exit(1);
    }

    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Lấy danh sách cinema
    const cinemas = await Cinema.find();
    console.log(`📍 Found ${cinemas.length} cinemas`);

    if (cinemas.length === 0) {
      console.log('⚠️  No cinemas found. Please create cinemas first.');
      process.exit(0);
    }

    // Lấy tất cả staff chưa có cinemaId
    const staffWithoutCinema = await User.find({
      role: 'staff',
      cinemaId: { $exists: false }
    });

    console.log(`👥 Found ${staffWithoutCinema.length} staff without cinemaId`);

    if (staffWithoutCinema.length === 0) {
      console.log('✅ All staff already have cinemaId assigned');
      process.exit(0);
    }

    // Gán cinema đầu tiên cho tất cả staff
    const defaultCinema = cinemas[0];
    console.log(`\n🎬 Assigning all staff to: ${defaultCinema.name}`);

    for (const staff of staffWithoutCinema) {
      await User.updateOne(
        { _id: staff._id },
        { $set: { cinemaId: defaultCinema._id } }
      );
      console.log(`  ✓ Assigned ${staff.email} to ${defaultCinema.name}`);
    }

    console.log(`\n✅ Successfully assigned ${staffWithoutCinema.length} staff to cinema`);
    
    // Hiển thị gợi ý
    console.log('\n💡 TIP: Nếu muốn gán staff cho các cinema khác:');
    console.log('   1. Vào admin panel');
    console.log('   2. Edit user và chọn cinema');
    console.log('   3. Hoặc modify script này để custom assignment\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Interactive mode - chọn cinema cho từng staff
async function assignCinemaInteractive() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const cinemas = await Cinema.find();
    console.log('\n📍 Available Cinemas:');
    cinemas.forEach((cinema, index) => {
      console.log(`   ${index + 1}. ${cinema.name} - ${cinema.address}`);
    });

    const staffWithoutCinema = await User.find({
      role: 'staff',
      cinemaId: { $exists: false }
    });

    console.log(`\n👥 Staff without cinema: ${staffWithoutCinema.length}\n`);

    for (const staff of staffWithoutCinema) {
      console.log(`Staff: ${staff.email} (${staff.fullName})`);
      
      // Trong script thực tế, có thể dùng readline để prompt
      // Ở đây mặc định gán cinema đầu tiên
      const assignedCinema = cinemas[0];
      
      await User.updateOne(
        { _id: staff._id },
        { $set: { cinemaId: assignedCinema._id } }
      );
      
      console.log(`  ✓ Assigned to: ${assignedCinema.name}\n`);
    }

    console.log('✅ All staff assigned!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Chạy script
const mode = process.argv[2];

if (mode === 'interactive') {
  assignCinemaInteractive();
} else {
  assignCinemaToStaff();
}
