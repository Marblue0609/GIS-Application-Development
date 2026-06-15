import requests
import time
import logging
import pandas as pd

from typing import List, Dict, Any, Optional

# ================= 日志配置 =================

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)

# ================= 全局配置 =================

CONFIG = {
    "API_KEY": "xxxxxxxx",
    "ADCODE_XIHU": "330106",
    "TARGET_TYPES": [
        "050101",
        "050102",
        "050103",
        "050104",
        "050105",
        "050106",
        "050107",
        "050108",
        "050109",
        "050110",
        "050111",
        "050112",
        "050113",
        "050114",
        "050115",
        "050116",
        "050117",
        "050118",
        "050119",
        "050120",
        "050121",
        "050122",
        "050123",
        "050201",
        "050202",
        "050203",
        "050204",
        "050205",
        "050206",
        "050207",
        "050208",
        "050209",
        "050210",
        "050211",
        "050212",
        "050213",
        "050214",
        "050215",
        "050216",
        "050217",
        "050301",
        "050302",
        "050303",
        "050304",
        "050305",
        "050306",
        "050307",
        "050308",
        "050309",
        "050310",
        "050311",
        "050400",
        "050501",
        "050502",
        "050503",
        "050504",
        "050600",
        "050700",
        "050800",
    ],
    "MAX_PAGES": 20,
    # 每次请求间隔（秒）
    "REQUEST_INTERVAL": 2,
    # QPS限流后的等待时间
    "QPS_WAIT": 10,
}

# ================= 工具函数 =================


def safe_float(v):

    try:
        return float(v)

    except:
        return 0.0


# ================= 核心爬虫 =================


class AMapSpider:

    def __init__(self, api_key, adcode):

        self.api_key = api_key
        self.adcode = adcode

        self.base_url = "https://restapi.amap.com/v3/place/text"

    # ================= 单分类抓取 =================

    def fetch_single_type(self, type_code):

        results = []

        page = 1

        with requests.Session() as session:

            while page <= CONFIG["MAX_PAGES"]:

                params = {
                    "key": self.api_key,
                    "types": type_code,
                    "city": self.adcode,
                    "citylimit": "true",
                    "offset": 20,
                    "page": page,
                    "extensions": "all",
                    "output": "JSON",
                }

                try:

                    response = session.get(self.base_url, params=params, timeout=20)

                    response.raise_for_status()

                    data = response.json()

                except Exception as e:

                    logger.error(f"{type_code} 第{page}页 网络异常: {e}")

                    break

                status = data.get("status")

                info = data.get("info", "")

                # ================= API失败 =================

                if status != "1":

                    # QPS限制

                    if info == "CUQPS_HAS_EXCEEDED_THE_LIMIT":

                        logger.warning(f"QPS超限 → 等待 " f"{CONFIG['QPS_WAIT']} 秒")

                        time.sleep(CONFIG["QPS_WAIT"])

                        continue

                    logger.error(f"高德拒绝请求 " f"{type_code}" f" | {info}")

                    break

                pois = data.get("pois", [])

                if not pois:

                    break

                for poi in pois:

                    cleaned = self.clean_poi(poi, type_code)

                    if cleaned:

                        results.append(cleaned)

                logger.info(
                    f"分类 {type_code}" f" 第{page}页" f" 当前累计 {len(results)}"
                )

                if len(pois) < 20:

                    break

                page += 1

                # 节流

                time.sleep(CONFIG["REQUEST_INTERVAL"])

        return results

    # ================= 数据清洗 =================

    def clean_poi(self, poi, original_typecode) -> Optional[Dict[str, Any]]:

        try:

            loc = poi.get("location", "")

            if "," not in loc:

                return None

            lng_gcj, lat_gcj = map(float, loc.split(","))

            biz_ext = poi.get("biz_ext", {})

            if not isinstance(biz_ext, dict):

                biz_ext = {}

            tel = poi.get("tel", "")

            if tel == "[]":

                tel = ""

            raw_type = str(poi.get("type", ""))

            category = raw_type.split(";")[-1] if ";" in raw_type else raw_type

            return {
                "restaurant_id": poi.get("id", ""),
                "restaurant_name": poi.get("name", ""),
                "restaurant_rate": safe_float(biz_ext.get("rating")),
                "restaurant_telephone": tel,
                "restaurant_category": category,
                "restaurant_typecode": original_typecode,
                "restaurant_avg_price": safe_float(biz_ext.get("cost")),
                # ===== 原始GCJ02 =====
                "lng_gcj02": lng_gcj,
                "lat_gcj02": lat_gcj,
                "restaurant_text_position": poi.get("address", ""),
            }

        except:

            return None

    # ================= 全量抓取 =================

    def fetch_all(self):

        all_data = []

        seen = set()

        for type_code in CONFIG["TARGET_TYPES"]:

            logger.info(f"开始抓取 {type_code}")

            result = self.fetch_single_type(type_code)

            for item in result:

                rid = item["restaurant_id"]

                if rid not in seen:

                    seen.add(rid)

                    all_data.append(item)

            logger.info(f"完成 {type_code}" f" | 当前总数" f" {len(all_data)}")

            # 分类之间再休息一下

            time.sleep(3)

        return all_data


# ================= 主程序 =================

if __name__ == "__main__":

    spider = AMapSpider(CONFIG["API_KEY"], CONFIG["ADCODE_XIHU"])

    results = spider.fetch_all()

    df = pd.DataFrame(results)

    df.to_csv("rest_gcj02.csv", index=False, encoding="utf-8-sig")

    logger.info(f"全部完成" f" 共 {len(df)} 条" f" 已保存 CSV")
