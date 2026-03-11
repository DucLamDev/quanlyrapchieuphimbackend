import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
  getMyLoyaltyInfo,
  redeemPoints,
  getLoyaltyHistory,
  getAvailableRewards
} from '../controllers/loyalty.controller.js';

const router = express.Router();

router.use(protect);

router.get('/my-info', getMyLoyaltyInfo);
router.get('/rewards', getAvailableRewards);
router.get('/history', getLoyaltyHistory);
router.post('/redeem', redeemPoints);

export default router;
