require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');

function getApiInfo() {
  return {
    name: 'Surf Report API',
    version: '1.0.0',
    description: 'Surf conditions aggregator for any beach in the world',
    endpoints: {
      spots: '/api/spots',
      conditions: '/api/conditions/:spotId',
      agent: '/api/agent/:spotId',
      allConditions: '/api/conditions',
      health: '/api/health',
      pushSubscribe: '/api/push/subscribe',
      pushUnsubscribe: '/api/push/unsubscribe',
      pushVapidKey: '/api/push/vapid-public-key'
    },
    documentation: 'https://shouldigo.surf'
  };
}

function createApp() {
  // Initialize Express app
  const app = express();

  // Middleware
  const apiOrigin = process.env.API_ORIGIN || 'https://api.shouldigo.surf';
  const appOrigins = [
    "'self'",
    'https://shouldigo.surf',
    'https://www.shouldigo.surf',
    apiOrigin
  ];
  const mapOrigins = [
    'https://tiles.openfreemap.org'
  ];
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: [...appOrigins, ...mapOrigins, 'https://www.googletagmanager.com', 'https://www.google-analytics.com'],
        imgSrc: ["'self'", 'data:', 'blob:', ...mapOrigins, 'https://www.google-analytics.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
        fontSrc: ["'self'", 'https:', 'data:', ...mapOrigins],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://www.googletagmanager.com'],
        workerSrc: ["'self'", 'blob:'],
      }
    }
  })); // Security headers + CSP needed for web API and map assets

  // Rate limiting
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // limit each IP to 200 requests per 15 min window
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests, please try again later' }
  });
  app.use('/api/', apiLimiter);

  // Stricter rate limit for admin/marketing endpoints (brute-force protection)
  const adminLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 30, // 30 requests per hour per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests, please try again later' }
  });
  app.use('/api/marketing', adminLimiter);

  // CORS configuration
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'https://shouldigo.surf',
    'https://www.shouldigo.surf',
    'http://localhost:3000',
    'http://localhost:3001'
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

  // SEO routes (outside rate limiter — crawlers need unrestricted access)
  app.use('/', require('./routes/seo'));

  // API routes
  app.get('/api', (req, res) => {
    res.json(getApiInfo());
  });
  app.use('/api/spots', require('./routes/spots'));
  app.use('/api/conditions', require('./routes/conditions'));
  app.use('/api/health', require('./routes/health'));
  app.use('/api/push', require('./routes/push'));
  app.use('/api/nearest-spot', require('./routes/geo'));
  app.use('/api/agent', require('./routes/agent'));
  app.use('/api/marketing', require('./routes/marketing'));

  // Serve co-located frontend build (GCP Cloud Run deployment)
  const frontendBuildPath = path.join(__dirname, '../frontend-build');
  if (fs.existsSync(frontendBuildPath)) {
    logger.info(`[Server] Serving frontend from ${frontendBuildPath}`);
    app.use(express.static(frontendBuildPath, {
      maxAge: '1h',
      setHeaders: (res, filePath) => {
        // Don't cache index.html (SPA entry point)
        if (filePath.endsWith('index.html')) {
          res.set('Cache-Control', 'no-cache');
        }
      }
    }));

    // SPA fallback — serve index.html only for non-API browser routes
    app.get(/^(?!\/api(?:\/|$)).*/, (req, res) => {
      res.sendFile(path.join(frontendBuildPath, 'index.html'));
    });
  } else {
    // No frontend build — serve API info at root (development / separate deployment)
    app.get('/', (req, res) => {
      res.json(getApiInfo());
    });
  }

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found',
      path: req.path.slice(0, 200)
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

  return app;
}

function startBackgroundServices() {
  // Start push notification scheduler
  const { startNotificationScheduler } = require('./services/pushNotifier');
  startNotificationScheduler();

  // Start Instagram marketing scheduler (token refresh + weekly creative rotation)
  const { startTokenRefresh } = require('./services/instagram/tokenManager');
  const { startMarketingScheduler } = require('./services/instagram/scheduler');
  startTokenRefresh();
  startMarketingScheduler();

  // Start daily monitoring report scheduler
  const { startDailyReportScheduler } = require('./services/dailyReport');
  startDailyReportScheduler();
}

function startServer(port = process.env.PORT || 5000) {
  const app = createApp();
  const server = app.listen(port, () => {
    logger.info(`🏄 Surf Report API running on port ${port}`);
    logger.info(`📡 API endpoint: http://localhost:${port}/api`);
    logger.info(`💚 Health check: http://localhost:${port}/api/health`);
    logger.info(`📖 Documentation: http://localhost:${port}/`);
    startBackgroundServices();
  });

  return { app, server };
}

let runningServer = null;

if (require.main === module) {
  runningServer = startServer().server;
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (!runningServer) return process.exit(0);
  runningServer.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  if (!runningServer) return process.exit(0);
  runningServer.close(() => process.exit(0));
});

module.exports = { createApp, startServer, getApiInfo };
