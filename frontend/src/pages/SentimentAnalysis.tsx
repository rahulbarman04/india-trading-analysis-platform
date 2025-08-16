import React from 'react';

export const SentimentAnalysis: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Sentiment Analysis
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Social media sentiment analysis from Twitter, StockTwits, and news headlines with real-time sentiment scoring.
        </p>
      </div>
    </div>
  );
};