import Sentiment from 'sentiment';
import { logger } from '../utils/logger.js';

/**
 * Sentiment Analysis AI Service
 * Analyzes customer messages for emotions and escalates negative sentiment
 */

class SentimentAI {
  constructor() {
    this.sentiment = new Sentiment();
    
    // Vietnamese negative keywords mapping
    this.negativeKeywords = [
      'chậm', 'lỗi', 'không được', 'bực mình', 'tệ', 'kém',
      'thất vọng', 'không hài lòng', 'tồi', 'dở', 'sai',
      'không thích', 'tức giận', 'phản đối', 'khó chịu',
      'mệt mỏi', 'chán', 'thảm họa', 'vô dụng', 'phí tiền',
      'slow', 'error', 'bad', 'terrible', 'awful', 'worst',
      'disappointed', 'angry', 'frustrated', 'annoyed'
    ];

    this.positiveKeywords = [
      'tốt', 'hay', 'đẹp', 'tuyệt', 'xuất sắc', 'hoàn hảo',
      'hài lòng', 'thích', 'yêu thích', 'ổn', 'ok', 'được',
      'great', 'good', 'excellent', 'perfect', 'amazing',
      'wonderful', 'fantastic', 'love', 'like', 'nice'
    ];

    this.escalationThreshold = -2; // Sentiment score below this = escalate
  }

  /**
   * Analyze sentiment of a message
   * @param {String} message - User message
   * @returns {Object} Sentiment analysis result
   */
  analyze(message) {
    try {
      if (!message || typeof message !== 'string') {
        return this._getDefaultSentiment();
      }

      const lowerMessage = message.toLowerCase();

      // Use sentiment library for English
      const result = this.sentiment.analyze(message);

      // Enhanced analysis with Vietnamese keywords
      const vietnameseScore = this._analyzeVietnamese(lowerMessage);

      // Combine scores
      const finalScore = result.score + vietnameseScore;
      const comparative = finalScore / message.split(' ').length;

      // Determine sentiment level
      const level = this._getSentimentLevel(comparative);

      // Check if needs escalation
      const needsEscalation = this._checkEscalation(
        comparative, 
        lowerMessage
      );

      // Extract emotions
      const emotions = this._extractEmotions(lowerMessage, comparative);

      return {
        score: finalScore,
        comparative,
        level,
        needsEscalation,
        emotions,
        confidence: this._calculateConfidence(message),
        suggestedResponse: this._suggestResponse(level, emotions)
      };

    } catch (error) {
      logger.error('Sentiment Analysis Error:', error);
      return this._getDefaultSentiment();
    }
  }

  /**
   * Analyze Vietnamese text
   */
  _analyzeVietnamese(text) {
    let score = 0;

    // Check negative keywords
    this.negativeKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        score -= matches.length * 2;
      }
    });

    // Check positive keywords
    this.positiveKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        score += matches.length * 2;
      }
    });

    return score;
  }

  /**
   * Get sentiment level from comparative score
   */
  _getSentimentLevel(comparative) {
    if (comparative >= 0.5) return 'very_positive';
    if (comparative >= 0.1) return 'positive';
    if (comparative >= -0.1) return 'neutral';
    if (comparative >= -0.5) return 'negative';
    return 'very_negative';
  }

  /**
   * Check if message needs escalation to human agent
   */
  _checkEscalation(comparative, message) {
    // Very negative sentiment
    if (comparative < this.escalationThreshold) {
      return {
        needed: true,
        reason: 'Khách hàng có cảm xúc tiêu cực',
        priority: 'high'
      };
    }

    // Critical keywords detected
    const criticalKeywords = [
      'hoàn tiền', 'refund', 'khiếu nại', 'complaint',
      'quản lý', 'manager', 'báo cáo', 'report',
      'kiện', 'sue', 'luật sư', 'lawyer'
    ];

    for (const keyword of criticalKeywords) {
      if (message.includes(keyword)) {
        return {
          needed: true,
          reason: 'Phát hiện từ khóa quan trọng cần xử lý',
          priority: 'urgent'
        };
      }
    }

    // Multiple consecutive negative messages would be tracked in conversation history
    
    return {
      needed: false,
      reason: null,
      priority: 'normal'
    };
  }

  /**
   * Extract emotions from text
   */
  _extractEmotions(text, comparative) {
    const emotions = [];

    // Anger
    const angerWords = ['tức', 'giận', 'bực', 'angry', 'mad', 'furious'];
    if (angerWords.some(word => text.includes(word))) {
      emotions.push('anger');
    }

    // Disappointment
    const disappointWords = ['thất vọng', 'disappointed', 'let down'];
    if (disappointWords.some(word => text.includes(word))) {
      emotions.push('disappointment');
    }

    // Frustration
    const frustrationWords = ['mệt mỏi', 'frustrated', 'annoyed'];
    if (frustrationWords.some(word => text.includes(word))) {
      emotions.push('frustration');
    }

    // Happiness
    const happyWords = ['vui', 'happy', 'glad', 'excited', 'love'];
    if (happyWords.some(word => text.includes(word))) {
      emotions.push('happiness');
    }

    // Satisfaction
    const satisfiedWords = ['hài lòng', 'satisfied', 'pleased'];
    if (satisfiedWords.some(word => text.includes(word))) {
      emotions.push('satisfaction');
    }

    // If no specific emotion but negative
    if (emotions.length === 0 && comparative < -0.2) {
      emotions.push('dissatisfaction');
    }

    // If no specific emotion but positive
    if (emotions.length === 0 && comparative > 0.2) {
      emotions.push('positive');
    }

    return emotions.length > 0 ? emotions : ['neutral'];
  }

  /**
   * Calculate confidence in analysis
   */
  _calculateConfidence(message) {
    const wordCount = message.split(' ').length;

    // More words = higher confidence
    if (wordCount > 20) return 0.9;
    if (wordCount > 10) return 0.75;
    if (wordCount > 5) return 0.6;
    
    return 0.5;
  }

  /**
   * Suggest appropriate response based on sentiment
   */
  _suggestResponse(level, emotions) {
    if (level === 'very_negative') {
      return {
        tone: 'apologetic',
        template: 'Chúng tôi rất xin lỗi về sự bất tiện này. Hãy để tôi kết nối bạn với nhân viên hỗ trợ để giải quyết vấn đề tốt nhất.',
        actions: ['escalate', 'apologize', 'offer_compensation']
      };
    }

    if (level === 'negative') {
      return {
        tone: 'understanding',
        template: 'Tôi hiểu cảm giác của bạn. Hãy cho tôi biết thêm chi tiết để tôi có thể hỗ trợ bạn tốt hơn.',
        actions: ['empathize', 'ask_details', 'offer_solution']
      };
    }

    if (level === 'positive' || level === 'very_positive') {
      return {
        tone: 'friendly',
        template: 'Rất vui vì bạn hài lòng! Tôi có thể giúp gì thêm cho bạn không?',
        actions: ['express_gratitude', 'upsell', 'ask_review']
      };
    }

    return {
      tone: 'neutral',
      template: 'Tôi đã hiểu yêu cầu của bạn. Hãy để tôi hỗ trợ bạn.',
      actions: ['acknowledge', 'provide_info']
    };
  }

  /**
   * Get default sentiment when analysis fails
   */
  _getDefaultSentiment() {
    return {
      score: 0,
      comparative: 0,
      level: 'neutral',
      needsEscalation: { needed: false, reason: null, priority: 'normal' },
      emotions: ['neutral'],
      confidence: 0.5,
      suggestedResponse: {
        tone: 'neutral',
        template: 'Tôi có thể giúp gì cho bạn?',
        actions: ['greet']
      }
    };
  }

  /**
   * Analyze conversation trend (multiple messages)
   */
  analyzeConversation(messages) {
    try {
      if (!messages || messages.length === 0) {
        return {
          overallSentiment: 'neutral',
          trend: 'stable',
          needsEscalation: false
        };
      }

      const analyses = messages.map(msg => this.analyze(msg));
      const scores = analyses.map(a => a.comparative);

      // Calculate overall sentiment
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const overallLevel = this._getSentimentLevel(avgScore);

      // Calculate trend (improving/declining)
      const trend = this._calculateTrend(scores);

      // Check if escalation needed
      const negativeCount = analyses.filter(a => 
        a.level === 'negative' || a.level === 'very_negative'
      ).length;

      const needsEscalation = negativeCount >= 3 || 
                             analyses[analyses.length - 1]?.needsEscalation.needed;

      return {
        overallSentiment: overallLevel,
        trend,
        needsEscalation,
        messageCount: messages.length,
        negativeMessageCount: negativeCount,
        avgScore
      };

    } catch (error) {
      logger.error('Conversation Analysis Error:', error);
      return {
        overallSentiment: 'neutral',
        trend: 'stable',
        needsEscalation: false
      };
    }
  }

  /**
   * Calculate sentiment trend
   */
  _calculateTrend(scores) {
    if (scores.length < 2) return 'stable';

    const recent = scores.slice(-3);
    const older = scores.slice(0, -3);

    if (older.length === 0) return 'stable';

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    const difference = recentAvg - olderAvg;

    if (difference > 0.3) return 'improving';
    if (difference < -0.3) return 'declining';
    return 'stable';
  }
}

export default new SentimentAI();
