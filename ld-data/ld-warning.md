# 一些重要说明


## 1. 数据库接入说明（后端：jzx, zzh）

数据库目前已在 AutoDL 容器本地启动，清洗后的矢量数据已完成映射与入库。

### 1.1 核心配置参数(这句话AI说的不一定准，geoserver的端口是这个没错)

FastAPI 后端在连接数据库时，请直接在 `.env` 文件中使用以下完整连接字符串进行配置：

```env
DATABASE_URL=postgresql://citytaste_user:123456@127.0.0.1:5432/citytaste

```

### 1.2 数据表与字段规范

目前已入库并具备完整空间索引（GiST）和 B-Tree 索引的三张核心表为：

* `restaurants`
* `landmarks`
* `transportations`

**开发要求：** 所有空间几何列（如 `restaurant_geom_position`）的底层数据类型已统一转换为带高程的三维点 **`PointZ`**，空间参考系统为标准 WGS84（EPSG:4326）。在执行 `ST_DWithin` 等 PostGIS 空间分析函数拼接 SQL 时，请确保维度对齐。



## 2. 地图服务接入说明（前端：hsh, prt）

GeoServer 服务已在 AutoDL 服务器本地 `6006` 端口部署完毕，且工作区和图层已全部发布。

### 2.1 本地网络映射规则（！！本人强烈建议按照下面说的做）

由于 AutoDL 实例的公网映射隧道存在严格的 HSTS 和路径代理拦截，前端直接通过外网域名请求 GeoServer API 会导致数据加载失败。**前端在本地联调 Cesium 时，必须通过 SSH 物理数据隧道拉取服务。**

请在本地电脑终端（CMD/Terminal）执行以下命令拉起隧道：

```bash
# 这个真的很重要。。
ssh -p <AutoDL实例端口号> root@<AutoDL实例域名> -L 6006:127.0.0.1:6006

# 实际就是下面这个
ssh -p 40984 root@connect.westc.seetacloud.com -L 6006:127.0.0.1:6006
```

*(注：执行后输入服务器登录密码。登录成功后，请保持该终端窗口在后台开启，切勿关闭。)*

### 2.2 接口调用规范

* **已发布图层名 (Layers)：**
* `citytaste:restaurants`
* `citytaste:landmarks`
* `citytaste:transportations`


* **坐标系统：** 请求切片时指定 `EPSG:4326`。


## 3. 服务器运维说明（公共）

为保障团队协同开发效率，请遵守以下服务器环境约定：

1. **数据库：** 若重启 AutoDL 实例后，后端提示连接拒绝（`Connection refused`），说明数据库处于休眠状态。请在服务器终端执行以下命令手动唤醒：
```bash
service postgresql start

psql -h 127.0.0.1 -U citytaste_user -d citytaste

密码：123456

```


2. **GeoServer：** GeoServer 环境部署于数据盘。若前端页面无法加载地图服务源，请在服务器终端执行启动脚本：
```bash
sh /root/autodl-tmp/geoserver/bin/startup.sh

```


3. **环境安全：** 数据基础设施文件均存放于 `/root/autodl-tmp` 目录下，严禁在此目录下执行未经确认的清空指令。