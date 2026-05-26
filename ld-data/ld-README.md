# ld-data 空间数据说明文档

## 1. 目录结构

!!!warning
    **数据重点内容在ld-data/data/json下面！！！**



> 本模块负责 CityTaste 项目核心空间矢量要素（餐饮、地标、交通网点）的获取、清洗、坐标转换以及空间数据库的标准化映射入库。  



模块的目录结构及各文件夹效用说明如下：
```text
ld-data/
├── ld-README.md           # 模块核心说明文档
├── data/                  # 矢量与属性数据集存储目录
│   ├── json/              # 转换并清洗后的标准 WGS84 GeoJSON 数据
│   │   ├── landmark/      # 地标点位 (landmark_4326.geojson 等)
│   │   ├── rest/          # 餐饮点位 (rest4326.geojson 等)
│   │   └── tran/          # 交通网点 (tran_4326.geojson 等)
│   ├── shp/               # 桌面端 GIS 软件交互查看用的 Shapefile 矢量套件
│   │   ├── landmark/      # (内含 .shp, .dbf, .prj 等构成文件)
│   │   ├── rest/          
│   │   └── tran/          
│   └── spider/            # 爬虫获取的中间态与原始数据
│       ├── raw/           # 原始未处理数据 (rest_gcj02.csv, tran_raw.geojson)
│       ├── filtered/      # 属性过滤后中间态数据 (rest_clean_gcj02.csv)
│       └── processed/     # 坐标转换后最终态数据 (rest_clean_wgs84.csv)
├── data_pipeline/         # 数据处理流水线与入库脚本
│   ├── amap_spider.py           # 高德 POI 接口爬虫脚本
│   ├── data_clean.py            # GCJ-02 逆偏转与基础清洗脚本
│   ├── query_traffic.overpassql # OSM 交通数据查询语句
│   ├── rest_init.ipynb          # 餐饮数据映射与入库脚本
│   ├── landmark_init.ipynb      # 地标数据映射与入库脚本
│   └── tran_init.ipynb          # 交通数据映射与入库脚本
└── docs/                  # 辅助技术规范与编码字典表
    └── (amap_poicode.xlsx, amap_adcode_citycode 等参考文档)
```






## 2. GeoJSON 数据结构解析

### 2.1 整体数据骨架

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

### 2.2 属性映射与清洗规约

入库脚本提取 `properties` 中的非空间属性，清洗并精准映射至 PostGIS 目标表中：

#### A. 餐饮数据集 (Restaurants)

* **属性映射关系**：
* `restaura_1` $\rightarrow$ `restaurant_name` (VARCHAR, NOT NULL)
* `restaura_2` $\rightarrow$ `restaurant_rate` (NUMERIC(3,1))
* `restaura_3` $\rightarrow "restaurant_telephone` (VARCHAR)
* `restaura_4` $\rightarrow$ `restaurant_category` (VARCHAR)
* `restaura_6` $\rightarrow$ `restaurant_avg_price` (NUMERIC(10,2))
* `restaura_7` $\rightarrow$ `restaurant_text_position` (TEXT)


* **动态追加字段**：`source = 'amap'`（标识高德地图数据源）。

#### B. 地标数据集 (Landmarks)

* **原始属性骨架**：`{"name": "...", "text_locat": "...", "type": "..."}`
* **属性映射关系**：
* `name` $\rightarrow$ `landmark_name` (VARCHAR, NOT NULL)
* `type` $\rightarrow$ `landmark_type` (VARCHAR)
* `text_locat` $\rightarrow$ `landmark_text_position` (TEXT)



#### C. 交通网点数据集 (Transportations)

* **原始属性骨架**：`{"F_id": "...", "name": "...", "highway": "..."}`
* **属性映射与容错策略**：
* `name` $\rightarrow$ `transportation_name` (VARCHAR, NOT NULL)
* `highway` $\rightarrow$ `transportation_type` (VARCHAR)
* `name` $\rightarrow$ `transportation_text_position` (TEXT) **[镜像赋值]**：因源数据缺失地址描述，将名称同步赋给描述字段以消灭数据库 `NULL` 值，防止前端页面因空指针崩溃。


