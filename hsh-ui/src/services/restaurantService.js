import api from './api';

// 餐厅综合检索接口
// 请求示例: GET /api/restaurants/search?keyword=火锅&category=川菜&minPrice=30&maxPrice=100&minRating=4.0
// 响应示例: { code: 200, data: [{ restaurantId, restaurantName, restaurantRate, ... }] }
const SearchRestaurants = async (params) => {
  const response = await api.get('/restaurants/search', { params });
  return response.data;
};

// 缓冲区分析接口
// 请求示例: GET /api/analysis/buffer?centerLng=120.09&centerLat=30.31&radius=1000
// 响应示例: { code: 200, data: { categories: [{ name: '火锅', count: 12, avgPrice: 80 }, ...] } }
const BufferAnalysis = async (params) => {
  const response = await api.get('/analysis/buffer', { params });
  return response.data;
};

// 个性化美食盲盒推荐接口
// 请求示例: GET /api/restaurants/random?category=火锅&minRating=4.0
// 响应示例: { code: 200, data: { restaurantId, restaurantName, restaurantRate, ... } }
const RandomRestaurant = async (params) => {
  const response = await api.get('/restaurants/random', { params });
  return response.data;
};

// 打卡路线规划接口
// 请求示例: GET /api/route/plan?travelMode=walking    (walking / driving / bicycling)
// 响应示例: { code: 200, data: { distance, duration, path: [[lng, lat], ...] } }
const PlanRoute = async (params) => {
  const response = await api.get('/route/plan', { params });
  return response.data;
};

export { SearchRestaurants, BufferAnalysis, RandomRestaurant, PlanRoute };
