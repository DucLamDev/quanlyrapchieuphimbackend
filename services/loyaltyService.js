import User from '../models/User.model.js';
import Booking from '../models/Booking.model.js';
import { logger } from '../utils/logger.js';

/**
 * Loyalty Points Service
 * Manages customer loyalty program
 */
class LoyaltyService {
  constructor() {
    this.pointsRules = {
      perDollar: 10, // 10 points per dollar spent
      signupBonus: 100,
      reviewBonus: 50,
      birthdayBonus: 500,
      referralBonus: 200
    };

    this.rewardTiers = {
      bronze: { minPoints: 0, multiplier: 1, name: 'Đồng' },
      silver: { minPoints: 1000, multiplier: 1.25, name: 'Bạc' },
      gold: { minPoints: 5000, multiplier: 1.5, name: 'Vàng' },
      platinum: { minPoints: 10000, multiplier: 2, name: 'Bạch Kim' }
    };
  }

  async earnPoints(userId, amount, source = 'purchase') {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      const tier = this._getUserTier(user.loyaltyPoints || 0);
      const basePoints = Math.floor(amount * this.pointsRules.perDollar);
      const bonusPoints = Math.floor(basePoints * (tier.multiplier - 1));
      const totalPoints = basePoints + bonusPoints;

      user.loyaltyPoints = (user.loyaltyPoints || 0) + totalPoints;
      
      if (!user.loyaltyHistory) user.loyaltyHistory = [];
      user.loyaltyHistory.push({
        points: totalPoints,
        source,
        amount,
        tier: tier.name,
        createdAt: new Date()
      });

      await user.save();

      return {
        pointsEarned: totalPoints,
        totalPoints: user.loyaltyPoints,
        tier: tier.name,
        nextTier: this._getNextTier(user.loyaltyPoints)
      };
    } catch (error) {
      logger.error('Earn Points Error:', error);
      throw error;
    }
  }

  async redeemPoints(userId, points, rewardType) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');
      if ((user.loyaltyPoints || 0) < points) {
        throw new Error('Insufficient points');
      }

      user.loyaltyPoints -= points;
      
      if (!user.loyaltyHistory) user.loyaltyHistory = [];
      user.loyaltyHistory.push({
        points: -points,
        source: 'redemption',
        rewardType,
        createdAt: new Date()
      });

      await user.save();

      return {
        pointsRedeemed: points,
        remainingPoints: user.loyaltyPoints,
        reward: rewardType
      };
    } catch (error) {
      logger.error('Redeem Points Error:', error);
      throw error;
    }
  }

  _getUserTier(points) {
    if (points >= this.rewardTiers.platinum.minPoints) return this.rewardTiers.platinum;
    if (points >= this.rewardTiers.gold.minPoints) return this.rewardTiers.gold;
    if (points >= this.rewardTiers.silver.minPoints) return this.rewardTiers.silver;
    return this.rewardTiers.bronze;
  }

  _getNextTier(points) {
    const tiers = Object.values(this.rewardTiers);
    const nextTier = tiers.find(t => t.minPoints > points);
    return nextTier ? {
      name: nextTier.name,
      pointsNeeded: nextTier.minPoints - points
    } : null;
  }
}

export default new LoyaltyService();
