import Movie from '../models/Movie.model.js';
import Cinema from '../models/Cinema.model.js';
import Showtime from '../models/Showtime.model.js';
import Booking from '../models/Booking.model.js';
import Promotion from '../models/Promotion.model.js';

/**
 * Simple Rule-Based Chatbot (Fallback when Gemini API unavailable)
 * This chatbot uses keyword matching and database queries
 */
class SimpleChatbotService {
  /**
   * Main chatbot function - handles natural language booking and queries
   */
  async processMessage(message, userId = null, context = {}) {
    try {
      // 1. Analyze sentiment
      const sentiment = this.analyzeSentiment(message);
      
      if (sentiment.needsHumanSupport) {
        return {
          message: 'Tôi xin lỗi vì sự bất tiện này. Để được hỗ trợ tốt nhất, tôi sẽ chuyển bạn đến nhân viên hỗ trợ.',
          requiresHumanSupport: true,
          sentiment: sentiment
        };
      }

      // 2. Classify intent and extract entities
      const intent = this.classifyIntent(message);
      const entities = this.extractEntities(message);

      // 3. Handle based on intent
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
      console.error('Error in chatbot:', error);
      return {
        message: 'Xin lỗi, tôi gặp lỗi khi xử lý yêu cầu. Vui lòng thử lại.',
        error: true
      };
    }
  }

  /**
   * Analyze sentiment
   */
  analyzeSentiment(message) {
    const frustrationKeywords = [
      'chậm', 'lỗi', 'không được', 'tệ', 'kém', 'phàn nàn',
      'thất vọng', 'giận', 'khó chịu', 'bực mình', 'tức giận'
    ];

    const lowerMessage = message.toLowerCase();
    const hasFrustration = frustrationKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    );

    if (hasFrustration) {
      return {
        sentiment: 'negative',
        frustrationLevel: 7,
        needsHumanSupport: true,
        reason: 'Detected frustration keywords'
      };
    }

    const positiveKeywords = ['tốt', 'hay', 'đẹp', 'thích', 'cảm ơn', 'thanks'];
    const hasPositive = positiveKeywords.some(keyword => lowerMessage.includes(keyword));
    
    return {
      sentiment: hasPositive ? 'positive' : 'neutral',
      frustrationLevel: 0,
      needsHumanSupport: false
    };
  }

  /**
   * Classify intent
   */
  classifyIntent(message) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('đặt') || lowerMessage.includes('mua vé') || lowerMessage.includes('book')) {
      return 'booking';
    }
    if (lowerMessage.includes('đông') || lowerMessage.includes('vắng') || lowerMessage.includes('crowd')) {
      return 'crowd_prediction';
    }
    if (lowerMessage.includes('phim') || lowerMessage.includes('movie')) {
      return 'movie_info';
    }
    if (lowerMessage.includes('suất') || lowerMessage.includes('lịch chiếu') || lowerMessage.includes('showtime')) {
      return 'showtime';
    }
    if (lowerMessage.includes('rạp') || lowerMessage.includes('cinema')) {
      return 'cinema';
    }
    if (lowerMessage.includes('khuyến mãi') || lowerMessage.includes('giảm giá') || lowerMessage.includes('promotion')) {
      return 'promotion';
    }
    
    return 'general';
  }

  /**
   * Extract entities
   */
  extractEntities(message) {
    // Simple entity extraction
    const entities = {
      movie_title: null,
      cinema_name: null,
      time: null,
      date: null,
      num_tickets: null,
      location: null,
      preferences: []
    };

    // Extract number of tickets
    const ticketMatch = message.match(/(\d+)\s*(vé|ve|ticket)/i);
    if (ticketMatch) {
      entities.num_tickets = parseInt(ticketMatch[1]);
    }

    return entities;
  }

  /**
   * Handle booking intent
   */
  async handleBooking(message, entities, userId) {
    // Get trending movies for suggestions
    const movies = await Movie.find({ status: 'now_showing' }).limit(3);
    
    return {
      message: 'Bạn muốn đặt vé xem phim nào? Dưới đây là những phim đang hot:',
      data: {
        movies: movies.map(m => ({
          id: m._id,
          title: m.title,
          genre: m.genre,
          duration: m.duration
        }))
      },
      suggestions: movies.map(m => `Đặt vé ${m.title}`).concat(['Xem tất cả phim'])
    };
  }

  /**
   * Handle crowd prediction
   */
  async handleCrowdPrediction(message, entities) {
    return {
      message: 'Để dự đoán mức độ đông đúc, bạn cần cho biết suất chiếu cụ thể. Bạn muốn xem suất chiếu nào?',
      suggestions: ['Xem suất chiếu hôm nay', 'Xem suất chiếu cuối tuần']
    };
  }

  /**
   * Handle movie info
   */
  async handleMovieInfo(message, entities) {
    const movies = await Movie.find({ status: 'now_showing' })
      .sort({ rating: -1 })
      .limit(5);
    
    if (movies.length === 0) {
      return {
        message: 'Hiện tại không có phim nào đang chiếu.',
        suggestions: ['Xem phim sắp chiếu']
      };
    }

    const movieList = movies.map((m, index) => 
      `${index + 1}. ${m.title} - ${m.genre.join(', ')} (${m.duration}p) - ⭐${m.rating}/10`
    ).join('\n');

    return {
      message: `Dưới đây là các phim đang chiếu:\n\n${movieList}`,
      data: { movies },
      suggestions: movies.slice(0, 3).map(m => `Xem ${m.title}`)
    };
  }

  /**
   * Handle showtime
   */
  async handleShowtime(message, entities) {
    const showtimes = await Showtime.find({
      startTime: { $gte: new Date() },
      status: 'available'
    })
      .populate('movieId cinemaId')
      .limit(10);

    if (showtimes.length === 0) {
      return {
        message: 'Hiện không có suất chiếu khả dụng.',
        suggestions: ['Xem phim đang chiếu']
      };
    }

    return {
      message: `Có ${showtimes.length} suất chiếu khả dụng. Bạn muốn xem suất nào?`,
      data: { showtimes },
      suggestions: ['Suất chiếu hôm nay', 'Suất chiếu cuối tuần']
    };
  }

  /**
   * Handle cinema info
   */
  async handleCinemaInfo(message, entities) {
    const cinemas = await Cinema.find({ status: 'active' });
    
    const cinemaList = cinemas.map((c, index) => 
      `${index + 1}. ${c.name} - ${c.location.address}, ${c.location.city}`
    ).join('\n');

    return {
      message: `Chúng tôi có ${cinemas.length} rạp:\n\n${cinemaList}`,
      data: { cinemas },
      suggestions: cinemas.slice(0, 2).map(c => `Xem lịch ${c.name}`)
    };
  }

  /**
   * Handle promotion
   */
  async handlePromotion(message, entities) {
    const promotions = await Promotion.find({
      isActive: true,
      validFrom: { $lte: new Date() },
      validTo: { $gte: new Date() }
    }).limit(5);

    if (promotions.length === 0) {
      return {
        message: 'Hiện tại chưa có chương trình khuyến mãi nào.',
        suggestions: ['Xem phim đang chiếu']
      };
    }

    const promoList = promotions.map((p, index) => 
      `${index + 1}. ${p.title} - Giảm ${p.discount}%`
    ).join('\n');

    return {
      message: `Các chương trình khuyến mãi:\n\n${promoList}`,
      data: { promotions },
      suggestions: ['Xem chi tiết khuyến mãi', 'Đặt vé ngay']
    };
  }

  /**
   * Handle general questions
   */
  async handleGeneral(message) {
    // Greetings
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('xin chào') || lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      return {
        message: 'Xin chào! Tôi có thể giúp gì cho bạn về việc đặt vé xem phim?',
        suggestions: [
          'Đặt vé xem phim',
          'Xem phim đang chiếu',
          'Xem lịch chiếu',
          'Tìm rạp gần đây'
        ]
      };
    }

    // Default response
    return {
      message: 'Xin lỗi, tôi chưa hiểu câu hỏi của bạn. Tôi có thể giúp bạn đặt vé, xem thông tin phim, lịch chiếu, rạp chiếu và khuyến mãi.',
      suggestions: [
        'Đặt vé xem phim',
        'Xem phim đang chiếu',
        'Xem khuyến mãi',
        'Tìm rạp gần đây'
      ]
    };
  }
}

export default new SimpleChatbotService();
