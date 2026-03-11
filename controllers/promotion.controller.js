import Promotion from '../models/Promotion.model.js';
import Showtime from '../models/Showtime.model.js';

// @desc    Get all promotions
// @route   GET /api/promotions
// @access  Public
export const getPromotions = async (req, res, next) => {
  try {
    const { isActive, type } = req.query;

    const query = {
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() }
    };

    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (type) query.type = type;

    const promotions = await Promotion.find(query)
      .populate('applicableFor.movies', 'title poster')
      .populate('applicableFor.cinemas', 'name location')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: promotions.length,
      promotions
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single promotion
// @route   GET /api/promotions/:id
// @access  Public
export const getPromotion = async (req, res, next) => {
  try {
    const promotion = await Promotion.findById(req.params.id)
      .populate('applicableFor.movies', 'title poster')
      .populate('applicableFor.cinemas', 'name location');

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    res.status(200).json({
      success: true,
      promotion
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create promotion
// @route   POST /api/promotions
// @access  Private/Admin
export const createPromotion = async (req, res, next) => {
  try {
    req.body.createdBy = req.user.id;

    const promotion = await Promotion.create(req.body);

    res.status(201).json({
      success: true,
      promotion
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update promotion
// @route   PUT /api/promotions/:id
// @access  Private/Admin
export const updatePromotion = async (req, res, next) => {
  try {
    let promotion = await Promotion.findById(req.params.id);

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    promotion = await Promotion.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      promotion
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete promotion
// @route   DELETE /api/promotions/:id
// @access  Private/Admin
export const deletePromotion = async (req, res, next) => {
  try {
    const promotion = await Promotion.findById(req.params.id);

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    await promotion.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Promotion deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Validate promotion code
// @route   POST /api/promotions/validate
// @access  Private
export const validatePromotionCode = async (req, res, next) => {
  try {
    const { code, showtimeId, amount } = req.body;

    const promotion = await Promotion.findOne({
      code: code.toUpperCase(),
      isActive: true
    });

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Invalid promotion code'
      });
    }

    if (!promotion.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'Promotion is no longer valid'
      });
    }

    // Check minimum purchase amount
    if (amount < promotion.minPurchaseAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum purchase amount is ${promotion.minPurchaseAmount}`
      });
    }

    // Check if applicable for showtime
    if (showtimeId && promotion.applicableFor.showtimes.length > 0) {
      if (!promotion.applicableFor.showtimes.includes(showtimeId)) {
        return res.status(400).json({
          success: false,
          message: 'Promotion not applicable for this showtime'
        });
      }
    }

    // Check user tier
    const user = await User.findById(req.user.id);
    if (promotion.applicableFor.userTiers.length > 0) {
      if (!promotion.applicableFor.userTiers.includes(user.loyaltyTier)) {
        return res.status(400).json({
          success: false,
          message: 'Promotion not available for your membership tier'
        });
      }
    }

    // Calculate discount
    let discount = 0;
    if (promotion.type === 'percentage') {
      discount = (amount * promotion.value) / 100;
      if (promotion.maxDiscountAmount) {
        discount = Math.min(discount, promotion.maxDiscountAmount);
      }
    } else if (promotion.type === 'fixed-amount') {
      discount = promotion.value;
    }

    res.status(200).json({
      success: true,
      promotion: {
        code: promotion.code,
        name: promotion.name,
        type: promotion.type,
        discount,
        finalAmount: amount - discount
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Apply automatic promotions to showtimes
// @route   POST /api/promotions/apply-auto
// @access  Private/Admin
export const applyAutoPromotions = async (req, res, next) => {
  try {
    const autoPromotions = await Promotion.find({
      autoApply: true,
      isActive: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() }
    });

    let appliedCount = 0;

    for (const promotion of autoPromotions) {
      const { occupancyThreshold, timeBeforeShowtime } = promotion.autoApplyRules;

      if (occupancyThreshold) {
        // Find showtimes below occupancy threshold
        const showtimes = await Showtime.find({
          date: { $gte: new Date() },
          isActive: true
        });

        for (const showtime of showtimes) {
          const occupancy = showtime.getOccupancy();
          
          if (occupancy < occupancyThreshold) {
            const hoursUntil = (showtime.startTime - Date.now()) / (1000 * 60 * 60);
            
            if (!timeBeforeShowtime || hoursUntil <= timeBeforeShowtime) {
              // Apply special pricing
              showtime.specialPrice = {
                isActive: true,
                discount: promotion.value,
                reason: promotion.name
              };
              await showtime.save();
              appliedCount++;
            }
          }
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Applied automatic promotions to ${appliedCount} showtimes`
    });
  } catch (error) {
    next(error);
  }
};
