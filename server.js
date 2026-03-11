import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';

// Import routes
import authRoutes from './routes/auth.routes.js';
import movieRoutes from './routes/movie.routes.js';
import cinemaRoutes from './routes/cinema.routes.js';
import showtimeRoutes from './routes/showtime.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import userRoutes from './routes/user.routes.js';
import reviewRoutes from './routes/review.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import loyaltyRoutes from './routes/loyalty.routes.js';
import revenueRoutes from './routes/revenue.routes.js';
import recommendationRoutes from './routes/recommendation.routes.js';
import crowdPredictionRoutes from './routes/crowdPrediction.routes.js';
import chatbotRoutes from './routes/chatbot.routes.js';
import promotionRoutes from './routes/promotion.routes.js';

// Import middleware
import { errorHandler } from './middleware/error.middleware.js';
import { logger } from './utils/logger.js';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }
});

// Middleware
app.use(helmet()); // Security headers
app.use(compression()); // Compress responses
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/cinemas', cinemaRoutes);
app.use('/api/showtimes', showtimeRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/revenue', revenueRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/crowd-prediction', crowdPredictionRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/promotions', promotionRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  logger.info(`New client connected: ${socket.id}`);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    logger.info(`Client ${socket.id} joined room ${roomId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Make io accessible to routes
app.set('io', io);

// Database connection
const connectDB = async () => {
  try {
    // MongoDB connection string - Atlas or Local fallback
    const mongoUri = process.env.MONGODB_URI || 
      'mongodb://localhost:27017/cinema_management'; // Fallback to local MongoDB
    
    // Connection options for MongoDB Atlas (compatible with latest Mongoose)
    const options = {
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout
      socketTimeoutMS: 45000, // 45 seconds socket timeout
      maxPoolSize: 10, // Maximum number of connections
      minPoolSize: 5,  // Minimum number of connections
      maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
      heartbeatFrequencyMS: 10000, // Heartbeat every 10 seconds
      retryWrites: true // Enable retryable writes
    };

    await mongoose.connect(mongoUri, options);
    
    const dbName = mongoose.connection.db.databaseName;
    logger.info(`✅ MongoDB Atlas connected successfully!`);
  } catch (error) {
    process.exit(1);
  }
};

// Start server
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  httpServer.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  httpServer.close(() => process.exit(1));
});

export { io };
