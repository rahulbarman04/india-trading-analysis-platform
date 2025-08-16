from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import os
from dotenv import load_dotenv

from app.database.connection import engine, SessionLocal
from app.database.models import Base
from app.routers import market_data, technical_analysis, sentiment, ml_predictions, options_analysis

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="Trading Analysis Platform API",
    description="Comprehensive trading analysis platform for Indian stock markets",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create database tables
Base.metadata.create_all(bind=engine)

# Include routers
app.include_router(market_data.router, prefix="/api/market", tags=["Market Data"])
app.include_router(technical_analysis.router, prefix="/api/technical", tags=["Technical Analysis"])
app.include_router(sentiment.router, prefix="/api/sentiment", tags=["Sentiment Analysis"])
app.include_router(ml_predictions.router, prefix="/api/ml", tags=["ML Predictions"])
app.include_router(options_analysis.router, prefix="/api/options", tags=["Options Analysis"])

@app.get("/")
async def root():
    return {"message": "Trading Analysis Platform API", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "backend"}

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"message": f"Internal server error: {str(exc)}"}
    )

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )