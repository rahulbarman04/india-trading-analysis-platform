import React from 'react';
import { useMarketData } from '../context/MarketDataContext';
import { MarketOverview } from '../components/Dashboard/MarketOverview';
import { TechnicalIndicators } from '../components/Dashboard/TechnicalIndicators';
import { SentimentMeter } from '../components/Dashboard/SentimentMeter';
import { PredictionCards } from '../components/Dashboard/PredictionCards';
import { RecommendationsTable } from '../components/Dashboard/RecommendationsTable';
import { PriceChart } from '../components/Charts/PriceChart';
import { VolumeChart } from '../components/Charts/VolumeChart';

export const Dashboard: React.FC = () => {
  const { selectedSymbol, marketData, technicalData, sentimentData, predictions, recommendations, isLoading } = useMarketData();
  
  const currentMarketData = marketData[selectedSymbol];
  const currentTechnicalData = technicalData[selectedSymbol];
  const currentSentimentData = sentimentData[selectedSymbol];
  const currentPrediction = predictions[selectedSymbol];

  if (isLoading && !currentMarketData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading market data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Trading Analysis Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Comprehensive analysis for {selectedSymbol} - Real-time data, technical indicators, sentiment analysis, and AI predictions
        </p>
      </div>

      {/* Market Overview */}
      <MarketOverview 
        symbol={selectedSymbol} 
        marketData={currentMarketData} 
      />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Price Chart
          </h3>
          <div className="h-80">
            <PriceChart symbol={selectedSymbol} />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Volume Analysis
          </h3>
          <div className="h-80">
            <VolumeChart symbol={selectedSymbol} />
          </div>
        </div>
      </div>

      {/* Analysis Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Technical Indicators
          </h3>
          <TechnicalIndicators 
            technicalData={currentTechnicalData} 
            isLoading={isLoading}
          />
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Market Sentiment
          </h3>
          <SentimentMeter 
            sentimentData={currentSentimentData} 
            isLoading={isLoading}
          />
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            AI Predictions
          </h3>
          <PredictionCards 
            prediction={currentPrediction} 
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Trading Recommendations */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Trading Recommendations
        </h3>
        <RecommendationsTable 
          recommendations={recommendations} 
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};