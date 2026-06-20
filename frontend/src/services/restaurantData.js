/**
 * 安全取值工具：从 GeoJSON properties 中读取指定字段，
 * 若为 null/undefined 则返回 fallback。
 */
const getProp = (properties, key, fallback = '') => {
  const value = properties?.[key];
  return value === null || value === undefined ? fallback : value;
};

/**
 * 将原始菜系字符串归一化为前端 UI 分类。
 * 原始数据中菜系字段（restaura_4）来自高德 POI 分类，细粒度较高，
 * 此处合并为 13 个大类便于筛选和图例展示。
 */
export const normalizeCategory = (category) => {
  if (!category) return '其他';
  if (category.includes('饮品') || category.includes('咖啡') || category.includes('茶')) return '饮品咖啡';
  if (category.includes('糕') || category.includes('饼') || category.includes('甜品') || category.includes('烘焙')) return '甜品烘焙';
  if (category.includes('川') || category.includes('渝')) return '川渝菜';
  if (category.includes('粤') || category.includes('广东')) return '粤菜';
  if (category.includes('日') || category.includes('韩国')) return '日韩料理';
  if (category.includes('西餐') || category.includes('意式')) return '西餐';
  if (category.includes('火锅')) return '火锅';
  if (category.includes('快餐') || category.includes('小吃')) return '快餐小吃';
  if (category.includes('浙江') || category.includes('江苏') || category.includes('安徽')) return '江浙本帮';
  if (category.includes('清真') || category.includes('西北')) return '清真西北';
  if (category.includes('湘') || category.includes('东北') || category.includes('鲁菜') || category.includes('地方')) return '地方风味';
  if (category.includes('综合')) return '综合酒楼';
  return '其他';
};

/**
 * 将本地 GeoJSON Feature 标准化为前端餐厅对象。
 * GeoJSON 字段名来自高德 POI 导出（restaura_1~restaura_7），
 * 坐标优先使用 WGS84 校正后的 lng_wgs84 / lat_wgs84。
 *
 * @param {object} feature - GeoJSON Feature
 * @returns {object} 标准化餐厅对象，含 id / layerType / name / rating / phone / category / categoryRaw / categoryCode / price / address / lng / lat
 */
export const normalizeRestaurantFeature = (feature) => {
  const properties = feature?.properties ?? {};
  const coordinates = feature?.geometry?.coordinates ?? [];
  // WGS84 坐标优先，兜底使用 geometry.coordinates
  const lng = Number(getProp(properties, 'lng_wgs84', coordinates[0])) || coordinates[0];
  const lat = Number(getProp(properties, 'lat_wgs84', coordinates[1])) || coordinates[1];
  const categoryRaw = getProp(properties, 'restaura_4', '其他');

  return {
    id: String(getProp(properties, 'restaurant', '')),
    layerType: 'restaurant',
    name: getProp(properties, 'restaura_1', '未命名餐厅'),
    rating: Number(getProp(properties, 'restaura_2', 0)) || 0,
    phone: getProp(properties, 'restaura_3', '暂无电话'),
    category: normalizeCategory(categoryRaw),
    categoryGroup: normalizeCategory(categoryRaw),
    categoryRaw,
    categoryCode: getProp(properties, 'restaura_5', ''),
    price: Number(getProp(properties, 'restaura_6', 0)) || 0,
    address: getProp(properties, 'restaura_7', '暂无地址'),
    lng,
    lat,
    displayLng: lng,
    displayLat: lat,
  };
};

/**
 * 纯前端筛选：不走后端 API，直接在本地数据中按条件过滤。
 * 用于后端不可用时的降级搜索。
 *
 * @param {object} restaurant - 标准化餐厅对象
 * @param {object} filters     - 筛选条件 { keyword, category, priceRange, minRating }
 * @returns {boolean} 是否匹配
 */
export const restaurantMatchesFilters = (restaurant, filters) => {
  const keyword = filters.keyword.trim().toLowerCase();
  const text = `${restaurant.name} ${restaurant.address} ${restaurant.categoryRaw} ${restaurant.category}`.toLowerCase();

  return (
    (!keyword || text.includes(keyword)) &&
    (!filters.category || restaurant.category === filters.category) &&
    restaurant.price >= filters.priceRange[0] &&
    restaurant.price <= filters.priceRange[1] &&
    restaurant.rating >= filters.minRating
  );
};

// 菜系 → 地图点位颜色映射，13 个分类各有唯一色值
export const categoryPalette = {
  饮品咖啡: '#2aa7a5',
  甜品烘焙: '#d96c95',
  川渝菜: '#dc5b3c',
  粤菜: '#4f9b6d',
  日韩料理: '#3b83bd',
  西餐: '#996bb2',
  火锅: '#d9822b',
  快餐小吃: '#c6a53a',
  江浙本帮: '#58a37d',
  清真西北: '#9a7448',
  地方风味: '#c86b55',
  综合酒楼: '#6f7782',
  其他: '#8f98a8',
};
