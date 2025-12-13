import Cinema from '../models/Cinema.model.js';
import Showtime from '../models/Showtime.model.js';

// @desc    Get all cinemas
// @route   GET /api/cinemas
// @access  Public
export const getCinemas = async (req, res, next) => {
  try {
    const { city, page = 1, limit = 10 } = req.query;

    const query = { isActive: true };
    if (city) query['location.city'] = city;

    const cinemas = await Cinema.find(query)
      .sort('name')
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Cinema.countDocuments(query);

    res.status(200).json({
      success: true,
      count: cinemas.length,
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      cinemas
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single cinema
// @route   GET /api/cinemas/:id
// @access  Public
export const getCinema = async (req, res, next) => {
  try {
    const cinema = await Cinema.findById(req.params.id);

    if (!cinema) {
      return res.status(404).json({
        success: false,
        message: 'Cinema not found'
      });
    }

    // Get upcoming showtimes
    const showtimes = await Showtime.find({
      cinemaId: cinema._id,
      date: { $gte: new Date() },
      isActive: true
    })
      .populate('movieId', 'title poster duration')
      .sort('startTime')
      .limit(20);

    res.status(200).json({
      success: true,
      cinema,
      showtimes
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create cinema
// @route   POST /api/cinemas
// @access  Private/Admin
export const createCinema = async (req, res, next) => {
  try {
    const cinema = await Cinema.create(req.body);

    res.status(201).json({
      success: true,
      cinema
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update cinema
// @route   PUT /api/cinemas/:id
// @access  Private/Admin
export const updateCinema = async (req, res, next) => {
  try {
    let cinema = await Cinema.findById(req.params.id);

    if (!cinema) {
      return res.status(404).json({
        success: false,
        message: 'Cinema not found'
      });
    }

    cinema = await Cinema.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      cinema
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete cinema
// @route   DELETE /api/cinemas/:id
// @access  Private/Admin
export const deleteCinema = async (req, res, next) => {
  try {
    const cinema = await Cinema.findById(req.params.id);

    if (!cinema) {
      return res.status(404).json({
        success: false,
        message: 'Cinema not found'
      });
    }

    cinema.isActive = false;
    await cinema.save();

    res.status(200).json({
      success: true,
      message: 'Cinema deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get nearest cinemas
// @route   GET /api/cinemas/nearest
// @access  Public
export const getNearestCinemas = async (req, res, next) => {
  try {
    const { lat, lng, maxDistance = 10000 } = req.query; // maxDistance in meters

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const cinemas = await Cinema.find({
      isActive: true,
      'location.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseInt(maxDistance)
        }
      }
    }).limit(10);

    res.status(200).json({
      success: true,
      count: cinemas.length,
      cinemas
    });
  } catch (error) {
    next(error);
  }
};
