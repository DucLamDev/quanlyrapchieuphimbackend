import mongoose from 'mongoose';
import Booking from '../models/Booking.model.js';
import Showtime from '../models/Showtime.model.js';
import User from '../models/User.model.js';
import Movie from '../models/Movie.model.js';
import { generateBookingQR } from '../utils/qrcode.js';
import { sendBookingConfirmation } from '../utils/email.js';

// @desc    Create booking
// @route   POST /api/bookings
// @access  Private
export const createBooking = async (req, res, next) => {
  try {
    const { showtimeId, seats, combos, paymentMethod, promotionCode, customerPhone, customerName } = req.body;

    // Get showtime
    const showtime = await Showtime.findById(showtimeId)
      .populate('movieId')
      .populate('cinemaId');

    if (!showtime) {
      return res.status(404).json({
        success: false,
        message: 'Showtime not found'
      });
    }

    // Get staff user để check quyền
    const staffUser = await User.findById(req.user.id);
    
    // Nếu là staff, check cinemaId
    if (staffUser.role === 'staff') {
      if (!staffUser.cinemaId) {
        return res.status(403).json({
          success: false,
          message: 'Staff chưa được gán rạp'
        });
      }
      
      // Staff chỉ đặt vé cho rạp của họ
      if (showtime.cinemaId._id.toString() !== staffUser.cinemaId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Bạn chỉ có thể đặt vé cho rạp của mình'
        });
      }
    }

    // Check seat availability with fresh data to prevent race conditions
    const freshShowtime = await Showtime.findById(showtimeId);
    if (!freshShowtime) {
      return res.status(404).json({
        success: false,
        message: 'Showtime not found'
      });
    }

    const requestedSeats = seats.map(s => `${s.row}${s.number}`);
    const bookedSeatIds = (freshShowtime.bookedSeats || []).map(s => `${s.row}${s.number}`);
    const unavailableSeats = requestedSeats.filter(s => bookedSeatIds.includes(s));

    if (unavailableSeats.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Some seats are already booked',
        unavailableSeats
      });
    }

    // Calculate total amount using showtime prices
    let totalAmount = 0;
    const seatDetails = seats.map(seat => {
      const price = showtime.price[seat.type] || showtime.price.standard || 100000;
      totalAmount += price;
      return { ...seat, price };
    });

    // Add combos
    if (combos && combos.length > 0) {
      combos.forEach(combo => {
        totalAmount += combo.price * combo.quantity;
      });
    }

    // Apply promotion if any
    let discount = 0;
    if (promotionCode) {
      // TODO: Apply promotion logic
    }

    // Xử lý khách hàng
    let customer = null;
    let isWalkInCustomer = false;
    const isCounterBooking = staffUser.role === 'staff' || staffUser.role === 'admin';
    
    if (isCounterBooking && customerPhone) {
      // Đặt vé tại quầy - tìm hoặc tạo khách vãng lai
      customer = await User.findOne({ phone: customerPhone });
      
      if (!customer) {
        // Khách vãng lai - không có account
        isWalkInCustomer = true;
        customer = {
          _id: null,
          phone: customerPhone,
          fullName: customerName || 'Khách vãng lai',
          loyaltyPoints: 0,
          loyaltyTier: 'bronze'
        };
      }
    } else {
      // Đặt vé online - dùng user đang đăng nhập
      customer = await User.findById(req.user.id);
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
    }

    const loyaltyPointsUsed = req.body.loyaltyPointsUsed || 0;
    const userLoyaltyPoints = customer.loyaltyPoints || 0;
    
    if (loyaltyPointsUsed > userLoyaltyPoints) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient loyalty points'
      });
    }

    const finalAmount = Math.max(0, totalAmount - discount - (loyaltyPointsUsed * 1000)); // 1 point = 1000 VND

    // Generate unique booking code
    const bookingCode = `BK${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Process combos - validate ObjectId
    const processedCombos = (combos || []).map(combo => {
      const comboId = combo.comboId || combo._id;
      const isValidObjectId = mongoose.Types.ObjectId.isValid(comboId) && String(comboId).length === 24;
      
      return {
        ...(isValidObjectId && { comboId }),
        name: combo.name,
        quantity: combo.quantity,
        price: combo.price
      };
    });

    // Prepare discount object
    const discountData = promotionCode ? {
      amount: discount || 0,
      code: promotionCode,
      type: 'promotion'
    } : null;

    // Create booking
    const bookingData = {
      bookingCode,
      showtimeId,
      movieId: showtime.movieId._id,
      cinemaId: showtime.cinemaId._id,
      seats: seatDetails,
      combos: processedCombos,
      totalAmount,
      discount: discountData,
      loyaltyPointsUsed,
      loyaltyPointsEarned: isWalkInCustomer ? 0 : Math.floor(finalAmount * 0.01),
      finalAmount,
      paymentMethod: req.body.paymentMethod || 'cash',
      paymentStatus: isCounterBooking ? 'paid' : 'pending',
      bookingType: isCounterBooking ? 'counter' : 'online',
      bookedBy: {
        userId: req.user.id,
        role: staffUser.role || 'customer',
        name: staffUser.fullName || staffUser.email
      }
    };
    
    // Thêm userId nếu không phải khách vãng lai
    if (!isWalkInCustomer && customer._id) {
      bookingData.userId = customer._id;
    } else if (isWalkInCustomer) {
      // Lưu thông tin khách vãng lai
      bookingData.customerInfo = {
        phone: customer.phone,
        name: customer.fullName
      };
    }
    
    const booking = await Booking.create(bookingData);

    // Update showtime seats atomically to prevent race conditions
    const seatsToAdd = seatDetails.map(s => ({
      row: String(s.row),
      number: Number(s.number),
      type: String(s.type),
      bookingId: booking._id instanceof mongoose.Types.ObjectId ? booking._id : new mongoose.Types.ObjectId(booking._id)
    }));
    
    // Check again for conflicts and update atomically
    const bookedSeatIdentifiers = seatsToAdd.map(s => `${s.row}${s.number}`);
    const updateResult = await mongoose.connection.db.collection('showtimes').updateOne(
      { 
        _id: new mongoose.Types.ObjectId(showtimeId),
        bookedSeats: { 
          $not: { 
            $elemMatch: { 
              $or: bookedSeatIdentifiers.map(id => ({
                $and: [
                  { row: id.charAt(0) },
                  { number: parseInt(id.substring(1)) }
                ]
              }))
            } 
          } 
        }
      },
      {
        $push: { bookedSeats: { $each: seatsToAdd } },
        $inc: { availableSeats: -seats.length }
      }
    );

    // If no document was modified, seats were already booked
    if (updateResult.matchedCount === 0 || updateResult.modifiedCount === 0) {
      // Delete the booking that was just created
      await Booking.findByIdAndDelete(booking._id);
      return res.status(400).json({
        success: false,
        message: 'Selected seats are no longer available. Please refresh and try again.',
        error: 'SEAT_CONFLICT'
      });
    }

    // Update customer loyalty points (nếu không phải khách vãng lai)
    if (!isWalkInCustomer && customer._id) {
      customer.loyaltyPoints = (customer.loyaltyPoints || 0) - loyaltyPointsUsed + booking.loyaltyPointsEarned;
      
      // Update loyalty tier based on points
      if (customer.loyaltyPoints >= 10000) {
        customer.loyaltyTier = 'platinum';
      } else if (customer.loyaltyPoints >= 5000) {
        customer.loyaltyTier = 'gold';
      } else if (customer.loyaltyPoints >= 2000) {
        customer.loyaltyTier = 'silver';
      } else {
        customer.loyaltyTier = 'bronze';
      }
      
      await customer.save();
    }

    // Generate QR code
    const qrCode = await generateBookingQR(booking);
    booking.qrCode = qrCode;
    await booking.save();

    // Send confirmation email
    await sendBookingConfirmation(booking, customer);

    // Populate booking data before sending response
    const populatedBooking = await Booking.findById(booking._id)
      .populate('userId', 'fullName email phone')
      .populate('movieId', 'title poster')
      .populate('cinemaId', 'name')
      .populate({
        path: 'showtimeId',
        populate: [
          { path: 'movieId', select: 'title poster duration' },
          { path: 'cinemaId', select: 'name location' }
        ]
      });

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`showtime-${showtimeId}`).emit('booking-update', {
      showtimeId,
      availableSeats: showtime.availableSeats,
      bookedSeats: showtime.bookedSeats
    });

    res.status(201).json({
      success: true,
      booking: populatedBooking
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get my bookings
// @route   GET /api/bookings/my-bookings
// @access  Private
export const getMyBookings = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = { userId: req.user.id };
    if (status) query.status = status;

    const bookings = await Booking.find(query)
      .populate('movieId', 'title poster duration')
      .populate('cinemaId', 'name location')
      .populate('showtimeId', 'startTime date')
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      count: bookings.length,
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      bookings
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single booking
// @route   GET /api/bookings/:id
// @access  Private
export const getBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('movieId')
      .populate('cinemaId')
      .populate('showtimeId')
      .populate('userId', 'fullName email phone');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check ownership - allow staff/admin or owner
    if (!['admin', 'staff'].includes(req.user.role)) {
      // For customers, check if they own the booking
      if (!booking.userId || booking.userId._id.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this booking'
        });
      }
    }

    res.status(200).json({
      success: true,
      booking
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel booking
// @route   PUT /api/bookings/:id/cancel
// @access  Private
export const cancelBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check ownership
    if (booking.userId.toString() !== req.user.id && 
        !['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this booking'
      });
    }

    // Check if booking can be cancelled
    const showtime = await Showtime.findById(booking.showtimeId);
    const hoursUntilShowtime = (showtime.startTime - Date.now()) / (1000 * 60 * 60);

    if (hoursUntilShowtime < 2) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel booking less than 2 hours before showtime'
      });
    }

    // Release seats
    showtime.bookedSeats = showtime.bookedSeats.filter(
      s => s.bookingId.toString() !== booking._id.toString()
    );
    showtime.availableSeats += booking.seats.length;
    await showtime.save();

    // Refund loyalty points
    const user = await User.findById(booking.userId);
    user.loyaltyPoints += booking.loyaltyPointsUsed;
    user.loyaltyPoints -= booking.loyaltyPointsEarned;
    await user.save();

    // Update booking status
    booking.status = 'cancelled';
    booking.cancellationReason = req.body.reason;
    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      booking
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check-in booking
// @route   PUT /api/bookings/:id/checkin
// @access  Private (Staff/Admin)
export const checkInBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('userId', 'fullName email phone')
      .populate('movieId', 'title poster')
      .populate('cinemaId', 'name')
      .populate({
        path: 'showtimeId',
        populate: [
          { path: 'movieId', select: 'title poster duration' },
          { path: 'cinemaId', select: 'name location' }
        ]
      });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status === 'used') {
      return res.status(400).json({
        success: false,
        message: 'Booking already checked in'
      });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Only confirmed bookings can be checked in'
      });
    }

    booking.status = 'used';
    booking.isCheckedIn = true;
    booking.checkInTime = Date.now();
    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Check-in successful',
      booking
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all bookings (Admin/Staff)
// @route   GET /api/bookings
// @access  Private (Staff/Admin)
export const getAllBookings = async (req, res, next) => {
  try {
    const { status, cinemaId, date, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (cinemaId) query.cinemaId = cinemaId;
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.createdAt = { $gte: startDate, $lt: endDate };
    }

    // Nếu là staff, chỉ hiển thị booking của rạp họ
    const user = await User.findById(req.user.id);
    if (user.role === 'staff' && user.cinemaId) {
      query.cinemaId = user.cinemaId;
    }

    const bookings = await Booking.find(query)
      .populate('userId', 'fullName email phone')
      .populate('movieId', 'title poster')
      .populate('cinemaId', 'name')
      .populate({
        path: 'showtimeId',
        populate: [
          { path: 'movieId', select: 'title poster duration' },
          { path: 'cinemaId', select: 'name location' }
        ]
      })
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      count: bookings.length,
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      bookings
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Refund booking
// @route   PUT /api/bookings/:id/refund
// @access  Private (Staff/Admin)
export const refundBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    booking.paymentStatus = 'refunded';
    booking.refundAmount = req.body.refundAmount || booking.finalAmount;
    booking.refundTime = Date.now();
    booking.status = 'cancelled';
    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Booking refunded successfully',
      booking
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create group booking
// @route   POST /api/bookings/group
// @access  Private
export const createGroupBooking = async (req, res, next) => {
  try {
    const { showtimeId, seats, participants } = req.body;

    // Create main booking
    const booking = await createBooking(req, res, next);

    // Generate share link
    const shareLink = `${process.env.FRONTEND_URL}/join-booking/${booking._id}`;
    
    booking.groupBooking = {
      isGroup: true,
      shareLink,
      participants: participants.map(p => ({
        userId: p,
        status: 'pending'
      }))
    };
    
    await booking.save();

    res.status(201).json({
      success: true,
      booking,
      shareLink
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate printable ticket PDF with QR code
// @route   GET /api/bookings/:id/print-ticket
// @access  Private/Staff/Admin
export const generatePrintableTicket = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('movieId')
      .populate('showtimeId')
      .populate('cinemaId')
      .populate('userId');
    
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy booking' 
      });
    }
    
    // Return ticket data for frontend to generate PDF
    const showtimeDate = new Date(booking.showtimeId.startTime);
    
    const ticketData = {
      bookingCode: booking.bookingCode,
      qrCode: booking.qrCode,
      movie: {
        title: booking.movieId.title,
        duration: booking.movieId.duration,
        ageRating: booking.movieId.ageRating
      },
      cinema: {
        name: booking.cinemaId.name,
        address: booking.cinemaId.address
      },
      showtime: {
        date: showtimeDate.toLocaleDateString('vi-VN', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        time: showtimeDate.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        screen: booking.showtimeId.screen
      },
      seats: booking.seats.map(s => `${s.row}${s.number}`).join(', '),
      combos: booking.combos || [],
      totalAmount: booking.totalAmount,
      customer: {
        name: booking.userId?.fullName || 'Khách hàng',
        email: booking.userId?.email || ''
      },
      createdAt: new Date(booking.createdAt).toLocaleDateString('vi-VN')
    };
    
    res.status(200).json({
      success: true,
      data: ticketData
    });
  } catch (error) {
    next(error);
  }
};
