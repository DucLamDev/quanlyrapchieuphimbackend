import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware.js';
import {
  getDashboardStats,
  getRevenueByPeriod,
  getRevenueByMovie,
  getRevenueByCinema,
  getBookingStats,
  exportReport,
  getRecentActivities
} from '../controllers/revenue.controller.js';

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/dashboard', getDashboardStats);
router.get('/period', getRevenueByPeriod);
router.get('/by-movie', getRevenueByMovie);
router.get('/by-cinema', getRevenueByCinema);
router.get('/booking-stats', getBookingStats);
router.get('/recent-activities', getRecentActivities);
router.get('/export', exportReport);

export default router;
