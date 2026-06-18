import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfigProvider, Layout, message } from 'antd';
import CesiumMap from './components/CesiumMap';
import HomePage from './components/HomePage';
import Sidebar from './components/Sidebar';
import { normalizeRestaurantFeature, restaurantMatchesFilters } from './services/restaurantData';
import { normalizeLandmarkFeature, normalizeTransportationFeature } from './services/mapData';
import {
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
} from './services/restaurantService';

const { Content } = Layout;

const appTheme = {
  token: {
    colorPrimary: '#ff6b4a',
    colorInfo: '#3b83bd',
    colorSuccess: '#4fb36b',
    colorWarning: '#d9952e',
    colorText: '#2f2a26',
    colorBgLayout: '#f4efe7',
    borderRadius: 8,
  },
};

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

const normalizeRoutePoint = (point) => {
  if (Array.isArray(point)) {
    return { lng: Number(point[0]), lat: Number(point[1]) };
  }
  return getPoint(point);
};

const isValidPoint = (point) => Number.isFinite(point?.lng) && Number.isFinite(point?.lat);

const attachWaypointsToRoutePath = (path, waypoints) => {
  const validPath = path.map(normalizeRoutePoint).filter(isValidPoint);
  const validWaypoints = waypoints.map(normalizeRoutePoint).filter(isValidPoint);
  if (validPath.length < 2) return validWaypoints;
  if (!validWaypoints.length) return validPath;

  const merged = [...validPath];
  validWaypoints.forEach((waypoint, index) => {
    if (index === 0) {
      if (distanceMeters(waypoint, merged[0]) > 3) merged.unshift(waypoint);
      return;
    }

    if (index === validWaypoints.length - 1) {
      if (distanceMeters(waypoint, merged[merged.length - 1]) > 3) merged.push(waypoint);
      return;
    }

    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    merged.forEach((point, pointIndex) => {
      const distance = distanceMeters(waypoint, point);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = pointIndex;
      }
    });
    if (nearestDistance > 3) merged.splice(nearestIndex + 1, 0, waypoint);
  });

  return merged;
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
  const [bufferStats, setBufferStats] = useState([]);
  const [routePlan, setRoutePlan] = useState(null);
  const [viewMode, setViewMode] = useState('home');
  const [activeFeature, setActiveFeature] = useState('search');
  const [filters, setFilters] = useState({
    keyword: '',
    category: null,
    priceRange: [0, 500],
    minRating: 0,
  });

  const clearActiveSelection = useCallback(() => {
    setSelectedRestaurant(null);
    setSelectedMapItem(null);
    setFocusedRestaurantId(null);
  }, []);

  const handleFiltersChange = useCallback((updater) => {
    setRoutePlan(null);
    clearActiveSelection();
    setFilters(updater);
  }, [clearActiveSelection]);

  const handleClearRoute = useCallback(() => {
    setRoutePlan(null);
    clearActiveSelection();
  }, [clearActiveSelection]);

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

  useEffect(() => {
    if (apiStatus !== 'online') return undefined;

    let cancelled = false;
    const loadChecklist = async () => {
      try {
        const items = await ListCheckList();
        if (!cancelled) setChecklist(items);
      } catch (error) {
        console.warn('Check-list API unavailable, keeping local checklist mode.', error);
      }
    };

    loadChecklist();
    return () => {
      cancelled = true;
    };
  }, [apiStatus]);

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
        const result = await SearchRestaurants(toSearchParams(filters, { limit: 500, offset: 0 }));
        setVisibleRestaurants(result.items);
        setAnalysisArea(null); // 筛选条件变了，清除上一个范围圈
        setBufferStats([]);
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
    if (bufferStats.length) return bufferStats;

    const categoryCount = visibleRestaurants.reduce((acc, restaurant) => {
      const name = restaurant.category || '其他';
      acc[name] = (acc[name] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(categoryCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [bufferStats, visibleRestaurants]);

  // 打卡清单 → 坐标数组，供路线折线绘制（≥2 个点才画线）
  const routeWaypoints = useMemo(() => {
    if (!routePlan) return [];
    const source = routePlan.waypoints?.length ? routePlan.waypoints : checklist;
    return source
      .map((item) => ({ ...item, layerType: item.layerType ?? 'restaurant' }))
      .filter((item) => isValidPoint(getPoint(item)));
  }, [checklist, routePlan]);

  const routePath = useMemo(() => {
    if (!routePlan?.path?.length || routePlan.path.length < 2) return [];

    return attachWaypointsToRoutePath(routePlan.path, routeWaypoints);
  }, [routePlan, routeWaypoints]);

  const routeDistanceM = useMemo(() => {
    if (!routePlan) return null;
    if (Number.isFinite(Number(routePlan?.totalDistanceM))) return Number(routePlan.totalDistanceM);
    if (routePath.length < 2) return null;
    return routePath.slice(1).reduce((sum, point, index) => (
      sum + distanceMeters(routePath[index], point)
    ), 0);
  }, [routePath, routePlan]);

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
  const handleSaveRestaurant = useCallback(async (restaurant) => {
    if (!restaurant) return;

    if (apiStatus === 'online') {
      try {
        const saved = await AddCheckListItem(restaurant.id);
        setChecklist((current) => {
          if (current.some((item) => item.id === saved.id)) return current;
          return [...current, saved].sort((a, b) => (a.checkOrder ?? 0) - (b.checkOrder ?? 0));
        });
        setRoutePlan(null);
        message.success('已加入打卡清单');
        return;
      } catch (error) {
        if (error?.response?.status === 409) {
          message.info('该餐厅已在打卡清单中');
          return;
        }
        console.warn('Add check-list API failed, using local checklist.', error);
      }
    }

    setChecklist((current) => {
      if (current.some((item) => item.id === restaurant.id)) return current;
      return [...current, restaurant];
    });
    setRoutePlan(null);
  }, [apiStatus]);

  // 从清单移除
  const handleRemoveRestaurant = useCallback(async (restaurantId) => {
    const target = checklist.find((item) => item.id === restaurantId);

    if (apiStatus === 'online' && target?.checkId) {
      try {
        await DeleteCheckListItem(target.checkId);
        setChecklist((current) => current.filter((item) => item.id !== restaurantId));
        setRoutePlan(null);
        message.success('已移出打卡清单');
        return;
      } catch (error) {
        console.warn('Delete check-list API failed, using local removal.', error);
      }
    }

    setChecklist((current) => current.filter((item) => item.id !== restaurantId));
    setRoutePlan(null);
  }, [apiStatus, checklist]);

  const handleMoveChecklistItem = useCallback(async (restaurantId, direction) => {
    const index = checklist.findIndex((item) => item.id === restaurantId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= checklist.length) return;

    const next = [...checklist];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    const reordered = next.map((item, orderIndex) => ({ ...item, checkOrder: orderIndex + 1 }));
    setChecklist(reordered);
    setRoutePlan(null);

    if (apiStatus === 'online') {
      try {
        await Promise.all(
          reordered
            .filter((item) => item.checkId)
            .map((item) => UpdateCheckListItem(item.checkId, { check_order: item.checkOrder })),
        );
      } catch (error) {
        console.warn('Update check-list order API failed, keeping local order.', error);
      }
    }
  }, [apiStatus, checklist]);

  // 随机盲盒：优先使用后端 /api/restaurants/random，失败时从当前可见列表本地随机。
  const handleRandomRestaurant = useCallback(async () => {
    if (apiStatus === 'online') {
      try {
        const { limit, offset, ...params } = toSearchParams(filters);
        void limit;
        void offset;
        const picked = await RandomRestaurant(params);
        if (picked) {
          handleFocusRestaurant(picked);
          message.success('已为你推荐一家餐厅');
          return;
        }
      } catch (error) {
        console.warn('Random restaurant API failed, using local random.', error);
      }
    }

    if (!visibleRestaurants.length) return;
    const picked = visibleRestaurants[Math.floor(Math.random() * visibleRestaurants.length)];
    handleFocusRestaurant(picked);
  }, [apiStatus, filters, handleFocusRestaurant, visibleRestaurants]);

  const handlePlanRoute = useCallback(async (travelMode) => {
    if (apiStatus === 'online') {
      try {
        const plan = await PlanRoute({ travel_mode: travelMode });
        setRoutePlan(plan);
        if (plan.count < 2) {
          message.warning(plan.message || '打卡清单不足两家餐厅，无法规划路线');
        } else {
          clearActiveSelection();
          message.success('已生成路线');
        }
        return;
      } catch (error) {
        console.warn('Route plan API failed, using local straight-line route.', error);
      }
    }

    if (checklist.length < 2) {
      message.warning('打卡清单不足两家餐厅，无法预览路线');
      return;
    }
    const fallbackPath = checklist
      .map(getPoint)
      .filter((point) => Number.isFinite(point.lng) && Number.isFinite(point.lat));
    const fallbackDistance = fallbackPath.slice(1).reduce((sum, point, index) => (
      sum + distanceMeters(fallbackPath[index], point)
    ), 0);
    setRoutePlan({
      travelMode,
      method: 'straight_line',
      count: fallbackPath.length,
      totalDistanceM: fallbackDistance,
      path: fallbackPath.map((point) => [point.lng, point.lat]),
      note: '当前使用本地直线距离预览',
    });
    clearActiveSelection();
    message.info('当前使用本地直线距离预览');
  }, [apiStatus, checklist, clearActiveSelection]);

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
        const result = await BufferAnalysis({
          center_lng: centerPoint.lng,
          center_lat: centerPoint.lat,
          radius,
        });
        const data = result.data ?? result;
        setVisibleRestaurants(data.items ?? []);
        setBufferStats(data.categoryStats ?? []);
        message.success(`已完成缓冲区分析：${data.total ?? data.items?.length ?? 0} 家餐厅`);
        return;
      } catch (error) {
        setApiStatus('offline');
        console.warn('Buffer analysis API failed, using local distance calculation.', error);
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
    const categoryCount = nearby.reduce((acc, restaurant) => {
      const name = restaurant.category || '其他';
      acc[name] = (acc[name] ?? 0) + 1;
      return acc;
    }, {});
    setBufferStats(
      Object.entries(categoryCount)
        .map(([name, value]) => ({ name, value, ratio: nearby.length ? value / nearby.length : 0 }))
        .sort((a, b) => b.value - a.value),
    );
    message.success(`已在本地数据中找到 ${nearby.length} 家范围内餐厅`);
  }, [allRestaurants, apiStatus, filters]);

  const handleEnterWorkspace = useCallback((feature = 'search') => {
    setActiveFeature(feature);
    setViewMode('workspace');
  }, []);

  if (viewMode === 'home') {
    return (
      <ConfigProvider theme={appTheme}>
        <HomePage
          apiStatus={apiStatus}
          landmarks={landmarks}
          restaurants={visibleRestaurants}
          stats={stats}
          transportations={transportations}
          onEnterWorkspace={handleEnterWorkspace}
        />
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider theme={appTheme}>
      <Layout className="app-shell">
        <Sidebar
          activeFeature={activeFeature}
          apiStatus={apiStatus}
          categories={categories}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          restaurants={visibleRestaurants}
          landmarks={landmarks}
          transportations={transportations}
          selectedRestaurant={selectedRestaurant}
          selectedMapItem={selectedMapItem}
          stats={stats}
          categoryStats={categoryStats}
        checklist={checklist}
        routeDistanceM={routeDistanceM}
        routeMethod={routePlan?.method}
        routeNote={routePlan?.note}
        analysisArea={analysisArea}
          onFeatureChange={setActiveFeature}
          onGoHome={() => setViewMode('home')}
          onSelectRestaurant={handleFocusRestaurant}
          onSaveRestaurant={handleSaveRestaurant}
          onRemoveRestaurant={handleRemoveRestaurant}
          onMoveChecklistItem={handleMoveChecklistItem}
          onClearRoute={handleClearRoute}
          onPlanRoute={handlePlanRoute}
          onRandomRestaurant={handleRandomRestaurant}
          onSelectMapItem={handleFocusMapItem}
          onRadiusSearch={handleRadiusSearch}
        />
        <Content className="map-panel">
          <CesiumMap
            activeCategory={filters.category}
            analysisArea={analysisArea}
            apiStatus={apiStatus}
            focusedRestaurantId={focusedRestaurantId}
            landmarks={landmarks}
            restaurants={visibleRestaurants}
            routePath={routePath}
            routeWaypoints={routeWaypoints}
            selectedRestaurant={selectedRestaurant}
            selectedMapItem={selectedMapItem}
            stats={stats}
            transportations={transportations}
            onSelectRestaurant={handleFocusRestaurant}
            onSelectMapItem={handleFocusMapItem}
          />
        </Content>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
