import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

export class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = createClient({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
        socket: {
          host: process.env.REDIS_HOST || '127.0.0.1',
          port: parseInt(process.env.REDIS_PORT) || 6379,
        }
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('Connected to Redis');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        console.log('Disconnected from Redis');
        this.isConnected = false;
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      console.error('Error connecting to Redis:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  async set(key, value, expireInSeconds = null) {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const serializedValue = JSON.stringify(value);
      
      if (expireInSeconds) {
        await this.client.setEx(key, expireInSeconds, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }

      return true;
    } catch (error) {
      console.error('Error setting Redis key:', error);
      return false;
    }
  }

  async get(key) {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Error getting Redis key:', error);
      return null;
    }
  }

  async del(key) {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('Error deleting Redis key:', error);
      return false;
    }
  }

  async exists(key) {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Error checking Redis key exists:', error);
      return false;
    }
  }

  async publish(channel, message) {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const serializedMessage = JSON.stringify(message);
      await this.client.publish(channel, serializedMessage);
      return true;
    } catch (error) {
      console.error('Error publishing to Redis channel:', error);
      return false;
    }
  }

  async subscribe(channel, callback) {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      await this.client.subscribe(channel, (message) => {
        try {
          const parsedMessage = JSON.parse(message);
          callback(parsedMessage);
        } catch (error) {
          console.error('Error parsing subscribed message:', error);
          callback(message);
        }
      });

      return true;
    } catch (error) {
      console.error('Error subscribing to Redis channel:', error);
      return false;
    }
  }

  async setHash(key, field, value) {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const serializedValue = JSON.stringify(value);
      await this.client.hSet(key, field, serializedValue);
      return true;
    } catch (error) {
      console.error('Error setting Redis hash:', error);
      return false;
    }
  }

  async getHash(key, field) {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const value = await this.client.hGet(key, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Error getting Redis hash:', error);
      return null;
    }
  }

  async getAllHash(key) {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const hash = await this.client.hGetAll(key);
      const result = {};
      
      for (const [field, value] of Object.entries(hash)) {
        try {
          result[field] = JSON.parse(value);
        } catch {
          result[field] = value;
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error getting Redis hash all:', error);
      return {};
    }
  }
}