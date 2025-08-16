from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import yfinance as yf
from ..database.connection import get_db, get_redis
from ..database.models import MarketData
from pydantic import BaseModel
import json

router = APIRouter()

class MarketDataResponse(BaseModel):
    symbol: str
    timestamp: datetime
    open_price: float
    high_price: float
    low_price: float
    close_price: float
    volume: int
    
    class Config:
        from_attributes = True

# Indian market symbols
INDIAN_SYMBOLS = {
    "NIFTY": "^NSEI",
    "SENSEX": "^BSESN", 
    "BANKNIFTY": "^NSEBANK"
}

@router.get("/symbols")
async def get_available_symbols():
    """Get list of available symbols"""
    return {"symbols": list(INDIAN_SYMBOLS.keys())}

@router.get("/realtime/{symbol}")
async def get_realtime_data(symbol: str, db: Session = Depends(get_db)):
    """Get real-time market data for a symbol"""
    try:
        # Map symbol to Yahoo Finance symbol
        yf_symbol = INDIAN_SYMBOLS.get(symbol.upper())
        if not yf_symbol:
            raise HTTPException(status_code=404, detail="Symbol not found")
        
        # Get data from Yahoo Finance
        ticker = yf.Ticker(yf_symbol)
        data = ticker.history(period="1d", interval="1m")
        
        if data.empty:
            raise HTTPException(status_code=404, detail="No data available")
        
        latest = data.iloc[-1]
        
        # Create market data record
        market_data = MarketData(
            symbol=symbol.upper(),
            open_price=float(latest['Open']),
            high_price=float(latest['High']),
            low_price=float(latest['Low']),
            close_price=float(latest['Close']),
            volume=int(latest['Volume'])
        )
        
        # Save to database
        db.add(market_data)
        db.commit()
        db.refresh(market_data)
        
        return MarketDataResponse.model_validate(market_data)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/historical/{symbol}")
async def get_historical_data(
    symbol: str, 
    period: str = "1mo",
    interval: str = "1d",
    db: Session = Depends(get_db)
):
    """Get historical market data"""
    try:
        yf_symbol = INDIAN_SYMBOLS.get(symbol.upper())
        if not yf_symbol:
            raise HTTPException(status_code=404, detail="Symbol not found")
        
        ticker = yf.Ticker(yf_symbol)
        data = ticker.history(period=period, interval=interval)
        
        if data.empty:
            raise HTTPException(status_code=404, detail="No data available")
        
        # Convert to list of records
        records = []
        for timestamp, row in data.iterrows():
            records.append({
                "symbol": symbol.upper(),
                "timestamp": timestamp.isoformat(),
                "open_price": float(row['Open']),
                "high_price": float(row['High']),
                "low_price": float(row['Low']),
                "close_price": float(row['Close']),
                "volume": int(row['Volume'])
            })
        
        return {"data": records}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/market-status")
async def get_market_status():
    """Get Indian market status"""
    try:
        # Check if Indian markets are open (simplified)
        now = datetime.now()
        market_hours = {
            "pre_market": {"start": "09:00", "end": "09:15"},
            "regular": {"start": "09:15", "end": "15:30"},
            "post_market": {"start": "15:40", "end": "16:00"}
        }
        
        current_time = now.strftime("%H:%M")
        status = "closed"
        
        for session, hours in market_hours.items():
            if hours["start"] <= current_time <= hours["end"]:
                status = session
                break
        
        return {
            "status": status,
            "timestamp": now.isoformat(),
            "market_hours": market_hours
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))