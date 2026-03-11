import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Knowledge Base Service
 * Loads and queries FAQ and common questions from knowledge base
 */
class KnowledgeBaseService {
  constructor() {
    this.knowledgeBase = null;
    this.loadKnowledgeBase();
  }

  /**
   * Load knowledge base from JSON file
   */
  loadKnowledgeBase() {
    try {
      const kbPath = path.join(__dirname, '../data/knowledge-base.json');
      const data = fs.readFileSync(kbPath, 'utf8');
      this.knowledgeBase = JSON.parse(data);
      console.log('✅ Knowledge Base loaded successfully');
    } catch (error) {
      console.error('❌ Error loading knowledge base:', error);
      this.knowledgeBase = {};
    }
  }

  /**
   * Search knowledge base for relevant answer
   * @param {string} query - User's question
   * @param {string} intent - Classified intent
   * @returns {Object|null} - Matching response or null
   */
  search(query, intent = 'general') {
    if (!this.knowledgeBase) {
      return null;
    }

    const lowerQuery = query.toLowerCase();
    
    // 1. Try to find by intent first
    if (intent && this.knowledgeBase[intent]) {
      const category = this.knowledgeBase[intent];
      
      // Check if query matches any keywords
      const hasKeyword = category.keywords.some(keyword => 
        lowerQuery.includes(keyword.toLowerCase())
      );
      
      if (hasKeyword && category.responses.length > 0) {
        // Find most relevant response
        for (const response of category.responses) {
          const questionWords = response.question.toLowerCase().split(' ');
          const matchCount = questionWords.filter(word => 
            lowerQuery.includes(word) && word.length > 2
          ).length;
          
          if (matchCount >= 2 || lowerQuery.includes(response.question.toLowerCase())) {
            return {
              answer: response.answer,
              category: intent,
              confidence: 0.9
            };
          }
        }
        
        // If no exact match, return first response from category
        return {
          answer: category.responses[0].answer,
          category: intent,
          confidence: 0.7
        };
      }
    }

    // 2. Search across all categories
    for (const [categoryName, category] of Object.entries(this.knowledgeBase)) {
      // Check keywords
      const hasKeyword = category.keywords.some(keyword => 
        lowerQuery.includes(keyword.toLowerCase())
      );
      
      if (hasKeyword) {
        // Find best matching response
        for (const response of category.responses) {
          const questionWords = response.question.toLowerCase().split(' ');
          const matchCount = questionWords.filter(word => 
            lowerQuery.includes(word) && word.length > 2
          ).length;
          
          if (matchCount >= 2) {
            return {
              answer: response.answer,
              category: categoryName,
              confidence: 0.8
            };
          }
        }
        
        // Return first response if keyword matched
        if (category.responses.length > 0) {
          return {
            answer: category.responses[0].answer,
            category: categoryName,
            confidence: 0.6
          };
        }
      }
    }

    // 3. No match found
    return null;
  }

  /**
   * Get all responses from a category
   * @param {string} category - Category name
   * @returns {Array} - List of responses
   */
  getCategory(category) {
    if (this.knowledgeBase && this.knowledgeBase[category]) {
      return this.knowledgeBase[category].responses;
    }
    return [];
  }

  /**
   * Get random helpful response
   * @returns {string} - Random helpful message
   */
  getRandomHelp() {
    const helpMessages = [
      'Tôi có thể giúp bạn đặt vé xem phim. Bạn muốn xem phim gì?',
      'Bạn cần tìm suất chiếu? Hãy cho tôi biết tên phim nhé!',
      'Tôi có thể giúp bạn tìm rạp gần nhất. Bạn đang ở khu vực nào?',
      'Bạn muốn xem các chương trình khuyến mãi đang có?'
    ];
    
    return helpMessages[Math.floor(Math.random() * helpMessages.length)];
  }

  /**
   * Get suggestions based on intent
   * @param {string} intent - Intent type
   * @returns {Array} - List of suggestion texts
   */
  getSuggestions(intent) {
    const suggestions = {
      booking: ['Đặt vé xem phim', 'Xem phim đang chiếu', 'Tìm suất chiếu'],
      movie_info: ['Phim hot tuần này', 'Phim sắp chiếu', 'Phim đáng xem'],
      showtime: ['Lịch chiếu hôm nay', 'Lịch chiếu cuối tuần', 'Suất chiếu sáng'],
      cinema: ['Rạp gần đây', 'Xem tất cả rạp', 'Địa chỉ rạp'],
      promotion: ['Xem khuyến mãi', 'Giảm giá hôm nay', 'Đăng ký thành viên'],
      price: ['Giá vé', 'Bảng giá', 'Giảm giá'],
      general: ['Đặt vé', 'Xem phim', 'Lịch chiếu', 'Khuyến mãi']
    };
    
    return suggestions[intent] || suggestions.general;
  }
}

export default new KnowledgeBaseService();
