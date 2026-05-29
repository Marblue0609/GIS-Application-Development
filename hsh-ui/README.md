# CityTaste 前端模块说明文档

## 1. 模块定位

`hsh-ui` 是 CityTaste 项目的前端界面模块，主要负责：

- Cesium 地图展示；
- 餐厅、地标、交通点位的前端可视化；
- 餐厅搜索、筛选、点选、高亮、飞行定位；
- 范围距离搜索、缓冲区分析、路径规划、打卡清单等功能入口；
- 后续与 FastAPI / GeoServer / PostGIS 数据服务对接。

当前阶段以前端原型和本地 GeoJSON 数据展示为主，后续 API 稳定后再替换数据源。

## 2. 目录结构

```text
hsh-ui/
├── public/
│   ├── restaurants.geojson       # 餐厅点位数据，来自 ld-data/data/json/rest/rest4326.geojson
│   ├── landmarks.geojson         # 地标点位数据，来自 ld-data/data/json/landmark/landmark_4326.geojson
│   └── transportations.geojson   # 交通点位数据，来自 ld-data/data/json/tran/tran_4326.geojson
│
├── src/
│   ├── components/
│   │   ├── CesiumMap.jsx         # Cesium 地图、点位图层、hover 卡片、飞行定位
│   │   └── Sidebar.jsx           # 左侧功能面板、搜索筛选、分析/路线/清单入口
│   │
│   ├── services/
│   │   ├── api.js                # Axios 基础配置，预留后端 API 使用
│   │   ├── restaurantService.js  # 后端接口函数草稿
│   │   ├── restaurantData.js     # 餐厅 GeoJSON 字段标准化、分类、筛选
│   │   └── mapData.js            # 地标/交通点标准化、WGS84 到 GCJ-02 显示转换
│   │
│   ├── App.jsx                   # 全局状态、数据加载、组件组织
│   ├── main.jsx                  # React 入口、Ant Design 主题配置
│   └── index.css                 # 全局布局和 UI 样式
│
├── package.json
├── vite.config.js
└── README.md
```

## 3. 本地运行

进入前端目录：

```bash
cd /Users/hsh/Applications/gisad_final/GIS-Application-Development/hsh-ui
```

安装依赖：

```bash
npm install
```

启动本地开发服务：

```bash
npm run dev
```

终端会显示本地访问地址，例如：

```text
http://localhost:5173/
```

浏览器打开该地址即可查看页面。

## 4. 常用命令

```bash
npm run dev
```

用于本地开发和查看可视化页面。

```bash
npm run lint
```

用于检查代码规范和明显的语法问题。

```bash
npm run build
```

用于生成生产部署版本，输出到 `dist/`。`dist/` 已被 `.gitignore` 忽略，不需要提交。

## 5. 当前数据说明

当前前端直接读取 `public/` 下的三份 GeoJSON：

| 前端文件 | 来源 | 数据类型 | 数量 |
| --- | --- | --- | --- |
| `public/restaurants.geojson` | `ld-data/data/json/rest/rest4326.geojson` | 餐厅点 | 482 |
| `public/landmarks.geojson` | `ld-data/data/json/landmark/landmark_4326.geojson` | 地标点 | 8 |
| `public/transportations.geojson` | `ld-data/data/json/tran/tran_4326.geojson` | 交通点 | 286 |

这些数据均为 WGS84 坐标。由于当前底图采用偏平面低饱和地图风格，前端在 `mapData.js` 中保留了 WGS84 到 GCJ-02 的显示转换能力，便于切换高德类底图时保持点位对齐。

## 6. 当前已实现功能

### 6.1 地图展示

- Cesium 2D 地图展示；
- 餐厅点、地标点、交通点分层显示；
- 鼠标悬停点位时显示名称、类型、评分等信息；
- 点击点位后地图从当前视角飞行到目标点；
- 选中点高亮显示。

### 6.2 餐厅搜索与筛选

- 关键词搜索；
- 菜系分类筛选；
- 人均价格筛选；
- 最低评分筛选；
- 随机推荐；
- 结果列表联动地图飞行定位。

### 6.3 分析与规划功能占位

以下功能已在 UI 中预留入口，当前主要用于前端展示，后续等待后端 API 接入：

- 范围距离搜索；
- 缓冲区分析；
- ECharts 菜系占比图；
- 路径规划；
- 打卡清单；
- 保存想去的餐厅。

## 7. 后续 API / GeoServer 接入建议

当前前端使用本地 GeoJSON：

```js
fetch('/restaurants.geojson')
fetch('/landmarks.geojson')
fetch('/transportations.geojson')
```

后续如果 FastAPI 提供接口，可以替换为：

```text
/api/restaurants/search
/api/analysis/buffer
/api/route/plan
/api/landmarks
/api/transportations
```

如果 GeoServer 已发布 WFS，建议优先用 WFS GeoJSON 接前端交互，因为前端需要属性数据用于 hover、筛选、点击、高亮和列表展示。

WFS 示例：

```text
http://服务器地址:8080/geoserver/工作区名/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=工作区名:图层名&outputFormat=application/json
```

WMS 更适合作为纯地图叠加图层，不适合当前这种需要丰富交互的点位 UI。

## 8. Git 提交注意事项

不要提交以下内容：

```text
node_modules/
dist/
.env
*.log
```

这些内容已在项目根目录 `.gitignore` 中配置。

提交前建议运行：

```bash
npm run lint
npm run build
```

确保本地检查通过后再提交。
