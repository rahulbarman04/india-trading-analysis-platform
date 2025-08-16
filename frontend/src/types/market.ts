export interface MarketData {
  symbol: string;
  timestamp: Date;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  volume: number;
  change?: number;
  change_percent?: number;
  is_market_open?: boolean;
}

export interface TechnicalIndicator {
  value: number;
  signal?: 'bullish' | 'bearish' | 'neutral';
  timestamp: Date;
}

export interface TechnicalAnalysis {
  symbol: string;
  timestamp: Date;
  current_price: number;
  indicators: {
    vwap: number;
    ema_9: number;
    ema_21: number;
    macd: {
      macd: number;
      signal: number;
      histogram: number;
    };
    rsi: number;
    bollinger_bands: {
      upper: number;
      middle: number;
      lower: number;
    };
    supertrend: {
      value: number;
      trend: 'bullish' | 'bearish';
    };
    atr: number;
    fibonacci_levels: Record<string, number>;
    volume_profile: Record<string, number>;
    adx: number;
  };
  signals: {
    rsi: 'overbought' | 'oversold' | 'neutral';
    macd: 'bullish' | 'bearish';
    bollinger: 'overbought' | 'oversold' | 'neutral';
    supertrend: 'bullish' | 'bearish';
    ema: 'bullish' | 'bearish';
  };
}

export interface SentimentData {
  symbol: string;
  timestamp: Date;
  overall_sentiment: 'positive' | 'negative' | 'neutral';
  sentiment_score: number; // -1 to 1
  confidence: number;
  distribution: {
    positive: number;
    negative: number;
    neutral: number;
  };
  sources: {
    news: {
      count: number;
      avg_score: number;
    };
    social_media: {
      count: number;
      avg_score: number;
    };
  };
}

export interface MLPrediction {
  symbol: string;
  timestamp: Date;
  model_type: string;
  prediction_horizon: string;
  predicted_price: number;
  current_price: number;
  confidence_score: number;
  change_percentage: number;
  recommendation: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell';
}

export interface OptionsData {
  symbol: string;
  timestamp: Date;
  current_price: number;
  implied_volatility: number;
  options_chain: OptionChainItem[];
  strategies: OptionsStrategy[];
}

export interface OptionChainItem {
  strike_price: number;
  call: {
    premium: number;
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    moneyness: 'ITM' | 'ATM' | 'OTM';
  };
  put: {
    premium: number;
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    moneyness: 'ITM' | 'ATM' | 'OTM';
  };
}

export interface OptionsStrategy {
  strategy: string;
  description: string;
  legs: OptionsLeg[];
  max_profit: string | number;
  max_loss: string | number;
  risk_reward: string;
  breakeven?: number;
  breakeven_upper?: number;
  breakeven_lower?: number;
}

export interface OptionsLeg {
  action: 'BUY' | 'SELL';
  option_type: 'CALL' | 'PUT';
  strike: number;
  premium: number;
}

export interface TradingRecommendation {
  id?: string;
  symbol: string;
  timestamp: Date;
  recommendation_type: 'BUY' | 'SELL' | 'HOLD' | 'OPTIONS';
  entry_price?: number;
  target_price?: number;
  stop_loss?: number;
  confidence_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  technical_reasoning: string;
  sentiment_reasoning?: string;
  ml_reasoning?: string;
  is_options: boolean;
  option_strategy?: string;
}

export interface MarketStatus {
  status: 'pre_market' | 'regular' | 'post_market' | 'closed';
  timestamp: Date;
  market_hours: {
    pre_market: { start: string; end: string };
    regular: { start: string; end: string };
    post_market: { start: string; end: string };
  };
}

export interface ChartDataPoint {
  timestamp: Date;
  value: number;
  volume?: number;
}

export interface PriceChange {
  absolute: number;
  percentage: number;
  direction: 'up' | 'down' | 'neutral';
}

export interface APIResponse<T> {
  data: T;
  timestamp: string;
  status: 'success' | 'error';
  message?: string;
}