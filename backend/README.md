# CityTaste 后端 (FastAPI)

CityTaste 餐饮空间分析平台的后端 API，基于 **FastAPI + SQLAlchemy + PostgreSQL/PostGIS**。
用 SQLAlchemy 的 `text()` 写原生 PostGIS SQL，不做复杂 ORM。

## 目录结构

```
backend/
├── app/
│   ├── main.py              # 入口, 注册所有路由
│   ├── core/config.py       # 读取 .env 配置 (含 AMAP_KEY)
│   ├── db/session.py        # 数据库连接 / get_db
│   └── api/
│       ├── restaurants.py   # 餐厅列表 / 详情
│       ├── search.py        # 多条件检索 + 距离搜索
│       ├── recommend.py     # 随机盲盒
│       ├── checklist.py     # 打卡清单 (增删改查)
│       └── route.py         # 路线规划 (高德真实路网)
├── requirements.txt
└── .env.example             # 配置模板 (真实 .env 不提交)
```

## 如何运行

### 1. 准备环境

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows PowerShell
# source .venv/bin/activate     # Linux / macOS / 服务器
pip install -r requirements.txt
```

### 2. 配置 .env

复制 `.env.example` 为 `.env`，填入真实值（`.env` 不提交，已在 .gitignore）：

```env
DATABASE_URL=postgresql://citytaste_user:123456@127.0.0.1:15432/citytaste
APP_NAME=CityTaste API
APP_ENV=dev
BACKEND_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
AMAP_KEY=你的高德Web服务key   # 路线规划用, 不填则路线退回直线估算
```

> 数据库在 AutoDL 服务器上。本地开发需先开 SSH 隧道把远程 5432 映射到本地 15432：
> ```bash
> ssh -p <端口> root@<服务器域名> -L 15432:127.0.0.1:5432
> ```
> 若后端直接跑在服务器上，则用 `127.0.0.1:5432`。

### 3. 启动

```bash
# 必须在 backend/ 目录下启动
uvicorn app.main:app --reload
```

打开 `http://127.0.0.1:8000/docs` 即可在浏览器交互测试所有接口。

## 统一返回格式

所有接口返回统一信封：

```json
{ "code": 200, "message": "OK", "data": { ... } }
```

餐厅对象字段命名（前端对齐用）：

```
id, layerType, name, rating, phone, category, price, address, lng, lat
```

## 接口清单

### 健康检查
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 服务存活检查 |
| GET | `/api/db/check` | 数据库连接检查 |

### 餐厅 `restaurants.py`
| 方法 | 路径 | 参数 | 说明 |
|---|---|---|---|
| GET | `/api/restaurants` | `limit=80` `offset=0` | 餐厅列表（分页，返回 total） |
| GET | `/api/restaurants/{id}` | — | 餐厅详情（查不到 404） |

### 多条件检索 + 距离搜索 `search.py`
| 方法 | 路径 | 参数 |
|---|---|---|
| GET | `/api/restaurants/search` | `keyword` `category` `min_price` `max_price` `min_rating` `limit` `offset` `center_lon` `center_lat` `radius` |

- 传 `center_lon` + `center_lat` + `radius`(米) 时启用距离搜索（PostGIS `ST_DWithin`），结果带 `distanceM` 并按距离排序。

### 随机盲盒 `recommend.py`
| 方法 | 路径 | 参数 | 说明 |
|---|---|---|---|
| GET | `/api/restaurants/random` | `keyword` `category` `min_price` `max_price` `min_rating`（均可选） | 在条件内随机抽 1 家；无符合 404 |

### 打卡清单 `checklist.py`
| 方法 | 路径 | 请求体 / 参数 | 说明 |
|---|---|---|---|
| GET | `/api/check-list` | — | 列出清单（按 check_order 排序，带餐厅详情） |
| POST | `/api/check-list` | `{ "restaurant_id": 1, "note": "可选" }` | 加入清单，check_order 自动排到最后。餐厅不存在→400，重复加→409 |
| PUT | `/api/check-list/{check_id}` | `{ "check_order": 1, "note": "都可选" }` | 改顺序 / 备注。不存在→404 |
| DELETE | `/api/check-list/{check_id}` | — | 移除某条。不存在→404 |

> 依赖数据库表 `check_list`，建表 SQL 见 `instruction.md`。

### 路线规划 `route.py`
| 方法 | 路径 | 参数 | 说明 |
|---|---|---|---|
| GET | `/api/route/plan` | `travel_mode=walking`（walking/driving/bicycling） | 按打卡清单顺序规划路线 |

返回 `data`：
```json
{
  "travelMode": "walking",
  "method": "amap",          // amap=高德真实路网; straight_line=直线兜底
  "count": 3,
  "totalDistanceM": 10478.0,
  "estimatedDurationS": 8382.0,
  "waypoints": [{ "order": 1, "id": "1", "name": "...", "lng": 120.09, "lat": 30.30 }],
  "path": [[120.0906, 30.3082], [120.0905, 30.3086], "..."]   // 沿道路的坐标, 前端连成折线
}
```

- 相邻两个打卡点调一次高德路径规划 API，拼接真实道路坐标/距离/耗时。
- 高德调用强制直连绕过系统代理（避免本机 VPN 把国内请求转海外导致超时）。
- **兜底**：没配 `AMAP_KEY` 或高德调用失败时，自动退回直线估算（`method=straight_line`），接口不会崩。
- 打卡清单不足两家时返回 `method=none`。

## 注意事项

- **菜系是精确匹配**：数据库里是「火锅店」「川渝菜馆」等真实分类名，不是「火锅」。前端做下拉框请用数据库真实分类名。
- **启动目录**：必须在 `backend/` 下用 `uvicorn app.main:app` 启动（import 用 `app.` 前缀）。
- **凭证不提交**：`.env`（数据库密码、AMAP_KEY）已在 .gitignore，不要提交到 git。
