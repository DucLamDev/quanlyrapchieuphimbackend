import Stripe from 'stripe';
import Booking from '../models/Booking.model.js';

// Only initialize Stripe if API key is provided
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// @desc    Create payment intent
// @route   POST /api/payments/create-intent
// @access  Private
export const createPaymentIntent = async (req, res, next) => {
  try {
    const { amount, bookingId } = req.body;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check authorization: booking must belong to current user OR be created by staff/admin for walk-in customer
    const isOwner = booking.userId && booking.userId.toString() === req.user.id;
    const isStaffCreated = !booking.userId && 
                          booking.bookedBy && 
                          booking.bookedBy.userId && 
                          booking.bookedBy.userId.toString() === req.user.id;
    const isAdminOrStaff = ['admin', 'staff'].includes(req.user.role);

    if (!isOwner && !isStaffCreated && !isAdminOrStaff) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this booking'
      });
    }

    // Create payment intent with Stripe
    if (!stripe || !process.env.STRIPE_SECRET_KEY) {
      // Mock payment for development/testing
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️  Stripe API key not configured. Using mock payment for development.');
        const mockPaymentIntentId = `pi_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        return res.status(200).json({
          success: true,
          clientSecret: `mock_client_secret_${mockPaymentIntentId}`,
          paymentIntentId: mockPaymentIntentId,
          isMock: true
        });
      } else {
        return res.status(500).json({
          success: false,
          message: 'Payment service is not configured. Please contact support.'
        });
      }
    }

    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'vnd',
        metadata: {
          bookingId: booking._id.toString(),
          userId: req.user.id
        }
      });
    } catch (stripeError) {
      console.error('Stripe error:', stripeError);
      return res.status(500).json({
        success: false,
        message: 'Payment processing failed. Please try again or contact support.',
        error: process.env.NODE_ENV === 'development' ? stripeError.message : undefined
      });
    }

    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Confirm payment
// @route   POST /api/payments/confirm
// @access  Private
export const confirmPayment = async (req, res, next) => {
  try {
    const { paymentIntentId, bookingId } = req.body;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check authorization: booking must belong to current user OR be created by staff/admin for walk-in customer
    const isOwner = booking.userId && booking.userId.toString() === req.user.id;
    const isStaffCreated = !booking.userId && 
                          booking.bookedBy && 
                          booking.bookedBy.userId && 
                          booking.bookedBy.userId.toString() === req.user.id;
    const isAdminOrStaff = ['admin', 'staff'].includes(req.user.role);

    if (!isOwner && !isStaffCreated && !isAdminOrStaff) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this booking'
      });
    }

    // Verify payment with Stripe
    if (!stripe || !process.env.STRIPE_SECRET_KEY) {
      // Mock payment confirmation for development/testing
      if (process.env.NODE_ENV === 'development' && paymentIntentId.startsWith('pi_mock_')) {
        console.warn('⚠️  Using mock payment confirmation for development.');
        booking.paymentStatus = 'completed';
        booking.status = 'confirmed';
        booking.paymentDetails = {
          transactionId: paymentIntentId,
          paymentTime: new Date(),
          provider: 'mock'
        };
        await booking.save();

        return res.status(200).json({
          success: true,
          message: 'Payment confirmed successfully (Mock)',
          booking
        });
      } else {
        return res.status(500).json({
          success: false,
          message: 'Payment service is not configured. Please contact support.'
        });
      }
    }

    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (stripeError) {
      console.error('Stripe error:', stripeError);
      return res.status(500).json({
        success: false,
        message: 'Payment verification failed. Please try again or contact support.',
        error: process.env.NODE_ENV === 'development' ? stripeError.message : undefined
      });
    }

    if (paymentIntent.status === 'succeeded') {
      booking.paymentStatus = 'completed';
      booking.status = 'confirmed';
      booking.paymentDetails = {
        transactionId: paymentIntentId,
        paymentTime: new Date(),
        provider: 'stripe'
      };
      await booking.save();

      res.status(200).json({
        success: true,
        message: 'Payment confirmed successfully',
        booking
      });
    } else {
      booking.paymentStatus = 'failed';
      await booking.save();

      res.status(400).json({
        success: false,
        message: 'Payment failed'
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get payment history
// @route   GET /api/payments/history
// @access  Private
export const getPaymentHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const bookings = await Booking.find({
      userId: req.user.id,
      paymentStatus: 'completed'
    })
      .select('bookingCode finalAmount paymentMethod paymentDetails createdAt')
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Booking.countDocuments({
      userId: req.user.id,
      paymentStatus: 'completed'
    });

    res.status(200).json({
      success: true,
      count: bookings.length,
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      payments: bookings
    });
  } catch (error) {
    next(error);
  }
};
