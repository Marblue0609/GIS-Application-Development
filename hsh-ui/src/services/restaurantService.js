import api from './api';

/**
 * 从不同后端响应结构中统一取出 items 数组。
 * 兼容 FastAPI 常见包装：{ data: { items: [...] } } 或 { items: [...] }
 */
const unwrapItems = (payload) => payload?.data?.items ?? payload?.items ?? [];
const unwrapData = (payload) => payload?.data ?? payload;

/**
 * 将后端返回的餐厅记录标准化为前端统一格式。
 * 同时兼容 hsh-ui 早期 GeoJSON 字段名和后端 snake_case 字段名。
 *
 * @param {object} item - 后端原始餐厅对象
 * @returns {object|null} 标准化后的餐厅对象，含 id / layerType / name / rating / phone / category / categoryRaw / price / address / lng / lat / displayLng / displayLat / distanceM
 */
const normalizeApiRestaurant = (item) => {
  if (!item) return null;
  const lng = Number(item.lng ?? item.lon ?? item.restaurant_lng);
  const lat = Number(item.lat ?? item.restaurant_lat);

  return {
    id: String(item.id ?? item.restaurant_id ?? ''),
    layerType: 'restaurant',
    name: item.name ?? item.restaurant_name ?? '未命名餐厅',
    rating: Number(item.rating ?? item.restaurant_rate ?? 0) || 0,
    phone: item.phone ?? item.restaurant_telephone ?? '暂无电话',
    category: item.category ?? item.restaurant_category ?? '其他',
    categoryRaw: item.categoryRaw ?? item.restaurant_category ?? item.category ?? '其他',
    price: Number(item.price ?? item.restaurant_avg_price ?? 0) || 0,
    address: item.address ?? item.restaurant_text_position ?? '暂无地址',
    lng,
    lat,
    displayLng: Number(item.displayLng ?? lng),
    displayLat: Number(item.displayLat ?? lat),
    distanceM: item.distanceM ?? item.distance_m ?? null,
    checkId: item.checkId ?? item.check_id ?? null,
    checkOrder: item.checkOrder ?? item.check_order ?? null,
    note: item.note ?? null,
  };
};

/**
 * 将前端筛选条件转换为后端 /api/restaurants/search 查询参数。
 * 空字符串/undefined 的字段会被省略，避免发送无效参数。
 *
 * @param {object} filters - 前端筛选状态 { keyword, category, priceRange, minRating }
 * @param {object} extra   - 额外参数 { limit, offset, center_lon, center_lat, radius }
 * @returns {object} 扁平化后的查询参数对象
 *
 * @example
 * toSearchParams({ keyword: '火锅', category: '川渝菜', minRating: 3.5, priceRange: [20, 200] })
 * // => { keyword: '火锅', category: '川渝菜', min_rating: 3.5, min_price: 20, max_price: 200, limit: 120, offset: 0 }
 */
const toSearchParams = (filters = {}, extra = {}) => ({
  keyword: filters.keyword || undefined,
  category: filters.category || undefined,
  min_price: filters.priceRange?.[0],
  max_price: filters.priceRange?.[1],
  min_rating: filters.minRating,
  limit: extra.limit ?? 120,
  offset: extra.offset ?? 0,
  center_lon: extra.center_lon,
  center_lat: extra.center_lat,
  radius: extra.radius,
});

/**
 * 获取全部餐厅列表。
 * 调用 GET /api/restaurants，返回标准化后的 items 数组。
 *
 * @param {object} params - 查询参数 { limit, offset }
 * @returns {Promise<{items: object[], ...}>}
 */
const ListRestaurants = async (params = {}) => {
  const response = await api.get('/restaurants', { params });
  return {
    ...response.data,
    items: unwrapItems(response.data).map(normalizeApiRestaurant).filter(Boolean),
  };
};

/**
 * 多条件搜索餐厅。
 * 调用 GET /api/restaurants/search，支持 keyword / category / price / rating / 空间范围。
 *
 * @param {object} params - 由 toSearchParams() 生成的查询参数
 * @returns {Promise<{items: object[], ...}>}
 */
const SearchRestaurants = async (params) => {
  const response = await api.get('/restaurants/search', { params });
  return {
    ...response.data,
    items: unwrapItems(response.data).map(normalizeApiRestaurant).filter(Boolean),
  };
};

/**
 * 缓冲区分析（Week 3 / 后端接口预留）。
 * 调用 GET /api/analysis/buffer，返回范围内餐厅分布统计。
 *
 * @param {object} params - { center_lng, center_lat, radius, ... }
 * @returns {Promise<object>}
 */
const BufferAnalysis = async (params) => {
  const response = await api.get('/analysis/buffer', { params });
  return response.data;
};

/**
 * 随机盲盒推荐（Week 3 / 后端接口预留）。
 * 调用 GET /api/restaurants/random，返回随机一家餐厅。
 *
 * @param {object} params - 可选筛选条件
 * @returns {Promise<object|null>} 标准化后的单个餐厅对象
 */
const RandomRestaurant = async (params) => {
  const response = await api.get('/restaurants/random', { params });
  return normalizeApiRestaurant(response.data?.data ?? response.data);
};

const ListCheckList = async () => {
  const response = await api.get('/check-list');
  return unwrapItems(response.data).map(normalizeApiRestaurant).filter(Boolean);
};

const AddCheckListItem = async (restaurantId, note = null) => {
  const response = await api.post('/check-list', {
    restaurant_id: Number(restaurantId),
    note,
  });
  return normalizeApiRestaurant(unwrapData(response.data));
};

const UpdateCheckListItem = async (checkId, payload) => {
  const response = await api.put(`/check-list/${checkId}`, payload);
  return normalizeApiRestaurant(unwrapData(response.data));
};

const DeleteCheckListItem = async (checkId) => {
  const response = await api.delete(`/check-list/${checkId}`);
  return unwrapData(response.data);
};

/**
 * 打卡路线规划（Week 3 / 后端接口预留）。
 * 调用 GET /api/route/plan，返回路线坐标 / 距离 / 耗时。
 *
 * @param {object} params - { check_list_id, travel_mode }
 * @returns {Promise<object>}
 */
const PlanRoute = async (params) => {
  const response = await api.get('/route/plan', { params });
  return unwrapData(response.data);
};

export {
  AddCheckListItem,
  BufferAnalysis,
  DeleteCheckListItem,
  ListCheckList,
  ListRestaurants,
  PlanRoute,
  RandomRestaurant,
  SearchRestaurants,
  UpdateCheckListItem,
  toSearchParams,
};
