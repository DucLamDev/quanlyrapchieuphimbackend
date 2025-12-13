import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware.js';
import {
  getCinemas,
  getCinema,
  createCinema,
  updateCinema,
  deleteCinema,
  getNearestCinemas
} from '../controllers/cinema.controller.js';

const router = express.Router();

// Public routes
router.get('/', getCinemas);
router.get('/nearest', getNearestCinemas);
router.get('/:id', getCinema);

// Protected routes (Admin only)
router.post('/', protect, authorize('admin'), createCinema);
router.put('/:id', protect, authorize('admin'), updateCinema);
router.delete('/:id', protect, authorize('admin'), deleteCinema);

export default router;
