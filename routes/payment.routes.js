import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
  createPaymentIntent,
  confirmPayment,
  getPaymentHistory
} from '../controllers/payment.controller.js';

const router = express.Router();

router.use(protect);

router.post('/create-intent', createPaymentIntent);
router.post('/confirm', confirmPayment);
router.get('/history', getPaymentHistory);

export default router;
