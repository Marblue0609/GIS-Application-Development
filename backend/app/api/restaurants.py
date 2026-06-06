"""
Restaurant info endpoints (餐厅信息接口).

    GET /api/restaurants        餐厅列表 (分页, 返回总数)
    GET /api/restaurants/{id}   餐厅详情

注意: 多条件检索 /search 由 search.py (jzx) 负责, 本文件不重复实现.
返回格式与 search.py 保持一致: {code, message, data}, 字段命名也对齐前端 (lng/lat/rating...).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db

router = APIRouter(prefix="/api/restaurants", tags=["Restaurants"])

# 共用字段. ST_X / ST_Y 从 geometry 取出经纬度, 起别名 lon / lat.
RESTAURANT_COLUMNS = """
    restaurant_id,
    restaurant_name,
    restaurant_rate,
    restaurant_telephone,
    restaurant_category,
    restaurant_avg_price,
    restaurant_text_position,
    ST_X(restaurant_geom_position) AS lon,
    ST_Y(restaurant_geom_position) AS lat
"""


def format_restaurant(row) -> dict:
    """把数据库一行转成前端需要的格式 (与 search.py 字段命名一致)."""
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
    }


@router.get("")
def list_restaurants(
    limit: int = 80,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """
    餐厅列表, 按 restaurant_id 升序, 支持分页.

    示例:
        GET /api/restaurants?limit=20&offset=0
    """
    rows = (
        db.execute(
            text(
                f"""
                SELECT {RESTAURANT_COLUMNS}
                FROM restaurants
                ORDER BY restaurant_id
                LIMIT :limit OFFSET :offset
                """
            ),
            {"limit": limit, "offset": offset},
        )
        .mappings()
        .all()
    )

    total = db.execute(text("SELECT COUNT(*) FROM restaurants")).scalar()

    return {
        "code": 200,
        "message": "OK",
        "data": {
            "items": [format_restaurant(row) for row in rows],
            "total": total,
            "limit": limit,
            "offset": offset,
        },
    }


@router.get("/{restaurant_id}")
def get_restaurant(restaurant_id: int, db: Session = Depends(get_db)):
    """
    根据 ID 查询单个餐厅详情, 查不到返回 404.

    示例:
        GET /api/restaurants/1
    """
    row = (
        db.execute(
            text(
                f"""
                SELECT {RESTAURANT_COLUMNS}
                FROM restaurants
                WHERE restaurant_id = :restaurant_id
                """
            ),
            {"restaurant_id": restaurant_id},
        )
        .mappings()
        .first()
    )

    if row is None:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    return {"code": 200, "message": "OK", "data": format_restaurant(row)}
