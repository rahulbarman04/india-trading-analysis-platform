from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import requests
from bs4 import BeautifulSoup
from textblob import TextBlob
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from ..database.connection import get_db, get_redis
from ..database.models import SentimentAnalysis
from pydantic import BaseModel
from datetime import datetime, timedelta
import json
import asyncio

router = APIRouter()

class SentimentResponse(BaseModel):
    symbol: str
    overall_sentiment: str
    sentiment_score: float
    confidence: float
    sources: Dict[str, Any]
    timestamp: datetime

# Initialize sentiment analyzer
vader_analyzer = SentimentIntensityAnalyzer()

def analyze_sentiment_vader(text: str) -> Dict[str, float]:
    """Analyze sentiment using VADER"""
    scores = vader_analyzer.polarity_scores(text)
    return scores

def analyze_sentiment_textblob(text: str) -> Dict[str, float]:
    """Analyze sentiment using TextBlob"""
    blob = TextBlob(text)
    return {
        'polarity': blob.sentiment.polarity,
        'subjectivity': blob.sentiment.subjectivity
    }

def get_news_sentiment(symbol: str) -> List[Dict[str, Any]]:
    """Scrape and analyze news sentiment for a symbol"""
    news_data = []
    
    try:
        # Search for news articles (using a news API or web scraping)
        # For demo purposes, using placeholder data
        sample_headlines = [
            f"{symbol} shows strong performance in today's trading session",
            f"Market experts bullish on {symbol} prospects",
            f"{symbol} faces challenges amid market volatility",
            f"Technical analysis suggests {symbol} may see correction",
            f"{symbol} earnings report exceeds expectations"
        ]
        
        for headline in sample_headlines:
            # Analyze sentiment
            vader_scores = analyze_sentiment_vader(headline)
            textblob_scores = analyze_sentiment_textblob(headline)
            
            # Combine scores
            combined_score = (vader_scores['compound'] + textblob_scores['polarity']) / 2
            
            sentiment_label = 'neutral'
            if combined_score > 0.1:
                sentiment_label = 'positive'
            elif combined_score < -0.1:
                sentiment_label = 'negative'
            
            news_data.append({
                'headline': headline,
                'sentiment_score': combined_score,
                'sentiment_label': sentiment_label,
                'confidence': abs(combined_score),
                'source': 'news'
            })
    
    except Exception as e:
        print(f"Error fetching news sentiment: {e}")
    
    return news_data

def get_social_media_sentiment(symbol: str) -> List[Dict[str, Any]]:
    """Get social media sentiment (Twitter/StockTwits simulation)"""
    social_data = []
    
    try:
        # Simulated social media posts
        sample_posts = [
            f"$NIFTY looking strong today! Bullish on {symbol} 🚀",
            f"Not sure about {symbol} right now, might see a pullback",
            f"{symbol} technical setup looking good for swing trade",
            f"Sold my {symbol} position today, profit booking time",
            f"Adding more {symbol} to my portfolio on this dip"
        ]
        
        for post in sample_posts:
            # Analyze sentiment
            vader_scores = analyze_sentiment_vader(post)
            textblob_scores = analyze_sentiment_textblob(post)
            
            # Combine scores
            combined_score = (vader_scores['compound'] + textblob_scores['polarity']) / 2
            
            sentiment_label = 'neutral'
            if combined_score > 0.1:
                sentiment_label = 'positive'
            elif combined_score < -0.1:
                sentiment_label = 'negative'
            
            social_data.append({
                'content': post,
                'sentiment_score': combined_score,
                'sentiment_label': sentiment_label,
                'confidence': abs(combined_score),
                'source': 'social_media'
            })
    
    except Exception as e:
        print(f"Error fetching social media sentiment: {e}")
    
    return social_data

@router.get("/analyze/{symbol}")
async def analyze_sentiment(symbol: str, db: Session = Depends(get_db)):
    """Analyze overall sentiment for a symbol"""
    try:
        # Get sentiment data from different sources
        news_sentiment = get_news_sentiment(symbol)
        social_sentiment = get_social_media_sentiment(symbol)
        
        all_sentiments = news_sentiment + social_sentiment
        
        if not all_sentiments:
            raise HTTPException(status_code=404, detail="No sentiment data found")
        
        # Calculate overall sentiment
        total_score = sum(item['sentiment_score'] for item in all_sentiments)
        avg_score = total_score / len(all_sentiments)
        avg_confidence = sum(item['confidence'] for item in all_sentiments) / len(all_sentiments)
        
        # Determine overall sentiment label
        overall_sentiment = 'neutral'
        if avg_score > 0.1:
            overall_sentiment = 'positive'
        elif avg_score < -0.1:
            overall_sentiment = 'negative'
        
        # Count sentiment distribution
        positive_count = sum(1 for item in all_sentiments if item['sentiment_label'] == 'positive')
        negative_count = sum(1 for item in all_sentiments if item['sentiment_label'] == 'negative')
        neutral_count = sum(1 for item in all_sentiments if item['sentiment_label'] == 'neutral')
        
        # Save individual sentiments to database
        for sentiment_data in all_sentiments:
            sentiment_record = SentimentAnalysis(
                symbol=symbol.upper(),
                source=sentiment_data['source'],
                content=sentiment_data.get('headline') or sentiment_data.get('content'),
                sentiment_score=sentiment_data['sentiment_score'],
                sentiment_label=sentiment_data['sentiment_label'],
                confidence=sentiment_data['confidence']
            )
            db.add(sentiment_record)
        
        db.commit()
        
        return {
            "symbol": symbol.upper(),
            "overall_sentiment": overall_sentiment,
            "sentiment_score": avg_score,
            "confidence": avg_confidence,
            "distribution": {
                "positive": positive_count,
                "negative": negative_count,
                "neutral": neutral_count
            },
            "sources": {
                "news": {
                    "count": len(news_sentiment),
                    "avg_score": sum(item['sentiment_score'] for item in news_sentiment) / len(news_sentiment) if news_sentiment else 0
                },
                "social_media": {
                    "count": len(social_sentiment),
                    "avg_score": sum(item['sentiment_score'] for item in social_sentiment) / len(social_sentiment) if social_sentiment else 0
                }
            },
            "details": all_sentiments,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/historical/{symbol}")
async def get_historical_sentiment(
    symbol: str, 
    days: int = 7, 
    db: Session = Depends(get_db)
):
    """Get historical sentiment analysis"""
    try:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        # Query historical sentiment data
        sentiments = db.query(SentimentAnalysis).filter(
            SentimentAnalysis.symbol == symbol.upper(),
            SentimentAnalysis.timestamp >= start_date,
            SentimentAnalysis.timestamp <= end_date
        ).all()
        
        if not sentiments:
            return {"message": "No historical sentiment data found", "data": []}
        
        # Group by date
        daily_sentiment = {}
        for sentiment in sentiments:
            date_key = sentiment.timestamp.date().isoformat()
            if date_key not in daily_sentiment:
                daily_sentiment[date_key] = []
            daily_sentiment[date_key].append({
                "score": sentiment.sentiment_score,
                "label": sentiment.sentiment_label,
                "source": sentiment.source
            })
        
        # Calculate daily averages
        daily_averages = []
        for date, day_sentiments in daily_sentiment.items():
            avg_score = sum(s['score'] for s in day_sentiments) / len(day_sentiments)
            positive_count = sum(1 for s in day_sentiments if s['label'] == 'positive')
            negative_count = sum(1 for s in day_sentiments if s['label'] == 'negative')
            
            daily_averages.append({
                "date": date,
                "avg_sentiment_score": avg_score,
                "total_mentions": len(day_sentiments),
                "positive_mentions": positive_count,
                "negative_mentions": negative_count,
                "sentiment_trend": "positive" if avg_score > 0.1 else "negative" if avg_score < -0.1 else "neutral"
            })
        
        return {
            "symbol": symbol.upper(),
            "period_days": days,
            "daily_sentiment": daily_averages,
            "total_mentions": len(sentiments),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/trending")
async def get_trending_sentiment():
    """Get trending sentiment across all symbols"""
    try:
        # Simulate trending sentiment data
        trending_data = {
            "NIFTY": {"sentiment": "positive", "score": 0.3, "mentions": 150},
            "SENSEX": {"sentiment": "neutral", "score": 0.05, "mentions": 120},
            "BANKNIFTY": {"sentiment": "negative", "score": -0.2, "mentions": 80}
        }
        
        return {
            "trending_sentiment": trending_data,
            "last_updated": datetime.now().isoformat(),
            "data_sources": ["news", "social_media", "forums"]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))