# CityTaste

CityTaste 是一个面向浙江大学紫金港校区周边餐饮场景的 GIS Web 应用。项目整合餐厅 POI、校园及周边地标、交通设施和空间分析能力，提供地图浏览、多条件检索、范围搜索、随机推荐、打卡清单、路线预览和餐厅 AI 问答等功能。

项目采用前后端分离结构：

- `frontend/`：React + Vite + Cesium 前端应用。
- `backend/`：FastAPI + SQLAlchemy + PostgreSQL/PostGIS 后端接口。
- `data/`：餐厅、地标、交通等空间数据及处理说明。
- `tools/`：数据导入和辅助脚本。

## 功能特性

- 餐厅多条件检索：支持关键词、菜系、人均价格、最低评分筛选。
- Cesium 地图交互：餐厅、地标、交通设施分层展示，支持悬停、点击、高亮和定位。
- 范围搜索与缓冲分析：以餐厅、地标或交通点为中心，查询指定半径内餐厅并展示菜系结构。
- 随机推荐：根据当前筛选条件随机推荐一家餐厅。
- 打卡清单：保存目标餐厅，支持排序、删除和路线预览。
- 路线规划：后端配置高德 Web 服务 Key 后使用真实路网；未配置时回退到直线预览。
- 餐厅助手：通过 DeepSeek `deepseek-v4-flash` 模型，基于项目餐厅资料回答餐厅相关问题。
- 本地数据降级：后端不可用时，前端仍可读取本地 GeoJSON 进行基本检索和地图展示。

## 技术栈

| 模块     | 技术                                                           |
| -------- | -------------------------------------------------------------- |
| 前端     | React 19, Vite 8, Cesium 1.141, Ant Design 6, ECharts 6, Axios |
| 后端     | FastAPI, SQLAlchemy, PostgreSQL/PostGIS, Pydantic Settings     |
| 数据     | GeoJSON, Shapefile, CSV, PostGIS                               |
| 外部服务 | DeepSeek API, 高德 Web 服务 API                                |

## 目录结构

```text
.
├── backend/              # FastAPI 后端服务
│   ├── app/
│   │   ├── api/          # REST API 路由
│   │   ├── core/         # 配置读取
│   │   ├── db/           # 数据库连接
│   │   ├── AGENTS.md     # 餐厅助手上下文资料
│   │   └── main.py       # 后端入口
│   ├── requirements.txt
│   └── README.md
├── frontend/             # React 前端应用
│   ├── public/           # 本地 GeoJSON 与静态资源
│   ├── src/
│   │   ├── components/   # 页面和地图组件
│   │   └── services/     # API 与数据标准化封装
│   ├── package.json
│   └── README.md
├── data/                 # 数据文件、数据处理说明和空间数据
├── tools/                # 数据导入脚本
├── instruction.md        # 开发过程说明
├── plan.md               # 项目计划
└── README.md
```

## 快速开始

### 1. 启动后端

进入后端目录：

```bash
cd backend
```

创建并激活 Python 环境：

```bash
# 使用 Python 虚拟环境
python -m venv .venv
source .venv/bin/activate

# 使用 conda 环境
conda create -n citytaste python=3.10
conda activate citytaste
```

安装依赖：

```bash
pip install -r requirements.txt
```

复制环境变量模板：

```bash
cp .env.example .env
```

根据本地环境填写 `backend/.env`：

```env
DATABASE_URL=postgresql://citytaste_user:123456@127.0.0.1:5432/citytaste
APP_NAME=CityTaste API
APP_ENV=dev
BACKEND_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
AMAP_KEY=
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

启动服务：

```bash
uvicorn app.main:app --reload
```

后端默认地址：

```text
http://127.0.0.1:8000
```

接口文档：

```text
http://127.0.0.1:8000/docs
```

### 2. 启动前端

进入前端目录：

```bash
cd frontend
```

安装依赖：

```bash
npm install
```

按需创建 `frontend/.env`：

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api
VITE_CESIUM_ION_TOKEN=
```

启动开发服务器：

```bash
npm run dev
```

前端默认地址：

```text
http://127.0.0.1:5173/
```

## 常用命令

### 前端

```bash
cd frontend
npm run dev
npm run lint
npm run build
npm run preview
```

### 后端

```bash
cd backend
uvicorn app.main:app --reload
python -m py_compile app/main.py
```

### 数据导入

`tools/import_geojson.py` 会读取 `data/data/json/` 下的 GeoJSON，并导入到 PostGIS：

```bash
python tools/import_geojson.py
```

运行前请确认 `backend/.env` 中的 `DATABASE_URL` 指向可用数据库。

## 核心接口

| 方法     | 路径                         | 说明                 |
| -------- | ---------------------------- | -------------------- |
| `GET`    | `/api/health`                | 后端健康检查         |
| `GET`    | `/api/db/check`              | 数据库连接检查       |
| `GET`    | `/api/restaurants`           | 餐厅列表             |
| `GET`    | `/api/restaurants/search`    | 多条件检索与距离搜索 |
| `GET`    | `/api/restaurants/random`    | 随机推荐             |
| `GET`    | `/api/analysis/buffer`       | 缓冲区范围分析       |
| `GET`    | `/api/check-list`            | 获取打卡清单         |
| `POST`   | `/api/check-list`            | 添加打卡餐厅         |
| `PUT`    | `/api/check-list/{check_id}` | 更新打卡顺序或备注   |
| `DELETE` | `/api/check-list/{check_id}` | 删除打卡餐厅         |
| `GET`    | `/api/route/plan`            | 生成打卡路线         |
| `POST`   | `/api/chat/restaurants`      | 餐厅助手问答         |

## 数据说明

前端本地降级数据位于：

```text
frontend/public/restaurants.geojson
frontend/public/landmarks.geojson
frontend/public/transportations.geojson
```

完整数据与处理说明位于：

- [data/README.md](./data/README.md)
- [data/warnings.md](./data/warnings.md)

## 环境变量

### 后端

| 变量                   | 说明                                    |
| ---------------------- | --------------------------------------- |
| `DATABASE_URL`         | PostgreSQL/PostGIS 数据库连接           |
| `BACKEND_CORS_ORIGINS` | 允许跨域访问的前端地址                  |
| `AMAP_KEY`             | 高德 Web 服务 Key，用于真实路网路线规划 |
| `DEEPSEEK_API_KEY`     | DeepSeek API Key，用于餐厅助手          |
| `DEEPSEEK_BASE_URL`    | DeepSeek API 地址                       |
| `DEEPSEEK_MODEL`       | 餐厅助手使用的模型名                    |

### 前端

| 变量                    | 说明                     |
| ----------------------- | ------------------------ |
| `VITE_API_BASE_URL`     | 后端 API 基础地址        |
| `VITE_CESIUM_ION_TOKEN` | Cesium Ion Token，可为空 |

## 备注

- 前端在后端不可用时会自动使用本地 GeoJSON，因此地图和基础检索仍可运行。
- 路线规划没有配置 `AMAP_KEY` 时会回退为直线预览。
- 餐厅助手需要 `DEEPSEEK_API_KEY`；未配置时问答接口会返回配置错误。
- Cesium 构建时可能提示 bundle 体积较大，这是地图依赖带来的常见提示，不代表构建失败。
