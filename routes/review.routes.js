import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware.js';
import {
  getReviews,
  getAllReviews,
  createReview,
  updateReview,
  deleteReview,
  likeReview,
  canReviewMovie,
  moderateReview,
  toggleReviewVisibility,
  getMyReview
} from '../controllers/review.controller.js';

const router = express.Router();

// Admin routes - must be before dynamic routes
router.get('/', protect, authorize('admin'), getAllReviews);
router.put('/:id/moderate', protect, authorize('admin'), moderateReview);
router.put('/:id/visibility', protect, authorize('admin'), toggleReviewVisibility);

// User routes
router.get('/can-review/:movieId', protect, canReviewMovie);
router.get('/my-review/:movieId', protect, getMyReview);
router.get('/movie/:movieId', getReviews);
router.post('/', protect, createReview);
router.put('/:id', protect, updateReview);
router.delete('/:id', protect, deleteReview);
router.post('/:id/like', protect, likeReview);

export default router;
