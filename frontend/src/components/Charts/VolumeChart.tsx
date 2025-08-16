import React from 'react';

interface VolumeChartProps {
  symbol: string;
  data?: any[];
}

export const VolumeChart: React.FC<VolumeChartProps> = ({ symbol, data }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">{symbol} Volume Chart</h3>
      <div className="h-64 flex items-center justify-center bg-gray-50 rounded">
        <div className="text-gray-500">
          📊 Volume Chart Component
          <br />
          <span className="text-sm">Trading volume visualization</span>
        </div>
      </div>
    </div>
  );
};