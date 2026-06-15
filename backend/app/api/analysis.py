"""
Buffer analysis endpoints (缓冲区分析接口).

    GET /api/analysis/buffer

Given a WGS84 center point and radius in meters, this endpoint returns:
    - restaurants inside the buffer, ordered by distance;
    - category count / ratio statistics;
    - overall average price and rating.

The database stores PointZ geometry in EPSG:4326. Distance calculations cast
geometry to geography so radius values are interpreted in meters.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db

router = APIRouter(prefix="/api/analysis", tags=["Analysis"])


def format_restaurant(row) -> dict:
    """Convert a restaurant row to the frontend shape used by search.py."""
    return {
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


@router.get("/buffer")
def buffer_analysis(
    center_lng: float | None = None,
    center_lon: float | None = None,
    center_lat: float | None = None,
    radius: float = 1000,
    db: Session = Depends(get_db),
):
    """
    Analyze restaurants inside a radius around a point.

    Parameters:
        center_lng / center_lon: center longitude in EPSG:4326.
        center_lat: center latitude in EPSG:4326.
        radius: buffer radius in meters.

    Examples:
        GET /api/analysis/buffer?center_lng=120.08&center_lat=30.30&radius=1000
        GET /api/analysis/buffer?center_lon=120.08&center_lat=30.30&radius=1000
    """
    lon = center_lng if center_lng is not None else center_lon
    if lon is None or center_lat is None:
        raise HTTPException(
            status_code=400,
            detail="center_lng 或 center_lon 与 center_lat 为必填参数",
        )
    if radius <= 0:
        raise HTTPException(status_code=400, detail="radius 必须大于 0")

    params = {"center_lon": lon, "center_lat": center_lat, "radius": radius}

    restaurants_sql = text("""
        SELECT restaurant_id,
               restaurant_name,
               restaurant_rate,
               restaurant_telephone,
               restaurant_category,
               restaurant_avg_price,
               restaurant_text_position,
               ST_X(restaurant_geom_position) AS lon,
               ST_Y(restaurant_geom_position) AS lat,
               ST_Distance(
                    restaurant_geom_position::geography,
                    ST_SetSRID(
                        ST_MakePoint(:center_lon, :center_lat, 0), 4326
                    )::geography
               ) AS distance_m
        FROM restaurants
        WHERE ST_DWithin(
            restaurant_geom_position::geography,
            ST_SetSRID(
                ST_MakePoint(:center_lon, :center_lat, 0), 4326
            )::geography,
            :radius
        )
        ORDER BY distance_m ASC, restaurant_rate DESC NULLS LAST, restaurant_id ASC
    """)

    rows = db.execute(restaurants_sql, params).mappings().all()

    stats_sql = text("""
        SELECT COALESCE(restaurant_category, '其他') AS category,
               COUNT(*) AS count,
               AVG(restaurant_avg_price) AS avg_price,
               AVG(restaurant_rate) AS avg_rating
        FROM restaurants
        WHERE ST_DWithin(
            restaurant_geom_position::geography,
            ST_SetSRID(
                ST_MakePoint(:center_lon, :center_lat, 0), 4326
            )::geography,
            :radius
        )
        GROUP BY COALESCE(restaurant_category, '其他')
        ORDER BY count DESC, category ASC
    """)

    stat_rows = db.execute(stats_sql, params).mappings().all()
    total = len(rows)
    category_stats = [
        {
            "name": row["category"],
            "value": int(row["count"]),
            "ratio": (float(row["count"]) / total if total else 0),
            "avgPrice": (
                float(row["avg_price"]) if row["avg_price"] is not None else None
            ),
            "avgRating": (
                float(row["avg_rating"]) if row["avg_rating"] is not None else None
            ),
        }
        for row in stat_rows
    ]

    priced_rows = [row for row in rows if row["restaurant_avg_price"] is not None]
    rated_rows = [row for row in rows if row["restaurant_rate"] is not None]
    avg_price = (
        sum(float(row["restaurant_avg_price"]) for row in priced_rows)
        / len(priced_rows)
        if priced_rows
        else None
    )
    avg_rating = (
        sum(float(row["restaurant_rate"]) for row in rated_rows) / len(rated_rows)
        if rated_rows
        else None
    )

    return {
        "code": 200,
        "message": "OK",
        "data": {
            "center": {"lng": float(lon), "lat": float(center_lat)},
            "radius": float(radius),
            "items": [format_restaurant(row) for row in rows],
            "total": total,
            "categoryStats": category_stats,
            "summary": {
                "avgPrice": round(avg_price, 2) if avg_price is not None else None,
                "avgRating": round(avg_rating, 2) if avg_rating is not None else None,
            },
        },
    }
