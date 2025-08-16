import React from 'react';
import { useMarketData } from '../../context/MarketDataContext';
import { useWebSocket } from '../../context/WebSocketContext';
import { Bell, Wifi, WifiOff, RefreshCw } from 'lucide-react';

export const Header: React.FC = () => {
  const { selectedSymbol, setSelectedSymbol, isLoading } = useMarketData();
  const { isConnected } = useWebSocket();
  
  const symbols = ['NIFTY', 'SENSEX', 'BANKNIFTY'];

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Trading Analysis Dashboard
          </h2>
          
          <div className="flex items-center space-x-2">
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="input-field w-32"
            >
              {symbols.map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <div className="flex items-center space-x-1 text-success-600">
                <Wifi className="w-4 h-4" />
                <span className="text-sm font-medium">Connected</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1 text-danger-600">
                <WifiOff className="w-4 h-4" />
                <span className="text-sm font-medium">Disconnected</span>
              </div>
            )}
          </div>
          
          {isLoading && (
            <div className="flex items-center space-x-1 text-warning-600">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          )}
          
          <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <Bell className="w-5 h-5" />
          </button>
          
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-white">U</span>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-gray-900 dark:text-white">User</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Trader</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};