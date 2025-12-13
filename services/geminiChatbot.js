import { GoogleGenerativeAI } from '@google/generative-ai';
import Movie from '../models/Movie.model.js';
import Cinema from '../models/Cinema.model.js';
import Showtime from '../models/Showtime.model.js';
import Booking from '../models/Booking.model.js';
import Promotion from '../models/Promotion.model.js';
import User from '../models/User.model.js';
import knowledgeBase from './knowledgeBase.js';
import dotenv from 'dotenv';
dotenv.config();
/**
 * Enhanced Gemini AI Chatbot Service
 * Uses Google Gemini AI with real database context for intelligent customer support
 */
class GeminiChatbotService {
  constructor() {
    // Initialize Gemini AI - Using free tier (gemini-pro model)
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      console.warn('⚠️ Gemini API key not configured. Please set GEMINI_API_KEY in .env file');
      console.warn('📖 Get your free API key at: https://aistudio.google.com/app/apikey');
      console.warn('📝 See QUICK_START_GEMINI_AI.md for detailed instructions');
      this.useAI = false;
      return;
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Use gemini-1.5-flash which is faster and supported by the new SDK
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    this.useAI = true;
    
    // Test API connection
    this.testConnection();
  }

  async testConnection() {
    try {
      await this.model.generateContent('Test');
      console.log('✅ Gemini AI connected successfully');
    } catch (error) {
      console.warn('⚠️ Gemini AI unavailable, using fallback mode:', error.message);
      this.useAI = false;
    }
  }

  /**
   * Main chatbot function - Uses Gemini AI with database context
   */
  async processMessage(message, userId = null, context = {}) {
    try {
      // 1. Analyze sentiment first
      const sentiment = this.analyzeSentiment(message);
      
      if (sentiment.needsHumanSupport) {
        return {
          message: 'Tôi xin lỗi vì sự bất tiện này. Để được hỗ trợ tốt nhất, tôi sẽ chuyển bạn đến nhân viên hỗ trợ chuyên nghiệp để giải quyết vấn đề nhanh chóng.',
          requiresHumanSupport: true,
          sentiment: sentiment
        };
      }

      // 2. Get database context
      const dbContext = await this.getDatabaseContext(message, userId);

      // 3. Use Gemini AI if available, otherwise fallback
      let response;
      if (this.useAI) {
        response = await this.generateAIResponse(message, dbContext, context);
      } else {
        // Fallback to rule-based
        const intent = this.classifyIntent(message);
        response = await this.handleFallback(message, intent, dbContext);
      }

      return {
        ...response,
        sentiment
      };
    } catch (error) {
      console.error('Error in chatbot:', error);
      // Fallback to simple response
      const intent = this.classifyIntent(message);
      return await this.handleFallback(message, intent, {});
    }
  }

  /**
   * Get relevant database context based on user query
   */
  async getDatabaseContext(message, userId) {
    const context = {};
    const lowerMessage = message.toLowerCase();

    try {
      // Determine which movies to fetch based on query
      let movieStatusFilter = { $in: ['now-showing', 'coming-soon'] };
      
      // If asking about "phim đang chiếu" or similar, only get now-showing movies
      if (lowerMessage.includes('đang chiếu') || lowerMessage.includes('đang hot') || 
          lowerMessage.includes('hiện tại') || lowerMessage.includes('bây giờ')) {
        movieStatusFilter = 'now-showing';
      }
      
      // Always get current movies and promotions for better responses
      const movies = await Movie.find({ 
        status: movieStatusFilter,
        isActive: true 
      })
        .sort({ 'rating.average': -1 })
        .limit(10)
        .select('title poster genres duration rating status releaseDate ageRating description')
        .lean();
      
      context.movies = movies;

      // Get active promotions
      const promotions = await Promotion.find({
        isActive: true,
        validFrom: { $lte: new Date() },
        validTo: { $gte: new Date() }
      })
        .select('code description discountType discountValue validTo')
        .limit(5)
        .lean();
      
      context.promotions = promotions;

      // If asking about cinema/location
      if (lowerMessage.includes('rạp') || lowerMessage.includes('cinema') || lowerMessage.includes('địa chỉ')) {
        const cinemas = await Cinema.find({ isActive: true })
          .select('name location screens facilities')
          .limit(10)
          .lean();
        context.cinemas = cinemas;
      }

      // If asking about showtimes
      if (lowerMessage.includes('suất') || lowerMessage.includes('lịch chiếu') || lowerMessage.includes('showtime')) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 2);

        const showtimes = await Showtime.find({
          date: { $gte: today, $lt: tomorrow },
          isActive: true
        })
          .populate('movieId', 'title')
          .populate('cinemaId', 'name')
          .populate('roomId', 'name')
          .select('date startTime endTime price availableSeats')
          .limit(20)
          .lean();
        
        context.showtimes = showtimes;
      }

      // Get user data if logged in
      if (userId) {
        const user = await User.findById(userId)
          .select('fullName loyalty bookingHistory')
          .lean();
        if (user) {
          context.user = {
            name: user.fullName,
            loyaltyTier: user.loyalty?.tier,
            loyaltyPoints: user.loyalty?.points
          };
        }
      }

      // Get policies from knowledge base
      const kbResult = knowledgeBase.search(message);
      if (kbResult) {
        context.knowledgeBase = kbResult;
      }

      return context;
    } catch (error) {
      console.error('Error getting database context:', error);
      return context;
    }
  }

  /**
   * Generate AI response using Gemini with database context
   */
  async generateAIResponse(message, dbContext, conversationContext) {
    try {
      // Build context-aware prompt
      const systemPrompt = this.buildSystemPrompt(dbContext);
      const fullPrompt = `${systemPrompt}\n\nKhách hàng hỏi: ${message}\n\nTrả lời:`;

      const result = await this.model.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text();

      // Extract intent from response
      const intent = this.classifyIntent(message);
      
      // Always extract movie cards for movie-related queries
      let movieCards = this.extractMovieCards(intent, dbContext, message);
      
      // If no movie cards but it's a movie query, try to fetch directly
      if (!movieCards && (intent === 'movie_info' || intent === 'booking' || 
          message.toLowerCase().includes('phim') || message.toLowerCase().includes('chiếu'))) {
        try {
          const movies = await Movie.find({ 
            status: 'now-showing',
            isActive: true 
          })
            .sort({ 'rating.average': -1 })
            .limit(6)
            .select('title poster genres duration rating status releaseDate ageRating description')
            .lean();
          
          if (movies && movies.length > 0) {
            movieCards = movies.map(movie => ({
              _id: movie._id,
              title: movie.title,
              poster: movie.poster,
              rating: movie.rating?.average || 0,
              ratingCount: movie.rating?.count || 0,
              genres: movie.genres || [],
              duration: movie.duration || 120,
              status: movie.status,
              releaseDate: movie.releaseDate,
              ageRating: movie.ageRating || 'P',
              description: movie.description?.substring(0, 150)
            }));
            // Update dbContext for future use
            dbContext.movies = movies;
          }
        } catch (error) {
          console.error('Error fetching movies in generateAIResponse:', error);
        }
      }

      return {
        message: text,
        intent: intent,
        entities: this.extractEntities(message),
        suggestions: this.generateSuggestions(intent, dbContext),
        movieCards: movieCards,
        bookingFlow: this.shouldShowBookingFlow(intent, message),
        source: 'gemini_ai'
      };
    } catch (error) {
      console.error('Gemini AI error:', error);
      // Fallback to rule-based
      const intent = this.classifyIntent(message);
      return await this.handleFallback(message, intent, dbContext);
    }
  }

  /**
   * Build system prompt with database context
   */
  buildSystemPrompt(dbContext) {
    let prompt = `Bạn là trợ lý AI thông minh của hệ thống rạp chiếu phim Cinema. Nhiệm vụ của bạn là tư vấn và hỗ trợ khách hàng một cách thân thiện, chuyên nghiệp.\n\n`;

    prompt += `**CHÍNH SÁCH VÀ QUY ĐỊNH:**\n`;
    prompt += `- Giá vé: 45.000đ - 150.000đ tùy loại ghế (Standard/VIP/Sweetbox) và thời gian chiếu\n`;
    prompt += `- Hủy vé: Được hoàn 100% nếu hủy trước 2 tiếng, sau đó không hoàn tiền\n`;
    prompt += `- Thanh toán: VNPay, thẻ tín dụng, ví điện tử (MoMo, ZaloPay), tại quầy\n`;
    prompt += `- Khuyến mãi thứ 3: Giảm 20% tất cả suất chiếu\n`;
    prompt += `- Học sinh sinh viên: Giảm 20% (thứ 2-5, xuất trình thẻ)\n`;
    prompt += `- Thành viên mới: Giảm 10% lần đầu đặt vé\n`;
    prompt += `- Độ tuổi: P (mọi lứa tuổi), C13 (từ 13+), C16 (từ 16+), C18 (18+)\n\n`;

    // Add movies context
    if (dbContext.movies && dbContext.movies.length > 0) {
      prompt += `**PHIM ĐANG CHIẾU (${dbContext.movies.length} phim):**\n`;
      dbContext.movies.forEach((movie, i) => {
        const status = movie.status === 'now-showing' ? '🔴 Đang chiếu' : '🔵 Sắp chiếu';
        prompt += `${i+1}. ${status} **${movie.title}**\n`;
        prompt += `   - Thể loại: ${movie.genres?.join(', ') || 'Đang cập nhật'}\n`;
        prompt += `   - Thời lượng: ${movie.duration || '120'} phút\n`;
        prompt += `   - Đánh giá: ${movie.rating?.average?.toFixed(1) || 'N/A'}/10 (${movie.rating?.count || 0} đánh giá)\n`;
      });
      prompt += `\n`;
    }

    // Add promotions context
    if (dbContext.promotions && dbContext.promotions.length > 0) {
      prompt += `**KHUYẾN MÃI ĐANG ÁP DỤNG (${dbContext.promotions.length} chương trình):**\n`;
      dbContext.promotions.forEach((promo, i) => {
        const validTo = new Date(promo.validTo).toLocaleDateString('vi-VN');
        const discount = promo.discountType === 'percentage' ? `${promo.discountValue}%` : `${promo.discountValue.toLocaleString()}đ`;
        prompt += `${i+1}. ${promo.code}: ${promo.description} - Giảm ${discount} (Đến ${validTo})\n`;
      });
      prompt += `\n`;
    }

    // Add cinema context
    if (dbContext.cinemas && dbContext.cinemas.length > 0) {
      prompt += `**HỆ THỐNG RẠP (${dbContext.cinemas.length} cơ sở):**\n`;
      dbContext.cinemas.forEach((cinema, i) => {
        prompt += `${i+1}. ${cinema.name}\n`;
        prompt += `   - Địa chỉ: ${cinema.location?.address || 'Đang cập nhật'}, ${cinema.location?.city || ''}\n`;
        prompt += `   - ${cinema.screens || 0} phòng chiếu\n`;
      });
      prompt += `\n`;
    }

    // Add showtime context
    if (dbContext.showtimes && dbContext.showtimes.length > 0) {
      prompt += `**LỊCH CHIẾU GẦN NHẤT (${dbContext.showtimes.length} suất):**\n`;
      // Group by movie
      const movieGroups = {};
      dbContext.showtimes.forEach(show => {
        const movieTitle = show.movieId?.title || 'N/A';
        if (!movieGroups[movieTitle]) {
          movieGroups[movieTitle] = [];
        }
        const time = new Date(show.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        movieGroups[movieTitle].push(`${time} (${show.cinemaId?.name || 'N/A'})`);
      });
      Object.entries(movieGroups).forEach(([movie, times]) => {
        prompt += `- ${movie}: ${times.slice(0, 3).join(', ')}${times.length > 3 ? '...' : ''}\n`;
      });
      prompt += `\n`;
    }

    // Add user context
    if (dbContext.user) {
      prompt += `**THÔNG TIN KHÁCH HÀNG:**\n`;
      prompt += `- Tên: ${dbContext.user.name}\n`;
      prompt += `- Hạng thành viên: ${dbContext.user.loyaltyTier || 'Bronze'}\n`;
      prompt += `- Điểm tích lũy: ${dbContext.user.loyaltyPoints || 0}\n\n`;
    }

    prompt += `**HƯỚNG DẪN TRẢ LỜI:**\n`;
    prompt += `- Trả lời NGẮN GỌN (50-100 từ), chỉ đưa thông tin quan trọng\n`;
    prompt += `- Khi hỏi về phim: CHỈ nói "Đây là các phim hot đang chiếu" và DỪNG LẠI (không liệt kê chi tiết phim)\n`;
    prompt += `- Khi hỏi đặt vé: Nói ngắn gọn "Để đặt vé, chọn phim bên dưới" và DỪNG LẠI\n`;
    prompt += `- KHÔNG liệt kê tên phim, đánh giá trong tin nhắn (sẽ hiển thị qua cards)\n`;
    prompt += `- Dùng emoji tinh tế (🎬⭐🎟️)\n`;
    prompt += `- Kết thúc với 1 câu hỏi ngắn để tiếp tục\n`;

    return prompt;
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
    
    if (lowerMessage.includes('xin chào') || lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      return 'greeting';
    }
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
    if (lowerMessage.includes('giá') || lowerMessage.includes('bao nhiêu') || lowerMessage.includes('price')) {
      return 'price';
    }
    
    return 'general';
  }

  /**
   * Extract entities
   */
  extractEntities(message) {
    const entities = {
      movie_title: null,
      cinema_name: null,
      time: null,
      date: null,
      num_tickets: null
    };

    // Extract number of tickets
    const ticketMatch = message.match(/(\d+)\s*(vé|ve|ticket)/i);
    if (ticketMatch) {
      entities.num_tickets = parseInt(ticketMatch[1]);
    }

    return entities;
  }

  /**
   * Generate smart suggestions based on intent
   */
  generateSuggestions(intent, dbContext) {
    const suggestions = [];
    
    if (intent === 'booking' || intent === 'movie_info') {
      if (dbContext.movies && dbContext.movies.length > 0) {
        suggestions.push(`Đặt vé ${dbContext.movies[0].title}`);
        if (dbContext.movies[1]) suggestions.push(`Xem ${dbContext.movies[1].title}`);
      }
      suggestions.push('Xem lịch chiếu');
    } else if (intent === 'showtime') {
      suggestions.push('Lịch chiếu hôm nay', 'Suất chiếu tối nay', 'Xem suất vắng');
    } else if (intent === 'cinema') {
      suggestions.push('Tìm rạp gần tôi', 'Xem tất cả rạp', 'Lịch chiếu theo rạp');
    } else if (intent === 'promotion') {
      suggestions.push('Xem khuyến mãi', 'Đăng ký thành viên', 'Áp dụng mã giảm giá');
    } else {
      suggestions.push('Đặt vé', 'Xem phim đang chiếu', 'Khuyến mãi hôm nay');
    }
    
    return suggestions.slice(0, 4);
  }

  /**
   * Extract movie cards with full details for display
   */
  extractMovieCards(intent, dbContext, message) {
    const lowerMessage = message.toLowerCase();
    
    // Check if this is a movie-related query
    const isMovieQuery = intent === 'movie_info' || intent === 'booking' || 
                        lowerMessage.includes('phim') || lowerMessage.includes('xem') ||
                        lowerMessage.includes('chiếu') || lowerMessage.includes('đặt vé');
    
    // If it's a movie query, always try to return movie cards
    if (isMovieQuery) {
      // Filter for now-showing movies if asking about current movies
      let moviesToShow = dbContext.movies || [];
      
      if (lowerMessage.includes('đang chiếu') || lowerMessage.includes('hiện tại') || 
          lowerMessage.includes('bây giờ') || lowerMessage.includes('đang hot')) {
        moviesToShow = moviesToShow.filter(m => m.status === 'now-showing');
      }
      
      if (moviesToShow.length > 0) {
        return moviesToShow.slice(0, 6).map(movie => ({
          _id: movie._id,
          title: movie.title,
          poster: movie.poster,
          rating: movie.rating?.average || 0,
          ratingCount: movie.rating?.count || 0,
          genres: movie.genres || [],
          duration: movie.duration || 120,
          status: movie.status,
          releaseDate: movie.releaseDate,
          ageRating: movie.ageRating || 'P',
          description: movie.description?.substring(0, 150)
        }));
      }
      
      // If no movies found but it's a movie query, try to fetch them directly
      // This is a fallback in case dbContext doesn't have movies
      return null; // Will be handled by fallback
    }
    return null;
  }

  /**
   * Check if should show booking flow instructions
   */
  shouldShowBookingFlow(intent, message) {
    const lowerMessage = message.toLowerCase();
    const bookingKeywords = ['đặt vé', 'book', 'mua vé', 'đặt'];
    return intent === 'booking' || bookingKeywords.some(kw => lowerMessage.includes(kw));
  }

  /**
   * Fallback handler when AI is unavailable
   */
  async handleFallback(message, intent, dbContext) {
    // Use knowledge base if available
    if (dbContext.knowledgeBase) {
      return {
        message: dbContext.knowledgeBase.answer,
        intent: intent,
        entities: {},
        suggestions: knowledgeBase.getSuggestions(intent),
        source: 'knowledge_base'
      };
    }

    // Simple intent-based responses
    switch (intent) {
      case 'greeting':
        return {
          message: '🎬 Xin chào! Tôi là trợ lý AI của Cinema. Tôi có thể giúp bạn đặt vé, tìm phim, xem lịch chiếu và nhiều hơn nữa. Bạn cần tôi hỗ trợ gì?',
          movieCards: null,
          bookingFlow: false,
          suggestions: ['Đặt vé xem phim', 'Xem phim đang chiếu', 'Khuyến mãi hôm nay']
        };
      
      case 'movie_info':
      case 'booking':
        // Always try to get movies, even if dbContext doesn't have them
        let movies = dbContext.movies;
        if (!movies || movies.length === 0) {
          // Fetch movies directly as fallback
          try {
            movies = await Movie.find({ 
              status: 'now-showing',
              isActive: true 
            })
              .sort({ 'rating.average': -1 })
              .limit(6)
              .select('title poster genres duration rating status releaseDate ageRating description')
              .lean();
            dbContext.movies = movies;
          } catch (error) {
            console.error('Error fetching movies in fallback:', error);
          }
        }
        
        if (movies && movies.length > 0) {
          const movieCards = movies.slice(0, 6).map(movie => ({
            _id: movie._id,
            title: movie.title,
            poster: movie.poster,
            rating: movie.rating?.average || 0,
            ratingCount: movie.rating?.count || 0,
            genres: movie.genres || [],
            duration: movie.duration || 120,
            status: movie.status,
            releaseDate: movie.releaseDate,
            ageRating: movie.ageRating || 'P',
            description: movie.description?.substring(0, 150)
          }));
          
          return {
            message: intent === 'booking' 
              ? '🎟️ Để đặt vé, chọn phim bên dưới nhé! Bạn muốn đặt vé phim nào?' 
              : '🎬 Đây là các phim hot đang chiếu! Bạn muốn xem phim nào?',
            movieCards: movieCards,
            bookingFlow: intent === 'booking',
            suggestions: this.generateSuggestions(intent, dbContext),
            intent: intent
          };
        }
        return {
          message: 'Hiện tại đang có nhiều phim hay đang chiếu. Bạn có thể xem danh sách phim trên website hoặc cho tôi biết thể loại phim bạn thích!',
          movieCards: null,
          bookingFlow: false,
          suggestions: ['Xem phim đang chiếu', 'Phim hành động', 'Phim tình cảm']
        };
      
      case 'showtime':
        if (dbContext.showtimes && dbContext.showtimes.length > 0) {
          return {
            message: `⏰ Có ${dbContext.showtimes.length} suất chiếu sắp diễn ra. Bạn muốn xem suất chiếu của phim nào?`,
            movieCards: this.extractMovieCards(intent, dbContext, message),
            bookingFlow: false,
            suggestions: ['Lịch chiếu hôm nay', 'Suất chiếu tối nay', 'Xem tất cả']
          };
        }
        return {
          message: 'Bạn muốn xem lịch chiếu phim nào? Hoặc ngày nào?',
          movieCards: null,
          bookingFlow: false,
          suggestions: ['Lịch chiếu hôm nay', 'Lịch chiếu ngày mai', 'Xem tất cả phim']
        };
      
      case 'cinema':
        if (dbContext.cinemas && dbContext.cinemas.length > 0) {
          const cinemaList = dbContext.cinemas.slice(0, 3).map((c, i) => 
            `${i+1}. ${c.name} - ${c.location?.city || ''}`
          ).join('\n');
          return {
            message: `🏢 Hệ thống có ${dbContext.cinemas.length} rạp:\n\n${cinemaList}\n\nBạn muốn xem chi tiết rạp nào?`,
            movieCards: null,
            bookingFlow: false,
            suggestions: ['Tìm rạp gần tôi', 'Xem tất cả rạp']
          };
        }
        return {
          message: 'Chúng tôi có hệ thống rạp trên toàn quốc. Bạn đang ở khu vực nào? Tôi sẽ giúp bạn tìm rạp gần nhất!',
          movieCards: null,
          bookingFlow: false,
          suggestions: ['Hà Nội', 'TP.HCM', 'Đà Nẵng']
        };
      
      case 'promotion':
        if (dbContext.promotions && dbContext.promotions.length > 0) {
          const promoList = dbContext.promotions.slice(0, 3).map((p, i) => 
            `${i+1}. ${p.code}: ${p.description}`
          ).join('\n');
          return {
            message: `🎁 Đang có ${dbContext.promotions.length} khuyến mãi:\n\n${promoList}\n\nĐặt vé ngay để nhận ưu đãi!`,
            movieCards: null,
            bookingFlow: false,
            suggestions: ['Đặt vé ngay', 'Đăng ký thành viên']
          };
        }
        return {
          message: '🎁 Chúng tôi có nhiều chương trình khuyến mãi hấp dẫn! Bạn có thể xem chi tiết trên website hoặc đăng ký thành viên để nhận ưu đãi đặc biệt.',
          movieCards: null,
          bookingFlow: false,
          suggestions: ['Xem khuyến mãi', 'Đăng ký thành viên', 'Đặt vé']
        };
      
      case 'price':
        return {
          message: '💰 Giá vé dao động từ 45.000đ - 150.000đ tùy loại ghế và suất chiếu. Đặt vé online được giảm giá và tích điểm!',
          movieCards: null,
          bookingFlow: false,
          suggestions: ['Xem bảng giá', 'Đặt vé online', 'Xem khuyến mãi']
        };
      
      default:
        return {
          message: 'Xin lỗi, tôi chưa hiểu rõ câu hỏi của bạn. Bạn có thể nói rõ hơn được không? Hoặc chọn một trong các gợi ý sau:',
          movieCards: null,
          bookingFlow: false,
          suggestions: ['Đặt vé', 'Xem phim đang chiếu', 'Khuyến mãi', 'Tìm rạp']
        };
    }
  }
}

export default new GeminiChatbotService();
