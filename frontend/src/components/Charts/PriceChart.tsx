import React from 'react';

interface PriceChartProps {
  symbol: string;
  data?: any[];
}

export const PriceChart: React.FC<PriceChartProps> = ({ symbol, data }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">{symbol} Price Chart</h3>
      <div className="h-64 flex items-center justify-center bg-gray-50 rounded">
        <div className="text-gray-500">
          📈 Price Chart Component
          <br />
          <span className="text-sm">Real-time price data visualization</span>
        </div>
      </div>
    </div>
  );
};