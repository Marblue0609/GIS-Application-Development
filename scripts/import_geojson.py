import json
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

BASE_DIR = Path(__file__).resolve().parents[1]
LD_DATA_DIR = BASE_DIR / "ld-data" / "data" / "json"

load_dotenv(BASE_DIR / "backend" / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not found. Please check backend/.env")


engine = create_engine(DATABASE_URL, pool_pre_ping=True)


def pointz_wkt(coords):
    lng, lat, *rest = coords
    z = rest[0] if rest else 0
    return f"POINT Z ({lng} {lat} {z})"


def import_landmarks():
    path = LD_DATA_DIR / "landmark" / "landmark_4326.geojson"

    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE landmarks RESTART IDENTITY;"))

        for feature in data["features"]:
            props = feature["properties"]
            coords = feature["geometry"]["coordinates"]

            conn.execute(
                text("""
                    INSERT INTO landmarks (
                        landmark_name,
                        landmark_type,
                        landmark_geom_position,
                        landmark_text_position
                    )
                    VALUES (
                        :name,
                        :type,
                        ST_GeomFromText(:geom, 4326),
                        :text_location
                    )
                """),
                {
                    "name": props.get("name"),
                    "type": props.get("type"),
                    "geom": pointz_wkt(coords),
                    "text_location": props.get("text_locat"),
                },
            )

    print("landmarks imported")


def import_restaurants():
    path = LD_DATA_DIR / "rest" / "rest4326.geojson"

    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE restaurants RESTART IDENTITY CASCADE;"))

        for feature in data["features"]:
            props = feature["properties"]
            coords = feature["geometry"]["coordinates"]

            conn.execute(
                text("""
                    INSERT INTO restaurants (
                        restaurant_name,
                        restaurant_rate,
                        restaurant_telephone,
                        restaurant_category,
                        restaurant_avg_price,
                        restaurant_geom_position,
                        restaurant_text_position,
                        source
                    )
                    VALUES (
                        :name,
                        :rate,
                        :telephone,
                        :category,
                        :avg_price,
                        ST_GeomFromText(:geom, 4326),
                        :text_location,
                        :source
                    )
                """),
                {
                    "name": props.get("restaura_1"),
                    "rate": props.get("restaura_2"),
                    "telephone": props.get("restaura_3"),
                    "category": props.get("restaura_4"),
                    "avg_price": props.get("restaura_6"),
                    "geom": pointz_wkt(coords),
                    "text_location": props.get("restaura_7"),
                    "source": props.get("restaurant"),
                },
            )

    print("restaurants imported")


def import_transportations():
    path = LD_DATA_DIR / "tran" / "tran_4326.geojson"

    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE transportations RESTART IDENTITY;"))

        for feature in data["features"]:
            props = feature["properties"]
            coords = feature["geometry"]["coordinates"]

            conn.execute(
                text("""
                    INSERT INTO transportations (
                        transportation_name,
                        transportation_type,
                        transportation_geom_position,
                        transportation_text_position
                    )
                    VALUES (
                        :name,
                        :type,
                        ST_GeomFromText(:geom, 4326),
                        :text_location
                    )
                """),
                {
                    "name": props.get("name") or props.get("F_id"),
                    "type": props.get("highway"),
                    "geom": pointz_wkt(coords),
                    "text_location": props.get("F_id"),
                },
            )

    print("transportations imported")


if __name__ == "__main__":
    import_landmarks()
    import_restaurants()
    import_transportations()
    print("all geojson data imported")
