from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db

router = APIRouter(prefix="/api/restaurants", tags=["Restaurants"])


@router.get("/search", tags=["Restaurants"])
def search_restaurants(
    keyword: str | None = None,
    category: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    min_rating: float | None = None,
    limit: int = 80,
    offset: int = 0,
    db: Session = Depends(get_db),
    center_lon: float | None = None,
    center_lat: float | None = None,
    radius: float | None = None,
):
    keyword_like = f"%{keyword}%" if keyword else None
    use_distance = (
        center_lon is not None and center_lat is not None and radius is not None
    )

    sql = text("""
        SELECT restaurant_id,
               restaurant_name, 
               restaurant_rate, 
               restaurant_telephone, 
               restaurant_category, 
               restaurant_avg_price, 
               restaurant_text_position, 
               ST_X(restaurant_geom_position) AS lon, 
               ST_Y(restaurant_geom_position) AS lat, 
               CASE
                WHEN :use_distance THEN ST_Distance(
                    restaurant_geom_position::geography, 
                    ST_SetSRID(ST_MakePoint(:center_lon, :center_lat, 0), 4326)::geography)
        ELSE NULL
               END AS distance_m
        FROM restaurants
        WHERE (:keyword IS NULL
               OR restaurant_name ILIKE :keyword_like
               OR restaurant_text_position ILIKE :keyword_like
               OR restaurant_category ILIKE :keyword_like)
        AND (:category IS NULL OR restaurant_category = :category)
        AND (:min_price IS NULL OR restaurant_avg_price >= :min_price) 
        AND (:max_price IS NULL OR restaurant_avg_price <= :max_price) 
        AND (:min_rating IS NULL OR restaurant_rate >= :min_rating)
        AND (
               :use_distance = FALSE
               OR ST_DWithin(
                    restaurant_geom_position::geography, 
                    ST_SetSRID(
                        ST_MakePoint(:center_lon, :center_lat, 0), 4326
                    )::geography, 
                    :radius
                )
        )
        ORDER BY distance_m ASC NULLS LAST, 
                 restaurant_rate DESC NULLS LAST, 
                 restaurant_id ASC
        LIMIT :limit OFFSET :offset 
    """)

    rows = (
        db.execute(
            sql,
            {
                "keyword": keyword,
                "keyword_like": keyword_like,
                "category": category,
                "min_price": min_price,
                "max_price": max_price,
                "min_rating": min_rating,
                "limit": limit,
                "offset": offset,
                "use_distance": use_distance,
                "center_lon": center_lon,
                "center_lat": center_lat,
                "radius": radius,
            },
        )
        .mappings()
        .all()
    )

    count_sql = text("""
        SELECT COUNT(*) AS total
        FROM restaurants
        WHERE (:keyword IS NULL
               OR restaurant_name ILIKE :keyword_like
               OR restaurant_text_position ILIKE :keyword_like
               OR restaurant_category ILIKE :keyword_like)
        AND (:category IS NULL OR restaurant_category = :category)
        AND (:min_price IS NULL OR restaurant_avg_price >= :min_price) 
        AND (:max_price IS NULL OR restaurant_avg_price <= :max_price) 
        AND (:min_rating IS NULL OR restaurant_rate >= :min_rating)
        AND (
                :use_distance = FALSE
                OR ST_DWithin(
                        restaurant_geom_position::geography,
                        ST_SetSRID(
                            ST_MakePoint(:center_lon, :center_lat, 0), 4326
                        )::geography,
                        :radius
                    )
            )
    """)

    total = db.execute(
        count_sql,
        params={
            "keyword": keyword,
            "keyword_like": keyword_like,
            "category": category,
            "min_price": min_price,
            "max_price": max_price,
            "min_rating": min_rating,
            "use_distance": use_distance,
            "center_lon": center_lon,
            "center_lat": center_lat,
            "radius": radius,
        },
    ).scalar()

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
            "lng": float(row["lon"]),
            "lat": float(row["lat"]),
            "distanceM": (
                float(row["distance_m"]) if row["distance_m"] is not None else None
            ),
        }
        for row in rows
    ]

    return {
        "code": 200,
        "message": "OK",
        "data": {"items": items, "total": total, "limit": limit, "offset": offset},
    }
