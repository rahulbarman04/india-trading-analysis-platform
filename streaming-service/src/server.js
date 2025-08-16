import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import winston from 'winston';
import { RedisService } from './services/redisService.js';
import { MarketDataService } from './services/marketDataService.js';
import { WebSocketService } from './services/websocketService.js';

// Load environment variables
dotenv.config();

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Create Express app and HTTP server
const app = express();
const server = createServer(app);

// Configure CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET", "POST"],
  credentials: true
}));

app.use(express.json());

// Create Socket.IO server
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Initialize services
const redisService = new RedisService();
const marketDataService = new MarketDataService(redisService, logger);
const websocketService = new WebSocketService(io, redisService, logger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'streaming-service',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Market data endpoints
app.get('/api/symbols', (req, res) => {
  const symbols = process.env.MARKET_SYMBOLS?.split(',') || ['NIFTY', 'SENSEX', 'BANKNIFTY'];
  res.json({ symbols });
});

app.get('/api/market-data/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const data = await marketDataService.getLatestData(symbol);
    res.json(data);
  } catch (error) {
    logger.error('Error fetching market data:', error);
    res.status(500).json({ error: 'Failed to fetch market data' });
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  // Handle symbol subscription
  socket.on('subscribe', (symbols) => {
    if (Array.isArray(symbols)) {
      symbols.forEach(symbol => {
        socket.join(`market-${symbol}`);
        logger.info(`Client ${socket.id} subscribed to ${symbol}`);
      });
    }
  });
  
  // Handle symbol unsubscription
  socket.on('unsubscribe', (symbols) => {
    if (Array.isArray(symbols)) {
      symbols.forEach(symbol => {
        socket.leave(`market-${symbol}`);
        logger.info(`Client ${socket.id} unsubscribed from ${symbol}`);
      });
    }
  });
  
  // Send initial data
  socket.on('request-initial-data', async (symbols) => {
    try {
      if (Array.isArray(symbols)) {
        for (const symbol of symbols) {
          const data = await marketDataService.getLatestData(symbol);
          socket.emit('market-data', { symbol, data });
        }
      }
    } catch (error) {
      logger.error('Error sending initial data:', error);
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Start services
async function startServices() {
  try {
    // Initialize Redis connection
    await redisService.connect();
    logger.info('Redis service connected');
    
    // Start market data collection
    await marketDataService.start();
    logger.info('Market data service started');
    
    // Start WebSocket service
    websocketService.start();
    logger.info('WebSocket service started');
    
    // Schedule periodic data updates
    cron.schedule('*/5 * * * * *', async () => {
      try {
        await marketDataService.updateAllSymbols();
      } catch (error) {
        logger.error('Error in scheduled data update:', error);
      }
    });
    
    logger.info('Scheduled data updates enabled (every 5 seconds)');
    
  } catch (error) {
    logger.error('Error starting services:', error);
    process.exit(1);
  }
}

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
  logger.info(`Streaming service running on port ${PORT}`);
  await startServices();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  await redisService.disconnect();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  await redisService.disconnect();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default app;