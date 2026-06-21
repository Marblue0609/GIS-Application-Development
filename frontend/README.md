# CityTaste 前端 (React + Cesium)

CityTaste 餐饮空间分析平台的前端应用，基于 **React 19 + Vite 8 + Cesium 1.141**。
采用 Ant Design 构建交互面板，ECharts 展示统计图表，支持后端在线与本地离线双源数据降级运行。

## 目录结构

```
frontend/
├── public/                  # 静态资源与本地兜底数据
│   ├── restaurants.geojson  # 本地餐厅数据
│   ├── landmarks.geojson    # 本地地标数据
│   └── transportations.geojson # 本地交通设施数据
├── src/
│   ├── components/          # 核心交互组件
│   │   ├── CesiumMap.jsx    # 地图初始化、点位渲染与图层控制
│   │   ├── HomePage.jsx     # 项目首页与功能导航
│   │   ├── Sidebar.jsx      # 检索、分析、清单等左侧面板
│   │   └── RestaurantChatPanel.jsx # AI 餐厅助手对话框
│   ├── services/            # API 封装与数据层
│   │   ├── api.js           # Axios 实例
│   │   ├── mapData.js       # 地标/交通点本地数据标准化
│   │   ├── restaurantData.js# 餐厅数据标准化与本地降级逻辑
│   │   └── restaurantService.js # FastAPI 接口调用封装
│   ├── App.jsx              # 全局状态管理与双源降级调度
│   ├── index.css            # 全局样式
│   └── main.jsx             # React 入口
├── package.json
└── vite.config.js
```

## 如何运行

### 1. 准备环境

请确保已安装 Node.js (推荐 20+ 版本)。

```bash
cd frontend
npm install
# 或者使用 pnpm install
```

### 2. 配置 .env

按需在根目录下创建 `.env`（`.env` 不提交，已在 .gitignore）：

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api   # FastAPI 接口基础地址
VITE_CESIUM_ION_TOKEN=你的CesiumToken          # 当前使用 Carto 免费底图，可不填
```

> **本地容灾机制**：如果未配置后端接口或后端未启动，控制台会报 `ERR_CONNECTION_REFUSED` 错误。此时前端会自动拦截失败，并回退读取 `public/` 下的静态 GeoJSON 文件。**这不会导致白屏，您依然可以正常体验地图和基础查询功能**。

### 3. 启动

```bash
# 必须在 frontend/ 目录下启动
npm run dev
```

打开 `http://127.0.0.1:5173/` 即可在浏览器中访问前端界面。

### 4. 生产构建

```bash
npm run build
npm run preview
```

## 核心交互模块

### 双源数据加载 `App.jsx`
负责在页面初始化时并行读取 GeoJSON 与调用后端 FastAPI。如果 API 请求成功，则用后端真实数据替换本地数据；若失败，则静默切换至“离线模式”，保障页面始终可用。

### 地图可视化 `CesiumMap.jsx`
基于 Cesium `SCENE2D` 模式构建。
- **多级底图**：优先使用 CARTO 灰色栅格底图；若断网则降级为自带的本地网格地图。
- **空间渲染**：点位使用 SVG billboard，并根据菜系映射13种专属颜色。缓冲区使用半透明几何圆，导航路线采用折线实体。
- **性能优化**：内置基于相机视野高度的 **LOD 抽稀** 以及基于屏幕像素距离的 **碰撞避让** 算法，防止海量点位重叠卡顿。

### 任务控制面板 `Sidebar.jsx`
由 Ant Design 驱动的侧边栏。将检索筛选、范围分析（联动 ECharts 菜系甜甜圈图）、盲盒推荐和打卡清单等功能集中管理，并与三维地图的选中高亮、镜头飞行 (`FlyTo`) 实现深度双向绑定。

## 注意事项

- **GeoServer 隧道映射**：如果您在地图上要加载存放在 AutoDL 上的 GeoServer 瓦片图层，必须确保已通过 SSH 将服务器的 `6006` 端口映射到了本地（请参考 `data/warnings.md`）。
- **打包体积警告**：由于内嵌了完整的 Cesium 3D 引擎库，执行 `npm run build` 时 Vite 可能会提示 chunk 超过 500kB，这是正常现象，不代表构建失败。
- **功能降级差异**：在“离线模式”下，缓冲分析使用前端原生 Haversine 距离算法替代 PostGIS，打卡路线规划回退为两点间的直线连接，餐厅助手问答则会提示后端未连接。
