import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware.js';
import {
  getShowtimes,
  getShowtime,
  createShowtime,
  updateShowtime,
  deleteShowtime,
  getShowtimesByMovie,
  getShowtimesByCinema
} from '../controllers/showtime.controller.js';

const router = express.Router();

// Public routes
router.get('/', getShowtimes);
router.get('/:id', getShowtime);
router.get('/movie/:movieId', getShowtimesByMovie);
router.get('/cinema/:cinemaId', getShowtimesByCinema);

// Protected routes (Admin only)
router.post('/', protect, authorize('admin'), createShowtime);
router.put('/:id', protect, authorize('admin'), updateShowtime);
router.delete('/:id', protect, authorize('admin'), deleteShowtime);

export default router;
