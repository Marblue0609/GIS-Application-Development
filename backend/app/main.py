import uvicorn
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db

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


@app.get("/", tags=["Root"])
def root():
    return {"message": "CityTaste API is alive", "docs": "/docs", "openapi": "/openapi.json"}


# API Health test
@app.get("/api/health", tags=["Health Check"])
def health_check():
    return {"status": "OK", "version": "0.1.0", "update date": "2026-05-28"}


# Database Health test
@app.get("/api/db/check", tags=["Health Check"])
def db_health_check(db: Session = Depends(get_db)):
    result = db.execute(text("SELECT 1 AS OK")).mappings().first()

    return {"database": "connected", "result": result}

@app.get("api/restaurants/search", tags=["Restaurants"])
def search_restaurants(
    keyword: str | None = None, 
    category: str | None = None, 
    min_price: float | None = None, 
    max_price: float | None = None,
    min_rating: float | None= None, 
    limit: int = 80, 
    offset: int = 0, 
    db: Session = Depends(get_db)
): 
    keyword_like = f"%{keyword}" if keyword else None

    sql = text("""
        SELECT restaurant_id,
               restaurant_name, 
               restaurant_rate, 
               restaurant_telephone, 
               restaurant_category, 
               restaurant_avg_price, 
               restaurant_text_position, 
               ST_X(restaurant_geom_position) AS lon, 
               ST_Y(restaurant_geom_position) AS lat
        FROM restaurants
        WHERE (:keyword IS NULL
               OR restaurant_name ILIKE :keyword_like
               OR restaurant_text_position ILIKE :keyword_like
               OR restaurant_category ILIKE :keyword_like)
        AND (:category IS NULL OR restaurant_category = :category)
        AND (:min_price IS NULL OR restaurant_avg_price >= :min_price) 
        AND (:max_price IS NULL OR restaurant_avg_price <= :min_price) 
        AND (:min_rating IS NULL OR restaurant_rate >= :min_rating)
        ORDER BY restaurant_rate DESC NULLS LAST, restaurant_id ASC
        LIMIT :limit OFFSET :offset 
    """)

    rows = db.execute(sql, {
        "keyword": keyword, 
        "keyword_like": keyword_like, 
        "category": category, 
        "min_price": min_price, 
        "max_price": max_price, 
        "min_rating": min_rating, 
        "limit": limit, 
        "offset": offset
    }).mappings().all()

    items = [
        {
            "id": str(row["restaurant_id"]),
            "layerType": "restaurant",
            "name": row["restaurant_name"],
            "rating": float(row["restaurant_rate"] or 0),
            "phone": row["restaurant_telephone"] or "暂无电话",
            "category": row["restaurant_category"] or "其他",
            "price": float(row["restaurant_avg_price"] or 0),
            "address": row["restaurant_text_position"] or "暂无地址",
            "lng": float(row["lng"]),
            "lat": float(row["lat"])
        }
        for row in rows
    ]

    return {
        "code": 200, 
        "message": "OK", 
        "data": {
            "items": items,
            "limit": limit, 
            "offset": offset
        }
    }

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
