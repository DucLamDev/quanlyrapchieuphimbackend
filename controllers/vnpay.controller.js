import crypto from 'crypto';
import querystring from 'qs';
import { logger } from '../utils/logger.js';
import Booking from '../models/Booking.model.js';

// VNPay configuration (from environment variables or defaults for development)
// IMPORTANT: For production, you MUST register your return URL with VNPay
// Error code 72 means the return URL is not registered in VNPay merchant settings
const vnpayConfig = {
  vnp_TmnCode: process.env.VNPAY_TMN_CODE || 'HBD6BLKB',
  vnp_HashSecret: process.env.VNPAY_HASH_SECRET || 'TU6878R6XO1QI5H68PL2XSPEV15DZQWR',
  vnp_Url: process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  // The return URL MUST be registered in your VNPay merchant account settings
  // Format: https://yourdomain.com/api/payments/vnpay/callback (for backend)
  // OR: https://yourdomain.com/payment-result (for frontend)
  vnp_ReturnUrl: process.env.VNPAY_RETURN_URL || 'http://localhost:3000/payment-result'
};

/**
 * Sort object by key
 */
function sortObject(obj) {
  const sorted = {};
  const str = [];
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (let key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, '+');
  }
  return sorted;
}

/**
 * Create VNPay payment URL
 * @route   POST /api/payments/vnpay/create
 * @access  Private
 */
export const createVNPayPayment = async (req, res, next) => {
  try {
    const { bookingId, amount, orderInfo, returnUrl } = req.body;

    // Validate VNPay configuration
    if (vnpayConfig.vnp_TmnCode === 'DEMO_TMN_CODE' || vnpayConfig.vnp_HashSecret === 'DEMO_HASH_SECRET') {
      logger.warn('VNPay not configured properly. Using demo credentials.');
      return res.status(400).json({
        success: false,
        message: 'VNPay chưa được cấu hình. Vui lòng liên hệ quản trị viên.',
        error: 'VNPAY_NOT_CONFIGURED',
        hint: 'Set VNPAY_TMN_CODE and VNPAY_HASH_SECRET in .env file'
      });
    }

    // Verify booking exists and belongs to user
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this booking'
      });
    }

    // Create VNPay payment parameters
    const date = new Date();
    const createDate = date.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const orderId = `${bookingId}_${Date.now()}`;

    let vnp_Params = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: vnpayConfig.vnp_TmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: orderId,
      vnp_OrderInfo: orderInfo || `Thanh toan ve xem phim - ${booking.bookingCode}`,
      vnp_OrderType: 'other',
      vnp_Amount: amount * 100, // VNPay requires amount in VND * 100
      vnp_ReturnUrl: returnUrl || vnpayConfig.vnp_ReturnUrl,
      vnp_IpAddr: req.ip || req.connection.remoteAddress || '127.0.0.1',
      vnp_CreateDate: createDate
    };

    // Sort params and create secure hash
    vnp_Params = sortObject(vnp_Params);
    const signData = querystring.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac('sha512', vnpayConfig.vnp_HashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    vnp_Params['vnp_SecureHash'] = signed;

    // Create payment URL
    const paymentUrl = vnpayConfig.vnp_Url + '?' + querystring.stringify(vnp_Params, { encode: false });

    logger.info(`VNPay payment created for booking: ${bookingId}`);

    res.status(200).json({
      success: true,
      paymentUrl,
      orderId
    });
  } catch (error) {
    logger.error('Error creating VNPay payment:', error);
    next(error);
  }
};

/**
 * Verify VNPay callback and update booking
 * @route   GET /api/payments/vnpay/callback
 * @access  Public (VNPay callback)
 */
export const verifyVNPayCallback = async (req, res, next) => {
  try {
    let vnp_Params = req.query;
    const secureHash = vnp_Params['vnp_SecureHash'];

    // Log callback data for debugging
    logger.info('VNPay callback received:', {
      txnRef: vnp_Params['vnp_TxnRef'],
      responseCode: vnp_Params['vnp_ResponseCode'],
      amount: vnp_Params['vnp_Amount']
    });

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);
    const signData = querystring.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac('sha512', vnpayConfig.vnp_HashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (secureHash === signed) {
      const orderId = vnp_Params['vnp_TxnRef'];
      const rspCode = vnp_Params['vnp_ResponseCode'];
      const amount = vnp_Params['vnp_Amount'] / 100;

      // Extract booking ID from order ID (format: bookingId_timestamp)
      const bookingId = orderId.split('_')[0];
      
      logger.info(`Extracted booking ID: ${bookingId} from order ID: ${orderId}`);

      // Update booking payment status
      if (rspCode === '00') {
        // Payment successful - also update status to 'confirmed'
        const booking = await Booking.findByIdAndUpdate(
          bookingId,
          {
            status: 'confirmed', // IMPORTANT: Update booking status to confirmed
            paymentStatus: 'paid',
            paymentMethod: 'vnpay',
            paymentDate: new Date(),
            vnpayData: {
              transactionId: vnp_Params['vnp_TransactionNo'],
              orderId,
              amount,
              bankCode: vnp_Params['vnp_BankCode'],
              responseCode: rspCode,
              payDate: vnp_Params['vnp_PayDate']
            }
          },
          { new: true }
        ).populate('showtimeId');

        if (!booking) {
          logger.error(`Booking not found: ${bookingId}`);
          return res.status(404).json({
            success: false,
            message: 'Booking not found'
          });
        }

        logger.info(`VNPay payment successful for booking: ${bookingId}, status updated to confirmed`);

        return res.status(200).json({
          success: true,
          message: 'Payment successful',
          booking
        });
      } else {
        // Payment failed
        const booking = await Booking.findByIdAndUpdate(
          bookingId,
          {
            status: 'cancelled',
            paymentStatus: 'failed',
            vnpayData: {
              orderId,
              responseCode: rspCode,
              failReason: `VNPay response code: ${rspCode}`
            }
          },
          { new: true }
        );

        logger.warn(`VNPay payment failed for booking: ${bookingId}, code: ${rspCode}`);

        return res.status(400).json({
          success: false,
          message: 'Payment failed',
          responseCode: rspCode,
          booking
        });
      }
    } else {
      logger.error('VNPay secure hash validation failed');
      return res.status(400).json({
        success: false,
        message: 'Invalid secure hash'
      });
    }
  } catch (error) {
    logger.error('Error verifying VNPay callback:', error);
    next(error);
  }
};

/**
 * Check VNPay payment status
 * @route   GET /api/payments/vnpay/status/:bookingId
 * @access  Private
 */
export const checkVNPayStatus = async (req, res, next) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId).select('paymentStatus paymentMethod vnpayData');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.status(200).json({
      success: true,
      paymentStatus: booking.paymentStatus,
      paymentMethod: booking.paymentMethod,
      vnpayData: booking.vnpayData
    });
  } catch (error) {
    logger.error('Error checking VNPay status:', error);
    next(error);
  }
};
