import React from 'react';
import { SentimentData } from '../../types/market';

interface SentimentMeterProps {
  sentiment?: SentimentData;
  isLoading: boolean;
}

export const SentimentMeter: React.FC<SentimentMeterProps> = ({ sentiment, isLoading }) => {
  if (isLoading || !sentiment) {
    return <div className="text-center text-gray-500">Loading sentiment...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">Sentiment Analysis Ready</div>
    </div>
  );
};