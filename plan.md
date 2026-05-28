# CityTaste: 基于 GeoServer 与 Cesium 的城市餐饮空间分析与推荐平台
## <center>Group 9</center>
#### <center>组员: 金喆鑫, 黄诗涵, 雷堤, 潘瑞涛, 张泽函</center>

## 功能模块及其实现

**主要包含以下模块:**
- 餐饮数据管理与 GeoServer 发布模块; 
- Cesium 餐饮地图展示; 
- 多条件检索: 菜系 / 价格 / 评分 / 关键字; 
- 范围距离搜索; 
- 缓冲区分析 + ECharts 饼图; 
- 打卡清单与个性化美食盲盒推荐; 
- pgRouting / API 调用路径规划; 

### 1. 餐饮数据管理与 Geoserver 发布

- **主要功能:** 
  1. 数据来源;  
  2. 数据存储; 
  3. 数据发布; 

#### 功能 1.1: 数据来源 

初步打算: 将地址选在紫金港周边; 具体根据获取的数据量和工作量来决定;  

- 餐厅数据来源: 
  - 高德地图: 可以通过开放平台的 API来**合法**获取餐厅的基本信息, 包括: 
    - 包含 `(lon, lat)` 的位置和 `text` 格式的文本地址;
    - 名称, 联系方式; 
    - 人均, 菜系, 评分;  
  - 百度地图: 同理; 
  - OpenStreetMap: 可以获取地理位置, 但是没有其他信息, 作为候选; 
- 空间路网数据来源: 
  - 高德地图; 
  - OSM; 
- 备选: 地铁站 / 公交站等公共交通设施数据; 其他商圈数据: 
  - 高德地图; 
  - OSM; 

#### 功能 1.2: 数据存储

- 数据库选择: PostgreSQL + PostGIS; 
- 核心 relation: 
```sql
restaurants(
    restaurant_id, 
    restaurant_name, 
    restaurant_rate, 
    restaurant_telephone, 
    restaurant_category, 
    restaurant_avg_price, 
    restaurant_geom_position, 
    restaurant_text_position
    ); 
```

- 可供选择的 relation: 
```sql
-- For spatial analysis like "the nearest restaurant near 'ZJG subway station' "
landmarks(
    landmark_id, 
    landmark_name, 
    landmark_geom_positon
)

transportations(
    transportation_id, 
    transportation_name, 
    transportation_geom_positon
)
```

- **整体流程:**
```
原始数据 JSON
        ↓
Python / GeoPandas + 人为清洗
        ↓
统一字段 / 坐标系
        ↓
导入 PostgreSQL + PostGIS
```

#### 功能 1.3: 数据发布

- **大体实现:** 
  - 根据餐厅不同的类型 / 公共设施等选择不同的点样式; 
  - 可以通过 Cesium 实现点选的信息查询或者是否展示某类点; 

- **大体流程:**
```
GeoServer 创建 PostGIS Data Store
        ↓
连接 restaurants / landmarks / transportations 等空间表
        ↓
发布为 WMS / WFS 图层
        ↓
Cesium 前端加载展示
```

### 2. Cesium 餐饮地图展示

- **主要实现的功能:**
    1. 餐厅的点选查询 (参考作业中天气查询); 
    2. 餐厅筛选; 
    3. 搜索结果定位 (FlyTo); 

#### 功能 2.1: 餐厅的点选查询

- 参考作业中的天气查询, **大体思路:** 
    - 获取点击的点的 ID; 
    - 从数据库中读取信息; 
    - 后端将信息传入前端; 
    - 前端根据数据进行解析并展示; 

#### 功能 2.2: 餐厅筛选

- **大体思路:** 
  - 前端展示餐厅的 label, 包括种类, 人均, 评分等; 
  - 用户根据需要进行筛选, 将要求返回给数据库进行 SELECT; 
  - 返回满足要求的 tuple 的信息, 并分条展示; 
  - 同时支持简单的对于餐厅名称的搜索 (`SELECT * FROM restaurant WHERE name LIKE '%...%'`);

#### 功能 2.3: 搜索结果定位

- **大体思路:** 
  - 对于功能 2.2 中返回的结果, 可以通过点击该结果来飞行到该餐厅; 
  - 通过 FlyTo, 飞行到被选择的餐厅; 

### 3. 多条件检索: 菜系 / 价格 / 评分 / 关键字 + 4. 距离范围搜索

- **大体思路:** 
  - (可选) 用户鼠标选中一个点 / 指定某个 landmark 或 transportation, 输入距离; 
  - 和餐厅筛选类似, 在后端设置一个接口用于接收条件; 
  - 前端将条件传输给后端之后, 后端先执行查询条件的拼接; 
  - 将条件嵌入 SQL 中进行查询; 
  - 对于距离范围搜索, 使用 PostGIS 扩展中的 `ST_DWithin()` 函数进行搜索; 
  - 将结果转换为 JSON / GeoJSON 格式返回前端; 
  - e.g. 
```Python
@app.get("/api/restaurants/search")
def search_restaurants(
    keyword: str | None = None,
    category: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    min_rating: float | None = None,
    # Optional
    center_lon: float | None = None, 
    center_lat: float | None = None, 
    # TBD; 
)
```

### 4. 范围距离搜索

- 大体思路: 
  - 
  - 使用 PostGIS 扩展中的 `ST_DWithin()` 函数进行搜索; 

### 5. 缓冲区分析 + ECharts 饼图

- **主要功能:**  
  1. 分析某个位置周边一定范围内的餐饮资源分布;   
  2. 统计该范围内不同菜系餐厅的数量和比例 
  3. 将空间分析结果以地图 + 图表的形式展示给用户  

- **中心点来源:**  
  - 在 Cesium 地图上鼠标点击选点; 
  - 选择某个 `landmark`, 例如学校 / 景点 / 商圈等; 
  - 用户选择某个 `transportation`, 例如地铁站 / 公交站等; 

- **大体思路:** 
  - 确定中心点; 
  - 使用 PostGIS 中的 `ST_DWithin()` 查询缓冲区内的餐厅; 
  - `GROUP BY` 统计数量, 并通过 `AVG` 等计算平均消费等信息; 
  - 返回 JSON / GeoJSON 数据;  

- e.g.

```Python
@app.get("/api/analysis/buffer")
def buffer_analysis(
    center_lng: float | None = None, 
    center_lat: float | None = None, 
    center_type: str | None = None, 
    center_id: int | None = None, 
    radius: float = 1000, 
)
```
### 6. 打卡清单与个性化美食盲盒推荐

- **主要功能:** 
  - 保存想去的餐厅; 
  - 系统推荐餐厅; 
  - 后续路线规划; 

- **核心 relation:**  
```sql
check_list(
    restaurant_id,
    restaurant_name,
    restaurant_geom_position, 
    check_order
);
```

#### 功能 6.1: 保存想去的餐厅

- **大体思路:**
  - 维护一个 `check_list` 的数据库, 用户可以选择把搜索结果中想要打卡的 tuple 放入数据库; 
  - 用户可以根据需要修改 `check_order`; 

#### 功能 6.2: 系统推荐餐厅

- **大体思路:**
  - 在搜索界面新增一个 "随机推荐" button; 
  - 当点击 button 的时候, 在满足搜索条件的范围内 `ORDER RANDOM() LIMIT 1`; 

#### 功能 6.3: 后续路线规划

见 7. pgrouting / API 调用路径规划; 

### 7. pgrouting / API 调用路线规划

- **主要功能:**  
  1. 根据打卡清单中的餐厅生成访问路线; 
  2. 计算路线总距离和预计耗时; 
  3. 将路线结果在 Cesium 地图上进行可视化展示; 

- **大体思路:**  
  - 用户先在搜索结果 / 盲盒推荐结果或餐厅详情页中将餐厅加入 `check_list`; 
  - 系统读取 `check_list` 中的餐厅点位和 `check_order`; 
  - 根据餐厅顺序生成路径规划请求; 
  - 后端返回路线坐标 / 总距离 / 预计耗时等信息; 
  - 前端使用 Cesium 绘制路线折线, 并在侧边栏展示路线摘要; 

- **实现方案 1: 调用地图路径规划 API**

  - 该方案作为优先实现方案; 
  - 可以调用高德地图 / 百度地图等路径规划 API; 
  - 后端将打卡清单中的餐厅坐标作为起点 / 终点和途经点传入 API; 
  - API 返回真实道路路径 / 总距离和预计耗时; 
  - 后端整理结果后返回给前端; 

```python
@app.get("/api/route/plan")
def plan_route(
    check_list_id: int,
    travel_mode: str = "walking"  # walking / bicycling / driving
)
```

- **实现方案 2: 使用 pgRouting 进行路径规划**
  - 该方案作为备选方案, 有时间试着实现; 
  - 准备 OSM 路网数据导入 PostgreSQL + PostGIS; 
  - 路网表中需要包含道路边 / 起点节点 / 终点节点 / 道路长度; 
  - 后端根据餐厅坐标匹配最近路网节点; 
  - 使用 pgRouting 中的 `pgr_dijkstra()` 计算最短路径; 

## 技术路径

- **数据层:** 负责餐饮 POI / 地标 / 交通设施和路网等空间数据的存储; 
- **服务层:** 通过 GeoServer 发布标准地图服务; 
- **后端:** 通过 FastAPI 处理查询 / 空间分析 / 随机推荐和路径规划等请求; 
- **前端:** 使用 Cesium 和 ECharts 完成地图展示与统计图表展示; 

### 1. 数据层: PostgreSQL + PostGIS

数据层采用 PostgreSQL 作为关系数据库, 并使用 PostGIS 扩展支持空间数据存储与空间查询. 

主要存储内容包括: 

- `restaurants`: 餐厅基础信息与点位数据; 
- `landmarks`: 学校 / 景点 / 商圈等地标数据; 
- `transportations`: 地铁站 / 公交站等交通设施数据; 
- `check_list`: 用户打卡清单数据; 
- 可选: OSM 路网数据, 用于 pgRouting 路径规划. 

### 2. 地图服务层: GeoServer

GeoServer 用于将 PostGIS 中的空间数据发布为标准地图服务, 供前端 Cesium 调用; 

主要发布图层包括: 
- `restaurants` 餐厅点图层; 
- `landmarks` 地标图层; 
- `transportations` 交通设施图层; 
- 可选: 行政区划图层 / 餐饮热力图图层 / 路径结果图层; 

- **大体流程:**

```text
GeoServer 创建 Workspace
        ↓
创建 PostGIS Data Store
        ↓
连接 PostgreSQL + PostGIS
        ↓
发布 WMS / WFS 图层
        ↓
配置图层样式 SLD
        ↓
Cesium 前端加载展示
```

### 3. 后端: FastAPI + PostGIS 空间查询

后端采用 FastAPI 构建 RESTful API, 负责接收前端请求 / 访问数据库 / 执行空间查询和返回结果; 主要框架为: **FastAPI + PostgreSQL / PostGIS + GeoServer + 第三方地图 API**; 

主要接口包括: 

```text
/api/restaurants/search      餐厅综合检索
/api/analysis/buffer         缓冲区分析
/api/restaurants/random      个性化美食盲盒推荐
/api/route/plan              打卡路线规划
```

后端主要实现以下逻辑: 

- 根据菜系 / 价格 / 评分 / 关键字进行属性筛选; 
- 使用 `ST_DWithin()` 实现指定范围内的餐厅搜索; 
- 使用 `GROUP BY` 和 `AVG()` 统计缓冲区内餐饮结构; 
- 使用 `ORDER BY RANDOM() LIMIT 1` 实现随机推荐; 
- 调用高德 / 百度路径规划 API, 或使用 pgRouting 进行路径规划; 
- 将查询结果转换为 JSON / GeoJSON 返回前端; 

### 4. 前端: Cesium + ECharts

前端采用 Cesium 作为地图展示引擎, 负责餐饮空间数据的可视化与交互操作; 主要框架为: **React + Vite + Cesium + ECharts + Ant Design + Axios**; 

Cesium 主要实现: 

- 加载 GeoServer 发布的 WMS / WFS 图层; 
- 展示餐厅点 / 地标点 / 交通设施点; 
- 支持餐厅点选查询; 
- 支持搜索结果定位 `FlyTo`; 
- 绘制缓冲区范围; 
- 绘制路径规划结果; 
- 高亮显示盲盒推荐餐厅; 


前端整体交互流程如下: 

```text
用户输入查询 / 分析条件
        ↓
前端发送 HTTP 请求
        ↓
FastAPI 后端处理并返回 JSON / GeoJSON
        ↓
Cesium 展示空间结果
        ↓
ECharts 展示统计结果
```

## 分工

| 成员 | 负责方向 | 主要任务 |
| ---- | ------- | ------- |
| 雷堤 | 数据与 GeoServer, 报告 | 餐厅数据获取, 数据清洗, PostGIS 入库, GeoServer 发布图层, PPT 与报告 |
| 金喆鑫, 张泽函 | 后端 API | FastAPI 接口, 餐厅检索, 距离搜索, 缓冲区分析, 盲盒推荐, 路线规划 |
| 黄诗涵, 潘瑞涛 | Cesium 地图前端, UI 设计 | 地图初始化, UI 设计, 加载 GeoServer 图层, 餐厅点选, 搜索结果定位, 缓冲区绘制 |

- 分工不定死, 根据实际情况来; 

## 规定: 
- 前端文件中: 
  - 文件名使用下划线命名法, 比如 `group_nine.md`; 
  - 函数名尽可能使用大写的开头 + 驼峰命名, 比如 `SearchRestaurant(condition)`;
  - 变量名尽可能使用驼峰命名, 比如 `string thisCondition;`;
- Python 文件中: 
  - 文件名, 变量名, 变量名使用下划线命名法, 比如 `group_nine.md`; 
  - 常量使用全大写 + 下划线命名法, 比如 `BASE_URL`; 
  - 类名尽可能使用大写开头的驼峰命名, 比如 `class ThisIsAClass: `;
- 一定要有注释, API 最好能有示例格式的说明; 
- **善用 git;** 写完代码及时 commit; 
- 不要在共有服务器上乱用 `rm -rf` 等命令;

---

> ### 基本要求: 
> - 以下要求需全部满足： 
>   - 大程主题具有一定的探究性或现实意义，不是简单地堆砌数据； 
>   - 可通过 GeoServer 对部分展示数据进行管理； 
>   - 与主题相关的数据可在 Cesium 上展示； 
>   - 具备一定的前后端交互能力； 
>   - 程序界面设计合理，符合普遍审美； 
>   - 操作流程符合一般直觉，具备用户友好性，且不存在明显的 BUG； 
>   - 最终展示形式为 PPT + 系统演示，并给出一份报告，报告需包括： 
>       - 研究背景 
>       - 总体架构 
>       - 功能设计 
>       - 系统实现 
>       - 创新点 / 特色  
> ### 进阶要求
> - 以下要求至少需要完成 5 点： 
>   - 开发过程中使用 GitHub 等代码管理软件进行组内合作； 
>   - 使用了一定的前 / 后端框架； 
>   - 程序通过前后端交互可实现空间分析能力； 
>   - 程序通过前后端交互可实现对 GeoServer 的管理； 
>   - 具有三维场景下时空数据的动态可视化功能； 
>   - 针对特定场景实现了一定的性能优化； 
>   - 使用 ECharts 等第三方 JavaScript 图表库； 
>   - 实现多屏或卷帘等多图层协同展示效果； 
>   - 实现地图的制作与导出功能； 
>   - 其他感兴趣的具有一定难度与意义的功能和设计; 