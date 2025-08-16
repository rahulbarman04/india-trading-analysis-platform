from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np
from scipy.stats import norm
import yfinance as yf
from ..database.connection import get_db
from ..database.models import OptionsData, TradingRecommendations
from pydantic import BaseModel
from datetime import datetime, timedelta
import math

router = APIRouter()

class OptionsRecommendation(BaseModel):
    symbol: str
    strategy: str
    option_type: str
    strike_price: float
    premium: float
    entry_price: float
    target_price: float
    stop_loss: float
    expiry_date: str
    risk_reward_ratio: float
    confidence_score: float
    reasoning: str
    timestamp: datetime

class BlackScholesCalculator:
    @staticmethod
    def calculate_option_price(S, K, T, r, sigma, option_type='call'):
        """Calculate option price using Black-Scholes formula"""
        try:
            d1 = (np.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
            d2 = d1 - sigma * np.sqrt(T)
            
            if option_type.lower() == 'call':
                price = (S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2))
            else:  # put
                price = (K * np.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1))
            
            return max(0, price)
        except:
            return 0
    
    @staticmethod
    def calculate_greeks(S, K, T, r, sigma, option_type='call'):
        """Calculate option Greeks"""
        try:
            d1 = (np.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
            d2 = d1 - sigma * np.sqrt(T)
            
            # Delta
            if option_type.lower() == 'call':
                delta = norm.cdf(d1)
            else:
                delta = -norm.cdf(-d1)
            
            # Gamma
            gamma = norm.pdf(d1) / (S * sigma * np.sqrt(T))
            
            # Theta
            if option_type.lower() == 'call':
                theta = (-(S * norm.pdf(d1) * sigma) / (2 * np.sqrt(T)) 
                        - r * K * np.exp(-r * T) * norm.cdf(d2)) / 365
            else:
                theta = (-(S * norm.pdf(d1) * sigma) / (2 * np.sqrt(T)) 
                        + r * K * np.exp(-r * T) * norm.cdf(-d2)) / 365
            
            # Vega
            vega = S * norm.pdf(d1) * np.sqrt(T) / 100
            
            return {
                'delta': delta,
                'gamma': gamma,
                'theta': theta,
                'vega': vega
            }
        except:
            return {'delta': 0, 'gamma': 0, 'theta': 0, 'vega': 0}

def get_implied_volatility(symbol: str) -> float:
    """Calculate implied volatility from historical data"""
    try:
        symbol_map = {"NIFTY": "^NSEI", "SENSEX": "^BSESN", "BANKNIFTY": "^NSEBANK"}
        yf_symbol = symbol_map.get(symbol.upper(), symbol)
        
        ticker = yf.Ticker(yf_symbol)
        data = ticker.history(period="3mo", interval="1d")
        
        if data.empty:
            return 0.25  # Default volatility
        
        # Calculate historical volatility
        returns = data['Close'].pct_change().dropna()
        volatility = returns.std() * np.sqrt(252)  # Annualized volatility
        
        return volatility
    except:
        return 0.25

def generate_strike_prices(current_price: float, option_type: str) -> List[float]:
    """Generate relevant strike prices around current price"""
    strikes = []
    
    # Generate strikes at different moneyness levels
    percentages = [-10, -7.5, -5, -2.5, 0, 2.5, 5, 7.5, 10, 15, 20]
    
    for pct in percentages:
        strike = current_price * (1 + pct/100)
        strikes.append(round(strike/50) * 50)  # Round to nearest 50
    
    return sorted(list(set(strikes)))

def analyze_options_chain(symbol: str, current_price: float, expiry_days: int = 30) -> Dict[str, Any]:
    """Analyze options chain and generate data"""
    try:
        # Risk-free rate (approximate)
        risk_free_rate = 0.06  # 6% for Indian markets
        
        # Time to expiry
        T = expiry_days / 365.0
        
        # Implied volatility
        implied_vol = get_implied_volatility(symbol)
        
        # Generate strike prices
        strikes = generate_strike_prices(current_price, 'both')
        
        options_data = []
        bs_calculator = BlackScholesCalculator()
        
        for strike in strikes:
            # Calculate call option
            call_price = bs_calculator.calculate_option_price(
                current_price, strike, T, risk_free_rate, implied_vol, 'call'
            )
            call_greeks = bs_calculator.calculate_greeks(
                current_price, strike, T, risk_free_rate, implied_vol, 'call'
            )
            
            # Calculate put option
            put_price = bs_calculator.calculate_option_price(
                current_price, strike, T, risk_free_rate, implied_vol, 'put'
            )
            put_greeks = bs_calculator.calculate_greeks(
                current_price, strike, T, risk_free_rate, implied_vol, 'put'
            )
            
            options_data.append({
                'strike_price': strike,
                'call': {
                    'premium': round(call_price, 2),
                    'delta': round(call_greeks['delta'], 3),
                    'gamma': round(call_greeks['gamma'], 4),
                    'theta': round(call_greeks['theta'], 3),
                    'vega': round(call_greeks['vega'], 3),
                    'moneyness': 'ITM' if strike < current_price else 'OTM' if strike > current_price else 'ATM'
                },
                'put': {
                    'premium': round(put_price, 2),
                    'delta': round(put_greeks['delta'], 3),
                    'gamma': round(put_greeks['gamma'], 4),
                    'theta': round(put_greeks['theta'], 3),
                    'vega': round(put_greeks['vega'], 3),
                    'moneyness': 'ITM' if strike > current_price else 'OTM' if strike < current_price else 'ATM'
                }
            })
        
        return {
            'current_price': current_price,
            'implied_volatility': round(implied_vol, 4),
            'expiry_days': expiry_days,
            'risk_free_rate': risk_free_rate,
            'options_chain': options_data
        }
        
    except Exception as e:
        raise Exception(f"Error analyzing options chain: {str(e)}")

def generate_options_strategies(symbol: str, market_outlook: str, options_chain: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Generate options trading strategies based on market outlook"""
    strategies = []
    current_price = options_chain['current_price']
    
    try:
        if market_outlook.lower() == 'bullish':
            # Long Call strategy
            atm_call = next((opt for opt in options_chain['options_chain'] 
                           if opt['call']['moneyness'] == 'ATM'), None)
            if atm_call:
                strategies.append({
                    'strategy': 'Long Call',
                    'description': 'Buy call option for bullish outlook',
                    'legs': [{
                        'action': 'BUY',
                        'option_type': 'CALL',
                        'strike': atm_call['strike_price'],
                        'premium': atm_call['call']['premium']
                    }],
                    'max_profit': 'Unlimited',
                    'max_loss': atm_call['call']['premium'],
                    'breakeven': atm_call['strike_price'] + atm_call['call']['premium'],
                    'risk_reward': 'High Risk, High Reward'
                })
            
            # Bull Call Spread
            itm_call = next((opt for opt in options_chain['options_chain'] 
                           if opt['strike_price'] < current_price and opt['call']['premium'] > 0), None)
            otm_call = next((opt for opt in options_chain['options_chain'] 
                           if opt['strike_price'] > current_price and opt['call']['premium'] > 0), None)
            
            if itm_call and otm_call:
                net_premium = itm_call['call']['premium'] - otm_call['call']['premium']
                strategies.append({
                    'strategy': 'Bull Call Spread',
                    'description': 'Buy lower strike call, sell higher strike call',
                    'legs': [
                        {
                            'action': 'BUY',
                            'option_type': 'CALL',
                            'strike': itm_call['strike_price'],
                            'premium': itm_call['call']['premium']
                        },
                        {
                            'action': 'SELL',
                            'option_type': 'CALL',
                            'strike': otm_call['strike_price'],
                            'premium': otm_call['call']['premium']
                        }
                    ],
                    'max_profit': (otm_call['strike_price'] - itm_call['strike_price']) - net_premium,
                    'max_loss': net_premium,
                    'breakeven': itm_call['strike_price'] + net_premium,
                    'risk_reward': 'Limited Risk, Limited Reward'
                })
        
        elif market_outlook.lower() == 'bearish':
            # Long Put strategy
            atm_put = next((opt for opt in options_chain['options_chain'] 
                          if opt['put']['moneyness'] == 'ATM'), None)
            if atm_put:
                strategies.append({
                    'strategy': 'Long Put',
                    'description': 'Buy put option for bearish outlook',
                    'legs': [{
                        'action': 'BUY',
                        'option_type': 'PUT',
                        'strike': atm_put['strike_price'],
                        'premium': atm_put['put']['premium']
                    }],
                    'max_profit': atm_put['strike_price'] - atm_put['put']['premium'],
                    'max_loss': atm_put['put']['premium'],
                    'breakeven': atm_put['strike_price'] - atm_put['put']['premium'],
                    'risk_reward': 'High Risk, High Reward'
                })
        
        elif market_outlook.lower() == 'neutral':
            # Short Straddle
            atm_option = next((opt for opt in options_chain['options_chain']
                             if abs(opt['strike_price'] - current_price) < 50), None)
            if atm_option:
                total_premium = atm_option['call']['premium'] + atm_option['put']['premium']
                strategies.append({
                    'strategy': 'Short Straddle',
                    'description': 'Sell call and put at same strike for neutral outlook',
                    'legs': [
                        {
                            'action': 'SELL',
                            'option_type': 'CALL',
                            'strike': atm_option['strike_price'],
                            'premium': atm_option['call']['premium']
                        },
                        {
                            'action': 'SELL',
                            'option_type': 'PUT',
                            'strike': atm_option['strike_price'],
                            'premium': atm_option['put']['premium']
                        }
                    ],
                    'max_profit': total_premium,
                    'max_loss': 'Unlimited',
                    'breakeven_upper': atm_option['strike_price'] + total_premium,
                    'breakeven_lower': atm_option['strike_price'] - total_premium,
                    'risk_reward': 'Limited Profit, Unlimited Risk'
                })
        
        return strategies
        
    except Exception as e:
        print(f"Error generating strategies: {e}")
        return []

@router.get("/chain/{symbol}")
async def get_options_chain(symbol: str, expiry_days: int = 30):
    """Get options chain for a symbol"""
    try:
        # Get current price
        symbol_map = {"NIFTY": "^NSEI", "SENSEX": "^BSESN", "BANKNIFTY": "^NSEBANK"}
        yf_symbol = symbol_map.get(symbol.upper())
        
        if not yf_symbol:
            raise HTTPException(status_code=404, detail="Symbol not found")
        
        ticker = yf.Ticker(yf_symbol)
        data = ticker.history(period="1d", interval="1m")
        
        if data.empty:
            raise HTTPException(status_code=404, detail="No data available")
        
        current_price = data['Close'].iloc[-1]
        
        # Analyze options chain
        options_analysis = analyze_options_chain(symbol.upper(), current_price, expiry_days)
        
        return {
            "symbol": symbol.upper(),
            "analysis": options_analysis,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/strategies/{symbol}")
async def get_options_strategies(
    symbol: str, 
    market_outlook: str = "neutral",
    expiry_days: int = 30
):
    """Get options trading strategies based on market outlook"""
    try:
        # Get options chain
        chain_response = await get_options_chain(symbol, expiry_days)
        options_chain = chain_response['analysis']
        
        # Generate strategies
        strategies = generate_options_strategies(symbol.upper(), market_outlook, options_chain)
        
        return {
            "symbol": symbol.upper(),
            "market_outlook": market_outlook,
            "current_price": options_chain['current_price'],
            "implied_volatility": options_chain['implied_volatility'],
            "strategies": strategies,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/recommendations/{symbol}")
async def get_options_recommendations(symbol: str, db: Session = Depends(get_db)):
    """Get AI-powered options trading recommendations"""
    try:
        # Get current market data
        symbol_map = {"NIFTY": "^NSEI", "SENSEX": "^BSESN", "BANKNIFTY": "^NSEBANK"}
        yf_symbol = symbol_map.get(symbol.upper())
        
        if not yf_symbol:
            raise HTTPException(status_code=404, detail="Symbol not found")
        
        ticker = yf.Ticker(yf_symbol)
        data = ticker.history(period="1mo", interval="1d")
        
        if data.empty:
            raise HTTPException(status_code=404, detail="No data available")
        
        current_price = data['Close'].iloc[-1]
        
        # Simple trend analysis
        sma_5 = data['Close'].tail(5).mean()
        sma_20 = data['Close'].tail(20).mean()
        price_change_pct = ((current_price - data['Close'].iloc[-5]) / data['Close'].iloc[-5]) * 100
        
        # Determine market outlook
        if sma_5 > sma_20 and price_change_pct > 2:
            market_outlook = "bullish"
            confidence = 0.8
        elif sma_5 < sma_20 and price_change_pct < -2:
            market_outlook = "bearish"
            confidence = 0.8
        else:
            market_outlook = "neutral"
            confidence = 0.6
        
        # Get options chain and strategies
        options_chain = analyze_options_chain(symbol.upper(), current_price, 30)
        strategies = generate_options_strategies(symbol.upper(), market_outlook, options_chain)
        
        # Create recommendations
        recommendations = []
        for strategy in strategies[:2]:  # Top 2 strategies
            recommendation = {
                "symbol": symbol.upper(),
                "strategy": strategy['strategy'],
                "market_outlook": market_outlook,
                "confidence_score": confidence,
                "description": strategy['description'],
                "legs": strategy['legs'],
                "max_profit": strategy.get('max_profit', 'Variable'),
                "max_loss": strategy.get('max_loss', 'Variable'),
                "risk_level": "MEDIUM",
                "reasoning": f"Based on {market_outlook} outlook with {confidence*100:.0f}% confidence. Current price: {current_price:.2f}",
                "expiry_recommendation": "30 days",
                "timestamp": datetime.now().isoformat()
            }
            recommendations.append(recommendation)
        
        # Save to database
        for rec in recommendations:
            db_recommendation = TradingRecommendations(
                symbol=symbol.upper(),
                recommendation_type="OPTIONS",
                confidence_score=confidence,
                technical_reasoning=rec['reasoning'],
                risk_level="MEDIUM",
                is_options=True,
                option_strategy=rec['strategy']
            )
            db.add(db_recommendation)
        
        db.commit()
        
        return {
            "symbol": symbol.upper(),
            "market_outlook": market_outlook,
            "current_price": current_price,
            "implied_volatility": options_chain['implied_volatility'],
            "recommendations": recommendations,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/greeks/{symbol}")
async def get_options_greeks(symbol: str, strike: float, option_type: str = "call", expiry_days: int = 30):
    """Calculate option Greeks for specific strike and expiry"""
    try:
        # Get current price
        symbol_map = {"NIFTY": "^NSEI", "SENSEX": "^BSESN", "BANKNIFTY": "^NSEBANK"}
        yf_symbol = symbol_map.get(symbol.upper())
        
        if not yf_symbol:
            raise HTTPException(status_code=404, detail="Symbol not found")
        
        ticker = yf.Ticker(yf_symbol)
        data = ticker.history(period="1d", interval="1m")
        current_price = data['Close'].iloc[-1]
        
        # Calculate Greeks
        T = expiry_days / 365.0
        risk_free_rate = 0.06
        implied_vol = get_implied_volatility(symbol)
        
        bs_calculator = BlackScholesCalculator()
        option_price = bs_calculator.calculate_option_price(
            current_price, strike, T, risk_free_rate, implied_vol, option_type
        )
        greeks = bs_calculator.calculate_greeks(
            current_price, strike, T, risk_free_rate, implied_vol, option_type
        )
        
        return {
            "symbol": symbol.upper(),
            "current_price": current_price,
            "strike_price": strike,
            "option_type": option_type.upper(),
            "expiry_days": expiry_days,
            "option_price": round(option_price, 2),
            "implied_volatility": round(implied_vol, 4),
            "greeks": {
                "delta": round(greeks['delta'], 4),
                "gamma": round(greeks['gamma'], 6),
                "theta": round(greeks['theta'], 4),
                "vega": round(greeks['vega'], 4)
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))