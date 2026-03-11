import express from 'express';
import {
  sendMessage,
  getConversationHistory,
  analyzeIntent,
  handleBookingQuery
} from '../controllers/chatbot.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/message', sendMessage);
router.post('/analyze-intent', analyzeIntent);
router.post('/booking-query', handleBookingQuery);
router.get('/history', protect, getConversationHistory);

export default router;
