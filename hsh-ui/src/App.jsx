import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layout, message } from 'antd';
import CesiumMap from './components/CesiumMap';
import Sidebar from './components/Sidebar';
import { normalizeRestaurantFeature, restaurantMatchesFilters } from './services/restaurantData';
import { normalizeLandmarkFeature, normalizeTransportationFeature } from './services/mapData';
import { ListRestaurants, SearchRestaurants, toSearchParams } from './services/restaurantService';

const { Content } = Layout;

/**
 * 从标准化点位对象中提取 WGS84 经纬度。
 * 兼容不同数据源可能使用 lng/lat 或 displayLng/displayLat 的情况。
 */
const getPoint = (item) => ({
  lng: Number(item?.lng ?? item?.displayLng),
  lat: Number(item?.lat ?? item?.displayLat),
});

/**
 * Haversine 公式计算两点间的球面距离（米）。
 * 后端不可用时，用于前端本地范围搜索。
 *
 * @param {{lat: number, lng: number}} a - 起点
 * @param {{lat: number, lng: number}} b - 终点
 * @returns {number} 距离（米）
 */
const distanceMeters = (a, b) => {
  const radius = 6371000;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const deltaLat = (b.lat - a.lat) * Math.PI / 180;
  const deltaLng = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

/**
 * 应用根组件。
 *
 * 数据加载策略：
 *   1. 组件挂载时先并行读取 3 个本地 GeoJSON（restaurants / landmarks / transportations），
 *      确保即使后端未启动也能立即渲染。
 *   2. 同时尝试调用 GET /api/restaurants，成功后替换本地餐厅数据为后端数据。
 *   3. 筛选条件变化时优先调用 /api/restaurants/search，失败则回退到本地过滤。
 */
function App() {
  const [allRestaurants, setAllRestaurants] = useState([]);
  const [visibleRestaurants, setVisibleRestaurants] = useState([]);
  const [landmarks, setLandmarks] = useState([]);
  const [transportations, setTransportations] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [selectedMapItem, setSelectedMapItem] = useState(null);
  const [focusedRestaurantId, setFocusedRestaurantId] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [apiStatus, setApiStatus] = useState('checking');
  const [analysisArea, setAnalysisArea] = useState(null);
  const [filters, setFilters] = useState({
    keyword: '',
    category: null,
    priceRange: [0, 500],
    minRating: 0,
  });

  // Step 1: 挂载时立即加载 3 个本地 GeoJSON（零延迟渲染）
  useEffect(() => {
    const loadLocalData = async () => {
      const [restaurantResponse, landmarkResponse, transportationResponse] = await Promise.all([
        fetch('/restaurants.geojson'),
        fetch('/landmarks.geojson'),
        fetch('/transportations.geojson'),
      ]);
      const [restaurantGeojson, landmarkGeojson, transportationGeojson] = await Promise.all([
        restaurantResponse.json(),
        landmarkResponse.json(),
        transportationResponse.json(),
      ]);

      const localRestaurants = restaurantGeojson.features.map(normalizeRestaurantFeature);
      setAllRestaurants(localRestaurants);
      setVisibleRestaurants(localRestaurants);
      setLandmarks(landmarkGeojson.features.map(normalizeLandmarkFeature));
      setTransportations(transportationGeojson.features.map(normalizeTransportationFeature));
    };

    loadLocalData().catch((error) => {
      console.error('读取本地 GeoJSON 数据失败:', error);
      message.error('本地地图数据读取失败');
    });
  }, []);

  // Step 2: 并行尝试后端 API，成功后用后端数据替换本地餐厅数据
  useEffect(() => {
    let cancelled = false;

    const loadBackendRestaurants = async () => {
      try {
        const result = await ListRestaurants({ limit: 500, offset: 0 });
        if (cancelled || !result.items.length) return;
        setAllRestaurants(result.items);
        setVisibleRestaurants(result.items);
        setApiStatus('online');
      } catch (error) {
        if (!cancelled) {
          setApiStatus('offline');
          console.warn('Backend API unavailable, using local GeoJSON fallback.', error);
        }
      }
    };

    loadBackendRestaurants();
    return () => {
      cancelled = true;
    };
  }, []);

  // Step 3: 筛选条件变化 → 后端搜索 or 本地过滤（260ms 防抖）
  useEffect(() => {
    if (apiStatus !== 'online') {
      const timer = window.setTimeout(() => {
        setVisibleRestaurants(allRestaurants.filter((restaurant) => restaurantMatchesFilters(restaurant, filters)));
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(async () => {
      try {
        const result = await SearchRestaurants(toSearchParams(filters));
        setVisibleRestaurants(result.items);
        setAnalysisArea(null); // 筛选条件变了，清除上一个范围圈
      } catch (error) {
        setApiStatus('offline');
        setVisibleRestaurants(allRestaurants.filter((restaurant) => restaurantMatchesFilters(restaurant, filters)));
        console.warn('Search API failed, switched to local filtering.', error);
      }
    }, 260);

    return () => window.clearTimeout(timer);
  }, [allRestaurants, apiStatus, filters]);

  // 从全量数据中提取去重菜系列表，供筛选下拉框使用
  const categories = useMemo(() => (
    [...new Set(allRestaurants.map((item) => item.category))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
  ), [allRestaurants]);

  // 顶部摘要：总量/可见数/均分/人均
  const stats = useMemo(() => {
    const rated = visibleRestaurants.filter((restaurant) => restaurant.rating > 0);
    const priced = visibleRestaurants.filter((restaurant) => restaurant.price > 0);

    return {
      total: allRestaurants.length,
      visible: visibleRestaurants.length,
      avgRating: rated.length
        ? (rated.reduce((sum, item) => sum + item.rating, 0) / rated.length).toFixed(1)
        : '-',
      avgPrice: priced.length
        ? Math.round(priced.reduce((sum, item) => sum + item.price, 0) / priced.length)
        : '-',
    };
  }, [allRestaurants.length, visibleRestaurants]);

  // ECharts 饼图数据：按当前可见餐厅的菜系统计
  const categoryStats = useMemo(() => {
    const categoryCount = visibleRestaurants.reduce((acc, restaurant) => {
      const name = restaurant.category || '其他';
      acc[name] = (acc[name] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(categoryCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [visibleRestaurants]);

  // 打卡清单 → 坐标数组，供路线折线绘制（≥2 个点才画线）
  const routePath = useMemo(() => (
    checklist
      .map(getPoint)
      .filter((point) => Number.isFinite(point.lng) && Number.isFinite(point.lat))
  ), [checklist]);

  const routeDistanceM = useMemo(() => {
    if (routePath.length < 2) return 0;
    return routePath.slice(1).reduce((sum, point, index) => (
      sum + distanceMeters(routePath[index], point)
    ), 0);
  }, [routePath]);

  // 选中餐厅（来自侧栏列表或地图点选）→ 高亮 + FlyTo
  const handleFocusRestaurant = useCallback((restaurant) => {
    setSelectedRestaurant(restaurant);
    setSelectedMapItem(restaurant);
    setFocusedRestaurantId(restaurant.id);
  }, []);

  // 选中非餐厅点位（地标/交通）→ 高亮但不更新详情卡片
  const handleFocusMapItem = useCallback((item) => {
    setSelectedMapItem(item);
    setFocusedRestaurantId(item?.id ?? null);
    if (item?.layerType === 'restaurant') {
      setSelectedRestaurant(item);
    }
  }, []);

  // 加入打卡清单（去重）
  const handleSaveRestaurant = useCallback((restaurant) => {
    if (!restaurant) return;
    setChecklist((current) => {
      if (current.some((item) => item.id === restaurant.id)) return current;
      return [...current, restaurant];
    });
  }, []);

  // 从清单移除
  const handleRemoveRestaurant = useCallback((restaurantId) => {
    setChecklist((current) => current.filter((item) => item.id !== restaurantId));
  }, []);

  const handleMoveChecklistItem = useCallback((restaurantId, direction) => {
    setChecklist((current) => {
      const index = current.findIndex((item) => item.id === restaurantId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= current.length) return current;

      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }, []);

  // 范围搜索：优先调后端 /api/restaurants/search?center_lon&center_lat&radius，
  // 后端失败则本地 haversine 计算距离过滤，并标记 apiStatus 为 offline
  const handleRadiusSearch = useCallback(async (center, radius) => {
    if (!center) {
      message.warning('请先选择一个餐厅、地标或交通点作为中心');
      return;
    }

    const centerPoint = getPoint(center);
    if (!Number.isFinite(centerPoint.lng) || !Number.isFinite(centerPoint.lat)) {
      message.warning('当前中心点缺少坐标');
      return;
    }

    setAnalysisArea({ ...centerPoint, radius });

    if (apiStatus === 'online') {
      try {
        const result = await SearchRestaurants(toSearchParams(filters, {
          center_lon: centerPoint.lng,
          center_lat: centerPoint.lat,
          radius,
          limit: 160,
        }));
        setVisibleRestaurants(result.items);
        message.success(`已找到 ${result.items.length} 家范围内餐厅`);
        return;
      } catch (error) {
        setApiStatus('offline');
        console.warn('Radius search API failed, using local distance calculation.', error);
      }
    }

    const nearby = allRestaurants
      .filter((restaurant) => restaurantMatchesFilters(restaurant, filters))
      .map((restaurant) => ({
        ...restaurant,
        distanceM: distanceMeters(centerPoint, getPoint(restaurant)),
      }))
      .filter((restaurant) => restaurant.distanceM <= radius)
      .sort((a, b) => a.distanceM - b.distanceM);

    setVisibleRestaurants(nearby);
    message.success(`已在本地数据中找到 ${nearby.length} 家范围内餐厅`);
  }, [allRestaurants, apiStatus, filters]);

  return (
    <Layout className="app-shell">
      <Sidebar
        apiStatus={apiStatus}
        categories={categories}
        filters={filters}
        onFiltersChange={setFilters}
        restaurants={visibleRestaurants}
        landmarks={landmarks}
        transportations={transportations}
        selectedRestaurant={selectedRestaurant}
        selectedMapItem={selectedMapItem}
        stats={stats}
        categoryStats={categoryStats}
        checklist={checklist}
        routeDistanceM={routeDistanceM}
        analysisArea={analysisArea}
        onSelectRestaurant={handleFocusRestaurant}
        onSaveRestaurant={handleSaveRestaurant}
        onRemoveRestaurant={handleRemoveRestaurant}
        onMoveChecklistItem={handleMoveChecklistItem}
        onSelectMapItem={handleFocusMapItem}
        onRadiusSearch={handleRadiusSearch}
      />
      <Content className="map-panel">
        <CesiumMap
          analysisArea={analysisArea}
          apiStatus={apiStatus}
          focusedRestaurantId={focusedRestaurantId}
          landmarks={landmarks}
          restaurants={visibleRestaurants}
          routePath={routePath}
          selectedRestaurant={selectedRestaurant}
          stats={stats}
          transportations={transportations}
          onSelectRestaurant={handleFocusRestaurant}
          onSelectMapItem={handleFocusMapItem}
        />
      </Content>
    </Layout>
  );
}

export default App;
