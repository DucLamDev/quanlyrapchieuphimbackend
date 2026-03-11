import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Movie from '../models/Movie.model.js'
import Cinema from '../models/Cinema.model.js'
import Showtime from '../models/Showtime.model.js'

dotenv.config()

const moviesData = [
  {
    title: 'Spider-Man: No Way Home',
    description: 'Peter Parker phải đối mặt với hậu quả khi danh tính Spider-Man của anh bị tiết lộ. Anh tìm đến Doctor Strange để xóa ký ức của mọi người, nhưng phép thuật đi sai khiến các nhân vật từ đa vũ trụ xâm nhập vào thế giới của anh.',
    poster: 'https://image.tmdb.org/t/p/w500/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/iQFcwSGbZXMkeyKrxbPnwnRo5fl.jpg',
    trailer: 'https://www.youtube.com/watch?v=JfVOs4VSpmA',
    genres: ['Hành động', 'Phiêu lưu', 'Khoa học viễn tưởng'],
    director: 'Jon Watts',
    cast: ['Tom Holland', 'Zendaya', 'Benedict Cumberbatch', 'Jacob Batalon'],
    duration: 148,
    releaseDate: new Date('2021-12-17'),
    status: 'now-showing',
    language: 'English',
    country: 'USA',
    ageRating: 'T13',
    rating: {
      average: 8.5,
      count: 15234
    }
  },
  {
    title: 'Avatar: The Way of Water',
    description: 'Jake Sully sống với gia đình mới của mình trên hành tinh Pandora. Khi một mối đe dọa quen thuộc trở lại, Jake phải hợp tác với Neytiri và quân đội của Na\'vi để bảo vệ hành tinh của họ.',
    poster: 'https://image.tmdb.org/t/p/w500/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/s16H6tpK2utvwDtzZ8Qy4qm5Emw.jpg',
    trailer: 'https://www.youtube.com/watch?v=d9MyW72ELq0',
    genres: ['Khoa học viễn tưởng', 'Phiêu lưu', 'Hành động'],
    director: 'James Cameron',
    cast: ['Sam Worthington', 'Zoe Saldana', 'Sigourney Weaver', 'Kate Winslet'],
    duration: 192,
    releaseDate: new Date('2022-12-16'),
    status: 'now-showing',
    language: 'English',
    country: 'USA',
    ageRating: 'T13',
    rating: {
      average: 9.0,
      count: 20567
    }
  },
  {
    title: 'Top Gun: Maverick',
    description: 'Sau hơn 30 năm phục vụ, Pete "Maverick" Mitchell vẫn là một trong những phi công thử nghiệm hàng đầu. Anh được giao nhiệm vụ huấn luyện một nhóm phi công Top Gun cho một nhiệm vụ đặc biệt.',
    poster: 'https://image.tmdb.org/t/p/w500/62HCnUTziyWcpDaBO2i1DX17ljH.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/odJ4hx6g6vBt4lBWKFD1tI8WS4x.jpg',
    trailer: 'https://www.youtube.com/watch?v=giXco2jaZ_4',
    genres: ['Hành động', 'Chính kịch'],
    director: 'Joseph Kosinski',
    cast: ['Tom Cruise', 'Miles Teller', 'Jennifer Connelly', 'Jon Hamm'],
    duration: 130,
    releaseDate: new Date('2022-05-27'),
    status: 'now-showing',
    language: 'English',
    country: 'USA',
    ageRating: 'T13',
    rating: {
      average: 8.8,
      count: 18934
    }
  },
  {
    title: 'The Batman',
    description: 'Trong năm thứ hai làm Batman, Bruce Wayne khám phá tham nhũng ở Gotham City và liên kết với gia đình Wayne của mình khi truy đuổi kẻ sát nhân biệt danh Riddler.',
    poster: 'https://image.tmdb.org/t/p/w500/74xTEgt7R36Fpooo50r9T25onhq.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/b0PlSFdDwbyK0cf5RxwDpaOJQvQ.jpg',
    trailer: 'https://www.youtube.com/watch?v=mqqft2x_Aa4',
    genres: ['Hành động', 'Tâm lý', 'Bí ẩn'],
    director: 'Matt Reeves',
    cast: ['Robert Pattinson', 'Zoë Kravitz', 'Paul Dano', 'Colin Farrell'],
    duration: 176,
    releaseDate: new Date('2022-03-04'),
    status: 'now-showing',
    language: 'English',
    country: 'USA',
    ageRating: 'T16',
    rating: {
      average: 8.3,
      count: 16234
    }
  },
  {
    title: 'Doctor Strange in the Multiverse of Madness',
    description: 'Doctor Strange mở ra cánh cửa đa vũ trụ và phải đối mặt với phiên bản đen tối của chính mình cùng với những mối nguy hiểm không tưởng.',
    poster: 'https://image.tmdb.org/t/p/w500/9Gtg2DzBhmYamXBS1hKAhiwbBKS.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/wcKFYIiVDvRURrzglV9kGu7fpfY.jpg',
    trailer: 'https://www.youtube.com/watch?v=aWzlQ2N6qqg',
    genres: ['Hành động', 'Phiêu lưu', 'Khoa học viễn tưởng'],
    director: 'Sam Raimi',
    cast: ['Benedict Cumberbatch', 'Elizabeth Olsen', 'Chiwetel Ejiofor', 'Benedict Wong'],
    duration: 126,
    releaseDate: new Date('2022-05-06'),
    status: 'now-showing',
    language: 'English',
    country: 'USA',
    ageRating: 'T13',
    rating: {
      average: 7.9,
      count: 14567
    }
  },
  {
    title: 'Jurassic World Dominion',
    description: 'Bốn năm sau sự hủy diệt của Isla Nublar, khủng long giờ sống và săn mồi cùng con người trên khắp thế giới. Sự cân bằng mong manh này sẽ định hình lại tương lai.',
    poster: 'https://image.tmdb.org/t/p/w500/kAVRgw7GgK1CfYEJq8ME6EvRIgU.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/5hoS3nEkGGXUfmnu39yw1k52JX5.jpg',
    trailer: 'https://www.youtube.com/watch?v=fb5ELWi-ekk',
    genres: ['Hành động', 'Phiêu lưu', 'Khoa học viễn tưởng'],
    director: 'Colin Trevorrow',
    cast: ['Chris Pratt', 'Bryce Dallas Howard', 'Laura Dern', 'Jeff Goldblum'],
    duration: 147,
    releaseDate: new Date('2022-06-10'),
    status: 'now-showing',
    language: 'English',
    country: 'USA',
    ageRating: 'T13',
    rating: {
      average: 7.5,
      count: 12345
    }
  },
  {
    title: 'Black Panther: Wakanda Forever',
    description: 'Nữ hoàng Ramonda, Shuri, M\'Baku, Okoye và Dora Milaje chiến đấu để bảo vệ quốc gia của họ khỏi các thế lực can thiệp sau cái chết của vua T\'Challa.',
    poster: 'https://image.tmdb.org/t/p/w500/sv1xJUazXeYqALzczSZ3O6nkH75.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/yYrvN5WFeGYjJnRzhY0QXuo4Isw.jpg',
    trailer: 'https://www.youtube.com/watch?v=_Z3QKkl1WyM',
    genres: ['Hành động', 'Phiêu lưu', 'Khoa học viễn tưởng'],
    director: 'Ryan Coogler',
    cast: ['Letitia Wright', 'Lupita Nyong\'o', 'Danai Gurira', 'Angela Bassett'],
    duration: 161,
    releaseDate: new Date('2024-01-15'),
    status: 'coming-soon',
    language: 'English',
    country: 'USA',
    ageRating: 'T13',
    rating: {
      average: 8.2,
      count: 9876
    }
  },
  {
    title: 'Guardians of the Galaxy Vol. 3',
    description: 'Peter Quill tập hợp đội của mình cho một nhiệm vụ nguy hiểm để bảo vệ một trong những thành viên của họ, một nhiệm vụ có thể dẫn đến sự kết thúc của Guardians.',
    poster: 'https://image.tmdb.org/t/p/w500/r2J02Z2OpNTctfOSN1Ydgii51I3.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/5YZbUmjbMa3ClvSW1Wj3D6XGolb.jpg',
    trailer: 'https://www.youtube.com/watch?v=u3V5KDHRQvk',
    genres: ['Hành động', 'Phiêu lưu', 'Khoa học viễn tưởng', 'Hài'],
    director: 'James Gunn',
    cast: ['Chris Pratt', 'Zoe Saldana', 'Dave Bautista', 'Karen Gillan'],
    duration: 150,
    releaseDate: new Date('2024-02-20'),
    status: 'coming-soon',
    language: 'English',
    country: 'USA',
    ageRating: 'T13',
    rating: {
      average: 8.7,
      count: 7654
    }
  },
  {
    title: 'Oppenheimer',
    description: 'Câu chuyện về J. Robert Oppenheimer, nhà vật lý lý thuyết người Mỹ, và vai trò của ông trong việc phát triển bom nguyên tử.',
    poster: 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/fm6KqXpk3M2HVveHwCrBSSBaO0V.jpg',
    trailer: 'https://www.youtube.com/watch?v=uYPbbksJxIg',
    genres: ['Chính kịch', 'Lịch sử', 'Tiểu sử'],
    director: 'Christopher Nolan',
    cast: ['Cillian Murphy', 'Emily Blunt', 'Matt Damon', 'Robert Downey Jr.'],
    duration: 180,
    releaseDate: new Date('2024-03-10'),
    status: 'coming-soon',
    language: 'English',
    country: 'USA',
    ageRating: 'T16',
    rating: {
      average: 9.2,
      count: 5432
    }
  },
  {
    title: 'Barbie',
    description: 'Barbie và Ken có một ngày tuyệt vời tại Barbie Land. Tuy nhiên, khi họ có cơ hội đến thế giới thực, họ sớm khám phá ra những niềm vui và nguy hiểm của cuộc sống.',
    poster: 'https://image.tmdb.org/t/p/w500/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/nHf61UzkfFno5X1ofIhugCPus2R.jpg',
    trailer: 'https://www.youtube.com/watch?v=pBk4NYhWNMM',
    genres: ['Hài', 'Phiêu lưu', 'Kỳ ảo'],
    director: 'Greta Gerwig',
    cast: ['Margot Robbie', 'Ryan Gosling', 'America Ferrera', 'Kate McKinnon'],
    duration: 114,
    releaseDate: new Date('2024-03-25'),
    status: 'coming-soon',
    language: 'English',
    country: 'USA',
    ageRating: 'P',
    rating: {
      average: 8.0,
      count: 8765
    }
  }
]

const cinemasData = [
  {
    name: 'CGV Vincom Center',
    address: '72 Lê Thánh Tôn, Quận 1, TP.HCM',
    city: 'TP.HCM',
    phone: '1900 6017',
    coordinates: {
      lat: 10.7769,
      lng: 106.7009
    },
    rooms: [
      { name: 'Rạp 1', capacity: 150, type: 'standard', facilities: ['Dolby Atmos'] },
      { name: 'Rạp 2', capacity: 120, type: 'standard', facilities: ['3D'] },
      { name: 'Rạp 3 - IMAX', capacity: 200, type: 'imax', facilities: ['IMAX', 'Dolby Atmos'] },
      { name: 'Rạp 4 - 4DX', capacity: 80, type: '4dx', facilities: ['4DX', 'Motion Seats'] },
      { name: 'Rạp 5 - Gold Class', capacity: 40, type: 'premium', facilities: ['Recliner', 'Private Lounge'] }
    ]
  },
  {
    name: 'Lotte Cinema Diamond Plaza',
    address: '34 Lê Duẩn, Quận 1, TP.HCM',
    city: 'TP.HCM',
    phone: '1900 5454',
    coordinates: {
      lat: 10.7829,
      lng: 106.6992
    },
    rooms: [
      { name: 'Cinema 1', capacity: 180, type: 'standard', facilities: ['Dolby Atmos'] },
      { name: 'Cinema 2', capacity: 150, type: 'standard', facilities: ['3D'] },
      { name: 'Cinema 3 - IMAX', capacity: 250, type: 'imax', facilities: ['IMAX', 'Laser'] },
      { name: 'Cinema 4', capacity: 120, type: 'standard', facilities: [] }
    ]
  }
]

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cinema_management'
    await mongoose.connect(mongoUri)
    console.log('✅ MongoDB connected successfully')
  } catch (error) {
    console.error('❌ MongoDB connection error:', error)
    process.exit(1)
  }
}

const seedDatabase = async () => {
  try {
    await connectDB()

    // Clear existing data
    console.log('🗑️  Clearing existing data...')
    await Movie.deleteMany({})
    await Cinema.deleteMany({})
    await Showtime.deleteMany({})

    // Seed movies
    console.log('🎬 Seeding movies...')
    const movies = await Movie.insertMany(moviesData)
    console.log(`✅ Created ${movies.length} movies`)

    // Seed cinemas
    console.log('🏢 Seeding cinemas...')
    const cinemas = await Cinema.insertMany(cinemasData)
    console.log(`✅ Created ${cinemas.length} cinemas`)

    // Seed showtimes
    console.log('📅 Seeding showtimes...')
    const showtimes = []
    const today = new Date()
    
    // Create showtimes for the next 7 days
    for (let day = 0; day < 7; day++) {
      const date = new Date(today)
      date.setDate(today.getDate() + day)
      
      // Only use now-showing movies
      const nowShowingMovies = movies.filter(m => m.status === 'now-showing')
      
      for (const movie of nowShowingMovies) {
        for (const cinema of cinemas) {
          // Create 3 showtimes per day per cinema
          const times = ['10:00', '14:30', '19:00']
          
          for (const time of times) {
            const [hours, minutes] = time.split(':')
            const startTime = new Date(date)
            startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0)
            
            const endTime = new Date(startTime)
            endTime.setMinutes(endTime.getMinutes() + movie.duration)
            
            // Random room selection
            const room = cinema.rooms[Math.floor(Math.random() * cinema.rooms.length)]
            
            showtimes.push({
              movieId: movie._id,
              cinemaId: cinema._id,
              room: {
                name: room.name,
                capacity: room.capacity,
                type: room.type
              },
              startTime,
              endTime,
              price: {
                standard: room.type === 'imax' ? 100000 : room.type === 'premium' ? 150000 : 80000,
                vip: room.type === 'imax' ? 150000 : room.type === 'premium' ? 200000 : 120000,
                couple: room.type === 'imax' ? 180000 : room.type === 'premium' ? 250000 : 150000
              },
              availableSeats: room.capacity,
              bookedSeats: [],
              status: 'scheduled'
            })
          }
        }
      }
    }
    
    const createdShowtimes = await Showtime.insertMany(showtimes)
    console.log(`✅ Created ${createdShowtimes.length} showtimes`)

    console.log('\n🎉 Database seeded successfully!')
    console.log(`📊 Summary:`)
    console.log(`   - Movies: ${movies.length}`)
    console.log(`   - Cinemas: ${cinemas.length}`)
    console.log(`   - Showtimes: ${createdShowtimes.length}`)

  } catch (error) {
    console.error('❌ Error seeding database:', error)
  } finally {
    await mongoose.disconnect()
    console.log('👋 Disconnected from MongoDB')
    process.exit(0)
  }
}

seedDatabase()
