from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error
import yfinance as yf
import joblib
import os
from ..database.connection import get_db
from ..database.models import MLPredictions
from pydantic import BaseModel
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

router = APIRouter()

class PredictionResponse(BaseModel):
    symbol: str
    model_type: str
    prediction_horizon: str
    predicted_price: float
    current_price: float
    confidence_score: float
    change_percentage: float
    recommendation: str
    timestamp: datetime

class MLModelManager:
    def __init__(self):
        self.models = {}
        self.scalers = {}
        self.model_dir = "backend/app/ml_models"
        os.makedirs(self.model_dir, exist_ok=True)
    
    def prepare_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """Prepare features for ML model"""
        features = pd.DataFrame()
        
        # Price features
        features['close'] = data['Close']
        features['open'] = data['Open']
        features['high'] = data['High']
        features['low'] = data['Low']
        features['volume'] = data['Volume']
        
        # Technical indicators
        features['sma_5'] = data['Close'].rolling(window=5).mean()
        features['sma_10'] = data['Close'].rolling(window=10).mean()
        features['sma_20'] = data['Close'].rolling(window=20).mean()
        
        # Price changes
        features['price_change'] = data['Close'].pct_change()
        features['price_change_5'] = data['Close'].pct_change(periods=5)
        
        # Volatility
        features['volatility'] = data['Close'].rolling(window=10).std()
        
        # RSI
        delta = data['Close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        features['rsi'] = 100 - (100 / (1 + rs))
        
        # MACD
        ema12 = data['Close'].ewm(span=12).mean()
        ema26 = data['Close'].ewm(span=26).mean()
        features['macd'] = ema12 - ema26
        features['macd_signal'] = features['macd'].ewm(span=9).mean()
        
        # Bollinger Bands
        bb_middle = data['Close'].rolling(window=20).mean()
        bb_std = data['Close'].rolling(window=20).std()
        features['bb_upper'] = bb_middle + (bb_std * 2)
        features['bb_lower'] = bb_middle - (bb_std * 2)
        features['bb_position'] = (data['Close'] - bb_lower) / (bb_upper - bb_lower)
        
        # Lag features
        for lag in [1, 2, 3, 5]:
            features[f'close_lag_{lag}'] = data['Close'].shift(lag)
            features[f'volume_lag_{lag}'] = data['Volume'].shift(lag)
        
        return features.dropna()
    
    def create_sequences(self, data: np.ndarray, seq_length: int = 10):
        """Create sequences for time series prediction"""
        X, y = [], []
        for i in range(seq_length, len(data)):
            X.append(data[i-seq_length:i])
            y.append(data[i])
        return np.array(X), np.array(y)
    
    def train_random_forest_model(self, symbol: str, data: pd.DataFrame) -> Dict[str, Any]:
        """Train Random Forest model"""
        try:
            features = self.prepare_features(data)
            
            if len(features) < 50:
                raise ValueError("Insufficient data for training")
            
            # Prepare target variable (next day's close price)
            features['target'] = features['close'].shift(-1)
            features = features.dropna()
            
            # Split features and target
            X = features.drop(['target'], axis=1)
            y = features['target']
            
            # Split train/test
            split_idx = int(len(X) * 0.8)
            X_train, X_test = X[:split_idx], X[split_idx:]
            y_train, y_test = y[:split_idx], y[split_idx:]
            
            # Scale features
            scaler = MinMaxScaler()
            X_train_scaled = scaler.fit_transform(X_train)
            X_test_scaled = scaler.transform(X_test)
            
            # Train model
            model = RandomForestRegressor(
                n_estimators=100,
                max_depth=10,
                random_state=42,
                n_jobs=-1
            )
            model.fit(X_train_scaled, y_train)
            
            # Evaluate
            y_pred = model.predict(X_test_scaled)
            mae = mean_absolute_error(y_test, y_pred)
            accuracy = 1 - (mae / np.mean(y_test))
            
            # Save model and scaler
            model_path = f"{self.model_dir}/{symbol}_rf_model.joblib"
            scaler_path = f"{self.model_dir}/{symbol}_rf_scaler.joblib"
            
            joblib.dump(model, model_path)
            joblib.dump(scaler, scaler_path)
            
            self.models[f"{symbol}_rf"] = model
            self.scalers[f"{symbol}_rf"] = scaler
            
            return {
                "model_type": "random_forest",
                "accuracy": accuracy,
                "mae": mae,
                "feature_count": len(X.columns),
                "training_samples": len(X_train)
            }
            
        except Exception as e:
            raise Exception(f"Error training Random Forest model: {str(e)}")
    
    def predict_with_model(self, symbol: str, data: pd.DataFrame, model_type: str = "random_forest") -> Dict[str, Any]:
        """Make prediction using trained model"""
        try:
            model_key = f"{symbol}_{model_type.replace('_', '')}"
            
            # Load model if not in memory
            if model_key not in self.models:
                model_path = f"{self.model_dir}/{symbol}_rf_model.joblib"
                scaler_path = f"{self.model_dir}/{symbol}_rf_scaler.joblib"
                
                if not os.path.exists(model_path):
                    # Train model if it doesn't exist
                    training_result = self.train_random_forest_model(symbol, data)
                else:
                    self.models[model_key] = joblib.load(model_path)
                    self.scalers[model_key] = joblib.load(scaler_path)
            
            # Prepare features
            features = self.prepare_features(data)
            
            if len(features) == 0:
                raise ValueError("No features available for prediction")
            
            # Get last row for prediction
            X_pred = features.iloc[-1:].drop(['close'], axis=1, errors='ignore')
            X_pred_scaled = self.scalers[model_key].transform(X_pred)
            
            # Make prediction
            prediction = self.models[model_key].predict(X_pred_scaled)[0]
            
            current_price = data['Close'].iloc[-1]
            change_percentage = ((prediction - current_price) / current_price) * 100
            
            # Calculate confidence based on historical accuracy
            # Simplified confidence calculation
            volatility = data['Close'].pct_change().std()
            confidence = max(0.5, min(0.95, 1 - (volatility * 10)))
            
            return {
                "predicted_price": prediction,
                "current_price": current_price,
                "change_percentage": change_percentage,
                "confidence": confidence
            }
            
        except Exception as e:
            raise Exception(f"Error making prediction: {str(e)}")

ml_manager = MLModelManager()

@router.post("/train/{symbol}")
async def train_model(symbol: str, model_type: str = "random_forest", db: Session = Depends(get_db)):
    """Train ML model for a symbol"""
    try:
        # Map symbol to Yahoo Finance
        symbol_map = {"NIFTY": "^NSEI", "SENSEX": "^BSESN", "BANKNIFTY": "^NSEBANK"}
        yf_symbol = symbol_map.get(symbol.upper())
        
        if not yf_symbol:
            raise HTTPException(status_code=404, detail="Symbol not found")
        
        # Get historical data
        ticker = yf.Ticker(yf_symbol)
        data = ticker.history(period="2y", interval="1d")
        
        if len(data) < 100:
            raise HTTPException(status_code=400, detail="Insufficient data for training")
        
        # Train model
        if model_type == "random_forest":
            result = ml_manager.train_random_forest_model(symbol.upper(), data)
        else:
            raise HTTPException(status_code=400, detail="Unsupported model type")
        
        return {
            "symbol": symbol.upper(),
            "model_type": model_type,
            "training_result": result,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/predict/{symbol}")
async def predict_price(
    symbol: str, 
    horizon: str = "1d",
    model_type: str = "random_forest",
    db: Session = Depends(get_db)
):
    """Get price prediction for a symbol"""
    try:
        # Map symbol to Yahoo Finance
        symbol_map = {"NIFTY": "^NSEI", "SENSEX": "^BSESN", "BANKNIFTY": "^NSEBANK"}
        yf_symbol = symbol_map.get(symbol.upper())
        
        if not yf_symbol:
            raise HTTPException(status_code=404, detail="Symbol not found")
        
        # Get historical data
        ticker = yf.Ticker(yf_symbol)
        data = ticker.history(period="6mo", interval="1d")
        
        if data.empty:
            raise HTTPException(status_code=404, detail="No data available")
        
        # Make prediction
        prediction_result = ml_manager.predict_with_model(symbol.upper(), data, model_type)
        
        # Generate recommendation
        change_pct = prediction_result['change_percentage']
        confidence = prediction_result['confidence']
        
        if change_pct > 2 and confidence > 0.7:
            recommendation = "Strong Buy"
        elif change_pct > 0.5 and confidence > 0.6:
            recommendation = "Buy"
        elif change_pct < -2 and confidence > 0.7:
            recommendation = "Strong Sell"
        elif change_pct < -0.5 and confidence > 0.6:
            recommendation = "Sell"
        else:
            recommendation = "Hold"
        
        # Save prediction to database
        ml_prediction = MLPredictions(
            symbol=symbol.upper(),
            model_type=model_type,
            prediction_horizon=horizon,
            predicted_price=prediction_result['predicted_price'],
            confidence_score=confidence
        )
        
        db.add(ml_prediction)
        db.commit()
        
        return {
            "symbol": symbol.upper(),
            "model_type": model_type,
            "prediction_horizon": horizon,
            "predicted_price": round(prediction_result['predicted_price'], 2),
            "current_price": round(prediction_result['current_price'], 2),
            "confidence_score": round(confidence, 3),
            "change_percentage": round(change_pct, 2),
            "recommendation": recommendation,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/predictions/{symbol}/history")
async def get_prediction_history(symbol: str, days: int = 30, db: Session = Depends(get_db)):
    """Get historical predictions and their accuracy"""
    try:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        predictions = db.query(MLPredictions).filter(
            MLPredictions.symbol == symbol.upper(),
            MLPredictions.timestamp >= start_date,
            MLPredictions.timestamp <= end_date
        ).all()
        
        if not predictions:
            return {"message": "No prediction history found", "data": []}
        
        history = []
        for pred in predictions:
            history.append({
                "timestamp": pred.timestamp.isoformat(),
                "model_type": pred.model_type,
                "predicted_price": pred.predicted_price,
                "actual_price": pred.actual_price,
                "confidence_score": pred.confidence_score,
                "accuracy": abs(pred.predicted_price - pred.actual_price) / pred.actual_price * 100 if pred.actual_price else None
            })
        
        return {
            "symbol": symbol.upper(),
            "period_days": days,
            "total_predictions": len(predictions),
            "history": history,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/models/status")
async def get_model_status():
    """Get status of all trained models"""
    try:
        model_files = []
        if os.path.exists(ml_manager.model_dir):
            model_files = [f for f in os.listdir(ml_manager.model_dir) if f.endswith('.joblib')]
        
        models_status = {}
        for file in model_files:
            if 'model' in file:
                symbol = file.split('_')[0]
                model_type = file.split('_')[1]
                models_status[symbol] = {
                    "model_type": model_type,
                    "file": file,
                    "status": "trained"
                }
        
        return {
            "total_models": len(models_status),
            "models": models_status,
            "supported_symbols": ["NIFTY", "SENSEX", "BANKNIFTY"],
            "supported_models": ["random_forest"],
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))