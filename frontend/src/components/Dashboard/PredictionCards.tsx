import React from 'react';
import { MLPrediction } from '../../types/market';

interface PredictionCardsProps {
  prediction?: MLPrediction;
  isLoading: boolean;
}

export const PredictionCards: React.FC<PredictionCardsProps> = ({ prediction, isLoading }) => {
  if (isLoading || !prediction) {
    return <div className="text-center text-gray-500">Loading predictions...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">ML Predictions Ready</div>
    </div>
  );
};