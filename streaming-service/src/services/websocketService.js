import { EventEmitter } from 'events';

export class WebSocketService extends EventEmitter {
  constructor(io, redisService, logger) {
    super();
    this.io = io;
    this.redisService = redisService;
    this.logger = logger;
    this.connectedClients = new Map();
    this.subscriptions = new Map(); // Track which clients are subscribed to which symbols
  }

  start() {
    this.logger.info('WebSocket service started');
    
    // Subscribe to Redis pub/sub for market updates
    this.setupRedisSubscription();
    
    // Setup periodic heartbeat
    this.setupHeartbeat();
  }

  async setupRedisSubscription() {
    try {
      // Create a separate Redis client for subscription
      const subscriber = this.redisService.client.duplicate();
      await subscriber.connect();
      
      await subscriber.subscribe('market_updates', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleMarketUpdate(data);
        } catch (error) {
          this.logger.error('Error parsing Redis message:', error);
        }
      });
      
      this.logger.info('Subscribed to Redis market_updates channel');
    } catch (error) {
      this.logger.error('Error setting up Redis subscription:', error);
    }
  }

  handleMarketUpdate(data) {
    if (data.type === 'market_data' && data.symbol && data.data) {
      // Broadcast to all clients subscribed to this symbol
      this.io.to(`market-${data.symbol}`).emit('market-data', {
        symbol: data.symbol,
        data: data.data,
        timestamp: new Date().toISOString()
      });
      
      // Also send technical analysis updates if available
      if (data.data.technical) {
        this.io.to(`market-${data.symbol}`).emit('technical-update', {
          symbol: data.symbol,
          technical: data.data.technical,
          timestamp: new Date().toISOString()
        });
      }
      
      // Send sentiment updates if available
      if (data.data.sentiment) {
        this.io.to(`market-${data.symbol}`).emit('sentiment-update', {
          symbol: data.symbol,
          sentiment: data.data.sentiment,
          timestamp: new Date().toISOString()
        });
      }
      
      this.logger.debug(`Broadcasted data for ${data.symbol} to subscribed clients`);
    }
  }

  setupHeartbeat() {
    // Send heartbeat every 30 seconds
    setInterval(() => {
      this.io.emit('heartbeat', {
        timestamp: new Date().toISOString(),
        connections: this.connectedClients.size
      });
    }, 30000);
  }

  async broadcastMarketData(symbol, data) {
    try {
      this.io.to(`market-${symbol}`).emit('market-data', {
        symbol,
        data,
        timestamp: new Date().toISOString()
      });
      
      this.logger.debug(`Broadcasted market data for ${symbol}`);
    } catch (error) {
      this.logger.error('Error broadcasting market data:', error);
    }
  }

  async broadcastTechnicalAnalysis(symbol, analysis) {
    try {
      this.io.to(`market-${symbol}`).emit('technical-update', {
        symbol,
        analysis,
        timestamp: new Date().toISOString()
      });
      
      this.logger.debug(`Broadcasted technical analysis for ${symbol}`);
    } catch (error) {
      this.logger.error('Error broadcasting technical analysis:', error);
    }
  }

  async broadcastSentimentAnalysis(symbol, sentiment) {
    try {
      this.io.to(`market-${symbol}`).emit('sentiment-update', {
        symbol,
        sentiment,
        timestamp: new Date().toISOString()
      });
      
      this.logger.debug(`Broadcasted sentiment analysis for ${symbol}`);
    } catch (error) {
      this.logger.error('Error broadcasting sentiment analysis:', error);
    }
  }

  async broadcastTradingRecommendation(recommendation) {
    try {
      this.io.emit('trading-recommendation', {
        recommendation,
        timestamp: new Date().toISOString()
      });
      
      this.logger.info(`Broadcasted trading recommendation for ${recommendation.symbol}`);
    } catch (error) {
      this.logger.error('Error broadcasting trading recommendation:', error);
    }
  }

  async broadcastMarketAlert(alert) {
    try {
      this.io.emit('market-alert', {
        alert,
        timestamp: new Date().toISOString()
      });
      
      this.logger.info(`Broadcasted market alert: ${alert.message}`);
    } catch (error) {
      this.logger.error('Error broadcasting market alert:', error);
    }
  }

  // Connection management
  handleConnection(socket) {
    const clientInfo = {
      id: socket.id,
      connectedAt: new Date().toISOString(),
      subscriptions: new Set(),
      lastActivity: Date.now()
    };
    
    this.connectedClients.set(socket.id, clientInfo);
    this.logger.info(`Client connected: ${socket.id} (Total: ${this.connectedClients.size})`);
    
    // Send welcome message
    socket.emit('connection-established', {
      clientId: socket.id,
      timestamp: new Date().toISOString(),
      availableChannels: ['market-data', 'technical-update', 'sentiment-update', 'trading-recommendation', 'market-alert']
    });
  }

  handleDisconnection(socket) {
    const clientInfo = this.connectedClients.get(socket.id);
    
    if (clientInfo) {
      // Clean up subscriptions
      clientInfo.subscriptions.forEach(symbol => {
        socket.leave(`market-${symbol}`);
      });
      
      this.connectedClients.delete(socket.id);
      this.logger.info(`Client disconnected: ${socket.id} (Total: ${this.connectedClients.size})`);
    }
  }

  handleSubscription(socket, symbols) {
    const clientInfo = this.connectedClients.get(socket.id);
    
    if (clientInfo && Array.isArray(symbols)) {
      symbols.forEach(symbol => {
        socket.join(`market-${symbol}`);
        clientInfo.subscriptions.add(symbol);
        
        // Track subscription stats
        if (!this.subscriptions.has(symbol)) {
          this.subscriptions.set(symbol, new Set());
        }
        this.subscriptions.get(symbol).add(socket.id);
      });
      
      clientInfo.lastActivity = Date.now();
      this.logger.info(`Client ${socket.id} subscribed to: ${symbols.join(', ')}`);
      
      // Send confirmation
      socket.emit('subscription-confirmed', {
        symbols,
        timestamp: new Date().toISOString()
      });
    }
  }

  handleUnsubscription(socket, symbols) {
    const clientInfo = this.connectedClients.get(socket.id);
    
    if (clientInfo && Array.isArray(symbols)) {
      symbols.forEach(symbol => {
        socket.leave(`market-${symbol}`);
        clientInfo.subscriptions.delete(symbol);
        
        // Update subscription stats
        if (this.subscriptions.has(symbol)) {
          this.subscriptions.get(symbol).delete(socket.id);
          if (this.subscriptions.get(symbol).size === 0) {
            this.subscriptions.delete(symbol);
          }
        }
      });
      
      clientInfo.lastActivity = Date.now();
      this.logger.info(`Client ${socket.id} unsubscribed from: ${symbols.join(', ')}`);
      
      // Send confirmation
      socket.emit('unsubscription-confirmed', {
        symbols,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Statistics and monitoring
  getConnectionStats() {
    const stats = {
      totalConnections: this.connectedClients.size,
      symbolSubscriptions: {},
      activeConnections: 0
    };
    
    // Count active connections (activity in last 5 minutes)
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    this.connectedClients.forEach(client => {
      if (client.lastActivity > fiveMinutesAgo) {
        stats.activeConnections++;
      }
    });
    
    // Count subscriptions per symbol
    this.subscriptions.forEach((clients, symbol) => {
      stats.symbolSubscriptions[symbol] = clients.size;
    });
    
    return stats;
  }

  // Health check
  async healthCheck() {
    const stats = this.getConnectionStats();
    
    return {
      status: 'healthy',
      websocket: {
        connected: stats.totalConnections > 0,
        connections: stats.totalConnections,
        activeConnections: stats.activeConnections,
        subscriptions: stats.symbolSubscriptions
      },
      redis: {
        connected: this.redisService.isConnected
      },
      timestamp: new Date().toISOString()
    };
  }

  // Cleanup inactive connections
  cleanupInactiveConnections() {
    const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
    let cleanedUp = 0;
    
    this.connectedClients.forEach((client, socketId) => {
      if (client.lastActivity < thirtyMinutesAgo) {
        // Force disconnect inactive clients
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.disconnect(true);
          cleanedUp++;
        }
      }
    });
    
    if (cleanedUp > 0) {
      this.logger.info(`Cleaned up ${cleanedUp} inactive connections`);
    }
  }
}

// Export default for ES modules
export default WebSocketService;