import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware.js';
import {
  getReviews,
  getAllReviews,
  createReview,
  updateReview,
  deleteReview,
  likeReview
} from '../controllers/review.controller.js';

const router = express.Router();

// Admin route - must be before /movie/:movieId to avoid conflict
router.get('/', protect, authorize('admin'), getAllReviews);
router.get('/movie/:movieId', getReviews);
router.post('/', protect, createReview);
router.put('/:id', protect, updateReview);
router.delete('/:id', protect, deleteReview);
router.post('/:id/like', protect, likeReview);

export default router;
