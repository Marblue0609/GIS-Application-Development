import uvicorn
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db

from app.api.search import router as search_router
from app.api.restaurants import router as restaurants_router

app = FastAPI(
    title="CityTaste API",
    description="Citytaste Backend API",
    version="0.1.0",
    servers=[{"url": "http://127.0.0.1:8000", "description": "Localhost server"}],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search_router)
app.include_router(restaurants_router)


@app.get("/", tags=["Root"])
def root():
    return {
        "message": "CityTaste API is alive",
        "docs": "/docs",
        "openapi": "/openapi.json",
    }


# API Health test
@app.get("/api/health", tags=["Health Check"])
def health_check():
    return {"status": "OK", "version": "0.1.0", "update date": "2026-05-28"}


# Database Health test
@app.get("/api/db/check", tags=["Health Check"])
def db_health_check(db: Session = Depends(get_db)):
    result = db.execute(text("SELECT 1 AS OK")).mappings().first()

    return {"database": "connected", "result": result}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
