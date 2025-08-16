import React from 'react';
import { TradingRecommendation } from '../../types/market';

interface RecommendationsTableProps {
  recommendations: TradingRecommendation[];
  isLoading: boolean;
}

export const RecommendationsTable: React.FC<RecommendationsTableProps> = ({ recommendations, isLoading }) => {
  if (isLoading) {
    return <div className="text-center text-gray-500">Loading recommendations...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">Trading Recommendations Ready</div>
    </div>
  );
};