import express from 'express';
import {
  predictShowtimeCrowd,
  getShowtimesByOccupancy,
  updatePredictions,
  getCrowdTrends
} from '../controllers/crowdPrediction.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/showtime/:showtimeId', predictShowtimeCrowd);
router.get('/filter', getShowtimesByOccupancy);
router.get('/trends/:cinemaId', getCrowdTrends);
router.post('/update', protect, authorize('admin'), updatePredictions);

export default router;
