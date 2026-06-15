"""
路线规划接口.

    GET /api/route/plan?travel_mode=walking   按打卡清单顺序规划一条真实道路路线

思路 (对应 plan.md 第 7 节, 实现方案1 = 调高德 API):
    读取 check_list 中的餐厅, 按 check_order 顺序, 相邻两家调用一次高德路径规划 API,
    把每段的真实道路坐标/距离/耗时拼起来, 返回给前端 Cesium 画折线.

高德 key 配置在 .env 的 AMAP_KEY (见 .env.example), 不硬编码.

兜底机制: 如果没配 key, 或高德调用失败, 自动退回直线距离(haversine)估算,
返回里的 method 字段会标明用的是 "amap"(真实路网) 还是 "straight_line"(直线兜底),
这样即使 key 没到位或网络不好, 接口也不会崩, 演示链路始终能跑通.

返回格式与项目其它接口对齐: {code, message, data}.
"""

import json
import math
import urllib.parse
import urllib.request

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db

router = APIRouter(prefix="/api/route", tags=["Route"])

# 高德路径规划 API: 不同出行方式用不同接口
#   步行 / 驾车 是 v3 接口, 返回结构一致 (route.paths[0])
#   骑行 是 v4 接口, 返回结构不同 (data.paths[0])
AMAP_DIRECTION_URL = {
    "walking": "https://restapi.amap.com/v3/direction/walking",
    "driving": "https://restapi.amap.com/v3/direction/driving",
    "bicycling": "https://restapi.amap.com/v4/direction/bicycling",
}

# 兜底估算用的平均速度 (米/秒), 仅在没配 key / 高德调用失败时使用
FALLBACK_SPEED_MPS = {
    "walking": 1.3,  # 步行 ~4.7 km/h
    "bicycling": 4.0,  # 骑行 ~14 km/h
    "driving": 11.0,  # 驾车 ~40 km/h (城区)
}

# 高德是国内服务, 强制直连、不走系统代理.
# 否则本机若开着 VPN/Clash(或残留 HTTP(S)_PROXY 环境变量), 会把国内请求
# 转到海外节点导致 SSL 握手超时. 用空 ProxyHandler 显式绕过代理.
_DIRECT_OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def haversine_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """两个经纬度点之间的大圆距离, 单位米 (兜底用)."""
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


def _fmt_point(lng: float, lat: float) -> str:
    """高德要求坐标格式为 '经度,纬度', 保留6位小数."""
    return f"{lng:.6f},{lat:.6f}"


def _parse_polyline(polyline: str) -> list[list[float]]:
    """把高德返回的 '经,纬;经,纬;...' 字符串解析成 [[lng, lat], ...]."""
    points = []
    for pair in polyline.split(";"):
        if not pair:
            continue
        lng, lat = pair.split(",")
        points.append([float(lng), float(lat)])
    return points


def amap_leg(
    mode: str, origin: str, destination: str, key: str
) -> tuple[float, float, list[list[float]]]:
    """
    调一次高德路径规划, 返回 (该段距离米, 该段耗时秒, 该段真实道路坐标点).
    出错抛异常, 由上层统一兜底.
    """
    params = urllib.parse.urlencode(
        {"key": key, "origin": origin, "destination": destination}
    )
    url = f"{AMAP_DIRECTION_URL[mode]}?{params}"
    with _DIRECT_OPENER.open(url, timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    if mode == "bicycling":
        # v4 结构: {"errcode":0, "data":{"paths":[{distance,duration,steps:[{polyline}]}]}}
        if data.get("errcode") != 0:
            raise RuntimeError(f"高德骑行接口错误: {data.get('errmsg')}")
        path = data["data"]["paths"][0]
    else:
        # v3 结构: {"status":"1", "route":{"paths":[{distance,duration,steps:[{polyline}]}]}}
        if data.get("status") != "1":
            raise RuntimeError(f"高德接口错误: {data.get('info')}")
        path = data["route"]["paths"][0]

    distance = float(path["distance"])
    duration = float(path["duration"])
    points: list[list[float]] = []
    for step in path["steps"]:
        points.extend(_parse_polyline(step["polyline"]))
    return distance, duration, points


@router.get("/plan")
def plan_route(travel_mode: str = "walking", db: Session = Depends(get_db)):
    """
    按打卡清单顺序规划路线, 返回途经点、真实道路坐标、总距离、预计耗时.

    参数:
        travel_mode: walking / driving / bicycling, 默认 walking.

    返回 data 里的 method:
        "amap"          = 高德真实路网结果 (path 是沿道路的坐标)
        "straight_line" = 没配 key 或高德失败时的直线兜底 (path 是途经点直连)

    示例:
        GET /api/route/plan
        GET /api/route/plan?travel_mode=driving
    """
    if travel_mode not in AMAP_DIRECTION_URL:
        raise HTTPException(
            status_code=400,
            detail=f"travel_mode 只支持 {list(AMAP_DIRECTION_URL)}",
        )

    rows = db.execute(text("""
                SELECT c.check_order,
                       r.restaurant_id,
                       r.restaurant_name,
                       ST_X(r.restaurant_geom_position) AS lon,
                       ST_Y(r.restaurant_geom_position) AS lat
                FROM check_list c
                JOIN restaurants r ON r.restaurant_id = c.restaurant_id
                ORDER BY c.check_order ASC, c.check_id ASC
            """)).mappings().all()

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

    # 打卡清单不足两家, 无法成线, 直接返回
    if len(waypoints) < 2:
        return {
            "code": 200,
            "message": "打卡清单不足两家餐厅, 无法规划路线",
            "data": {
                "travelMode": travel_mode,
                "method": "none",
                "count": len(waypoints),
                "totalDistanceM": 0.0,
                "estimatedDurationS": 0.0,
                "waypoints": waypoints,
                "path": [[wp["lng"], wp["lat"]] for wp in waypoints],
            },
        }

    key = settings.amap_key.strip()
    method = "amap"
    note = None
    total_distance_m = 0.0
    total_duration_s = 0.0
    path: list[list[float]] = []

    if key:
        # 有 key: 相邻两家调一次高德, 把各段真实路线拼起来
        try:
            for a, b in zip(waypoints, waypoints[1:]):
                dist, dur, pts = amap_leg(
                    travel_mode,
                    _fmt_point(a["lng"], a["lat"]),
                    _fmt_point(b["lng"], b["lat"]),
                    key,
                )
                total_distance_m += dist
                total_duration_s += dur
                path.extend(pts)
        except Exception as exc:  # noqa: BLE001 - 任何失败都退回直线, 保证不崩
            method = "straight_line"
            note = f"高德调用失败, 已退回直线估算: {exc}"
    else:
        method = "straight_line"
        note = "未配置 AMAP_KEY, 当前为直线估算; 在 .env 填入 AMAP_KEY 即为真实路网"

    # 兜底: 直线估算
    if method == "straight_line":
        path = [[wp["lng"], wp["lat"]] for wp in waypoints]
        total_distance_m = 0.0
        for a, b in zip(path, path[1:]):
            total_distance_m += haversine_m(a[0], a[1], b[0], b[1])
        speed = FALLBACK_SPEED_MPS[travel_mode]
        total_duration_s = total_distance_m / speed

    data = {
        "travelMode": travel_mode,
        "method": method,
        "count": len(waypoints),
        "totalDistanceM": round(total_distance_m, 1),
        "estimatedDurationS": round(total_duration_s, 1),
        "waypoints": waypoints,
        "path": path,
    }
    if note:
        data["note"] = note

    return {"code": 200, "message": "OK", "data": data}
