import natural from 'natural';
import Movie from '../models/Movie.model.js';
import Showtime from '../models/Showtime.model.js';
import Cinema from '../models/Cinema.model.js';
import sentimentAI from './sentimentAI.js';
import crowdPredictionAI from './crowdPredictionAI.js';
import { logger } from '../utils/logger.js';

/**
 * Chatbot NLP Service
 * Natural Language Processing for booking and queries
 */
class ChatbotNLP {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.intents = this._defineIntents();
  }

  _defineIntents() {
    return {
      book_ticket: {
        keywords: ['đặt', 'book', 'mua', 'vé', 'ticket', 'xem'],
        patterns: [/đặt.*vé/, /book.*ticket/, /mua.*vé/]
      },
      find_movie: {
        keywords: ['tìm', 'find', 'phim', 'movie', 'có gì'],
        patterns: [/tìm.*phim/, /find.*movie/, /phim.*nào/]
      },
      crowd_check: {
        keywords: ['đông', 'ít người', 'yên tĩnh', 'crowd', 'quiet'],
        patterns: [/suất.*ít người/, /suất.*yên tĩnh/, /đông.*không/]
      },
      showtime_query: {
        keywords: ['suất', 'showtime', 'giờ', 'time', 'lúc'],
        patterns: [/suất.*chiếu/, /showtime/, /mấy giờ/]
      },
      cancel_refund: {
        keywords: ['hủy', 'cancel', 'hoàn', 'refund'],
        patterns: [/hủy.*vé/, /cancel.*ticket/, /hoàn.*tiền/]
      },
      help: {
        keywords: ['giúp', 'help', 'hỗ trợ', 'support'],
        patterns: [/giúp.*tôi/, /help.*me/, /cần.*hỗ trợ/]
      }
    };
  }

  async processMessage(message, userId = null) {
    try {
      // Sentiment analysis
      const sentiment = sentimentAI.analyze(message);

      // Check escalation
      if (sentiment.needsEscalation.needed) {
        return {
          intent: 'escalate',
          response: 'Tôi sẽ kết nối bạn với nhân viên hỗ trợ ngay.',
          sentiment,
          requiresHuman: true
        };
      }

      // Intent classification
      const intent = this._classifyIntent(message);

      // Extract entities
      const entities = this._extractEntities(message);

      // Process based on intent
      let response;
      switch (intent) {
        case 'book_ticket':
          response = await this._handleBooking(entities, userId);
          break;
        case 'crowd_check':
          response = await this._handleCrowdCheck(entities);
          break;
        case 'find_movie':
          response = await this._handleFindMovie(entities);
          break;
        case 'showtime_query':
          response = await this._handleShowtimeQuery(entities);
          break;
        default:
          response = this._getDefaultResponse();
      }

      return { intent, response, entities, sentiment };
    } catch (error) {
      logger.error('Chatbot NLP Error:', error);
      return this._getErrorResponse();
    }
  }

  _classifyIntent(message) {
    const lowerMessage = message.toLowerCase();
    let maxScore = 0;
    let detectedIntent = 'unknown';

    for (const [intent, config] of Object.entries(this.intents)) {
      let score = 0;
      
      // Check keywords
      config.keywords.forEach(keyword => {
        if (lowerMessage.includes(keyword)) score += 1;
      });

      // Check patterns
      config.patterns.forEach(pattern => {
        if (pattern.test(lowerMessage)) score += 2;
      });

      if (score > maxScore) {
        maxScore = score;
        detectedIntent = intent;
      }
    }

    return detectedIntent;
  }

  _extractEntities(message) {
    const entities = {
      movieTitle: null,
      time: null,
      date: null,
      quantity: null,
      cinema: null
    };

    // Extract quantity
    const quantityMatch = message.match(/(\d+)\s*(vé|ticket)/i);
    if (quantityMatch) entities.quantity = parseInt(quantityMatch[1]);

    // Extract time
    const timeMatch = message.match(/(\d{1,2})[h:giờ](\d{0,2})/i);
    if (timeMatch) entities.time = `${timeMatch[1]}:${timeMatch[2] || '00'}`;

    // Extract date keywords
    if (/hôm nay|today/i.test(message)) entities.date = 'today';
    if (/ngày mai|tomorrow/i.test(message)) entities.date = 'tomorrow';

    return entities;
  }

  async _handleBooking(entities, userId) {
    if (!entities.quantity) entities.quantity = 1;
    
    return {
      message: `Tôi sẽ giúp bạn đặt ${entities.quantity} vé. Bạn muốn xem phim gì?`,
      action: 'request_movie_selection',
      data: { quantity: entities.quantity }
    };
  }

  async _handleCrowdCheck(entities) {
    const quietShowtimes = await Showtime.find({
      startTime: { $gte: new Date() }
    }).limit(5);

    const predictions = await Promise.all(
      quietShowtimes.map(s => crowdPredictionAI.predictShowtime(s._id))
    );

    const quiet = predictions.filter(p => p.crowdLevel === 'Thấp');

    return {
      message: `Tìm thấy ${quiet.length} suất chiếu yên tĩnh`,
      action: 'show_quiet_showtimes',
      data: quiet
    };
  }

  async _handleFindMovie(entities) {
    const movies = await Movie.find({ status: 'now_showing' }).limit(10);
    
    return {
      message: `Hiện đang có ${movies.length} phim đang chiếu`,
      action: 'show_movies',
      data: movies
    };
  }

  async _handleShowtimeQuery(entities) {
    return {
      message: 'Bạn muốn xem suất chiếu của phim nào?',
      action: 'request_movie_for_showtime'
    };
  }

  _getDefaultResponse() {
    return {
      message: 'Tôi có thể giúp bạn đặt vé, tìm phim hoặc kiểm tra suất chiếu. Bạn cần gì?',
      action: 'show_menu'
    };
  }

  _getErrorResponse() {
    return {
      message: 'Xin lỗi, tôi không hiểu. Bạn có thể nói rõ hơn không?',
      action: 'clarify'
    };
  }
}

export default new ChatbotNLP();
