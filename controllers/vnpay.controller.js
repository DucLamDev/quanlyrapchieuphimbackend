import crypto from 'crypto';
import querystring from 'qs';
import { logger } from '../utils/logger.js';
import Booking from '../models/Booking.model.js';

// VNPay configuration (from environment variables or defaults for development)
// IMPORTANT: For VNPay Sandbox, the return URL must be exactly as registered
// Common VNPay Sandbox errors:
// - Error 71: Website not approved - Return URL not registered
// - Error 72: Return URL not whitelisted
// Solution: Use backend callback URL instead of frontend URL
const vnpayConfig = {
  vnp_TmnCode:'DQHQPG5E',
  vnp_HashSecret:'02DLOYH8VBLQSX6QXX02K5PDR2AU1G84',
  vnp_Url:'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  // IMPORTANT: This URL MUST be registered in VNPay Sandbox merchant settings
  // Go to: https://sandbox.vnpayment.vn/merchantv2/ → Cấu hình → Cấu hình thông báo
  // Add this URL: http://localhost:5000/api/payments/vnpay/callback
  // OR use ngrok/cloudflare tunnel for public URL
  vnp_ReturnUrl:'https://quanlyrapchieuphimbackend.onrender.com/api/payments/vnpay/callback'
};

/**
 * Sort object by key
 */
function sortObject(obj) {
  const sorted = {};
  const str = [];
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      str.push(key);
    }
  }
  str.sort();
  for (let key = 0; key < str.length; key++) {
    sorted[str[key]] = obj[str[key]];
  }
  return sorted;
}

function buildVNPayHashData(params) {
  return Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key])).replace(/%20/g, '+')}`)
    .join('&');
}

function buildVNPayQuery(params) {
  return Object.keys(params)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key])).replace(/%20/g, '+')}`)
    .join('&');
}

function formatVNPayDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function sanitizeOrderInfo(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Create VNPay payment URL
 * @route   POST /api/payments/vnpay/create
 * @access  Private
 */
export const createVNPayPayment = async (req, res, next) => {
  try {
    const { bookingId, amount, orderInfo } = req.body;

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
    const expireDateObj = new Date(date.getTime() + 15 * 60 * 1000);
    const createDate = formatVNPayDate(date);
    const expireDate = formatVNPayDate(expireDateObj);
    const orderId = `${bookingId}_${Date.now()}`;
    const safeOrderInfo = sanitizeOrderInfo(orderInfo || `Thanh toan ve xem phim Ma dat ve ${booking.bookingCode}`);

    let vnp_Params = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: vnpayConfig.vnp_TmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: orderId,
      vnp_OrderInfo: safeOrderInfo,
      vnp_OrderType: 'other',
      vnp_Amount: amount * 100, // VNPay requires amount in VND * 100
      vnp_ReturnUrl: vnpayConfig.vnp_ReturnUrl,
      vnp_IpAddr: '127.0.0.1',
      vnp_CreateDate: createDate,
      vnp_ExpireDate: expireDate
    };

    // Sort params and create secure hash
    vnp_Params = sortObject(vnp_Params);
    const signData = buildVNPayHashData(vnp_Params);
    const hmac = crypto.createHmac('sha512', vnpayConfig.vnp_HashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    vnp_Params['vnp_SecureHash'] = signed;

    // Create payment URL
    const paymentUrl = vnpayConfig.vnp_Url + '?' + buildVNPayQuery(vnp_Params);

    logger.info('VNPay signed payload created', {
      bookingId,
      orderId,
      signData,
      returnUrl: vnp_Params.vnp_ReturnUrl,
      createDate: vnp_Params.vnp_CreateDate,
      expireDate: vnp_Params.vnp_ExpireDate
    });

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
    const signData = buildVNPayHashData(vnp_Params);
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
          // Redirect to frontend with error
          return res.redirect(`http://localhost:3000/payment/vnpay-callback?success=false&message=Booking+not+found`);
        }

        logger.info(`VNPay payment successful for booking: ${bookingId}, status updated to confirmed`);

        // Redirect to frontend success page with booking ID
        return res.redirect(`http://localhost:3000/payment/vnpay-callback?success=true&bookingId=${bookingId}&responseCode=${rspCode}`);
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

        // Redirect to frontend with failure
        return res.redirect(`http://localhost:3000/payment/vnpay-callback?success=false&responseCode=${rspCode}&bookingId=${bookingId}`);
      }
    } else {
      logger.error('VNPay secure hash validation failed', {
        receivedSecureHash: secureHash,
        calculatedSecureHash: signed,
        signData
      });
      // Redirect to frontend with error
      return res.redirect(`http://localhost:3000/payment/vnpay-callback?success=false&message=Invalid+secure+hash`);
    }
  } catch (error) {
    logger.error('Error verifying VNPay callback:', error);
    // Redirect to frontend with error
    return res.redirect(`http://localhost:3000/payment/vnpay-callback?success=false&message=Server+error`);
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
