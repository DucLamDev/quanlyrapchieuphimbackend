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

    if (movieId) query.movieId = movieId;
    if (cinemaId) query.cinemaId = cinemaId;
    
    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
      query.startTime = { $gte: startOfDay, $lte: endOfDay };
    } else {
      query.startTime = { $gte: new Date() };
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
    const showtime = await Showtime.findById(req.params.id)
      .populate('movieId')
      .populate('cinemaId');

    if (!showtime) {
      return res.status(404).json({
        success: false,
        message: 'Showtime not found'
      });
    }

    // Update status
    showtime.updateStatus();
    await showtime.save();

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
    const { movieId, cinemaId, screenId, startTime, date, price } = req.body;

    // Verify movie and cinema exist
    const movie = await Movie.findById(movieId);
    const cinema = await Cinema.findById(cinemaId);

    if (!movie || !cinema) {
      return res.status(404).json({
        success: false,
        message: 'Movie or Cinema not found'
      });
    }

    // Find screen in cinema
    const screen = cinema.screens.id(screenId);
    if (!screen) {
      return res.status(404).json({
        success: false,
        message: 'Screen not found'
      });
    }

    // Calculate end time
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + movie.duration + 15); // +15 minutes for cleaning

    // Check for conflicts
    const conflictingShowtime = await Showtime.findOne({
      cinemaId,
      screenId,
      date: new Date(date),
      $or: [
        {
          startTime: { $lt: endTime },
          endTime: { $gt: new Date(startTime) }
        }
      ],
      isActive: true
    });

    if (conflictingShowtime) {
      return res.status(400).json({
        success: false,
        message: 'Time slot conflicts with existing showtime'
      });
    }

    const showtime = await Showtime.create({
      movieId,
      cinemaId,
      screenId,
      startTime: new Date(startTime),
      endTime,
      date: new Date(date),
      price: price || cinema.priceList,
      availableSeats: screen.seats.total
    });

    res.status(201).json({
      success: true,
      showtime
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

    // If specific date provided, match that date
    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
      query.startTime = { $gte: startOfDay, $lte: endOfDay };
    } else {
      // Show all future showtimes
      query.startTime = { $gte: new Date() };
    }

    if (cinemaId) query.cinemaId = cinemaId;

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
