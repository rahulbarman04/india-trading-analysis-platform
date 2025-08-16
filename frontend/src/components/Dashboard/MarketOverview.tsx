import React from 'react';
import { MarketData } from '../../types/market';
import { TrendingUp, TrendingDown, Minus, Activity, Volume2, Clock } from 'lucide-react';

interface MarketOverviewProps {
  symbol: string;
  marketData?: MarketData;
}

export const MarketOverview: React.FC<MarketOverviewProps> = ({ symbol, marketData }) => {
  if (!marketData) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const changePercent = marketData.change_percent || 0;
  const changeValue = marketData.change || 0;
  const isPositive = changePercent > 0;
  const isNegative = changePercent < 0;

  const getTrendIcon = () => {
    if (isPositive) return <TrendingUp className="w-5 h-5 text-success-500" />;
    if (isNegative) return <TrendingDown className="w-5 h-5 text-danger-500" />;
    return <Minus className="w-5 h-5 text-gray-400" />;
  };

  const getPriceColor = () => {
    if (isPositive) return 'text-success-600';
    if (isNegative) return 'text-danger-600';
    return 'text-gray-600';
  };

  const formatNumber = (num: number, decimals = 2) => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  };

  const formatVolume = (volume: number) => {
    if (volume >= 10000000) return `${(volume / 10000000).toFixed(1)}Cr`;
    if (volume >= 100000) return `${(volume / 100000).toFixed(1)}L`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return volume.toString();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Current Price */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border-l-4 border-primary-500">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Current Price</h4>
          {getTrendIcon()}
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            ₹{formatNumber(marketData.close_price)}
          </span>
        </div>
        <div className="flex items-center space-x-2 mt-2">
          <span className={`text-sm font-medium ${getPriceColor()}`}>
            {isPositive && '+'}{formatNumber(changeValue)}
          </span>
          <span className={`text-sm font-medium ${getPriceColor()}`}>
            ({isPositive && '+'}{formatNumber(changePercent, 2)}%)
          </span>
        </div>
      </div>

      {/* Day Range */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Day Range</h4>
          <Activity className="w-5 h-5 text-gray-400" />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-300">Low</span>
            <span className="font-medium text-gray-900 dark:text-white">
              ₹{formatNumber(marketData.low_price)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-300">High</span>
            <span className="font-medium text-gray-900 dark:text-white">
              ₹{formatNumber(marketData.high_price)}
            </span>
          </div>
        </div>
        <div className="mt-3">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-primary-500 h-2 rounded-full" 
              style={{
                width: `${((marketData.close_price - marketData.low_price) / (marketData.high_price - marketData.low_price)) * 100}%`
              }}
            ></div>
          </div>
        </div>
      </div>

      {/* Volume */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Volume</h4>
          <Volume2 className="w-5 h-5 text-gray-400" />
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatVolume(marketData.volume)}
          </span>
        </div>
        <div className="mt-2">
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {formatNumber(marketData.volume)} shares
          </span>
        </div>
      </div>

      {/* Market Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Market Status</h4>
          <Clock className="w-5 h-5 text-gray-400" />
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${marketData.is_market_open ? 'bg-success-500' : 'bg-danger-500'}`}></div>
          <span className="text-lg font-semibold text-gray-900 dark:text-white">
            {marketData.is_market_open ? 'Open' : 'Closed'}
          </span>
        </div>
        <div className="mt-2">
          <span className="text-sm text-gray-600 dark:text-gray-300">
            Last updated: {new Date(marketData.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
};