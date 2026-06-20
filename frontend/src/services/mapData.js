/**
 * 安全取值工具：从 GeoJSON properties 中读取指定字段，
 * 若为 null/undefined 则返回 fallback。
 */
const getProp = (properties, key, fallback = '') => {
  const value = properties?.[key];
  return value === null || value === undefined ? fallback : value;
};

// 交通设施类型 → 中文显示名
const transportationLabels = {
  bus_center: '公交枢纽',
  bus_stop: '公交站',
  subway_entrance: '地铁出入口',
};

// 地标类型 → 中文显示名
const landmarkLabels = {
  snack_street: '餐饮街区',
  campus: '校园地标',
  landmark: '地标',
};

/**
 * 将地标或交通设施的 GeoJSON Feature 标准化为前端统一格式。
 *
 * @param {object} feature - GeoJSON Feature
 * @param {'landmark'|'transportation'} type - 图层类型
 * @returns {object} 标准化点位对象，含 id / layerType / name / category / address / lng / lat
 */
const normalizePointFeature = (feature, type) => {
  const properties = feature?.properties ?? {};
  const coordinates = feature?.geometry?.coordinates ?? [];
  const lng = Number(coordinates[0]) || 0;
  const lat = Number(coordinates[1]) || 0;

  if (type === 'landmark') {
    const category = getProp(properties, 'type', 'landmark');
    return {
      id: `landmark-${getProp(properties, 'name')}`,
      layerType: 'landmark',
      name: getProp(properties, 'name', '未命名地标'),
      category: landmarkLabels[category] ?? category,
      address: getProp(properties, 'text_locat', '暂无位置描述'),
      lng,
      lat,
      displayLng: lng,
      displayLat: lat,
    };
  }

  // transportation 类型：highway 字段含 bus_center / bus_stop / subway_entrance
  const category = getProp(properties, 'highway', 'transportation');
  return {
    id: `transportation-${getProp(properties, 'F_id', getProp(properties, 'name'))}`,
    layerType: 'transportation',
    name: getProp(properties, 'name', '未命名交通点'),
    category: transportationLabels[category] ?? category,
    address: '交通网点',
    lng,
    lat,
    displayLng: lng,
    displayLat: lat,
  };
};

// 对外暴露两个便捷工厂函数，封装 type 参数
export const normalizeLandmarkFeature = (feature) => normalizePointFeature(feature, 'landmark');

export const normalizeTransportationFeature = (feature) => normalizePointFeature(feature, 'transportation');
