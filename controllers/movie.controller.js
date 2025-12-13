import Movie from '../models/Movie.model.js';
import Showtime from '../models/Showtime.model.js';

// @desc    Get all movies with filters
// @route   GET /api/movies
// @access  Public
export const getMovies = async (req, res, next) => {
  try {
    const { 
      status, 
      genre, 
      language, 
      ageRating, 
      page = 1, 
      limit = 12,
      sort = '-createdAt'
    } = req.query;

    const query = { isActive: true };

    if (status) query.status = status;
    if (genre) query.genres = genre;
    if (language) query.language = language;
    if (ageRating) query.ageRating = ageRating;

    const movies = await Movie.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await Movie.countDocuments(query);

    res.status(200).json({
      success: true,
      count: movies.length,
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      movies
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single movie
// @route   GET /api/movies/:id
// @access  Public
export const getMovie = async (req, res, next) => {
  try {
    const movie = await Movie.findById(req.params.id);

    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    // Update view count
    movie.viewCount += 1;
    await movie.save();

    // Get available showtimes
    const showtimes = await Showtime.find({
      movieId: movie._id,
      date: { $gte: new Date() },
      isActive: true
    })
      .populate('cinemaId', 'name location')
      .sort('startTime')
      .limit(10);

    res.status(200).json({
      success: true,
      movie,
      showtimes
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new movie
// @route   POST /api/movies
// @access  Private/Admin
export const createMovie = async (req, res, next) => {
  try {
    const movie = await Movie.create(req.body);

    res.status(201).json({
      success: true,
      movie
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update movie
// @route   PUT /api/movies/:id
// @access  Private/Admin
export const updateMovie = async (req, res, next) => {
  try {
    let movie = await Movie.findById(req.params.id);

    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    movie = await Movie.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    // Update status based on dates
    movie.updateStatus();
    await movie.save();

    res.status(200).json({
      success: true,
      movie
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete movie
// @route   DELETE /api/movies/:id
// @access  Private/Admin
export const deleteMovie = async (req, res, next) => {
  try {
    const movie = await Movie.findById(req.params.id);

    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    // Soft delete
    movie.isActive = false;
    await movie.save();

    res.status(200).json({
      success: true,
      message: 'Movie deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get now showing movies
// @route   GET /api/movies/now-showing
// @access  Public
export const getNowShowing = async (req, res, next) => {
  try {
    const movies = await Movie.find({
      status: 'now-showing',
      isActive: true
    })
      .sort('-rating.average')
      .limit(20);

    res.status(200).json({
      success: true,
      count: movies.length,
      movies
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get coming soon movies
// @route   GET /api/movies/coming-soon
// @access  Public
export const getComingSoon = async (req, res, next) => {
  try {
    const movies = await Movie.find({
      status: 'coming-soon',
      isActive: true
    })
      .sort('releaseDate')
      .limit(20);

    res.status(200).json({
      success: true,
      count: movies.length,
      movies
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Search movies
// @route   GET /api/movies/search
// @access  Public
export const searchMovies = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const movies = await Movie.find(
      {
        $text: { $search: q },
        isActive: true
      },
      {
        score: { $meta: 'textScore' }
      }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(20);

    res.status(200).json({
      success: true,
      count: movies.length,
      movies
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get movie statistics
// @route   GET /api/movies/:id/stats
// @access  Public
export const getMovieStats = async (req, res, next) => {
  try {
    const movie = await Movie.findById(req.params.id);

    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    const showtimeCount = await Showtime.countDocuments({
      movieId: movie._id,
      isActive: true
    });

    const stats = {
      viewCount: movie.viewCount,
      ticketsSold: movie.ticketsSold,
      revenue: movie.revenue,
      rating: movie.rating,
      showtimeCount
    };

    res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    next(error);
  }
};
