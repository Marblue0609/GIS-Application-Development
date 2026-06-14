"""
随机盲盒推荐接口.

    GET /api/restaurants/random   在(可选)筛选条件下随机抽一家餐厅

支持和搜索一样的可选筛选: keyword / category / min_price / max_price / min_rating.
没有任何条件时就是从全部餐厅里随机抽一家.

注意: 本路由前缀是 /api/restaurants, 与 restaurants.py 的 /{restaurant_id} 同前缀,
所以 main.py 里必须把本 router 挂在 restaurants_router 之前, 否则 /random 会被
/{restaurant_id} 当成 id 抢走 (和 jzx 的 /search 同理).

返回格式与 search.py (jzx) 对齐: {code, message, data}.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db

router = APIRouter(prefix="/api/restaurants", tags=["Restaurants"])


@router.get("/random")
def random_restaurant(
    keyword: str | None = None,
    category: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    min_rating: float | None = None,
    db: Session = Depends(get_db),
):
    """
    随机盲盒: 在筛选条件内 ORDER BY RANDOM() 抽 1 家. 条件都可选.

    示例:
        GET /api/restaurants/random
        GET /api/restaurants/random?category=火锅&min_rating=4.0&max_price=100
    """
    keyword_like = f"%{keyword}%" if keyword else None

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
        AND (:max_price IS NULL OR restaurant_avg_price <= :max_price)
        AND (:min_rating IS NULL OR restaurant_rate >= :min_rating)
        ORDER BY RANDOM()
        LIMIT 1
    """)

    row = (
        db.execute(
            sql,
            {
                "keyword": keyword,
                "keyword_like": keyword_like,
                "category": category,
                "min_price": min_price,
                "max_price": max_price,
                "min_rating": min_rating,
            },
        )
        .mappings()
        .first()
    )

    if row is None:
        raise HTTPException(status_code=404, detail="没有符合条件的餐厅")

    data = {
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
    }

    return {"code": 200, "message": "OK", "data": data}
