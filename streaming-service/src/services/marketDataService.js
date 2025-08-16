import axios from 'axios';
import { EventEmitter } from 'events';

export class MarketDataService extends EventEmitter {
  constructor(redisService, logger) {
    super();
    this.redisService = redisService;
    this.logger = logger;
    this.symbols = process.env.MARKET_SYMBOLS?.split(',') || ['NIFTY', 'SENSEX', 'BANKNIFTY'];
    this.updateInterval = parseInt(process.env.DATA_UPDATE_INTERVAL) || 5000;
    this.backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8000';
    this.isRunning = false;
    
    // Symbol mapping for Yahoo Finance
    this.symbolMap = {
      'NIFTY': '^NSEI',
      'SENSEX': '^BSESN',
      'BANKNIFTY': '^NSEBANK'
    };
  }

  async start() {
    this.isRunning = true;
    this.logger.info('Market data service started');
    
    // Initial data fetch
    await this.updateAllSymbols();
  }

  stop() {
    this.isRunning = false;
    this.logger.info('Market data service stopped');
  }

  async updateAllSymbols() {
    if (!this.isRunning) return;

    const promises = this.symbols.map(symbol => this.updateSymbolData(symbol));
    await Promise.allSettled(promises);
  }

  async updateSymbolData(symbol) {
    try {
      // Get data from multiple sources
      const [marketData, technicalData, sentimentData] = await Promise.allSettled([
        this.fetchMarketData(symbol),
        this.fetchTechnicalData(symbol),
        this.fetchSentimentData(symbol)
      ]);

      const combinedData = {
        symbol,
        timestamp: new Date().toISOString(),
        market: marketData.status === 'fulfilled' ? marketData.value : null,
        technical: technicalData.status === 'fulfilled' ? technicalData.value : null,
        sentiment: sentimentData.status === 'fulfilled' ? sentimentData.value : null,
        lastUpdated: Date.now()
      };

      // Cache in Redis
      await this.redisService.set(`market_data:${symbol}`, combinedData, 300); // 5 minutes TTL
      
      // Publish to Redis for WebSocket broadcasting
      await this.redisService.publish('market_updates', {
        type: 'market_data',
        symbol,
        data: combinedData
      });

      this.emit('dataUpdated', symbol, combinedData);
      
      return combinedData;
    } catch (error) {
      this.logger.error(`Error updating data for ${symbol}:`, error);
      return null;
    }
  }

  async fetchMarketData(symbol) {
    try {
      // First try to get from backend API
      const response = await axios.get(`${this.backendUrl}/api/market/realtime/${symbol}`, {
        timeout: 10000
      });
      
      if (response.data) {
        return response.data;
      }
    } catch (error) {
      this.logger.warn(`Backend API unavailable for ${symbol}, using fallback`);
    }

    // Fallback: Generate simulated data
    return this.generateMockMarketData(symbol);
  }

  async fetchTechnicalData(symbol) {
    try {
      const response = await axios.get(`${this.backendUrl}/api/technical/analyze/${symbol}`, {
        timeout: 10000
      });
      
      if (response.data) {
        return response.data;
      }
    } catch (error) {
      this.logger.warn(`Technical analysis unavailable for ${symbol}`);
    }

    return null;
  }

  async fetchSentimentData(symbol) {
    try {
      const response = await axios.get(`${this.backendUrl}/api/sentiment/analyze/${symbol}`, {
        timeout: 10000
      });
      
      if (response.data) {
        return response.data;
      }
    } catch (error) {
      this.logger.warn(`Sentiment analysis unavailable for ${symbol}`);
    }

    return null;
  }

  generateMockMarketData(symbol) {
    // Base prices for different symbols
    const basePrices = {
      'NIFTY': 21000,
      'SENSEX': 69000,
      'BANKNIFTY': 45000
    };

    const basePrice = basePrices[symbol] || 20000;
    
    // Generate realistic price movement
    const changePercent = (Math.random() - 0.5) * 4; // -2% to +2%
    const currentPrice = basePrice * (1 + changePercent / 100);
    
    // Generate OHLC data
    const open = basePrice * (1 + (Math.random() - 0.5) * 2 / 100);
    const high = Math.max(open, currentPrice) * (1 + Math.random() * 1 / 100);
    const low = Math.min(open, currentPrice) * (1 - Math.random() * 1 / 100);
    
    // Generate volume
    const baseVolume = symbol === 'NIFTY' ? 1000000 : symbol === 'SENSEX' ? 800000 : 1200000;
    const volume = Math.floor(baseVolume * (0.8 + Math.random() * 0.4));

    return {
      symbol,
      timestamp: new Date().toISOString(),
      open_price: Math.round(open * 100) / 100,
      high_price: Math.round(high * 100) / 100,
      low_price: Math.round(low * 100) / 100,
      close_price: Math.round(currentPrice * 100) / 100,
      volume: volume,
      change: Math.round((currentPrice - basePrice) * 100) / 100,
      change_percent: Math.round(changePercent * 100) / 100,
      is_market_open: this.isMarketOpen()
    };
  }

  isMarketOpen() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = hour * 100 + minute;
    
    // Indian market hours: 9:15 AM to 3:30 PM IST
    return currentTime >= 915 && currentTime <= 1530;
  }

  async getLatestData(symbol) {
    try {
      // Try to get from Redis cache first
      const cachedData = await this.redisService.get(`market_data:${symbol}`);
      
      if (cachedData && (Date.now() - cachedData.lastUpdated) < 30000) { // 30 seconds fresh
        return cachedData;
      }

      // If not cached or stale, fetch fresh data
      const freshData = await this.updateSymbolData(symbol);
      return freshData;
    } catch (error) {
      this.logger.error(`Error getting latest data for ${symbol}:`, error);
      return null;
    }
  }

  async getHistoricalData(symbol, period = '1d') {
    try {
      const response = await axios.get(`${this.backendUrl}/api/market/historical/${symbol}`, {
        params: { period },
        timeout: 15000
      });
      
      return response.data;
    } catch (error) {
      this.logger.error(`Error getting historical data for ${symbol}:`, error);
      return null;
    }
  }

  async getMarketStatus() {
    try {
      const response = await axios.get(`${this.backendUrl}/api/market/market-status`, {
        timeout: 5000
      });
      
      return response.data;
    } catch (error) {
      this.logger.warn('Market status unavailable, using fallback');
      
      return {
        status: this.isMarketOpen() ? 'regular' : 'closed',
        timestamp: new Date().toISOString(),
        market_hours: {
          pre_market: { start: '09:00', end: '09:15' },
          regular: { start: '09:15', end: '15:30' },
          post_market: { start: '15:40', end: '16:00' }
        }
      };
    }
  }

  // Technical indicators calculation methods
  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return null;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    return Math.round(rsi * 100) / 100;
  }

  calculateSMA(prices, period) {
    if (prices.length < period) return null;
    
    const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
    return Math.round((sum / period) * 100) / 100;
  }

  calculateEMA(prices, period) {
    if (prices.length < period) return null;
    
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return Math.round(ema * 100) / 100;
  }
}