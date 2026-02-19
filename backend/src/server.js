const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');

// Initialize Express app
const app = express();

// Middleware
app.use(helmet()); // Security headers

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // limit each IP to 60 requests per 15 min window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later' }
});
app.use('/api/', apiLimiter);

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://shouldigo.surf',
  'https://www.shouldigo.surf',
  'http://localhost:3000'
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};
app.use(cors(corsOptions)); // Enable CORS for frontend

app.use(express.json({ limit: '10kb' })); // Parse JSON bodies with size limit
app.use(express.urlencoded({ extended: true, limit: '10kb' })); // Parse URL-encoded bodies with size limit

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/spots', require('./routes/spots'));
app.use('/api/conditions', require('./routes/conditions'));
app.use('/api/health', require('./routes/health'));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Surf Report API',
    version: '1.0.0',
    description: 'Surf conditions aggregator for Israeli beaches',
    endpoints: {
      spots: '/api/spots',
      conditions: '/api/conditions/:spotId',
      allConditions: '/api/conditions',
      health: '/api/health'
    },
    documentation: 'https://github.com/YOUR_USERNAME/surf_report'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`[Error] ${err.message}`, {
    path: req.path,
    method: req.method,
    stack: err.stack
  });

  // Don't expose internal errors in production
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  res.status(err.statusCode || 500).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  logger.info(`🏄 Surf Report API running on port ${PORT}`);
  logger.info(`📡 API endpoint: http://localhost:${PORT}/api`);
  logger.info(`💚 Health check: http://localhost:${PORT}/api/health`);
  logger.info(`📖 Documentation: http://localhost:${PORT}/`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;
