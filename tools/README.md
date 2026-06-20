# 本地数据库导入数据

在 SQL Shell 里运行:

```sql
CREATE USER citytaste_user WITH PASSWORD '123456';

CREATE DATABASE citytaste OWNER citytaste_user;

GRANT ALL PRIVILEGES ON DATABASE citytaste TO citytaste_user;

CREATE EXTENSION postgis;

SELECT postgis_version(); -- 用于测试是否成功安装了 PostGIS;

DROP TABLE IF EXISTS restaurants;
DROP TABLE IF EXISTS landmarks;
DROP TABLE IF EXISTS transportations;

CREATE TABLE landmarks (
    landmark_id SERIAL PRIMARY KEY,
    landmark_name VARCHAR(255) NOT NULL,
    landmark_type VARCHAR(100),
    landmark_geom_position geometry(PointZ, 4326) NOT NULL,
    landmark_text_position TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE restaurants (
    restaurant_id SERIAL PRIMARY KEY,
    restaurant_name VARCHAR(255) NOT NULL,
    restaurant_rate NUMERIC(3, 1),
    restaurant_telephone VARCHAR(100),
    restaurant_category VARCHAR(100),
    restaurant_avg_price NUMERIC(10, 2),
    restaurant_geom_position geometry(PointZ, 4326) NOT NULL,
    restaurant_text_position TEXT,
    source VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE transportations (
    transportation_id SERIAL PRIMARY KEY,
    transportation_name VARCHAR(255) NOT NULL,
    transportation_type VARCHAR(100),
    transportation_geom_position geometry(PointZ, 4326) NOT NULL,
    transportation_text_position TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_landmarks_geom ON landmarks
USING GIST (landmark_geom_position);

CREATE INDEX idx_landmarks_name ON landmarks
USING BTREE (landmark_name);

CREATE INDEX idx_restaurants_geom ON restaurants
USING GIST (restaurant_geom_position);

CREATE INDEX idx_restaurants_name ON restaurants
USING BTREE (restaurant_name);

CREATE INDEX idx_restaurants_category ON restaurants
USING BTREE (restaurant_category);

CREATE INDEX idx_restaurants_price ON restaurants
USING BTREE (restaurant_avg_price);

CREATE INDEX idx_restaurants_rate ON restaurants
USING BTREE (restaurant_rate);

CREATE INDEX idx_transportations_geom ON transportations
USING GIST (transportation_geom_position);

CREATE INDEX idx_transportations_name ON transportations
USING BTREE (transportation_name);

ALTER TABLE landmarks OWNER TO citytaste_user;

ALTER TABLE restaurants OWNER TO citytaste_user;

ALTER TABLE transportations OWNER TO citytaste_user;

ALTER SEQUENCE landmarks_landmark_id_seq OWNER TO citytaste_user;

ALTER SEQUENCE restaurants_restaurant_id_seq OWNER TO citytaste_user;

ALTER SEQUENCE transportations_transportation_id_seq OWNER TO citytaste_user;
```

回到项目的根目录, 运行 `python tools/import_geojson.py`, 如果若导入成功会看到:

```text
landmarks imported
restaurants imported
transportations imported
all geojson data imported
```
