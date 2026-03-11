import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Movie from '../models/Movie.model.js';

dotenv.config();

// Sample movies data
const sampleMovies = [
  {
    title: 'Deadpool & Wolverine',
    description: 'Wade Wilson tái xuất với chiến binh Wolverine trong một cuộc phiêu lưu đầy hành động và hài hước.',
    director: 'Shawn Levy',
    cast: ['Ryan Reynolds', 'Hugh Jackman', 'Emma Corrin', 'Morena Baccarin'],
    genres: ['Action', 'Comedy', 'Adventure'],
    duration: 128,
    language: 'Tiếng Anh',
    country: 'Mỹ',
    releaseDate: new Date('2024-07-26'),
    ageRating: 'T18',
    poster: 'https://image.tmdb.org/t/p/w500/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg',
    trailer: 'https://www.youtube.com/watch?v=73_1biulkYk',
    status: 'now-showing',
    rating: { average: 8.5, count: 1250 }
  },
  {
    title: 'Oppenheimer',
    description: 'Câu chuyện về J. Robert Oppenheimer, người được mệnh danh là "cha đẻ của bom nguyên tử".',
    director: 'Christopher Nolan',
    cast: ['Cillian Murphy', 'Emily Blunt', 'Matt Damon', 'Robert Downey Jr.'],
    genres: ['Drama', 'History', 'Biography'],
    duration: 180,
    language: 'Tiếng Anh',
    country: 'Mỹ',
    releaseDate: new Date('2023-07-21'),
    ageRating: 'T16',
    poster: 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
    trailer: 'https://www.youtube.com/watch?v=uYPbbksJxIg',
    status: 'now-showing',
    rating: { average: 8.8, count: 2100 }
  },
  {
    title: 'Barbie',
    description: 'Barbie và Ken khám phá thế giới thực sau khi bị đuổi khỏi Barbie Land vì không hoàn hảo.',
    director: 'Greta Gerwig',
    cast: ['Margot Robbie', 'Ryan Gosling', 'Will Ferrell', 'America Ferrera'],
    genres: ['Comedy', 'Adventure', 'Fantasy'],
    duration: 114,
    language: 'Tiếng Anh',
    country: 'Mỹ',
    releaseDate: new Date('2023-07-21'),
    ageRating: 'P',
    poster: 'https://image.tmdb.org/t/p/w500/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg',
    trailer: 'https://www.youtube.com/watch?v=pBk4NYhWNMM',
    status: 'now-showing',
    rating: { average: 7.8, count: 1800 }
  },
  {
    title: 'Spider-Man: Across the Spider-Verse',
    description: 'Miles Morales tái xuất trong một cuộc phiêu lưu xuyên đa vũ trụ cùng Gwen Stacy.',
    director: 'Joaquim Dos Santos',
    cast: ['Shameik Moore', 'Hailee Steinfeld', 'Brian Tyree Henry', 'Oscar Isaac'],
    genres: ['Animation', 'Action', 'Adventure'],
    duration: 140,
    language: 'Tiếng Anh',
    country: 'Mỹ',
    releaseDate: new Date('2023-06-02'),
    ageRating: 'P',
    poster: 'https://image.tmdb.org/t/p/w500/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg',
    trailer: 'https://www.youtube.com/watch?v=cqGjhVJWtEg',
    status: 'now-showing',
    rating: { average: 9.0, count: 2500 }
  },
  {
    title: 'The Batman',
    description: 'Batman phải đối mặt với Riddler, một kẻ giết người hàng loạt nhắm vào giới tinh hoa Gotham.',
    director: 'Matt Reeves',
    cast: ['Robert Pattinson', 'Zoë Kravitz', 'Paul Dano', 'Jeffrey Wright'],
    genres: ['Action', 'Crime', 'Drama'],
    duration: 176,
    language: 'Tiếng Anh',
    country: 'Mỹ',
    releaseDate: new Date('2022-03-04'),
    ageRating: 'T13',
    poster: 'https://image.tmdb.org/t/p/w500/74xTEgt7R36Fpooo50r9T25onhq.jpg',
    trailer: 'https://www.youtube.com/watch?v=mqqft2x_Aa4',
    status: 'now-showing',
    rating: { average: 8.2, count: 1900 }
  },
  {
    title: 'Top Gun: Maverick',
    description: 'Sau hơn 30 năm, Maverick trở lại với tư cách huấn luyện viên cho thế hệ phi công mới.',
    director: 'Joseph Kosinski',
    cast: ['Tom Cruise', 'Miles Teller', 'Jennifer Connelly', 'Jon Hamm'],
    genres: ['Action', 'Drama'],
    duration: 131,
    language: 'Tiếng Anh',
    country: 'Mỹ',
    releaseDate: new Date('2022-05-27'),
    ageRating: 'T13',
    poster: 'https://image.tmdb.org/t/p/w500/62HCnUTziyWcpDaBO2i1DX17ljH.jpg',
    trailer: 'https://www.youtube.com/watch?v=qSqVVswa420',
    status: 'now-showing',
    rating: { average: 8.6, count: 2200 }
  },
  {
    title: 'Avatar: The Way of Water',
    description: 'Jake Sully và gia đình phải đối mặt với những thách thức mới trên hành tinh Pandora.',
    director: 'James Cameron',
    cast: ['Sam Worthington', 'Zoe Saldana', 'Sigourney Weaver', 'Kate Winslet'],
    genres: ['Action', 'Adventure', 'Fantasy', 'Sci-Fi'],
    duration: 192,
    language: 'Tiếng Anh',
    country: 'Mỹ',
    releaseDate: new Date('2022-12-16'),
    ageRating: 'T13',
    poster: 'https://image.tmdb.org/t/p/w500/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg',
    trailer: 'https://www.youtube.com/watch?v=d9MyW72ELq0',
    status: 'now-showing',
    rating: { average: 8.4, count: 2800 }
  },
  {
    title: 'Guardians of the Galaxy Vol. 3',
    description: 'Đội Vệ Binh dấn thân vào nhiệm vụ cuối cùng để bảo vệ một trong những người của họ.',
    director: 'James Gunn',
    cast: ['Chris Pratt', 'Zoe Saldana', 'Dave Bautista', 'Karen Gillan'],
    genres: ['Action', 'Adventure', 'Comedy', 'Sci-Fi'],
    duration: 150,
    language: 'Tiếng Anh',
    country: 'Mỹ',
    releaseDate: new Date('2023-05-05'),
    ageRating: 'T13',
    poster: 'https://image.tmdb.org/t/p/w500/r2J02Z2OpNTctfOSN1Ydgii51I3.jpg',
    trailer: 'https://www.youtube.com/watch?v=u3V5KDHRQvk',
    status: 'now-showing',
    rating: { average: 8.1, count: 1600 }
  }
];

async function seedMoviesQuick() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cinema_management';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Clear existing movies
    console.log('🗑️  Clearing old movies...');
    await Movie.deleteMany({});
    console.log('✅ Old movies cleared\n');

    // Insert sample movies
    console.log(`📽️  Inserting ${sampleMovies.length} sample movies...\n`);
    
    for (const movieData of sampleMovies) {
      const movie = new Movie(movieData);
      await movie.save();
      console.log(`   ✅ ${movie.title}`);
    }

    console.log(`\n🎉 SUCCESS! Seeded ${sampleMovies.length} movies`);
    console.log('\n📊 All movies have status: "now_showing"');
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
seedMoviesQuick();
