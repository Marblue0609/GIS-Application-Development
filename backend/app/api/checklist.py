"""
打卡清单接口 (check_list).

    GET    /api/check-list            列出打卡清单 (按 check_order 排序, 带餐厅详情)
    POST   /api/check-list            把一家餐厅加入清单
    PUT    /api/check-list/{check_id} 修改某条 (顺序 check_order / 备注 note)
    DELETE /api/check-list/{check_id} 从清单移除某条

依赖数据库表 check_list (见 instruction.md):
    check_id SERIAL PK, restaurant_id 唯一(一家店只能加一次),
    check_order INT, note TEXT, created_at TIMESTAMP.

返回格式与 search.py (jzx) 对齐: {code, message, data}, 字段命名也对齐前端.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_db

router = APIRouter(prefix="/api/check-list", tags=["CheckList"])


# ---- 请求体 ----
class CheckListCreate(BaseModel):
    """加入打卡清单时的请求体. note 可选."""

    restaurant_id: int
    note: str | None = None


class CheckListUpdate(BaseModel):
    """修改打卡清单时的请求体, 两个字段都可选, 只传要改的那个."""

    check_order: int | None = None
    note: str | None = None


def format_item(row) -> dict:
    """把一行 (check_list JOIN restaurants) 转成前端需要的格式."""
    return {
        "checkId": row["check_id"],
        "checkOrder": row["check_order"],
        "note": row["note"],
        # 下面是餐厅本身的信息, 字段命名与 search.py 保持一致
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


# 共用的查询: check_list 关联餐厅信息
_SELECT_WITH_RESTAURANT = """
    SELECT c.check_id,
           c.check_order,
           c.note,
           r.restaurant_id,
           r.restaurant_name,
           r.restaurant_rate,
           r.restaurant_telephone,
           r.restaurant_category,
           r.restaurant_avg_price,
           r.restaurant_text_position,
           ST_X(r.restaurant_geom_position) AS lon,
           ST_Y(r.restaurant_geom_position) AS lat
    FROM check_list c
    JOIN restaurants r ON r.restaurant_id = c.restaurant_id
"""


@router.get("")
def list_check_list(db: Session = Depends(get_db)):
    """
    列出整个打卡清单, 按打卡顺序排序.

    示例:
        GET /api/check-list
    """
    rows = (
        db.execute(
            text(_SELECT_WITH_RESTAURANT + " ORDER BY c.check_order ASC, c.check_id ASC")
        )
        .mappings()
        .all()
    )

    return {
        "code": 200,
        "message": "OK",
        "data": {
            "items": [format_item(row) for row in rows],
            "total": len(rows),
        },
    }


@router.post("")
def add_to_check_list(payload: CheckListCreate, db: Session = Depends(get_db)):
    """
    把一家餐厅加入打卡清单. check_order 自动排到最后 (当前最大值 + 1).

    - 餐厅不存在 -> 400
    - 餐厅已在清单里 (restaurant_id 唯一) -> 409

    示例:
        POST /api/check-list
        body: {"restaurant_id": 1, "note": "周末和朋友去"}
    """
    insert_sql = text("""
        INSERT INTO check_list (restaurant_id, check_order, note)
        VALUES (
            :restaurant_id,
            COALESCE((SELECT MAX(check_order) FROM check_list), 0) + 1,
            :note
        )
        RETURNING check_id
    """)

    try:
        check_id = db.execute(
            insert_sql,
            {"restaurant_id": payload.restaurant_id, "note": payload.note},
        ).scalar()
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        # 外键失败 = 餐厅不存在; 唯一索引失败 = 已经加过了
        message = str(exc.orig).lower()
        if "foreign key" in message or "violates foreign key" in message:
            raise HTTPException(status_code=400, detail="该餐厅不存在")
        raise HTTPException(status_code=409, detail="该餐厅已在打卡清单中")

    # 把刚插入的这条连同餐厅信息查出来返回
    row = (
        db.execute(
            text(_SELECT_WITH_RESTAURANT + " WHERE c.check_id = :check_id"),
            {"check_id": check_id},
        )
        .mappings()
        .first()
    )

    return {"code": 200, "message": "OK", "data": format_item(row)}


@router.put("/{check_id}")
def update_check_list(
    check_id: int, payload: CheckListUpdate, db: Session = Depends(get_db)
):
    """
    修改打卡清单中的某条: 调整顺序 check_order 或备注 note. 只更新传进来的字段.

    示例:
        PUT /api/check-list/3
        body: {"check_order": 1}
    """
    update_sql = text("""
        UPDATE check_list
        SET check_order = COALESCE(:check_order, check_order),
            note        = COALESCE(:note, note)
        WHERE check_id = :check_id
        RETURNING check_id
    """)

    updated = db.execute(
        update_sql,
        {
            "check_id": check_id,
            "check_order": payload.check_order,
            "note": payload.note,
        },
    ).scalar()

    if updated is None:
        db.rollback()
        raise HTTPException(status_code=404, detail="打卡清单中没有这一条")

    db.commit()

    row = (
        db.execute(
            text(_SELECT_WITH_RESTAURANT + " WHERE c.check_id = :check_id"),
            {"check_id": check_id},
        )
        .mappings()
        .first()
    )

    return {"code": 200, "message": "OK", "data": format_item(row)}


@router.delete("/{check_id}")
def delete_from_check_list(check_id: int, db: Session = Depends(get_db)):
    """
    从打卡清单移除某条.

    示例:
        DELETE /api/check-list/3
    """
    deleted = db.execute(
        text("DELETE FROM check_list WHERE check_id = :check_id RETURNING check_id"),
        {"check_id": check_id},
    ).scalar()

    if deleted is None:
        db.rollback()
        raise HTTPException(status_code=404, detail="打卡清单中没有这一条")

    db.commit()

    return {"code": 200, "message": "OK", "data": {"checkId": deleted}}
