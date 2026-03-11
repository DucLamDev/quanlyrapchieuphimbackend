import Showtime from '../models/Showtime.model.js';
import Movie from '../models/Movie.model.js';
import Cinema from '../models/Cinema.model.js';

// @desc    Get all showtimes
// @route   GET /api/showtimes
// @access  Public
export const getShowtimes = async (req, res, next) => {
  try {
    const { movieId, cinemaId, date, page = 1, limit = 20 } = req.query;

    const query = { isActive: true };
    const now = new Date();

    if (movieId) query.movieId = movieId;
    if (cinemaId) query.cinemaId = cinemaId;
    
    // Nếu user là staff, chỉ hiển thị suất chiếu của rạp họ làm việc
    if (req.user && req.user.role === 'staff' && req.user.cinemaId) {
      query.cinemaId = req.user.cinemaId;
    }
    
    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      // If the date is today, only show showtimes from current time
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isToday = startOfDay.getTime() === today.getTime();
      
      if (isToday) {
        query.startTime = { $gte: now, $lte: endOfDay };
      } else {
        query.startTime = { $gte: startOfDay, $lte: endOfDay };
      }
    } else {
      query.startTime = { $gte: now };
    }

    const showtimes = await Showtime.find(query)
      .populate('movieId', 'title poster duration ageRating')
      .populate('cinemaId', 'name location')
      .sort('startTime')
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Showtime.countDocuments(query);

    res.status(200).json({
      success: true,
      count: showtimes.length,
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      showtimes
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single showtime
// @route   GET /api/showtimes/:id
// @access  Public
export const getShowtime = async (req, res, next) => {
  try {
    // Validate ObjectId format
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid showtime ID format'
      });
    }

    const showtime = await Showtime.findById(req.params.id)
      .populate('movieId')
      .populate('cinemaId');

    if (!showtime) {
      return res.status(404).json({
        success: false,
        message: 'Showtime not found'
      });
    }

    // Check if required references exist
    if (!showtime.movieId || !showtime.cinemaId) {
      return res.status(400).json({
        success: false,
        message: 'Showtime has invalid movie or cinema reference'
      });
    }

    // Update status
    try {
      showtime.updateStatus();
      await showtime.save();
    } catch (saveError) {
      // If save fails, still return the showtime data
      console.error('Error updating showtime status:', saveError);
    }

    res.status(200).json({
      success: true,
      showtime
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create showtime
// @route   POST /api/showtimes
// @access  Private/Admin
export const createShowtime = async (req, res, next) => {
  try {
    const { movieId, cinemaId, screenId, room, startTime, date, price } = req.body;

    // Verify movie and cinema exist
    const movie = await Movie.findById(movieId);
    const cinema = await Cinema.findById(cinemaId);

    if (!movie || !cinema) {
      return res.status(404).json({
        success: false,
        message: 'Movie or Cinema not found'
      });
    }

    // Handle room information - support both screenId and room object
    let roomInfo;
    let capacity = 150; // Default capacity

    if (room && room.name) {
      // Frontend sends room object directly
      roomInfo = {
        name: room.name,
        capacity: room.capacity || 150,
        type: room.type || 'standard'
      };
      capacity = roomInfo.capacity;
    } else if (screenId) {
      // Find screen in cinema by screenId
      const screen = cinema.screens.id(screenId);
      if (screen) {
        roomInfo = {
          name: screen.name,
          capacity: screen.capacity || screen.seats?.total || 150,
          type: screen.screenType === 'IMAX' ? 'imax' : screen.screenType === '4DX' ? '4dx' : 'standard'
        };
        capacity = roomInfo.capacity;
      }
    }

    // If no room info found, use default
    if (!roomInfo) {
      roomInfo = {
        name: 'Phòng 1',
        capacity: 150,
        type: 'standard'
      };
    }

    // Parse startTime properly
    const startDateTime = new Date(startTime);
    
    // Calculate end time
    const endTime = new Date(startDateTime);
    endTime.setMinutes(endTime.getMinutes() + movie.duration + 15); // +15 minutes for cleaning

    // Determine date from startTime if not provided
    const showtimeDate = date ? new Date(date) : new Date(startDateTime);
    showtimeDate.setHours(0, 0, 0, 0);

    // Check for conflicts
    const conflictingShowtime = await Showtime.findOne({
      cinemaId,
      'room.name': roomInfo.name,
      $or: [
        {
          startTime: { $lt: endTime },
          endTime: { $gt: startDateTime }
        }
      ],
      isActive: true
    });

    if (conflictingShowtime) {
      return res.status(400).json({
        success: false,
        message: 'Khung giờ này đã có suất chiếu khác trong cùng phòng'
      });
    }

    // Handle price - support both object format and cinema.priceList
    let priceInfo = price;
    if (!priceInfo || (!priceInfo.standard && !priceInfo.vip)) {
      priceInfo = {
        standard: 80000,
        vip: 120000,
        couple: 150000
      };
    }

    const showtime = await Showtime.create({
      movieId,
      cinemaId,
      room: roomInfo,
      screenId: screenId || null,
      startTime: startDateTime,
      endTime,
      date: showtimeDate,
      price: priceInfo,
      availableSeats: capacity,
      bookedSeats: [],
      status: 'scheduled',
      isActive: true
    });

    // Populate and return
    const populatedShowtime = await Showtime.findById(showtime._id)
      .populate('movieId', 'title poster duration')
      .populate('cinemaId', 'name location');

    res.status(201).json({
      success: true,
      showtime: populatedShowtime
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update showtime
// @route   PUT /api/showtimes/:id
// @access  Private/Admin
export const updateShowtime = async (req, res, next) => {
  try {
    let showtime = await Showtime.findById(req.params.id);

    if (!showtime) {
      return res.status(404).json({
        success: false,
        message: 'Showtime not found'
      });
    }

    showtime = await Showtime.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      showtime
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete showtime
// @route   DELETE /api/showtimes/:id
// @access  Private/Admin
export const deleteShowtime = async (req, res, next) => {
  try {
    const showtime = await Showtime.findById(req.params.id);

    if (!showtime) {
      return res.status(404).json({
        success: false,
        message: 'Showtime not found'
      });
    }

    // Check if there are bookings
    if (showtime.bookedSeats.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete showtime with existing bookings'
      });
    }

    showtime.isActive = false;
    await showtime.save();

    res.status(200).json({
      success: true,
      message: 'Showtime deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get showtimes by movie
// @route   GET /api/showtimes/movie/:movieId
// @access  Public
export const getShowtimesByMovie = async (req, res, next) => {
  try {
    const { movieId } = req.params;
    const { date, cinemaId } = req.query;

    const query = {
      movieId,
      isActive: true
    };

    const now = new Date();
    
    // If specific date provided, match that date
    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      // If the date is today, only show showtimes from current time
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isToday = startOfDay.getTime() === today.getTime();
      
      if (isToday) {
        query.startTime = { $gte: now, $lte: endOfDay };
      } else {
        query.startTime = { $gte: startOfDay, $lte: endOfDay };
      }
    } else {
      // Show all future showtimes
      query.startTime = { $gte: now };
    }

    if (cinemaId) query.cinemaId = cinemaId;
    
    // Nếu user là staff, chỉ hiển thị suất chiếu của rạp họ làm việc
    if (req.user && req.user.role === 'staff' && req.user.cinemaId) {
      query.cinemaId = req.user.cinemaId;
    }

    const showtimes = await Showtime.find(query)
      .populate('cinemaId', 'name location')
      .sort('startTime');

    res.status(200).json({
      success: true,
      count: showtimes.length,
      showtimes
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get showtimes by cinema
// @route   GET /api/showtimes/cinema/:cinemaId
// @access  Public
export const getShowtimesByCinema = async (req, res, next) => {
  try {
    const { cinemaId } = req.params;
    const { date, movieId } = req.query;

    const query = {
      cinemaId,
      isActive: true
    };

    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
      query.startTime = { $gte: startOfDay, $lte: endOfDay };
    } else {
      query.startTime = { $gte: new Date() };
    }

    if (movieId) query.movieId = movieId;

    const showtimes = await Showtime.find(query)
      .populate('movieId', 'title poster duration')
      .sort('startTime');

    res.status(200).json({
      success: true,
      count: showtimes.length,
      showtimes
    });
  } catch (error) {
    next(error);
  }
};
