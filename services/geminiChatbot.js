import { GoogleGenerativeAI } from '@google/generative-ai';
import Movie from '../models/Movie.model.js';
import Cinema from '../models/Cinema.model.js';
import Showtime from '../models/Showtime.model.js';
import Booking from '../models/Booking.model.js';
import Promotion from '../models/Promotion.model.js';

class GeminiChatbotService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
  }

  /**
   * Main chatbot function - handles natural language booking and queries
   */
  async processMessage(message, userId = null, context = {}) {
    try {
      // 1. Phân tích cảm xúc để phát hiện frustration
      const sentiment = await this.analyzeSentiment(message);
      
      if (sentiment.needsHumanSupport) {
        return {
          message: 'Tôi xin lỗi vì sự bất tiện này. Để được hỗ trợ tốt nhất, tôi sẽ chuyển bạn đến nhân viên hỗ trợ.',
          requiresHumanSupport: true,
          sentiment: sentiment
        };
      }

      // 2. Phân loại intent và trích xuất thông tin
      const intent = await this.classifyIntent(message);
      const entities = await this.extractEntities(message);

      // 3. Xử lý theo intent
      let response;
      switch (intent) {
        case 'booking':
          response = await this.handleBooking(message, entities, userId);
          break;
        case 'crowd_prediction':
          response = await this.handleCrowdPrediction(message, entities);
          break;
        case 'movie_info':
          response = await this.handleMovieInfo(message, entities);
          break;
        case 'showtime':
          response = await this.handleShowtime(message, entities);
          break;
        case 'cinema':
          response = await this.handleCinemaInfo(message, entities);
          break;
        case 'promotion':
          response = await this.handlePromotion(message, entities);
          break;
        default:
          response = await this.handleGeneral(message);
      }

      return {
        ...response,
        intent,
        entities,
        sentiment
      };
    } catch (error) {
      console.error('Error in Gemini chatbot:', error);
      return {
        message: 'Xin lỗi, tôi gặp lỗi khi xử lý yêu cầu. Vui lòng thử lại.',
        error: true
      };
    }
  }

  /**
   * Phân tích cảm xúc để phát hiện frustration
   */
  async analyzeSentiment(message) {
    const frustrationKeywords = [
      'chậm', 'lỗi', 'không được', 'tệ', 'kém', 'phàn nàn',
      'thất vọng', 'giận', 'khó chịu', 'bực mình', 'tức giận'
    ];

    const lowerMessage = message.toLowerCase();
    const hasFrustration = frustrationKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    );

    // Use Gemini for more nuanced sentiment analysis
    const prompt = `Phân tích cảm xúc của tin nhắn sau và trả về JSON:
    Tin nhắn: "${message}"
    
    Trả về JSON với format:
    {
      "sentiment": "positive/neutral/negative",
      "frustration_level": 0-10,
      "needs_human_support": true/false,
      "reason": "giải thích ngắn gọn"
    }`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        return {
          sentiment: analysis.sentiment,
          frustrationLevel: analysis.frustration_level,
          needsHumanSupport: analysis.needs_human_support || hasFrustration,
          reason: analysis.reason
        };
      }
    } catch (error) {
      console.error('Sentiment analysis error:', error);
    }

    return {
      sentiment: hasFrustration ? 'negative' : 'neutral',
      frustrationLevel: hasFrustration ? 7 : 3,
      needsHumanSupport: hasFrustration,
      reason: hasFrustration ? 'Phát hiện từ khóa frustration' : 'Bình thường'
    };
  }

  /**
   * Phân loại intent sử dụng Gemini
   */
  async classifyIntent(message) {
    const prompt = `Phân loại mục đích (intent) của câu hỏi sau về rạp chiếu phim:
    
    Câu hỏi: "${message}"
    
    Các intent có thể: booking, crowd_prediction, movie_info, showtime, cinema, promotion, general
    
    Trả về chỉ 1 từ intent phù hợp nhất.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const intent = response.text().trim().toLowerCase();
      
      const validIntents = ['booking', 'crowd_prediction', 'movie_info', 'showtime', 'cinema', 'promotion', 'general'];
      return validIntents.includes(intent) ? intent : 'general';
    } catch (error) {
      console.error('Intent classification error:', error);
      return 'general';
    }
  }

  /**
   * Trích xuất thông tin từ tin nhắn (NLU)
   */
  async extractEntities(message) {
    const prompt = `Trích xuất thông tin từ câu sau về đặt vé xem phim:
    
    Câu: "${message}"
    
    Trả về JSON với format:
    {
      "movie_title": "tên phim nếu có",
      "cinema_name": "tên rạp nếu có",
      "time": "giờ nếu có (format HH:mm)",
      "date": "ngày nếu có (hôm nay/ngày mai/dd/mm)",
      "num_tickets": số vé nếu có,
      "location": "vị trí gần nhất nếu có",
      "preferences": ["vắng", "đông", "yên tĩnh", "rẻ" - các ưu tiên nếu có]
    }
    
    Nếu không có thông tin nào thì để null.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Entity extraction error:', error);
    }

    return {
      movie_title: null,
      cinema_name: null,
      time: null,
      date: null,
      num_tickets: null,
      location: null,
      preferences: []
    };
  }

  /**
   * Xử lý đặt vé tự nhiên: "Đặt 2 vé phim Doraemon lúc 19h tối nay ở rạp gần nhất"
   */
  async handleBooking(message, entities, userId) {
    try {
      // Tìm phim
      let movie = null;
      if (entities.movie_title) {
        movie = await Movie.findOne({
          title: new RegExp(entities.movie_title, 'i'),
          status: 'now-showing'
        });
      }

      // Tìm rạp gần nhất (nếu có location) hoặc tất cả rạp
      const cinemas = await Cinema.find({ isActive: true });
      
      // Tìm suất chiếu phù hợp
      const today = new Date();
      let showtimes = [];

      if (movie) {
        const query = {
          movieId: movie._id,
          isActive: true,
          date: { $gte: today }
        };

        // Filter by time if specified
        if (entities.time) {
          const [hours, minutes] = entities.time.split(':');
          const targetTime = new Date(today);
          targetTime.setHours(parseInt(hours), parseInt(minutes || 0));
          query.startTime = { $gte: targetTime };
        }

        showtimes = await Showtime.find(query)
          .populate('cinemaId', 'name location')
          .populate('movieId', 'title')
          .limit(5)
          .sort('startTime');
      }

      // Tạo response
      if (!movie && entities.movie_title) {
        // Suggest movies if no exact match
        const suggestedMovies = await Movie.find({
          status: 'now-showing',
          $text: { $search: entities.movie_title }
        }).limit(3);

        return {
          message: `Tôi không tìm thấy phim "${entities.movie_title}". Có thể bạn muốn xem:`,
          suggestions: suggestedMovies.map(m => m.title),
          data: suggestedMovies,
          requiresSelection: true
        };
      }

      if (showtimes.length > 0) {
        const showtimeOptions = showtimes.map(st => ({
          id: st._id,
          time: new Date(st.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          cinema: st.cinemaId.name,
          availableSeats: st.availableSeats,
          price: st.price.standard
        }));

        return {
          message: `Đây là các suất chiếu phù hợp cho "${movie?.title}":`,
          data: showtimeOptions,
          entities,
          canBook: true,
          nextStep: 'select_showtime'
        };
      }

      return {
        message: 'Tôi cần thêm thông tin để đặt vé. Bạn muốn xem phim gì?',
        suggestedMovies: await this.getSuggestedMovies(),
        requiresMoreInfo: true
      };
    } catch (error) {
      console.error('Booking handler error:', error);
      return {
        message: 'Xin lỗi, tôi gặp lỗi khi tìm suất chiếu. Vui lòng thử lại.',
        error: true
      };
    }
  }

  /**
   * Xử lý câu hỏi về crowd prediction: "Suất nào ít người nhất?"
   */
  async handleCrowdPrediction(message, entities) {
    try {
      const today = new Date();
      const showtimes = await Showtime.find({
        date: { $gte: today },
        isActive: true
      })
        .populate('movieId', 'title')
        .populate('cinemaId', 'name')
        .sort('startTime')
        .limit(20);

      // Calculate occupancy for each showtime
      const showtimesWithOccupancy = showtimes.map(st => {
        const occupancy = ((st.room.capacity - st.availableSeats) / st.room.capacity) * 100;
        let crowdLevel = 'thấp';
        if (occupancy > 70) crowdLevel = 'cao';
        else if (occupancy > 40) crowdLevel = 'trung bình';

        return {
          id: st._id,
          movie: st.movieId.title,
          cinema: st.cinemaId.name,
          time: new Date(st.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          occupancy: Math.round(occupancy),
          crowdLevel,
          availableSeats: st.availableSeats,
          totalSeats: st.room.capacity
        };
      });

      // Sort by preference
      const isLookingForEmpty = message.toLowerCase().includes('ít người') || 
                                 message.toLowerCase().includes('vắng') ||
                                 message.toLowerCase().includes('yên tĩnh');

      const sorted = showtimesWithOccupancy.sort((a, b) => 
        isLookingForEmpty ? a.occupancy - b.occupancy : b.occupancy - a.occupancy
      );

      const top5 = sorted.slice(0, 5);

      return {
        message: isLookingForEmpty ? 
          'Đây là các suất chiếu ít người nhất (yên tĩnh):' :
          'Đây là các suất chiếu đang có mức độ lấp đầy:',
        data: top5,
        crowdPrediction: true
      };
    } catch (error) {
      console.error('Crowd prediction error:', error);
      return {
        message: 'Xin lỗi, tôi không thể dự đoán độ đông ngay bây giờ.',
        error: true
      };
    }
  }

  /**
   * Xử lý thông tin phim
   */
  async handleMovieInfo(message, entities) {
    try {
      let movies;
      
      if (entities.movie_title) {
        movies = await Movie.find({
          title: new RegExp(entities.movie_title, 'i')
        }).limit(3);
      } else {
        movies = await Movie.find({ status: 'now-showing' })
          .sort('-rating.average')
          .limit(5);
      }

      if (movies.length === 0) {
        return {
          message: 'Không tìm thấy phim phù hợp. Đây là các phim đang chiếu:',
          data: await Movie.find({ status: 'now-showing' }).limit(5)
        };
      }

      const movieData = movies.map(m => ({
        id: m._id,
        title: m.title,
        description: m.description,
        genres: m.genres,
        duration: m.duration,
        rating: typeof m.rating?.average === 'number' ? m.rating.average.toFixed(1) : 'N/A',
        ageRating: m.ageRating,
        director: m.director,
        cast: m.cast
      }));

      return {
        message: entities.movie_title ? 
          `Thông tin về phim "${entities.movie_title}":` :
          'Đây là các phim đang chiếu:',
        data: movieData
      };
    } catch (error) {
      console.error('Movie info error:', error);
      return {
        message: 'Xin lỗi, tôi không thể tìm thông tin phim ngay bây giờ.',
        error: true
      };
    }
  }

  /**
   * Xử lý lịch chiếu
   */
  async handleShowtime(message, entities) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const query = {
        date: { $gte: today },
        isActive: true
      };

      if (entities.movie_title) {
        const movie = await Movie.findOne({
          title: new RegExp(entities.movie_title, 'i')
        });
        if (movie) query.movieId = movie._id;
      }

      const showtimes = await Showtime.find(query)
        .populate('movieId', 'title')
        .populate('cinemaId', 'name')
        .sort('startTime')
        .limit(10);

      const showtimeData = showtimes.map(st => ({
        id: st._id,
        movie: st.movieId.title,
        cinema: st.cinemaId.name,
        date: new Date(st.date).toLocaleDateString('vi-VN'),
        time: new Date(st.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        room: st.room.name,
        availableSeats: st.availableSeats,
        price: st.price.standard
      }));

      return {
        message: 'Đây là lịch chiếu:',
        data: showtimeData
      };
    } catch (error) {
      console.error('Showtime error:', error);
      return {
        message: 'Xin lỗi, tôi không thể tìm lịch chiếu ngay bây giờ.',
        error: true
      };
    }
  }

  /**
   * Xử lý thông tin rạp
   */
  async handleCinemaInfo(message, entities) {
    try {
      const cinemas = await Cinema.find({ isActive: true });
      
      const cinemaData = cinemas.map(c => ({
        id: c._id,
        name: c.name,
        address: c.location.address,
        city: c.location.city,
        facilities: c.facilities,
        screens: c.screens.length,
        phone: c.contactInfo.phone
      }));

      return {
        message: 'Chúng tôi có các rạp chiếu sau:',
        data: cinemaData
      };
    } catch (error) {
      console.error('Cinema info error:', error);
      return {
        message: 'Xin lỗi, tôi không thể tìm thông tin rạp ngay bây giờ.',
        error: true
      };
    }
  }

  /**
   * Xử lý khuyến mãi
   */
  async handlePromotion(message, entities) {
    try {
      const now = new Date();
      const promotions = await Promotion.find({
        isActive: true,
        validFrom: { $lte: now },
        validUntil: { $gte: now }
      });

      const promoData = promotions.map(p => ({
        code: p.code,
        name: p.name,
        description: p.description,
        type: p.type,
        value: p.value,
        minPurchase: p.minPurchaseAmount,
        validUntil: new Date(p.validUntil).toLocaleDateString('vi-VN')
      }));

      return {
        message: 'Đây là các chương trình khuyến mãi đang áp dụng:',
        data: promoData
      };
    } catch (error) {
      console.error('Promotion error:', error);
      return {
        message: 'Xin lỗi, tôi không thể tìm thông tin khuyến mãi ngay bây giờ.',
        error: true
      };
    }
  }

  /**
   * Xử lý câu hỏi chung
   */
  async handleGeneral(message) {
    const prompt = `Bạn là trợ lý ảo của rạp chiếu phim. Trả lời câu hỏi sau một cách thân thiện và hữu ích:
    
    Câu hỏi: "${message}"
    
    Trả lời ngắn gọn (2-3 câu) và suggest user có thể hỏi gì khác.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return {
        message: text,
        suggestions: [
          'Đặt vé xem phim',
          'Xem lịch chiếu',
          'Tìm suất vắng nhất',
          'Xem khuyến mãi'
        ]
      };
    } catch (error) {
      console.error('General handler error:', error);
      return {
        message: 'Xin chào! Tôi có thể giúp bạn đặt vé, xem lịch chiếu, tìm suất vắng, và nhiều hơn nữa. Bạn cần tôi hỗ trợ gì?',
        suggestions: [
          'Đặt vé xem phim',
          'Xem lịch chiếu',
          'Tìm suất vắng nhất',
          'Xem khuyến mãi'
        ]
      };
    }
  }

  /**
   * Get suggested movies
   */
  async getSuggestedMovies() {
    const movies = await Movie.find({ status: 'now-showing' })
      .sort('-rating.average')
      .limit(5)
      .select('title _id');
    return movies.map(m => m.title);
  }
}

export default new GeminiChatbotService();
