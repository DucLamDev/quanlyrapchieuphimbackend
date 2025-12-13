import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
  getPersonalizedRecommendations,
  getSimilarMovies,
  getTrendingMovies
} from '../controllers/recommendation.controller.js';

const router = express.Router();

router.get('/personalized', protect, getPersonalizedRecommendations);
router.get('/similar/:movieId', getSimilarMovies);
router.get('/trending', getTrendingMovies);

export default router;
