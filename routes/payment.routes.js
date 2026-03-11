import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
  createPaymentIntent,
  confirmPayment,
  getPaymentHistory
} from '../controllers/payment.controller.js';
import {
  createVNPayPayment,
  verifyVNPayCallback,
  checkVNPayStatus
} from '../controllers/vnpay.controller.js';

const router = express.Router();

// VNPay routes
router.post('/vnpay/create', protect, createVNPayPayment);
router.get('/vnpay/callback', verifyVNPayCallback); // Public route for VNPay callback
router.get('/vnpay/status/:bookingId', protect, checkVNPayStatus);

// Standard payment routes
router.use(protect);

router.post('/create-intent', createPaymentIntent);
router.post('/confirm', confirmPayment);
router.get('/history', getPaymentHistory);

export default router;
