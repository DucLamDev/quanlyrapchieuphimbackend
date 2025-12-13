import User from '../models/User.model.js';
import Booking from '../models/Booking.model.js';
import Combo from '../models/Combo.model.js';
import loyaltyService from '../services/loyaltyService.js';

// @desc    Get user loyalty info
// @route   GET /api/loyalty/my-info
// @access  Private
export const getMyLoyaltyInfo = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    const totalBookings = await Booking.countDocuments({
      userId: user._id,
      status: { $in: ['confirmed', 'used'] }
    });

    const totalSpent = await Booking.aggregate([
      {
        $match: {
          userId: user._id,
          status: { $in: ['confirmed', 'used'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$finalAmount' }
        }
      }
    ]);

    // Calculate points to next tier
    const tierThresholds = {
      bronze: 0,
      silver: 2000,
      gold: 5000,
      platinum: 10000
    };

    let nextTier = null;
    let pointsToNextTier = 0;

    if (user.loyaltyTier !== 'platinum') {
      const tiers = Object.keys(tierThresholds);
      const currentIndex = tiers.indexOf(user.loyaltyTier);
      nextTier = tiers[currentIndex + 1];
      pointsToNextTier = tierThresholds[nextTier] - user.loyaltyPoints;
    }

    res.status(200).json({
      success: true,
      loyaltyInfo: {
        points: user.loyaltyPoints,
        tier: user.loyaltyTier,
        totalBookings,
        totalSpent: totalSpent[0]?.total || 0,
        nextTier,
        pointsToNextTier
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get available rewards
// @route   GET /api/loyalty/rewards
// @access  Private
export const getAvailableRewards = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    // Get combos that can be redeemed with points
    const combos = await Combo.find({
      loyaltyPointsRequired: { $lte: user.loyaltyPoints, $gt: 0 },
      isAvailable: true
    }).sort('loyaltyPointsRequired');

    // Define tier benefits
    const tierBenefits = {
      bronze: {
        discountPercentage: 0,
        pointsMultiplier: 1,
        specialOffers: []
      },
      silver: {
        discountPercentage: 5,
        pointsMultiplier: 1.2,
        specialOffers: ['Ưu tiên đặt vé sớm']
      },
      gold: {
        discountPercentage: 10,
        pointsMultiplier: 1.5,
        specialOffers: ['Ưu tiên đặt vé sớm', 'Miễn phí nâng cấp ghế VIP (có điều kiện)']
      },
      platinum: {
        discountPercentage: 15,
        pointsMultiplier: 2,
        specialOffers: ['Ưu tiên đặt vé sớm', 'Miễn phí nâng cấp ghế VIP', 'Phòng chờ VIP', 'Sinh nhật đặc biệt']
      }
    };

    res.status(200).json({
      success: true,
      rewards: {
        currentPoints: user.loyaltyPoints,
        tier: user.loyaltyTier,
        benefits: tierBenefits[user.loyaltyTier],
        redeemableCombos: combos
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Redeem loyalty points
// @route   POST /api/loyalty/redeem
// @access  Private
export const redeemPoints = async (req, res, next) => {
  try {
    const { comboId, quantity = 1 } = req.body;
    const combo = await Combo.findById(comboId);

    if (!combo || !combo.loyaltyPointsRequired) {
      return res.status(404).json({
        success: false,
        message: 'Reward not found'
      });
    }

    const totalPointsRequired = combo.loyaltyPointsRequired * quantity;
    
    const result = await loyaltyService.redeemPoints(
      req.user.id,
      totalPointsRequired,
      combo.name
    );

    const redemptionCode = `REDEEM${Date.now()}${Math.floor(Math.random() * 1000)}`;

    res.status(200).json({
      success: true,
      message: 'Reward redeemed successfully',
      redemption: {
        code: redemptionCode,
        combo: combo.name,
        quantity,
        pointsUsed: totalPointsRequired,
        remainingPoints: result.remainingPoints
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get loyalty history
// @route   GET /api/loyalty/history
// @access  Private
export const getLoyaltyHistory = async (req, res, next) => {
  try {
    const bookings = await Booking.find({
      userId: req.user.id,
      status: { $in: ['confirmed', 'used'] }
    })
      .select('bookingCode finalAmount loyaltyPointsEarned loyaltyPointsUsed createdAt')
      .sort('-createdAt')
      .limit(50);

    const history = bookings.map(booking => ({
      date: booking.createdAt,
      type: 'booking',
      description: `Booking ${booking.bookingCode}`,
      pointsEarned: booking.loyaltyPointsEarned,
      pointsUsed: booking.loyaltyPointsUsed,
      netPoints: booking.loyaltyPointsEarned - booking.loyaltyPointsUsed
    }));

    res.status(200).json({
      success: true,
      count: history.length,
      history
    });
  } catch (error) {
    next(error);
  }
};
