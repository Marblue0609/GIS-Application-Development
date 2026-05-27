# CityTaste Frontend

React + Vite + Cesium 前端原型，用于 Week 1 展示紫金港周边餐厅点位。

## 本地运行

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

如果需要加载 Cesium Ion 在线底图，在 `.env` 中填写：

```bash
VITE_CESIUM_ION_TOKEN=你的 Cesium ion token
```

不填写 token 时，页面会使用本地浅色网格底图兜底，餐厅点位和筛选功能仍可正常调试。

## 当前数据来源

Week 1 前端暂时读取 `public/restaurants.geojson`，该文件来自 `ld-data/data/json/rest/rest4326.geojson` 的 WGS84 餐厅点数据。后续 FastAPI 接口稳定后，可以把数据读取切换到 `/api/restaurants/search` 等接口。
