import pandas as pd
import math
import os

# --- GCJ02 转 WGS84 的数学算法 ---
x_pi = 3.14159265358979324 * 3000.0 / 180.0
pi = 3.1415926535897932384626
a = 6378245.0
ee = 0.00669342162296594323

def out_of_china(lng, lat):
    return not (lng > 73.66 and lng < 135.05 and lat > 3.86 and lat < 53.55)

def transform_lat(x, y):
    ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * math.sqrt(abs(x))
    ret += (20.0 * math.sin(6.0 * x * pi) + 20.0 * math.sin(2.0 * x * pi)) * 2.0 / 3.0
    ret += (20.0 * math.sin(y * pi) + 40.0 * math.sin(y / 3.0 * pi)) * 2.0 / 3.0
    ret += (160.0 * math.sin(y / 12.0 * pi) + 320 * math.sin(y * pi / 30.0)) * 2.0 / 3.0
    return ret

def transform_lng(x, y):
    ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * math.sqrt(abs(x))
    ret += (20.0 * math.sin(6.0 * x * pi) + 20.0 * math.sin(2.0 * x * pi)) * 2.0 / 3.0
    ret += (20.0 * math.sin(x * pi) + 40.0 * math.sin(x / 3.0 * pi)) * 2.0 / 3.0
    ret += (150.0 * math.sin(x / 12.0 * pi) + 300.0 * math.sin(x / 30.0 * pi)) * 2.0 / 3.0
    return ret

def gcj02_to_wgs84(lng, lat):
    if out_of_china(lng, lat):
        return lng, lat
    dlat = transform_lat(lng - 105.0, lat - 35.0)
    dlng = transform_lng(lng - 105.0, lat - 35.0)
    radlat = lat / 180.0 * pi
    magic = math.sin(radlat)
    magic = 1 - ee * magic * magic
    sqrtmagic = math.sqrt(magic)
    dlat = (dlat * 180.0) / ((a * (1 - ee)) / (magic * sqrtmagic) * pi)
    dlng = (dlng * 180.0) / (a / sqrtmagic * math.cos(radlat) * pi)
    mglat = lat + dlat
    mglng = lng + dlng
    return [lng * 2 - mglng, lat * 2 - mglat]

# --- 数据清洗主流程 ---
def main():
    # 使用相对路径，在 data_pipeline 目录下运行
    input_path = '../data/spider/filtered/rest_clean_gcj02.csv'
    output_path = '../data/spider/processed/rest_clean_wgs84.csv'
    
    # 1. 读取数据
    print(f"正在读取文件: {input_path}")
    df = pd.read_csv(input_path)
    
    # 2. 处理“暂无数据”
    columns_to_clean = ['restaurant_telephone', 'restaurant_avg_price', 'restaurant_text_position']
    for col in columns_to_clean:
        if col in df.columns:
            # 将“暂无数据”替换为 pandas 的空值，后续入库会变成 NULL
            df[col] = df[col].replace('暂无数据', pd.NA)
    
    # 3. 坐标转换
    print("正在进行 GCJ-02 到 WGS-84 坐标转换...")
    # 使用 apply 函数逐行转换经纬度
    wgs_coords = df.apply(lambda row: gcj02_to_wgs84(row['lng_gcj02'], row['lat_gcj02']), axis=1)
    
    # 将转换后的坐标拆分为两列新字段
    df['lng_wgs84'] = [coord[0] for coord in wgs_coords]
    df['lat_wgs84'] = [coord[1] for coord in wgs_coords]
    
    # 4. 删除旧的 GCJ02 坐标列（可选，保持数据干净）
    df = df.drop(columns=['lng_gcj02', 'lat_gcj02'])
    
    # 5. 确保 processed 文件夹存在并保存文件
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_csv(output_path, index=False, encoding='utf-8-sig')
    print(f"清洗与转换完成！文件已保存至: {output_path}")

if __name__ == "__main__":
    main()