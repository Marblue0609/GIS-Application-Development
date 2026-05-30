我看了一下你这个项目，当前状态大致是：

项目已经有比较完整的**项目计划、数据处理脚本、清洗后的空间数据、数据库字段说明和 GeoServer 接入说明**。但仓库里目前还没有真正的 FastAPI 后端代码目录。也就是说，现在最适合做的事情不是“改后端”，而是**从零初始化一个后端模块**，并让它先稳定连接 PostgreSQL/PostGIS，再逐步补 API。

你们项目的后端目标应该是：

```text
React / Cesium 前端
        ↓ HTTP 请求
FastAPI 后端
        ↓ SQL / PostGIS 空间查询
PostgreSQL + PostGIS
        ↓ 可选
GeoServer 图层服务
```

FastAPI 本身适合做 API 服务，官方文档也强调它基于 Python 类型提示构建 API，并且可以与任意关系型数据库配合使用；SQLAlchemy 则是 Python 里常用的数据库访问工具。你们这个项目已经有 PostgreSQL/PostGIS 表，所以我建议先用 **FastAPI + SQLAlchemy + psycopg2/psycopg + 原生 SQL/PostGIS 查询**，不要一上来做太复杂的 ORM 封装。([FastAPI][1])

---

## 一、建议先建立的后端目录结构

在项目根目录下新增一个 `backend/`：

```text
GIS-Application-Development/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   │   └── config.py
│   │   ├── db/
│   │   │   └── session.py
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── api.py
│   │   │       └── endpoints/
│   │   │           ├── health.py
│   │   │           ├── restaurants.py
│   │   │           ├── landmarks.py
│   │   │           ├── transportations.py
│   │   │           └── analysis.py
│   │   ├── schemas/
│   │   │   ├── restaurant.py
│   │   │   ├── landmark.py
│   │   │   └── analysis.py
│   │   └── services/
│   │       ├── restaurant_service.py
│   │       └── analysis_service.py
│   ├── requirements.txt
│   ├── .env.example
│   └── README.md
├── ld-data/
├── plan.md
├── instruction.md
└── README.md
```

这里先不建议把结构做得太复杂。你们现在的核心目标是：**能跑、能连数据库、能查餐厅、能做空间范围查询、能给前端返回 JSON / GeoJSON**。

---

## 二、第一阶段：初始化 FastAPI 后端环境

先在项目根目录执行：

```bash
mkdir backend
cd backend

python -m venv .venv
```

Windows PowerShell 激活：

```powershell
.venv\Scripts\activate
```

Linux / macOS / 服务器激活：

```bash
source .venv/bin/activate
```

安装依赖：

```bash
pip install fastapi uvicorn[standard] sqlalchemy psycopg2-binary pydantic-settings python-dotenv
```

生成依赖文件：

```bash
pip freeze > requirements.txt
```

第一阶段先用这些就够了：

```text
fastapi              API 框架
uvicorn              FastAPI 运行服务器
sqlalchemy           数据库访问
psycopg2-binary      PostgreSQL 驱动
pydantic-settings    读取 .env 配置
python-dotenv        支持环境变量文件
```

暂时不急着装 `GeoAlchemy2`。因为你们当前主要是查询已有的 PostGIS 表，用 SQLAlchemy 的 `text()` 写 PostGIS SQL 会更直接、更容易调试。

---

## 三、第二阶段：配置数据库连接

你们项目文档里已经写了数据库连接信息，但不要把真实密码硬编码进代码，也不要提交 `.env`。

在 `backend/` 下创建：

```bash
touch .env.example
```

内容写成模板：

```env
DATABASE_URL=postgresql://citytaste_user:your_password@127.0.0.1:5432/citytaste
APP_NAME=CityTaste API
APP_ENV=dev
BACKEND_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

然后你自己本地创建 `.env`：

```env
DATABASE_URL=postgresql://citytaste_user:实际密码@127.0.0.1:5432/citytaste
APP_NAME=CityTaste API
APP_ENV=dev
BACKEND_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

注意：`.env` 不要提交。你们 `.gitignore` 里已经排除了 `.env*`，并保留了 `.env.example`，这个设置是合理的。

如果 FastAPI 后端运行在 AutoDL 服务器上，数据库地址可以用：

```text
127.0.0.1:5432
```

如果 FastAPI 后端运行在你本地 Windows，但数据库在 AutoDL 服务器上，建议用 SSH 隧道：

```bash
ssh -p <AutoDL端口> root@<AutoDL域名> -L 15432:127.0.0.1:5432
```

然后本地 `.env` 改成：

```env
DATABASE_URL=postgresql://citytaste_user:实际密码@127.0.0.1:15432/citytaste
```

我建议本地映射成 `15432`，不要直接占用本机的 `5432`，因为你本地可能已经有 PostgreSQL。

---

## 四、第三阶段：先写最小可运行 FastAPI

创建文件：

```text
backend/app/main.py
```

先写最小版本：

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="CityTaste API",
    description="Backend API for CityTaste GIS Application Development Project",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def Root():
    return {
        "message": "CityTaste API is running"
    }


@app.get("/api/health")
def HealthCheck():
    return {
        "status": "ok"
    }
```

启动：

```bash
uvicorn app.main:app --reload
```

浏览器访问：

```text
http://127.0.0.1:8000/
http://127.0.0.1:8000/api/health
http://127.0.0.1:8000/docs
```

FastAPI 会自动生成 Swagger API 文档，这对你们前后端联调很方便。([FastAPI][1])

---

## 五、第四阶段：封装配置和数据库 Session

创建：

```text
backend/app/core/config.py
```

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "CityTaste API"
    app_env: str = "dev"
    database_url: str
    backend_cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins(self) -> list[str]:
        return [item.strip() for item in self.backend_cors_origins.split(",") if item.strip()]


settings = Settings()
```

创建：

```text
backend/app/db/session.py
```

```python
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings


engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)


def GetDB() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

这里 `engine` 是 SQLAlchemy 应用连接数据库的核心对象，通常一个应用进程全局创建一次即可。([SQLAlchemy Documentation][2])

然后写一个数据库测试接口：

```python
from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import GetDB

app = FastAPI()


@app.get("/api/db/check")
def CheckDatabase(db: Session = Depends(GetDB)):
    result = db.execute(text("SELECT 1 AS ok")).mappings().first()
    return {
        "database": "connected",
        "result": result["ok"],
    }
```

再测试：

```text
http://127.0.0.1:8000/api/db/check
```

如果返回：

```json
{
  "database": "connected",
  "result": 1
}
```

说明 FastAPI 已经成功连上 PostgreSQL。

---

## 六、第五阶段：先做餐厅基础查询 API

你们当前最核心的表是：

```text
restaurants
```

字段包括：

```text
restaurant_id
restaurant_name
restaurant_rate
restaurant_telephone
restaurant_category
restaurant_avg_price
restaurant_geom_position
restaurant_text_position
source
created_at
```

建议先做这几个接口：

```text
GET /api/restaurants
GET /api/restaurants/{restaurant_id}
GET /api/restaurants/search
GET /api/restaurants/random
```

### 1. 查询餐厅列表

目标：

```http
GET /api/restaurants?limit=20&offset=0
```

返回：

```json
{
  "items": [
    {
      "restaurant_id": 1,
      "restaurant_name": "xxx",
      "restaurant_rate": 4.5,
      "restaurant_category": "火锅",
      "restaurant_avg_price": 80,
      "restaurant_text_position": "xxx",
      "lon": 120.0,
      "lat": 30.0
    }
  ],
  "limit": 20,
  "offset": 0
}
```

SQL 大致是：

```sql
SELECT
    restaurant_id,
    restaurant_name,
    restaurant_rate,
    restaurant_telephone,
    restaurant_category,
    restaurant_avg_price,
    restaurant_text_position,
    ST_X(restaurant_geom_position) AS lon,
    ST_Y(restaurant_geom_position) AS lat
FROM restaurants
ORDER BY restaurant_id
LIMIT :limit OFFSET :offset;
```

---

### 2. 根据 ID 查询餐厅详情

目标：

```http
GET /api/restaurants/1
```

返回单个餐厅的完整信息。

---

### 3. 多条件搜索餐厅

目标：

```http
GET /api/restaurants/search?keyword=火锅&category=川菜&min_price=20&max_price=100&min_rating=4.0
```

支持条件：

```text
keyword       餐厅名称关键词
category      菜系 / 类型
min_price     最低人均
max_price     最高人均
min_rating    最低评分
limit         返回数量
offset        分页偏移
```

注意这里不要直接拼接字符串 SQL，必须用参数绑定，避免 SQL 注入。

---

## 七、第六阶段：做 PostGIS 距离搜索

你们项目里最关键的后端价值不是普通查表，而是空间查询。

目标接口：

```http
GET /api/restaurants/search?center_lon=120.08&center_lat=30.30&radius=1000
```

含义：

```text
查询某个经纬度点 1000 米范围内的餐厅
```

这里要特别注意：你们的坐标系是 EPSG:4326，经纬度单位是“度”。如果直接对 `geometry` 使用 `ST_DWithin()`，距离单位会按空间参考系来理解，也就是经纬度的度数，不是米。PostGIS 官方文档说明，`geometry` 的距离单位来自空间参考系，而 `geography` 的距离单位是米；所以你们做“1000米范围搜索”时，建议把 geometry 转成 geography。([PostGIS][3])

建议 SQL：

```sql
SELECT
    restaurant_id,
    restaurant_name,
    restaurant_rate,
    restaurant_category,
    restaurant_avg_price,
    restaurant_text_position,
    ST_X(restaurant_geom_position) AS lon,
    ST_Y(restaurant_geom_position) AS lat,
    ST_Distance(
        restaurant_geom_position::geography,
        ST_SetSRID(ST_MakePoint(:center_lon, :center_lat, 0), 4326)::geography
    ) AS distance_m
FROM restaurants
WHERE ST_DWithin(
    restaurant_geom_position::geography,
    ST_SetSRID(ST_MakePoint(:center_lon, :center_lat, 0), 4326)::geography,
    :radius
)
ORDER BY distance_m ASC
LIMIT :limit OFFSET :offset;
```

这个接口做出来后，前端就可以实现：

```text
用户点击地图某点
        ↓
前端拿到 lon / lat
        ↓
传给 FastAPI
        ↓
FastAPI 用 ST_DWithin 查附近餐厅
        ↓
返回餐厅列表
        ↓
Cesium 高亮显示
```

---

## 八、第七阶段：做缓冲区分析 API

你们计划里有：

```text
缓冲区分析 + ECharts 饼图
```

这个接口应该优先做，因为它能体现 GIS 空间分析能力。

目标接口：

```http
GET /api/analysis/buffer?center_lon=120.08&center_lat=30.30&radius=1000
```

返回内容建议分两块：

```json
{
  "center": {
    "lon": 120.08,
    "lat": 30.30,
    "radius": 1000
  },
  "summary": {
    "total_count": 35,
    "avg_price": 62.5,
    "avg_rating": 4.2
  },
  "category_stats": [
    {
      "category": "火锅",
      "count": 8,
      "avg_price": 85.5,
      "avg_rating": 4.3
    },
    {
      "category": "咖啡",
      "count": 5,
      "avg_price": 35.0,
      "avg_rating": 4.1
    }
  ]
}
```

SQL 核心：

```sql
SELECT
    COALESCE(restaurant_category, '未知') AS category,
    COUNT(*) AS count,
    AVG(restaurant_avg_price) AS avg_price,
    AVG(restaurant_rate) AS avg_rating
FROM restaurants
WHERE ST_DWithin(
    restaurant_geom_position::geography,
    ST_SetSRID(ST_MakePoint(:center_lon, :center_lat, 0), 4326)::geography,
    :radius
)
GROUP BY restaurant_category
ORDER BY count DESC;
```

这个接口给前端以后，前端可以直接用 ECharts 画饼图：

```text
不同菜系数量占比
不同菜系平均价格
不同菜系平均评分
```

---

## 九、第八阶段：做地标和交通点接口

你们还有两张表：

```text
landmarks
transportations
```

建议接口：

```text
GET /api/landmarks
GET /api/landmarks/{landmark_id}
GET /api/transportations
GET /api/transportations/{transportation_id}
```

这两个接口的作用是：

```text
1. 前端可以让用户选择“以某个地标为中心”
2. 前端可以让用户选择“以某个公交站 / 地铁站为中心”
3. 后端拿到中心点以后，再做 buffer analysis 或附近餐厅搜索
```

后续可以扩展：

```http
GET /api/analysis/buffer?center_type=landmark&center_id=1&radius=1000
GET /api/restaurants/search?center_type=transportation&center_id=3&radius=800
```

也就是说，中心点可以有两种来源：

```text
用户手动点击地图给 lon / lat
用户选择 landmark / transportation 的 id
```

---

## 十、第九阶段：做 GeoJSON 返回格式

Cesium 前端可能更喜欢 GeoJSON，所以建议除了普通 JSON 列表，也提供 GeoJSON 接口。

例如：

```text
GET /api/restaurants/search/geojson?keyword=火锅
```

返回：

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "restaurant_id": 1,
        "restaurant_name": "xxx",
        "restaurant_rate": 4.5,
        "restaurant_category": "火锅",
        "restaurant_avg_price": 80
      },
      "geometry": {
        "type": "Point",
        "coordinates": [120.08, 30.30, 0]
      }
    }
  ]
}
```

你们现有数据本身就是 WGS84 GeoJSON，所以前端加载会比较自然。

---

## 十一、第十阶段：做随机推荐 / 美食盲盒

接口：

```http
GET /api/restaurants/random
```

支持筛选条件：

```http
GET /api/restaurants/random?category=火锅&min_rating=4.0&max_price=100
```

SQL：

```sql
SELECT
    restaurant_id,
    restaurant_name,
    restaurant_rate,
    restaurant_category,
    restaurant_avg_price,
    restaurant_text_position,
    ST_X(restaurant_geom_position) AS lon,
    ST_Y(restaurant_geom_position) AS lat
FROM restaurants
WHERE
    (:category IS NULL OR restaurant_category = :category)
    AND (:min_rating IS NULL OR restaurant_rate >= :min_rating)
    AND (:max_price IS NULL OR restaurant_avg_price <= :max_price)
ORDER BY RANDOM()
LIMIT 1;
```

这个功能不难，但是展示效果好，适合放进最终 demo。

---

## 十二、第十一阶段：最后再做 check_list 和路线规划

不要一开始就做路线规划。建议顺序是：

```text
餐厅查询
    ↓
距离搜索
    ↓
缓冲区分析
    ↓
随机推荐
    ↓
打卡清单
    ↓
路线规划
```

因为路线规划依赖前面的餐厅查询和打卡清单。

后续可以新增表：

```sql
CREATE TABLE check_list (
    check_id SERIAL PRIMARY KEY,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(restaurant_id),
    check_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

接口：

```text
GET    /api/check-list
POST   /api/check-list
PUT    /api/check-list/{check_id}
DELETE /api/check-list/{check_id}
```

路线规划接口后做：

```text
GET /api/route/plan
```

你们计划里有两种方案：

```text
方案一：调用高德 / 百度路径规划 API
方案二：pgRouting
```

我建议优先做**地图 API 调用**，pgRouting 作为进阶功能。因为 pgRouting 还涉及路网数据、拓扑构建、最近节点匹配，短期内工作量比较大。

---

## 十三、推荐的开发顺序

可以按这个节奏推进：

### Step 1：后端目录初始化

完成：

```text
backend/
requirements.txt
.env.example
app/main.py
```

验收标准：

```text
http://127.0.0.1:8000/
http://127.0.0.1:8000/docs
```

能打开。

---

### Step 2：数据库连接

完成：

```text
app/core/config.py
app/db/session.py
GET /api/db/check
```

验收标准：

```json
{
  "database": "connected",
  "result": 1
}
```

---

### Step 3：餐厅基础查询

完成：

```text
GET /api/restaurants
GET /api/restaurants/{restaurant_id}
```

验收标准：

能从 `restaurants` 表读出真实餐厅数据，并返回经纬度。

---

### Step 4：餐厅多条件搜索

完成：

```text
GET /api/restaurants/search
```

支持：

```text
keyword
category
min_price
max_price
min_rating
limit
offset
```

验收标准：

前端可以根据菜系、价格、评分、关键词筛选餐厅。

---

### Step 5：距离范围搜索

完成：

```text
GET /api/restaurants/search?center_lon=...&center_lat=...&radius=...
```

验收标准：

能返回某个点附近 N 米内的餐厅，并按距离排序。

---

### Step 6：缓冲区统计分析

完成：

```text
GET /api/analysis/buffer
```

验收标准：

返回：

```text
总餐厅数
不同菜系数量
不同菜系平均价格
不同菜系平均评分
```

前端可以接 ECharts 饼图。

---

### Step 7：地标 / 交通点接口

完成：

```text
GET /api/landmarks
GET /api/transportations
```

验收标准：

前端可以选择某个地标或公交站作为分析中心。

---

### Step 8：GeoJSON 输出

完成：

```text
GET /api/restaurants/geojson
GET /api/restaurants/search/geojson
```

验收标准：

Cesium 能直接加载或根据返回结果绘制点位。

---

### Step 9：随机推荐

完成：

```text
GET /api/restaurants/random
```

验收标准：

能在当前筛选条件下随机返回一家餐厅。

---

### Step 10：打卡清单和路线规划

最后再做：

```text
/api/check-list
/api/route/plan
```

---

## 十四、现在最建议你马上做的第一批文件

第一批只写这些：

```text
backend/
├── requirements.txt
├── .env.example
└── app/
    ├── main.py
    ├── core/
    │   └── config.py
    ├── db/
    │   └── session.py
    └── api/
        └── v1/
            ├── api.py
            └── endpoints/
                ├── health.py
                └── restaurants.py
```

先不要创建太多空文件。先把最小链路打通：

```text
FastAPI 启动
    ↓
数据库连接成功
    ↓
restaurants 表能查出来
    ↓
距离搜索能返回结果
```

这条链路通了以后，后面的 `landmarks`、`transportations`、`buffer analysis` 都只是扩展。

---

## 十五、我建议你们的后端第一版 API 清单

第一版够用的 API：

```text
GET /api/health
GET /api/db/check

GET /api/restaurants
GET /api/restaurants/{restaurant_id}
GET /api/restaurants/search
GET /api/restaurants/search/geojson
GET /api/restaurants/random

GET /api/landmarks
GET /api/transportations

GET /api/analysis/buffer
```

暂时不做：

```text
用户登录
权限系统
复杂 ORM
Alembic 数据库迁移
pgRouting
GeoServer 管理 API
```

这些东西不是不能做，而是现在会拖慢你们的 MVP。你们当前项目最核心的演示价值是：

```text
Cesium 地图展示
+ FastAPI 查询
+ PostgreSQL/PostGIS 空间分析
+ ECharts 统计图
```

先把这个闭环做出来最重要。

[1]: https://fastapi.tiangolo.com/?utm_source=chatgpt.com "FastAPI"
[2]: https://docs.sqlalchemy.org/en/latest/core/engines.html?utm_source=chatgpt.com "Engine Configuration — SQLAlchemy 2.1 Documentation"
[3]: https://postgis.net/docs/ST_DWithin.html?utm_source=chatgpt.com "ST_DWithin"
