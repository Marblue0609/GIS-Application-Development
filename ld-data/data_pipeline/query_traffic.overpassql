[out:json][timeout:90];
(
  // 1. 地铁出入口 (精确到具体的地铁口，如A口、B口)
  node["railway"="subway_entrance"](around:8000, 30.30685, 120.08178);
  way["railway"="subway_entrance"](around:8000, 30.30685, 120.08178);

  // 2. 常规路边公交站点
  node["highway"="bus_stop"](around:8000, 30.30685, 120.08178);
  
  // 3. 公交首末站、公交枢纽站
  node["amenity"="bus_station"](around:8000, 30.30685, 120.08178);
  way["amenity"="bus_station"](around:8000, 30.30685, 120.08178);
);
// 自动计算中心点输出，确保所有数据都转化为点(Point)坐标，完美匹配你的数据库结构
out center;