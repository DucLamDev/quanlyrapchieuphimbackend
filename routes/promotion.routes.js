import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware.js';
import {
  getPromotions,
  getPromotion,
  createPromotion,
  updatePromotion,
  deletePromotion,
  validatePromotionCode,
  applyAutoPromotions
} from '../controllers/promotion.controller.js';

const router = express.Router();

// Public routes
router.get('/', getPromotions);
router.get('/:id', getPromotion);
router.post('/validate', protect, validatePromotionCode);

// Admin routes
router.post('/', protect, authorize('admin'), createPromotion);
router.put('/:id', protect, authorize('admin'), updatePromotion);
router.delete('/:id', protect, authorize('admin'), deletePromotion);
router.post('/apply-auto', protect, authorize('admin'), applyAutoPromotions);

export default router;
