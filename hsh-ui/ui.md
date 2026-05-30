# hsh-ui 前端模块说明文档

## 1. 模块定位

`hsh-ui` 是 CityTaste 项目的前端界面模块，负责项目 UI 与地图交互部分，主要包括：

- Cesium 地图展示；
- 餐厅、地标、交通点位展示；
- 餐厅搜索、筛选、点选、高亮、飞行定位；
- 范围距离搜索、缓冲区分析、路径规划、打卡清单等功能入口；
- 后续与 FastAPI / GeoServer / PostGIS 数据服务对接。

当前阶段以前端原型和本地 GeoJSON 数据展示为主。后续后端 API 稳定后，再将本地数据读取替换为接口请求。

## 2. 目录结构

```text
hsh-ui/
├── public/
│   ├── restaurants.geojson       # 餐厅点位数据
│   ├── landmarks.geojson         # 地标点位数据
│   └── transportations.geojson   # 交通点位数据
│
├── src/
│   ├── components/
│   │   ├── CesiumMap.jsx         # Cesium 地图、点位图层、hover 卡片、飞行定位
│   │   └── Sidebar.jsx           # 左侧功能面板、搜索筛选、分析/路线/清单入口
│   │
│   ├── services/
│   │   ├── api.js                # Axios 基础配置，预留后端 API 使用
│   │   ├── restaurantService.js  # 后端接口函数草稿
│   │   ├── restaurantData.js     # 餐厅数据标准化、分类、筛选
│   │   └── mapData.js            # 地标/交通点标准化、坐标显示转换
│   │
│   ├── App.jsx                   # 全局状态、数据加载、组件组织
│   ├── main.jsx                  # React 入口、Ant Design 主题配置
│   └── index.css                 # 全局布局和 UI 样式
│
├── package.json
├── vite.config.js
└── ui.md
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

用于检查代码规范和明显语法问题。

```bash
npm run build
```

用于生成生产部署版本，输出到 `dist/`。`dist/` 不需要提交。

## 5. 当前数据来源

当前前端直接读取 `public/` 下三份 GeoJSON：

| 前端文件 | 来源 | 数据类型 |
| --- | --- | --- |
| `public/restaurants.geojson` | `ld-data/data/json/rest/rest4326.geojson` | 餐厅点 |
| `public/landmarks.geojson` | `ld-data/data/json/landmark/landmark_4326.geojson` | 地标点 |
| `public/transportations.geojson` | `ld-data/data/json/tran/tran_4326.geojson` | 交通点 |

`ld-data/data/shp/` 中的 Shapefile 与上述 GeoJSON 是同一批点数据的桌面 GIS / GeoServer / PostGIS 版本，不是研究区面边界数据。

## 6. 当前已实现功能

### 6.1 地图展示

- Cesium 2D 地图；
- 餐厅、地标、交通点分层显示；
- 点位 hover 信息卡片；
- 点击点位后从当前视角飞行定位；
- 选中点高亮。

### 6.2 餐厅搜索与筛选

- 关键词搜索；
- 菜系分类筛选；
- 人均价格筛选；
- 最低评分筛选；
- 随机推荐；
- 结果列表联动地图定位。

### 6.3 功能入口预留

以下功能在前端已预留 UI 位置，等待后端 API 接入：

- 范围距离搜索；
- 缓冲区分析；
- ECharts 菜系占比图；
- pgRouting / 第三方 API 路径规划；
- 打卡清单；
- 保存想去的餐厅。

## 7. 后续 API / GeoServer 接入建议

当前前端数据读取方式：

```js
fetch('/restaurants.geojson')
fetch('/landmarks.geojson')
fetch('/transportations.geojson')
```

后续可以替换为 FastAPI 接口，例如：

```text
/api/restaurants/search
/api/landmarks
/api/transportations
/api/analysis/buffer
/api/route/plan
```

如果 GeoServer 已发布图层，建议优先使用 WFS GeoJSON 接入前端交互，因为当前 UI 需要属性数据用于 hover、筛选、点击、高亮和列表展示。WMS 更适合作为纯地图图层叠加。

WFS 示例：

```text
http://服务器地址:8080/geoserver/工作区名/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=工作区名:图层名&outputFormat=application/json
```

## 8. Git 提交注意事项

不要提交以下内容：

```text
node_modules/
dist/
.env
*.log
```

提交前建议运行：

```bash
npm run lint
npm run build
```

确认通过后再提交。
