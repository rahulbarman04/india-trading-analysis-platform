import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  BarChart3, 
  TrendingUp, 
  Brain, 
  MessageCircle, 
  Target, 
  Settings, 
  Activity,
  PieChart
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { name: 'Market Data', href: '/market', icon: Activity },
  { name: 'Technical Analysis', href: '/technical', icon: TrendingUp },
  { name: 'Sentiment Analysis', href: '/sentiment', icon: MessageCircle },
  { name: 'ML Predictions', href: '/predictions', icon: Brain },
  { name: 'Options Analysis', href: '/options', icon: PieChart },
  { name: 'Recommendations', href: '/recommendations', icon: Target },
];

export const Sidebar: React.FC = () => {
  return (
    <div className="w-64 bg-white dark:bg-gray-800 shadow-sm border-r border-gray-200 dark:border-gray-700">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-center h-16 px-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Trading Platform
          </h1>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                  isActive
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-200'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.name}
            </NavLink>
          ))}
        </nav>
        
        <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
              <Settings className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Settings</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Configure platform</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};