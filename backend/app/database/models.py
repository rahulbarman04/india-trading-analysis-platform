from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, JSON
from sqlalchemy.sql import func
from .connection import Base

class MarketData(Base):
    __tablename__ = "market_data"
    
    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(20), index=True, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    open_price = Column(Float, nullable=False)
    high_price = Column(Float, nullable=False)
    low_price = Column(Float, nullable=False)
    close_price = Column(Float, nullable=False)
    volume = Column(Integer, nullable=False)
    
class TechnicalIndicators(Base):
    __tablename__ = "technical_indicators"
    
    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(20), index=True, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    vwap = Column(Float)
    ema_9 = Column(Float)
    ema_21 = Column(Float)
    macd = Column(Float)
    macd_signal = Column(Float)
    macd_histogram = Column(Float)
    rsi = Column(Float)
    bb_upper = Column(Float)
    bb_middle = Column(Float)
    bb_lower = Column(Float)
    supertrend = Column(Float)
    supertrend_signal = Column(String(10))
    atr = Column(Float)
    fibonacci_levels = Column(JSON)
    volume_profile = Column(JSON)
    adx = Column(Float)

class SentimentAnalysis(Base):
    __tablename__ = "sentiment_analysis"
    
    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(20), index=True, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    source = Column(String(50))  # twitter, stocktwits, news
    content = Column(Text)
    sentiment_score = Column(Float)  # -1 to 1
    sentiment_label = Column(String(20))  # positive, negative, neutral
    confidence = Column(Float)

class MLPredictions(Base):
    __tablename__ = "ml_predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(20), index=True, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    model_type = Column(String(50))  # lstm, random_forest, etc.
    prediction_horizon = Column(String(20))  # 1d, 1w, 1m
    predicted_price = Column(Float)
    confidence_score = Column(Float)
    actual_price = Column(Float, nullable=True)  # Filled later for accuracy tracking

class OptionsData(Base):
    __tablename__ = "options_data"
    
    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(20), index=True, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    expiry_date = Column(DateTime)
    strike_price = Column(Float)
    option_type = Column(String(4))  # CALL or PUT
    premium = Column(Float)
    volume = Column(Integer)
    open_interest = Column(Integer)
    implied_volatility = Column(Float)

class TradingRecommendations(Base):
    __tablename__ = "trading_recommendations"
    
    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(20), index=True, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    recommendation_type = Column(String(20))  # BUY, SELL, HOLD
    entry_price = Column(Float)
    target_price = Column(Float)
    stop_loss = Column(Float)
    confidence_score = Column(Float)
    technical_reasoning = Column(Text)
    sentiment_reasoning = Column(Text)
    ml_reasoning = Column(Text)
    risk_level = Column(String(20))  # LOW, MEDIUM, HIGH
    is_options = Column(Boolean, default=False)
    option_strategy = Column(String(50), nullable=True)