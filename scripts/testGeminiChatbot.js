import geminiChatbot from '../services/geminiChatbot.js';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load environment variables
dotenv.config();

// Test scenarios
const testMessages = [
  'Xin chào!',
  'Có phim gì đang chiếu?',
  'Lịch chiếu phim hôm nay',
  'Tìm rạp gần tôi',
  'Có khuyến mãi gì không?',
  'Giá vé bao nhiêu?'
];

async function testGeminiChatbot() {
  console.log('🚀 Testing Gemini AI Chatbot Integration\n');
  console.log('=' .repeat(60));

  try {
    // Connect to database
    console.log('\n📦 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cinema');
    console.log('✅ Database connected\n');

    // Test each message
    for (let i = 0; i < testMessages.length; i++) {
      const message = testMessages[i];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Test ${i + 1}/${testMessages.length}: "${message}"`);
      console.log('-'.repeat(60));

      try {
        const result = await geminiChatbot.processMessage(message, null, {});
        
        console.log('\n📤 Response:');
        console.log(`Message: ${result.message}`);
        console.log(`\nIntent: ${result.intent || 'N/A'}`);
        console.log(`Source: ${result.source || 'N/A'}`);
        
        if (result.suggestions && result.suggestions.length > 0) {
          console.log(`\n💡 Suggestions:`);
          result.suggestions.forEach(s => console.log(`  - ${s}`));
        }
        
        if (result.data) {
          console.log(`\n📊 Data: ${JSON.stringify(Object.keys(result.data))}`);
        }
        
        if (result.sentiment) {
          console.log(`\n😊 Sentiment: ${result.sentiment.sentiment || 'N/A'}`);
          if (result.sentiment.needsHumanSupport) {
            console.log(`⚠️  Needs human support: ${result.sentiment.reason}`);
          }
        }

        console.log('\n✅ Test passed');
      } catch (error) {
        console.error(`\n❌ Test failed: ${error.message}`);
      }

      // Wait a bit between requests to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 All tests completed!');
    console.log('=' .repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n📦 Database connection closed');
    process.exit(0);
  }
}

// Run tests
testGeminiChatbot();
