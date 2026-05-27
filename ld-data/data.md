# ld-data 空间数据说明文档

## 1. 目录结构

!!!warning  
    **数据重点内容在ld-data/data/json下面！！！**



> 本模块负责 CityTaste 项目核心空间矢量要素（餐饮、地标、交通网点）的获取、清洗、坐标转换以及空间数据库的标准化映射入库。  



模块的目录结构及各文件用途说明如下：
```text
ld-data/
├── data.md  # 模块核心说明文档
│ 
│ 
├── data/ # 矢量与属性数据集存储目录
│   ├── json/    # 转换并清洗后的标准 WGS84 GeoJSON 数据
│   │   ├── landmark/  # 地标点位 (landmark_4326.geojson 等)
│   │   ├── rest/      # 餐饮点位 (rest4326.geojson 等)
│   │   └── tran/      # 交通网点 (tran_4326.geojson 等)
│   │
│   ├── shp/   # 桌面端 GIS 软件交互查看用的 Shapefile 矢量套件
│   │   ├── landmark/ # (内含 .shp, .dbf, .prj 等构成文件)
│   │   ├── rest/          
│   │   └── tran/          
│   │
│   └── spider/        # 爬虫获取的中间态与原始数据
│       ├── raw/       # 原始未处理数据 (rest_gcj02.csv, tran_raw.geojson)
│       ├── filtered/  # 属性过滤后中间态数据 (rest_clean_gcj02.csv)
│       └── processed/ # 坐标转换后最终态数据 (rest_clean_wgs84.csv)
│ 
│ 
├── data_pipeline/         # 数据处理脚本
│   ├── amap_spider.py           # 高德 POI 接口爬虫脚本
│   ├── data_clean.py            # GCJ-02 逆偏转与基础清洗脚本
│   └── query_traffic.overpassql # OSM 交通数据查询语句

│ 
├── data_post/             # 数据入库脚本
│   ├── check.ipynb              # 整体数据检查和处理脚本
│   ├── rest_init.ipynb          # 餐饮数据映射与入库脚本
│   ├── landmark_init.ipynb      # 地标数据映射与入库脚本
│   └── tran_init.ipynb          # 交通数据映射与入库脚本
│ 
└── docs/                  # 辅助技术规范与编码字典表
    ├── amap_poicode.xlsx         # 高德POI分类码
    ├── amap_adcode_citycode.xlsx # 高德城市地区分类码
    └── mypoi.xlsx                # 我们的项目POI分类码
```




## 2. GeoJSON 数据结构解析


- 本模块产出的 `.geojson` 文件遵循 OGC 规范
- 统一采用标准地理坐标系 **WGS 84 (EPSG:4326)**
- 空间点位采用 **`POINT Z`（三维点）** 格式 **（高程默认赋 0）**


```json
{
  "type": "FeatureCollection",
  "name": "dataset_name",
  "crs": { 
    "type": "name", 
    "properties": { "name": "urn:ogc:def:crs:OGC:1.3:CRS84" } 
  },
  "features": [
    {
      "type": "Feature",
      "properties": {}, // 业务属性键值对
      "geometry": {
        "type": "Point",
        "coordinates": [ 120.xxxxxx, 30.xxxxxx, 0.0 ] // [经度, 纬度, 高程]
      }
    }
  ]
}

```

### 3. 数据结构说明
### 模块 1：空间几何列元数据审计

| 表名 | 空间列名 | 坐标维度 | 空间参考系统标识符(SRID) | 几何体类型 |
| --- | --- | --- | --- | --- |
| landmarks | landmark_geom_position | 3 | 4326 | POINT |
| restaurants | restaurant_geom_position | 3 | 4326 | POINT |
| transportations | transportation_geom_position | 3 | 4326 | POINT |

---

### 模块 2：表物理存储与记录统计

| 表名 | 预估活跃记录数 | 表基础数据大小 | 总占用空间(含索引) | 最后一次统计信息收集时间 |
| --- | --- | --- | --- | --- |
| landmarks | 8 | 8192 bytes | 56 kB | 2026-05-27 07:28:01.027565+00:00 |
| restaurants | 482 | 104 kB | 344 kB | 2026-05-27 07:28:01.092801+00:00 |
| transportations | 286 | 40 kB | 112 kB | 2026-05-27 07:28:01.095355+00:00 |

---

### 模块 3：字段结构与数据类型审计

| 表名 | 字段顺序 | 字段名称 | PostgreSQL数据类型 | 底层类型 | 字符长度 | 数值精度 | 小数位数 | 允许NULL | 默认值 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| landmarks | 1 | landmark_id | integer | int4 | NaN | 32.0 | 0.0 | NO | nextval('landmarks_landmark_id_seq'::regclass) |
| landmarks | 2 | landmark_name | character varying | varchar | 255.0 | NaN | NaN | NO | None |
| landmarks | 3 | landmark_type | character varying | varchar | 100.0 | NaN | NaN | YES | None |
| landmarks | 4 | landmark_geom_position | USER-DEFINED | geometry | NaN | NaN | NaN | NO | None |
| landmarks | 5 | landmark_text_position | text | text | NaN | NaN | NaN | YES | None |
| landmarks | 6 | created_at | timestamp without time zone | timestamp | NaN | NaN | NaN | YES | CURRENT_TIMESTAMP |
| restaurants | 1 | restaurant_id | integer | int4 | NaN | 32.0 | 0.0 | NO | nextval('restaurants_restaurant_id_seq'::regcl... |
| restaurants | 2 | restaurant_name | character varying | varchar | 255.0 | NaN | NaN | NO | None |
| restaurants | 3 | restaurant_rate | numeric | numeric | NaN | 3.0 | 1.0 | YES | None |
| restaurants | 4 | restaurant_telephone | character varying | varchar | 100.0 | NaN | NaN | YES | None |
| restaurants | 5 | restaurant_category | character varying | varchar | 100.0 | NaN | NaN | YES | None |
| restaurants | 6 | restaurant_avg_price | numeric | numeric | NaN | 10.0 | 2.0 | YES | None |
| restaurants | 7 | restaurant_geom_position | USER-DEFINED | geometry | NaN | NaN | NaN | NO | None |
| restaurants | 8 | restaurant_text_position | text | text | NaN | NaN | NaN | YES | None |
| restaurants | 9 | source | character varying | varchar | 50.0 | NaN | NaN | YES | None |
| restaurants | 10 | created_at | timestamp without time zone | timestamp | NaN | NaN | NaN | YES | CURRENT_TIMESTAMP |
| transportations | 1 | transportation_id | integer | int4 | NaN | 32.0 | 0.0 | NO | nextval('transportations_transportation_id_seq... |
| transportations | 2 | transportation_name | character varying | varchar | 255.0 | NaN | NaN | NO | None |
| transportations | 3 | transportation_type | character varying | varchar | 100.0 | NaN | NaN | YES | None |
| transportations | 4 | transportation_geom_position | USER-DEFINED | geometry | NaN | NaN | NaN | NO | None |
| transportations | 5 | transportation_text_position | text | text | NaN | NaN | NaN | YES | None |
| transportations | 6 | created_at | timestamp without time zone | timestamp | NaN | NaN | NaN | YES | CURRENT_TIMESTAMP |

---

### 模块 4：索引部署情况审计

| 表名 | 索引名称 | 完整索引定义 |
| --- | --- | --- |
| landmarks | idx_landmarks_geom | CREATE INDEX idx_landmarks_geom ON public.landmarks USING gist (landmark_geom_position) |
| landmarks | idx_landmarks_name | CREATE INDEX idx_landmarks_name ON public.landmarks USING btree (landmark_name) |
| landmarks | landmarks_pkey | CREATE UNIQUE INDEX landmarks_pkey ON public.landmarks USING btree (landmark_id) |
| restaurants | idx_restaurants_category | CREATE INDEX idx_restaurants_category ON public.restaurants USING btree (restaurant_category) |
| restaurants | idx_restaurants_geom | CREATE INDEX idx_restaurants_geom ON public.restaurants USING gist (restaurant_geom_position) |
| restaurants | idx_restaurants_name | CREATE INDEX idx_restaurants_name ON public.restaurants USING btree (restaurant_name) |
| restaurants | idx_restaurants_price | CREATE INDEX idx_restaurants_price ON public.restaurants USING btree (restaurant_avg_price) |
| restaurants | idx_restaurants_rate | CREATE INDEX idx_restaurants_rate ON public.restaurants USING btree (restaurant_rate) |
| restaurants | restaurants_pkey | CREATE UNIQUE INDEX restaurants_pkey ON public.restaurants USING btree (restaurant_id) |
| transportations | idx_transportations_geom | CREATE INDEX idx_transportations_geom ON public.transportations USING gist (transportation_geom_position) |
| transportations | idx_transportations_name | CREATE INDEX idx_transportations_name ON public.transportations USING btree (transportation_name) |
| transportations | transportations_pkey | CREATE UNIQUE INDEX transportations_pkey ON public.transportations USING btree (transportation_id) |