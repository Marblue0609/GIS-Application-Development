"""
路线规划接口.

    GET /api/route/plan?travel_mode=walking   按打卡清单顺序规划一条路线

思路 (对应 plan.md 第 7 节):
    读取 check_list 中的餐厅, 按 check_order 顺序串成一条路线,
    计算总距离和预计耗时, 返回路线坐标供前端 Cesium 画折线.

本版本是**不依赖外部 API 的自包含版**: 用经纬度按大圆距离(haversine)估算相邻两点
直线距离之和, 按出行方式的平均速度估算耗时. 能直接跑、直接演示.

后续可升级为调用高德/百度路径规划 API 拿真实道路路线 (plan.md 实现方案1):
把下面 _straight_line_path 换成调用高德 API、用返回的 polyline 即可,
API key 建议放进 .env / config.py, 不要硬编码.

返回格式与项目其它接口对齐: {code, message, data}.
"""

import math

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db

router = APIRouter(prefix="/api/route", tags=["Route"])

# 各出行方式的平均速度 (米/秒), 用于估算耗时
TRAVEL_SPEED_MPS = {
    "walking": 1.3,    # 步行 ~4.7 km/h
    "bicycling": 4.0,  # 骑行 ~14 km/h
    "driving": 11.0,   # 驾车 ~40 km/h (城区)
}


def haversine_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """两个经纬度点之间的大圆距离, 单位米."""
    radius = 6371000.0  # 地球半径(米)
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@router.get("/plan")
def plan_route(travel_mode: str = "walking", db: Session = Depends(get_db)):
    """
    按打卡清单顺序规划路线, 返回途经点、路线坐标、总距离、预计耗时.

    参数:
        travel_mode: walking / bicycling / driving, 默认 walking, 仅影响耗时估算.

    示例:
        GET /api/route/plan
        GET /api/route/plan?travel_mode=driving
    """
    speed = TRAVEL_SPEED_MPS.get(travel_mode, TRAVEL_SPEED_MPS["walking"])

    rows = (
        db.execute(
            text("""
                SELECT c.check_order,
                       r.restaurant_id,
                       r.restaurant_name,
                       ST_X(r.restaurant_geom_position) AS lon,
                       ST_Y(r.restaurant_geom_position) AS lat
                FROM check_list c
                JOIN restaurants r ON r.restaurant_id = c.restaurant_id
                ORDER BY c.check_order ASC, c.check_id ASC
            """)
        )
        .mappings()
        .all()
    )

    waypoints = [
        {
            "order": row["check_order"],
            "id": str(row["restaurant_id"]),
            "name": row["restaurant_name"],
            "lng": float(row["lon"]),
            "lat": float(row["lat"]),
        }
        for row in rows
    ]

    # 路线坐标: 途经点按顺序连成的折线 [[lng, lat], ...]
    path = [[wp["lng"], wp["lat"]] for wp in waypoints]

    # 累加相邻两点直线距离
    total_distance_m = 0.0
    for a, b in zip(path, path[1:]):
        total_distance_m += haversine_m(a[0], a[1], b[0], b[1])

    estimated_duration_s = total_distance_m / speed if speed else 0.0

    message = "OK"
    if len(waypoints) < 2:
        # 清单为空或只有一家店, 无法成线
        message = "打卡清单不足两家餐厅, 无法规划路线"

    return {
        "code": 200,
        "message": message,
        "data": {
            "travelMode": travel_mode,
            "count": len(waypoints),
            "totalDistanceM": round(total_distance_m, 1),
            "estimatedDurationS": round(estimated_duration_s, 1),
            "waypoints": waypoints,
            "path": path,
        },
    }
