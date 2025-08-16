import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useWebSocket } from './WebSocketContext';
import { MarketData, TechnicalAnalysis, SentimentData, MLPrediction, OptionsData, TradingRecommendation } from '../types/market';

interface MarketDataContextType {
  marketData: Record<string, MarketData>;
  technicalData: Record<string, TechnicalAnalysis>;
  sentimentData: Record<string, SentimentData>;
  predictions: Record<string, MLPrediction>;
  optionsData: Record<string, OptionsData>;
  recommendations: TradingRecommendation[];
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
  subscribeToSymbol: (symbol: string) => void;
  unsubscribeFromSymbol: (symbol: string) => void;
  isLoading: boolean;
  error: string | null;
}

const MarketDataContext = createContext<MarketDataContextType | undefined>(undefined);

interface MarketDataProviderProps {
  children: ReactNode;
}

const DEFAULT_SYMBOLS = ['NIFTY', 'SENSEX', 'BANKNIFTY'];

export const MarketDataProvider: React.FC<MarketDataProviderProps> = ({ children }) => {
  const { socket, isConnected } = useWebSocket();
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const [technicalData, setTechnicalData] = useState<Record<string, TechnicalAnalysis>>({});
  const [sentimentData, setSentimentData] = useState<Record<string, SentimentData>>({});
  const [predictions, setPredictions] = useState<Record<string, MLPrediction>>({});
  const [optionsData, setOptionsData] = useState<Record<string, OptionsData>>({});
  const [recommendations, setRecommendations] = useState<TradingRecommendation[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState('NIFTY');
  const [subscribedSymbols, setSubscribedSymbols] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Socket event listeners
    const handleMarketData = (data: { symbol: string; data: any }) => {
      setMarketData(prev => ({
        ...prev,
        [data.symbol]: {
          ...data.data.market,
          timestamp: new Date(data.data.timestamp),
        }
      }));
      setIsLoading(false);
    };

    const handleTechnicalUpdate = (data: { symbol: string; technical: any }) => {
      setTechnicalData(prev => ({
        ...prev,
        [data.symbol]: {
          ...data.technical,
          timestamp: new Date(data.technical.timestamp),
        }
      }));
    };

    const handleSentimentUpdate = (data: { symbol: string; sentiment: any }) => {
      setSentimentData(prev => ({
        ...prev,
        [data.symbol]: {
          ...data.sentiment,
          timestamp: new Date(data.sentiment.timestamp),
        }
      }));
    };

    const handleTradingRecommendation = (data: { recommendation: TradingRecommendation }) => {
      setRecommendations(prev => [data.recommendation, ...prev.slice(0, 9)]); // Keep last 10
    };

    const handleError = (error: any) => {
      console.error('Market data error:', error);
      setError(error.message || 'An error occurred');
      setIsLoading(false);
    };

    // Register event listeners
    socket.on('market-data', handleMarketData);
    socket.on('technical-update', handleTechnicalUpdate);
    socket.on('sentiment-update', handleSentimentUpdate);
    socket.on('trading-recommendation', handleTradingRecommendation);
    socket.on('error', handleError);

    // Subscribe to default symbols
    socket.emit('subscribe', DEFAULT_SYMBOLS);
    socket.emit('request-initial-data', DEFAULT_SYMBOLS);
    setSubscribedSymbols(new Set(DEFAULT_SYMBOLS));

    return () => {
      socket.off('market-data', handleMarketData);
      socket.off('technical-update', handleTechnicalUpdate);
      socket.off('sentiment-update', handleSentimentUpdate);
      socket.off('trading-recommendation', handleTradingRecommendation);
      socket.off('error', handleError);
    };
  }, [socket, isConnected]);

  const subscribeToSymbol = (symbol: string) => {
    if (!socket || !isConnected || subscribedSymbols.has(symbol)) return;

    socket.emit('subscribe', [symbol]);
    socket.emit('request-initial-data', [symbol]);
    setSubscribedSymbols(prev => new Set([...prev, symbol]));
  };

  const unsubscribeFromSymbol = (symbol: string) => {
    if (!socket || !isConnected || !subscribedSymbols.has(symbol)) return;

    socket.emit('unsubscribe', [symbol]);
    setSubscribedSymbols(prev => {
      const newSet = new Set(prev);
      newSet.delete(symbol);
      return newSet;
    });
  };

  const value = {
    marketData,
    technicalData,
    sentimentData,
    predictions,
    optionsData,
    recommendations,
    selectedSymbol,
    setSelectedSymbol,
    subscribeToSymbol,
    unsubscribeFromSymbol,
    isLoading,
    error,
  };

  return (
    <MarketDataContext.Provider value={value}>
      {children}
    </MarketDataContext.Provider>
  );
};

export const useMarketData = () => {
  const context = useContext(MarketDataContext);
  if (context === undefined) {
    throw new Error('useMarketData must be used within a MarketDataProvider');
  }
  return context;
};