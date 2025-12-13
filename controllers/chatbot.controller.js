import natural from 'natural';
import Sentiment from 'sentiment';
import Movie from '../models/Movie.model.js';
import Cinema from '../models/Cinema.model.js';
import Showtime from '../models/Showtime.model.js';
import Booking from '../models/Booking.model.js';
import chatbotNLP from '../services/chatbotNLP.js';
import sentimentAI from '../services/sentimentAI.js';
import geminiChatbot from '../services/geminiChatbot.js';

const sentiment = new Sentiment();
const tokenizer = new natural.WordTokenizer();

// Store conversation context (in production, use Redis)
const conversationContexts = new Map();

// Intent classification
const classifyIntent = (message) => {
  const lowerMessage = message.toLowerCase();
  
  const intents = {
    booking: ['đặt vé', 'book', 'mua vé', 'đặt', 'booking'],
    movieInfo: ['phim gì', 'thông tin phim', 'phim nào', 'movie', 'xem phim'],
    showtime: ['suất chiếu', 'lịch chiếu', 'chiếu lúc', 'showtime', 'giờ chiếu'],
    cinema: ['rạp', 'cinema', 'địa chỉ rạp', 'rạp chiếu'],
    price: ['giá', 'bao nhiêu', 'price', 'cost', 'tiền'],
    promotion: ['khuyến mãi', 'giảm giá', 'promotion', 'discount'],
    crowdPrediction: ['đông', 'vắng', 'crowd', 'ít người', 'nhiều người'],
    recommendation: ['gợi ý', 'recommend', 'đề xuất', 'xem gì'],
    complaint: ['chậm', 'lỗi', 'không được', 'tệ', 'complaint'],
    greeting: ['xin chào', 'hello', 'hi', 'chào', 'hey']
  };

  for (const [intent, keywords] of Object.entries(intents)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      return intent;
    }
  }

  return 'general';
};

// Extract entities from message
const extractEntities = (message) => {
  const entities = {
    movieTitle: null,
    cinema: null,
    time: null,
    date: null,
    numberOfTickets: null
  };

  // Extract numbers (for tickets)
  const numberMatch = message.match(/\d+/);
  if (numberMatch) {
    entities.numberOfTickets = parseInt(numberMatch[0]);
  }

  // Extract time patterns
  const timePatterns = [
    /(\d{1,2})[h:]\s*(\d{2})?/i,
    /(\d{1,2})\s*(giờ|h)/i
  ];

  for (const pattern of timePatterns) {
    const match = message.match(pattern);
    if (match) {
      entities.time = match[0];
      break;
    }
  }

  // Extract date keywords
  const dateKeywords = {
    'hôm nay': new Date(),
    'ngày mai': new Date(Date.now() + 24 * 60 * 60 * 1000),
    'today': new Date(),
    'tomorrow': new Date(Date.now() + 24 * 60 * 60 * 1000)
  };

  for (const [keyword, date] of Object.entries(dateKeywords)) {
    if (message.toLowerCase().includes(keyword)) {
      entities.date = date;
      break;
    }
  }

  return entities;
};

// Generate response based on intent
const generateResponse = async (intent, entities, context) => {
  switch (intent) {
    case 'greeting':
      return {
        message: 'Xin chào! Tôi là trợ lý ảo của Cinema. Tôi có thể giúp bạn đặt vé, tìm phim, xem suất chiếu và nhiều hơn nữa. Bạn cần tôi hỗ trợ gì?',
        suggestions: ['Đặt vé xem phim', 'Tìm phim đang chiếu', 'Xem suất chiếu', 'Tìm rạp gần nhất']
      };

    case 'movieInfo':
      const movies = await Movie.find({ 
        status: 'now-showing',
        isActive: true 
      }).limit(5).sort('-rating.average');
      
      return {
        message: 'Hiện tại chúng tôi đang có những phim hay sau:',
        data: movies.map(m => ({
          id: m._id,
          title: m.title,
          rating: m.rating.average,
          genres: m.genres.join(', ')
        })),
        suggestions: ['Xem chi tiết', 'Đặt vé', 'Phim khác']
      };

    case 'showtime':
      if (entities.date) {
        const showtimes = await Showtime.find({
          date: {
            $gte: new Date(entities.date.setHours(0, 0, 0, 0)),
            $lt: new Date(entities.date.setHours(23, 59, 59, 999))
          },
          isActive: true
        })
          .populate('movieId', 'title')
          .populate('cinemaId', 'name')
          .limit(10);

        return {
          message: `Đây là các suất chiếu ${entities.date.toLocaleDateString('vi-VN')}:`,
          data: showtimes,
          suggestions: ['Đặt vé', 'Xem ngày khác', 'Lọc theo rạp']
        };
      }
      return {
        message: 'Bạn muốn xem lịch chiếu ngày nào? Hoặc phim nào?',
        suggestions: ['Hôm nay', 'Ngày mai', 'Cuối tuần']
      };

    case 'crowdPrediction':
      return {
        message: 'Tôi có thể giúp bạn tìm các suất chiếu ít đông. Bạn muốn tìm suất nào?',
        suggestions: ['Suất vắng nhất', 'Suất trung bình', 'Tất cả suất']
      };

    case 'recommendation':
      return {
        message: 'Để gợi ý phim phù hợp, bạn có thể cho tôi biết bạn thích thể loại gì không?',
        suggestions: ['Hành động', 'Tình cảm', 'Hài hước', 'Kinh dị', 'Tất cả']
      };

    case 'price':
      return {
        message: 'Giá vé phụ thuộc vào suất chiếu, rạp và loại ghế. Thông thường:\n' +
                 '- Ghế thường: 70.000 - 100.000đ\n' +
                 '- Ghế VIP: 120.000 - 150.000đ\n' +
                 '- Ghế đôi: 200.000 - 250.000đ\n' +
                 'Bạn muốn xem giá chi tiết cho suất nào?',
        suggestions: ['Xem lịch chiếu', 'Tìm vé rẻ nhất']
      };

    case 'cinema':
      const cinemas = await Cinema.find({ isActive: true }).limit(5);
      return {
        message: 'Chúng tôi có các rạp chiếu sau:',
        data: cinemas.map(c => ({
          id: c._id,
          name: c.name,
          address: c.location.address,
          city: c.location.city
        })),
        suggestions: ['Xem chi tiết', 'Tìm rạp gần', 'Xem lịch chiếu']
      };

    case 'promotion':
      return {
        message: 'Hiện tại chúng tôi có các chương trình khuyến mãi:\n' +
                 '- Giảm 20% vào thứ 3 hàng tuần\n' +
                 '- Mua 2 vé tặng 1 combo bắp nước\n' +
                 '- Thành viên Gold giảm 15% mọi suất chiếu\n' +
                 'Bạn muốn biết thêm chi tiết về khuyến mãi nào?',
        suggestions: ['Xem tất cả khuyến mãi', 'Đăng ký thành viên']
      };

    case 'complaint':
      return {
        message: 'Tôi rất xin lỗi vì sự bất tiện này. Cho phép tôi kết nối bạn với nhân viên hỗ trợ để được giải quyết nhanh nhất. Trong lúc chờ đợi, bạn có thể cung cấp thêm thông tin về vấn đề không?',
        needsHumanSupport: true,
        suggestions: ['Gọi hotline', 'Gửi email hỗ trợ']
      };

    default:
      return {
        message: 'Xin lỗi, tôi chưa hiểu rõ câu hỏi của bạn. Bạn có thể nói rõ hơn hoặc chọn một trong các gợi ý sau?',
        suggestions: ['Đặt vé', 'Tìm phim', 'Xem suất chiếu', 'Liên hệ hỗ trợ']
      };
  }
};

// Simple fallback when Gemini API is unavailable
const getSimpleFallbackResponse = async (message, userId) => {
  const intent = classifyIntent(message);
  const entities = extractEntities(message);
  const response = await generateResponse(intent, entities, {});
  
  // Extract movie cards if available
  let movieCards = null;
  if (response.data && Array.isArray(response.data)) {
    movieCards = response.data.map(item => ({
      _id: item.id,
      title: item.title,
      rating: item.rating || 0,
      genres: Array.isArray(item.genres) ? item.genres : (item.genres ? item.genres.split(', ') : [])
    }));
  }
  
  return {
    message: response.message,
    intent: intent,
    entities: entities,
    sentiment: { sentiment: 'neutral', frustrationLevel: 0, needsHumanSupport: false },
    suggestions: response.suggestions || [],
    movieCards: movieCards,
    bookingFlow: intent === 'booking'
  };
};

// @desc    Send message to chatbot
// @route   POST /api/chatbot/message
// @access  Public
export const sendMessage = async (req, res, next) => {
  try {
    const { message, sessionId } = req.body;
    const userId = req.user?.id;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    // Get or create conversation context
    let context = conversationContexts.get(sessionId) || {
      history: [],
      lastIntent: null,
      entities: {}
    };

    // Use Gemini AI chatbot service with fallback
    let geminiResult;
    try {
      geminiResult = await geminiChatbot.processMessage(message, userId, context);
    } catch (error) {
      console.error('Gemini chatbot error, using fallback:', error.message);
      // Simple rule-based fallback
      geminiResult = await getSimpleFallbackResponse(message, userId);
    }

    // Update context
    context.lastIntent = geminiResult.intent;
    context.entities = { ...context.entities, ...geminiResult.entities };
    context.history.push({
      role: 'user',
      message,
      timestamp: Date.now()
    });

    // Check if needs human support
    if (geminiResult.requiresHumanSupport || geminiResult.sentiment?.needsHumanSupport) {
      context.history.push({
        role: 'system',
        message: 'Chuyển tiếp đến nhân viên hỗ trợ...',
        timestamp: Date.now()
      });
      
      conversationContexts.set(sessionId, context);
      
      return res.status(200).json({
        success: true,
        response: {
          message: geminiResult.message,
          needsHumanSupport: true,
          escalationReason: geminiResult.sentiment?.reason || 'Yêu cầu hỗ trợ từ nhân viên'
        },
        context: {
          intent: geminiResult.intent,
          sentiment: geminiResult.sentiment,
          entities: geminiResult.entities
        }
      });
    }

    // Update context with bot response
    context.history.push({
      role: 'assistant',
      message: geminiResult.message,
      timestamp: Date.now()
    });

    // Keep only last 10 messages
    if (context.history.length > 10) {
      context.history = context.history.slice(-10);
    }

    conversationContexts.set(sessionId, context);

    res.status(200).json({
      success: true,
      message: geminiResult.message || 'Xin lỗi, tôi không hiểu câu hỏi của bạn.',
      suggestions: geminiResult.suggestions || [],
      movieCards: geminiResult.movieCards || null,
      bookingFlow: geminiResult.bookingFlow || false,
      intent: geminiResult.intent,
      sentiment: geminiResult.sentiment,
      entities: geminiResult.entities
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Analyze user intent
// @route   POST /api/chatbot/analyze-intent
// @access  Public
export const analyzeIntent = async (req, res, next) => {
  try {
    const { message } = req.body;

    const intent = classifyIntent(message);
    const entities = extractEntities(message);
    const sentimentResult = sentiment.analyze(message);

    res.status(200).json({
      success: true,
      analysis: {
        intent,
        entities,
        sentiment: {
          score: sentimentResult.score,
          comparative: sentimentResult.comparative,
          tokens: sentimentResult.tokens
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Handle booking query through natural language
// @route   POST /api/chatbot/booking-query
// @access  Public
export const handleBookingQuery = async (req, res, next) => {
  try {
    const { message } = req.body;

    const entities = extractEntities(message);

    // Search for matching movies
    let movieQuery = {};
    if (entities.movieTitle) {
      movieQuery = {
        $text: { $search: entities.movieTitle },
        status: 'now-showing',
        isActive: true
      };
    } else {
      movieQuery = {
        status: 'now-showing',
        isActive: true
      };
    }

    const movies = await Movie.find(movieQuery).limit(5);

    // Search for matching showtimes
    let showtimeQuery = {
      isActive: true,
      date: entities.date || { $gte: new Date() }
    };

    if (movies.length > 0) {
      showtimeQuery.movieId = { $in: movies.map(m => m._id) };
    }

    const showtimes = await Showtime.find(showtimeQuery)
      .populate('movieId', 'title poster')
      .populate('cinemaId', 'name location')
      .sort('startTime')
      .limit(10);

    res.status(200).json({
      success: true,
      results: {
        movies,
        showtimes,
        entities
      },
      message: showtimes.length > 0 
        ? `Tôi tìm thấy ${showtimes.length} suất chiếu phù hợp.`
        : 'Không tìm thấy suất chiếu phù hợp. Bạn có thể thử tìm kiếm khác?'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get conversation history
// @route   GET /api/chatbot/history
// @access  Private
export const getConversationHistory = async (req, res, next) => {
  try {
    const { sessionId } = req.query;

    const context = conversationContexts.get(sessionId);

    if (!context) {
      return res.status(404).json({
        success: false,
        message: 'No conversation history found'
      });
    }

    res.status(200).json({
      success: true,
      history: context.history
    });
  } catch (error) {
    next(error);
  }
};
