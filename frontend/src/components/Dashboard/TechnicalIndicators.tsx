import React from 'react';
import { TechnicalIndicator } from '../../types/market';

interface TechnicalIndicatorsProps {
  indicators?: TechnicalIndicator;
  isLoading: boolean;
}

export const TechnicalIndicators: React.FC<TechnicalIndicatorsProps> = ({ indicators, isLoading }) => {
  if (isLoading || !indicators) {
    return <div className="text-center text-gray-500">Loading indicators...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">Technical Indicators Ready</div>
    </div>
  );
};