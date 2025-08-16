from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List
import pandas as pd
import numpy as np
import yfinance as yf
from ..database.connection import get_db
from ..database.models import TechnicalIndicators
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

class TechnicalAnalysisResponse(BaseModel):
    symbol: str
    timestamp: datetime
    indicators: Dict[str, Any]
    signals: Dict[str, str]
    
    class Config:
        from_attributes = True

def calculate_vwap(data):
    """Calculate Volume Weighted Average Price"""
    typical_price = (data['High'] + data['Low'] + data['Close']) / 3
    vwap = (typical_price * data['Volume']).cumsum() / data['Volume'].cumsum()
    return vwap.iloc[-1]

def calculate_ema(data, period):
    """Calculate Exponential Moving Average"""
    return data['Close'].ewm(span=period).mean().iloc[-1]

def calculate_macd(data):
    """Calculate MACD"""
    ema12 = data['Close'].ewm(span=12).mean()
    ema26 = data['Close'].ewm(span=26).mean()
    macd = ema12 - ema26
    signal = macd.ewm(span=9).mean()
    histogram = macd - signal
    
    return {
        'macd': macd.iloc[-1],
        'signal': signal.iloc[-1],
        'histogram': histogram.iloc[-1]
    }

def calculate_rsi(data, period=14):
    """Calculate RSI"""
    delta = data['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    return rsi.iloc[-1]

def calculate_bollinger_bands(data, period=20, std=2):
    """Calculate Bollinger Bands"""
    middle = data['Close'].rolling(window=period).mean()
    std_dev = data['Close'].rolling(window=period).std()
    upper = middle + (std_dev * std)
    lower = middle - (std_dev * std)
    
    return {
        'upper': upper.iloc[-1],
        'middle': middle.iloc[-1],
        'lower': lower.iloc[-1]
    }

def calculate_supertrend(data, period=10, multiplier=3):
    """Calculate Supertrend"""
    hl2 = (data['High'] + data['Low']) / 2
    atr = calculate_atr(data, period)
    
    basic_upper = hl2 + (multiplier * atr)
    basic_lower = hl2 - (multiplier * atr)
    
    # Simplified supertrend calculation
    current_close = data['Close'].iloc[-1]
    upper_band = basic_upper.iloc[-1]
    lower_band = basic_lower.iloc[-1]
    
    if current_close > upper_band:
        trend = "bullish"
        supertrend_value = lower_band
    else:
        trend = "bearish"
        supertrend_value = upper_band
    
    return {
        'value': supertrend_value,
        'trend': trend
    }

def calculate_atr(data, period=14):
    """Calculate Average True Range"""
    high_low = data['High'] - data['Low']
    high_close = np.abs(data['High'] - data['Close'].shift())
    low_close = np.abs(data['Low'] - data['Close'].shift())
    
    true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    atr = true_range.rolling(window=period).mean()
    return atr.iloc[-1]

def calculate_fibonacci_levels(data):
    """Calculate Fibonacci retracement levels"""
    high = data['High'].max()
    low = data['Low'].min()
    diff = high - low
    
    levels = {
        '0%': high,
        '23.6%': high - 0.236 * diff,
        '38.2%': high - 0.382 * diff,
        '50%': high - 0.5 * diff,
        '61.8%': high - 0.618 * diff,
        '100%': low
    }
    
    return levels

def calculate_volume_profile(data):
    """Calculate simplified volume profile"""
    # Group by price ranges and sum volumes
    price_ranges = pd.cut(data['Close'], bins=10)
    volume_profile = data.groupby(price_ranges)['Volume'].sum().to_dict()
    
    # Convert to serializable format
    profile = {}
    for range_key, volume in volume_profile.items():
        if pd.notna(range_key):
            profile[f"{range_key.left:.2f}-{range_key.right:.2f}"] = int(volume)
    
    return profile

def calculate_adx(data, period=14):
    """Calculate ADX"""
    # Simplified ADX calculation
    high_diff = data['High'].diff()
    low_diff = -data['Low'].diff()
    
    plus_dm = high_diff.where(high_diff > low_diff, 0).where(high_diff > 0, 0)
    minus_dm = low_diff.where(low_diff > high_diff, 0).where(low_diff > 0, 0)
    
    atr = calculate_atr(data, period)
    plus_di = 100 * (plus_dm.rolling(window=period).mean() / atr)
    minus_di = 100 * (minus_dm.rolling(window=period).mean() / atr)
    
    dx = 100 * abs(plus_di - minus_di) / (plus_di + minus_di)
    adx = dx.rolling(window=period).mean()
    
    return adx.iloc[-1] if not pd.isna(adx.iloc[-1]) else 0

@router.get("/analyze/{symbol}")
async def analyze_symbol(symbol: str, db: Session = Depends(get_db)):
    """Perform comprehensive technical analysis"""
    try:
        # Map symbol to Yahoo Finance
        symbol_map = {"NIFTY": "^NSEI", "SENSEX": "^BSESN", "BANKNIFTY": "^NSEBANK"}
        yf_symbol = symbol_map.get(symbol.upper())
        
        if not yf_symbol:
            raise HTTPException(status_code=404, detail="Symbol not found")
        
        # Get historical data
        ticker = yf.Ticker(yf_symbol)
        data = ticker.history(period="3mo", interval="1d")
        
        if data.empty:
            raise HTTPException(status_code=404, detail="No data available")
        
        # Calculate all indicators
        indicators = {
            'vwap': calculate_vwap(data),
            'ema_9': calculate_ema(data, 9),
            'ema_21': calculate_ema(data, 21),
            'macd': calculate_macd(data),
            'rsi': calculate_rsi(data),
            'bollinger_bands': calculate_bollinger_bands(data),
            'supertrend': calculate_supertrend(data),
            'atr': calculate_atr(data),
            'fibonacci_levels': calculate_fibonacci_levels(data),
            'volume_profile': calculate_volume_profile(data),
            'adx': calculate_adx(data)
        }
        
        # Generate signals
        current_price = data['Close'].iloc[-1]
        signals = {}
        
        # RSI signals
        rsi = indicators['rsi']
        if rsi > 70:
            signals['rsi'] = 'overbought'
        elif rsi < 30:
            signals['rsi'] = 'oversold'
        else:
            signals['rsi'] = 'neutral'
        
        # MACD signals
        macd_data = indicators['macd']
        if macd_data['macd'] > macd_data['signal']:
            signals['macd'] = 'bullish'
        else:
            signals['macd'] = 'bearish'
        
        # Bollinger Bands signals
        bb = indicators['bollinger_bands']
        if current_price > bb['upper']:
            signals['bollinger'] = 'overbought'
        elif current_price < bb['lower']:
            signals['bollinger'] = 'oversold'
        else:
            signals['bollinger'] = 'neutral'
        
        # Supertrend signal
        signals['supertrend'] = indicators['supertrend']['trend']
        
        # EMA signals
        ema_9 = indicators['ema_9']
        ema_21 = indicators['ema_21']
        if ema_9 > ema_21:
            signals['ema'] = 'bullish'
        else:
            signals['ema'] = 'bearish'
        
        # Save to database
        tech_indicators = TechnicalIndicators(
            symbol=symbol.upper(),
            vwap=indicators['vwap'],
            ema_9=indicators['ema_9'],
            ema_21=indicators['ema_21'],
            macd=macd_data['macd'],
            macd_signal=macd_data['signal'],
            macd_histogram=macd_data['histogram'],
            rsi=indicators['rsi'],
            bb_upper=bb['upper'],
            bb_middle=bb['middle'],
            bb_lower=bb['lower'],
            supertrend=indicators['supertrend']['value'],
            supertrend_signal=indicators['supertrend']['trend'],
            atr=indicators['atr'],
            fibonacci_levels=indicators['fibonacci_levels'],
            volume_profile=indicators['volume_profile'],
            adx=indicators['adx']
        )
        
        db.add(tech_indicators)
        db.commit()
        
        return {
            "symbol": symbol.upper(),
            "timestamp": datetime.now().isoformat(),
            "current_price": current_price,
            "indicators": indicators,
            "signals": signals
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/signals/{symbol}")
async def get_trading_signals(symbol: str):
    """Get trading signals summary"""
    try:
        analysis = await analyze_symbol(symbol)
        signals = analysis['signals']
        
        # Count bullish/bearish signals
        bullish_count = sum(1 for signal in signals.values() if signal in ['bullish', 'oversold'])
        bearish_count = sum(1 for signal in signals.values() if signal in ['bearish', 'overbought'])
        
        overall_signal = 'neutral'
        if bullish_count > bearish_count:
            overall_signal = 'bullish'
        elif bearish_count > bullish_count:
            overall_signal = 'bearish'
        
        return {
            "symbol": symbol.upper(),
            "overall_signal": overall_signal,
            "bullish_indicators": bullish_count,
            "bearish_indicators": bearish_count,
            "individual_signals": signals,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))