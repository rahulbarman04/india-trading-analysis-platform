import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { MarketAnalysis } from './pages/MarketAnalysis';
import { TechnicalAnalysis } from './pages/TechnicalAnalysis';
import { SentimentAnalysis } from './pages/SentimentAnalysis';
import { MLPredictions } from './pages/MLPredictions';
import { OptionsAnalysis } from './pages/OptionsAnalysis';
import { TradingRecommendations } from './pages/TradingRecommendations';
import { WebSocketProvider } from './context/WebSocketContext';
import { MarketDataProvider } from './context/MarketDataContext';
import './App.css';

function App() {
  return (
    <Router>
      <WebSocketProvider>
        <MarketDataProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/market" element={<MarketAnalysis />} />
              <Route path="/technical" element={<TechnicalAnalysis />} />
              <Route path="/sentiment" element={<SentimentAnalysis />} />
              <Route path="/predictions" element={<MLPredictions />} />
              <Route path="/options" element={<OptionsAnalysis />} />
              <Route path="/recommendations" element={<TradingRecommendations />} />
            </Routes>
          </Layout>
        </MarketDataProvider>
      </WebSocketProvider>
    </Router>
  );
}

export default App;