import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware.js';
import {
  createBooking,
  getMyBookings,
  getBooking,
  cancelBooking,
  checkInBooking,
  getAllBookings,
  refundBooking,
  createGroupBooking,
  generatePrintableTicket
} from '../controllers/booking.controller.js';

const router = express.Router();

// Protected routes
router.use(protect);

router.post('/', createBooking);
router.post('/group', createGroupBooking);
router.get('/my-bookings', getMyBookings);
router.get('/:id', getBooking);
router.put('/:id/cancel', cancelBooking);
router.put('/:id/checkin', authorize('staff', 'admin'), checkInBooking);
router.put('/:id/refund', authorize('staff', 'admin'), refundBooking);
router.get('/:id/print-ticket', authorize('staff', 'admin'), generatePrintableTicket);

// Admin/Staff routes
router.get('/', authorize('staff', 'admin'), getAllBookings);

export default router;
