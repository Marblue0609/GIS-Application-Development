# 简单说明

## Git

基本流程是: 

```text
每个人本地电脑开发代码
        ↓
提交到自己的功能分支
        ↓
推送到 GitHub
        ↓
通过 Pull Request 合并到主分支
        ↓
服务器从 GitHub 拉取最新代码并运行
```
### 1. 分支约定

#### 1.1 main 分支

`main` 是项目主分支, 用于保存当前稳定版本代码. 

- 不要直接在 `main` 分支上随意修改代码; 
- 不要直接向 `main` 分支强行推送; 
- 每次合并到 `main` 前, 应确认代码可以正常运行; 
- 服务器默认从 `main` 分支拉取代码并运行. 

#### 1.2 功能分支

每个人开发新功能时, 应从 `main` 创建自己的功能分支. 

分支命名: 

```text
姓名-模块名
```

例如: 

```text
jzx-backend/navigation
```

### 2. 下载项目代码

进入自己想存放项目的目录, 例如: 

```bash
cd D:\Code\In_Class
```

然后克隆项目: 

```bash
git clone https://github.com/Marblue0609/GIS-Application-Development.git
```

进入项目目录: 

```bash
cd GIS_Application_Development
```

查看当前分支: 

```bash
git branch
```

一般会看到当前在 `main` 分支. 

### 3. 每次开始前的准备工作

每次开始开发前, 先进入项目目录: 

```bash
cd D:\Code\In_Class\GIS_Application_Development
```

然后切换到主分支并拉取最新代码: 

```bash
git switch main
git pull origin main
```

这样可以保证本地代码是最新的, 减少后续冲突; 

### 4. 开发新功能的标准流程

假设要开发导航功能: 

#### 4.1 从 main 创建功能分支

```bash
git switch main
git pull origin main
git switch -c jzx-backend/navigation
```

其中 `jzx-backend/navigation` 改成你自己的分支名; 

---

#### 4.2 写代码

修改过程中可以随时查看状态: 

```bash
git status
```

查看具体改了什么: 

```bash
git diff
```

如果用的是 VS Code, 应该能在文件里直接看到绿色 / 红色的高亮; 

#### 4.3 提交

修改完成后, 先查看状态: 

```bash
git status
```

添加需要提交的文件, 一般可以直接 `git add .` 把所有文件都加入需要提交的列表; 

```bash
git add .
```

提交代码: 

```bash
git commit -m "jzx-backend/navigation completed; "
```

这个 message 最好写清楚一点; 

#### 4.4 推送到 GitHub

第一次推送自己的功能分支时, 执行: 

```bash
git push -u origin jzx-backend/navigation
```

之后如果继续在这个分支上提交, 可以直接: 

```bash
git push
```

#### 4.5  Pull Request

推送完成后, 打开 GitHub 项目页面. 

通常 GitHub 会提示你创建 Pull Request. 

Pull Request 的目标分支选择: 

```text
main
```

Pull Request 里需要说明一些基础信息; 

### 5. 同步代码

如果别人已经合并了新的代码到 `main`, 需要同步. 

先保存好自己的修改并提交, 然后执行: 

```bash
git switch main
git pull origin main
```

如果你正在自己的功能分支上开发, 希望把最新 `main` 合进来: 

```bash
git switch feature/你的分支名
git merge main
```

如果没有冲突, Git 会自动合并. 

如果出现冲突, 需要手动解决冲突后再提交. 

如果不确定应该保留哪部分内容, 不要乱删, 先群里问问. 

---

### 6. 不需要提交的文件

以下文件一般不要提交: 

```text
node_modules/
.venv/
venv/
__pycache__/
.env
.env.local
*.log
dist/
build/
.next/
.idea/
.vscode/
```

尤其注意: 

```text
.env
```

可以写一个 `.gitignore`, 具体怎么写直接让 AI 生成就行. 


e.g. `.gitignore`

```gitignore
# Node / frontend
node_modules/
dist/
build/
.next/
.vite/

# Python
__pycache__/
*.pyc
.venv/
venv/
env/

# Env files
.env
.env.local
.env.*.local

# Logs
*.log
logs/

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Database / temp
*.sqlite
*.db
tmp/
temp/
```

### 7. 服务器端如何更新代码

因为数据库在服务上, 所以代码需要在服务器上测试; 

服务器主要负责拉取 GitHub 上的最新代码并运行, 也可以直接在上面修改. 

服务器项目目录: 

```bash
/root/autodl-tmp/GISAppDev_Project
```

第一次在服务器上下载代码: 

```bash
cd /root/autodl-tmp/projects
git clone https://github.com/Marblue0609/GIS-Application-Development.git
cd GIS_Application_Development
```

后续更新服务器代码: 

```bash
cd /root/autodl-tmp/projects/GIS_Application_Development
git pull origin main
```

如果前端依赖发生变化, 需要在前端目录重新安装依赖: 

```bash
cd frontend
npm install
```

如果后端依赖发生变化, 需要在后端目录重新安装依赖: 

```bash
cd backend
source .venv/bin/activate
pip install -r requirements.txt
```


### 8. 常用 Git 命令速查

查看当前状态: 

```bash
git status
```

查看当前分支: 

```bash
git branch
```

切换分支: 

```bash
git switch 分支名
```

创建并切换新分支: 

```bash
git switch -c 新分支名
```

拉取远程最新代码: 

```bash
git pull origin main
```

添加修改文件: 

```bash
git add .
```

提交代码: 

```bash
git commit -m "提交说明"
```

推送代码: 

```bash
git push
```

第一次推送新分支: 

```bash
git push -u origin 分支名
```

查看远程仓库地址: 

```bash
git remote -v
```

查看提交记录: 

```bash
git log --oneline
```

## 数据库

服务器端数据库已经建好, 统一使用: 

```
数据库名: citytaste
用户名: citytaste_user
密码: 123456
端口: 5432
```

### 在服务器上连接数据库

在服务器上运行: 

```
psql -h 127.0.0.1 -U citytaste_user -d citytaste
```

然后输入密码: 

```123456```

如果成功, 会进入类似界面: 

```citytaste=>```

这就表示已经进入 / activate 了 citytaste 数据库. 

如果你已经在 PostgreSQL 命令行里, 可以使用: 

```\c citytaste```

看到类似: 

```You are now connected to database "citytaste"```

说明切换成功. 

退出数据库: 

```\q```

其他的简单 SQL 语句 (插入, 修改等可以直接把下面表的结构发给 AI 问)

### 表的结构

这些结构看不懂直接问 AI 就行: 

```sql
-- Table for restaurants
CREATE TABLE IF NOT EXISTS restaurants (
    restaurant_id SERIAL PRIMARY KEY,
    restaurant_name VARCHAR(255) NOT NULL,
    restaurant_rate NUMERIC(3, 1),
    restaurant_telephone VARCHAR(100),
    restaurant_category VARCHAR(100),
    restaurant_avg_price NUMERIC(10, 2),
    restaurant_geom_position geometry(Point, 4326) NOT NULL,
    restaurant_text_position TEXT,
    source VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for restaurants
CREATE INDEX IF NOT EXISTS idx_restaurants_geom
ON restaurants
USING GIST (restaurant_geom_position);

CREATE INDEX IF NOT EXISTS idx_restaurants_category
ON restaurants (restaurant_category);

CREATE INDEX IF NOT EXISTS idx_restaurants_rate
ON restaurants (restaurant_rate);

CREATE INDEX IF NOT EXISTS idx_restaurants_price
ON restaurants (restaurant_avg_price);

CREATE INDEX IF NOT EXISTS idx_restaurants_name
ON restaurants (restaurant_name);

-- Table for landmatks
CREATE TABLE IF NOT EXISTS landmarks (
    landmark_id SERIAL PRIMARY KEY,
    landmark_name VARCHAR(255) NOT NULL,
    landmark_type VARCHAR(100),
    landmark_geom_position geometry(Point, 4326) NOT NULL,
    landmark_text_position TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for landmarks
CREATE INDEX IF NOT EXISTS idx_landmarks_geom
ON landmarks
USING GIST (landmark_geom_position);

-- Table for transportations
CREATE TABLE IF NOT EXISTS transportations (
    transportation_id SERIAL PRIMARY KEY,
    transportation_name VARCHAR(255) NOT NULL,
    transportation_type VARCHAR(100),
    transportation_geom_position geometry(Point, 4326) NOT NULL,
    transportation_text_position TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for transportations
CREATE INDEX IF NOT EXISTS idx_transportations_geom
ON transportations
USING GIST (transportation_geom_position);

-- Table for check list
CREATE TABLE IF NOT EXISTS check_list (
    check_id SERIAL PRIMARY KEY,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(restaurant_id) ON DELETE CASCADE,
    check_order INTEGER NOT NULL,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for check list
CREATE UNIQUE INDEX IF NOT EXISTS idx_check_list_restaurant
ON check_list (restaurant_id);

CREATE INDEX IF NOT EXISTS idx_check_list_order
ON check_list (check_order);
```

### 后端连接数据库

FastAPI 后端 `.env` 文件中写: 

```DATABASE_URL=postgresql://citytaste_user:123456@127.0.0.1:5432/citytaste```

### Geoserver 连接数据库

GeoServer 创建 PostGIS Data Store 时填写: 

```
host: 127.0.0.1
port: 5432
database: citytaste
schema: public
user: citytaste_user
password: 123456
```

## DDL

### Week 1: 05.31 截止

- **项目初始化, 熟悉 git 和数据库的基础操作;**
1. 餐厅数据采集清洗入库; Geoserver 连接 PostGIS; (Optional) landmarks 和 transportations 数据入库; -- **ld**;
2. FastAPI 初始化, 搭建 API 框架; 连接 PostgreSQL; -- **jzx, zzh**; 
3. Cesium + React 框架搭建; 地图正常显示; 能显示餐厅点; (Optional) 前端初步设计; -- **hsh, prt**; 

### Week 2: 06.07 截止

1. 餐厅信息接口, 多条件检索接口, 距离搜索接口; 缓冲区分析接口-- **jzx, zzh**; 
2. 点选餐厅功能, 详细信息展示卡片; 搜索卡片 UI, 搜索结果 UI; 搜索结果 FlyTo; (Optional) 缓冲区显示与 ECharts 饼图; -- **hsh, prt**; 
3. 根据上述完成情况撰写报告, 制作 PPT; 必要时帮忙赶上述进度; -- **ld**; 

### Week 3: 06.14 截止

1. 打卡清单接口, 随机盲盒接口, 路线规划接口; -- **jzx, zzh**; 
2. 打卡清单 UI, 随机盲盒 UI, 导航路线可视化; -- **hsh, prt**; 
3. 根据上述完成情况撰写报告, 制作 PPT; 必要时帮忙赶上述进度; -- **ld**; 