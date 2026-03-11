import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware.js';
import {
  getMovies,
  getMovie,
  createMovie,
  updateMovie,
  deleteMovie,
  getNowShowing,
  getComingSoon,
  searchMovies,
  getMovieStats
} from '../controllers/movie.controller.js';

const router = express.Router();

// Public routes
router.get('/', getMovies);
router.get('/now-showing', getNowShowing);
router.get('/coming-soon', getComingSoon);
router.get('/search', searchMovies);
router.get('/:id', getMovie);
router.get('/:id/stats', getMovieStats);

// Protected routes (Admin only)
router.post('/', protect, authorize('admin'), createMovie);
router.put('/:id', protect, authorize('admin'), updateMovie);
router.delete('/:id', protect, authorize('admin'), deleteMovie);

export default router;
