import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { connectDatabase } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { authenticateToken } from './middleware/auth';
import { webSocketService } from './services/websocketService';

// Routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import courtRoutes from './routes/courts';
import reservationRoutes from './routes/reservations';
import paymentRoutes from './routes/paymentRoutes';
import weatherRoutes from './routes/weatherRoutes';
import pollRoutes from './routes/pollRoutes';
import suggestionRoutes from './routes/suggestions';
import analyticsRoutes from './routes/analytics';
import creditRoutes from './routes/creditRoutes';
import memberRoutes from './routes/memberRoutes';
import reportRoutes, { specialRouter } from './routes/reportRoutes';
import expenseRoutes from './routes/expenseRoutes';
import seedingRoutes from './routes/seedingRoutes';
import matchRoutes from './routes/matchRoutes';
import notificationRoutes from './routes/notifications';
import chatRoutes from './routes/chat';
import manualCourtUsageRoutes from './routes/manualCourtUsageRoutes';
import fixReservationRoutes from './routes/fix-reservation';
import tournamentRoutes from './routes/tournamentRoutes';
import playerRoutes from './routes/playerRoutes';
import validationRoutes from './routes/validationRoutes';
import rankingRoutes from './routes/rankingRoutes';
import resurfacingRoutes from './routes/resurfacingRoutes';
import impersonationRoutes from './routes/impersonation';
import galleryRoutes from './routes/galleryRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server for Socket.IO integration
const httpServer = createServer(app);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Rate limiting (temporarily disabled for CORS debugging)
if (false && process.env.NODE_ENV === 'production') {
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '500'),
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);
  console.log('📊 Rate limiting enabled for production');
} else {
  console.log('📊 Rate limiting disabled');
}

// CORS configuration
const allowedOrigins: string[] = [
  'http://localhost:4200',
  'http://localhost:4201',
  'http://localhost:3000',
  'http://192.168.68.113:4200',
  'http://192.168.68.113:4201',
  'https://tennisclubrt2.netlify.app',
  'https://main--tennisclubrt2.netlify.app',
  'https://tennisclubrt2-2026.netlify.app',
  'https://tennisclubrt2-v2.netlify.app'
];

// Add production frontend URL if available
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

// Netlify pattern regex for preview deployments
const netlifyPatterns: RegExp[] = [
  /^https:\/\/.*--tennisclubrt2\.netlify\.app$/,
  /^https:\/\/.*\.netlify\.app$/
];

// Add explicit CORS preflight handling
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  console.log('🔄 OPTIONS preflight request from origin:', origin);
  
  if (!origin) {
    res.header('Access-Control-Allow-Origin', '*');
  } else if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    // Check regex patterns for Netlify
    let matched = false;
    for (const pattern of netlifyPatterns) {
      if (pattern.test(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
        matched = true;
        break;
      }
    }
    if (!matched) {
      res.header('Access-Control-Allow-Origin', origin); // Allow for debugging
    }
  }
  
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, Accept');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, postman, etc.)
    if (!origin) return callback(null, true);
    
    // Log the incoming origin for debugging
    console.log('🔍 CORS request from origin:', origin);
    
    // Check if origin is in allowed string list
    if (allowedOrigins.includes(origin)) {
      console.log('✅ CORS allowed origin:', origin);
      return callback(null, true);
    }
    
    // Check regex patterns for Netlify
    for (const pattern of netlifyPatterns) {
      if (pattern.test(origin)) {
        console.log('✅ CORS allowed origin via pattern:', origin);
        return callback(null, true);
      }
    }
    
    console.log('❌ CORS blocked origin:', origin);
    // For debugging, allow the origin but log the issue
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  optionsSuccessStatus: 200,
  preflightContinue: false
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Sanitize data against NoSQL injection
app.use(mongoSanitize());

// Request logging
app.use(requestLogger);

// Health check endpoints
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    api: 'v1'
  });
});

// API routes
console.log('📥 Registering API routes...');
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/courts', authenticateToken, courtRoutes);
app.use('/api/reservations', authenticateToken, reservationRoutes);
app.use('/api/payments', authenticateToken, paymentRoutes);
app.use('/api/weather', authenticateToken, weatherRoutes);
console.log('📥 Registering poll routes...', typeof pollRoutes);
app.use('/api/polls', pollRoutes);
app.use('/api/suggestions', authenticateToken, suggestionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/credits', creditRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/reports', reportRoutes); // Temporarily removing auth for testing fix endpoint
app.use('/api/reports', specialRouter); // Special router without auth for fix endpoint
app.use('/api/expenses', expenseRoutes);
app.use('/api/seeding', authenticateToken, seedingRoutes);
app.use('/api/matches', authenticateToken, matchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/manual-court-usage', manualCourtUsageRoutes);
app.use('/api/fix-reservation', authenticateToken, fixReservationRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/validation', authenticateToken, validationRoutes);
app.use('/api/rankings', rankingRoutes); // New calculated rankings endpoint
app.use('/api/resurfacing', resurfacingRoutes); // Resurfacing contribution routes
app.use('/api/impersonation', impersonationRoutes); // Admin impersonation routes
app.use('/api/gallery', galleryRoutes); // Image gallery routes (public viewing, superadmin upload)
console.log('📥 All routes registered');

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler
app.use(errorHandler);

// Database connection and server startup
const startServer = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await connectDatabase();
    console.log('✅ MongoDB connected successfully');
    
    // Initialize WebSocket service
    webSocketService.initialize(httpServer);
    console.log('🔌 WebSocket service initialized');
    
    // Start Google Sheets sync service
    // TEMPORARILY DISABLED - to allow recorded payments to persist
    // const { syncService } = await import('./services/syncService');
    // syncService.startSync();
    console.log('⚠️  Google Sheets sync DISABLED for testing recorded payments integration');
    
    httpServer.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`🚀 Tennis Club RT2 Backend running on port ${PORT}`);
      console.log(`📱 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🔗 Network access: http://192.168.68.113:${PORT}/health`);
      console.log(`🔌 WebSocket server ready for real-time updates`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    console.error('❌ Error details:', error instanceof Error ? error.message : String(error));
    
    // Start server anyway without MongoDB for emergency access
    console.log('⚠️ Starting server without database for emergency access...');
    
    // Initialize WebSocket service even without database
    webSocketService.initialize(httpServer);
    console.log('🔌 WebSocket service initialized (emergency mode)');
    
    httpServer.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`🚀 Tennis Club RT2 Backend running on port ${PORT} (NO DATABASE)`);
      console.log(`📱 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🔗 Network access: http://192.168.68.113:${PORT}/health`);
      console.log('⚠️ Database unavailable - some features may not work');
      console.log(`🔌 WebSocket server ready for real-time updates`);
    });
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  console.error('❌ Unhandled Promise Rejection:', err.message);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  console.error('❌ Uncaught Exception:', err.message);
  process.exit(1);
});

startServer();

export default app;// trigger restart
// trigger restart
