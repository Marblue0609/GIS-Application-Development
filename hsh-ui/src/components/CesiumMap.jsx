import { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { categoryPalette } from '../services/restaurantData';

// Cesium Ion Token，通过 VITE_CESIUM_ION_TOKEN 环境变量注入（非必需，有 CARTO/Grid 兜底）
const cesiumToken = import.meta.env.VITE_CESIUM_ION_TOKEN;

if (cesiumToken) {
  Cesium.Ion.defaultAccessToken = cesiumToken;
}

// 紫金港周边初始相机范围：[西, 南, 东, 北]
const initialView = Cesium.Rectangle.fromDegrees(120.055, 30.285, 120.105, 30.326);

// 点位样式常量
const selectedPointColor = Cesium.Color.fromCssColorString('#ff4d2e');
const routePointColor = Cesium.Color.fromCssColorString('#ff7a21');
const landmarkColor = Cesium.Color.fromCssColorString('#2f6fb3');
const transportationColor = Cesium.Color.fromCssColorString('#2c9a5f');
const iconCache = new Map();

// 根据菜系从 categoryPalette 获取 Cesium 颜色，未匹配到时用灰色
const colorFromCategory = (category) => Cesium.Color.fromCssColorString(
  categoryPalette[category] ?? categoryPalette['其他'] ?? '#8f98a8',
);

// 提取经纬度工具函数
const getLngLat = (item) => ({
  lng: Number(item?.lng ?? item?.displayLng),
  lat: Number(item?.lat ?? item?.displayLat),
});

const sameId = (a, b) => {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  return String(a) === String(b);
};

const layerOf = (item) => item?.layerType ?? 'restaurant';

const almostSamePoint = (a, b, tolerance = 0.00018) => {
  const pointA = getLngLat(a);
  const pointB = getLngLat(b);
  if (!Number.isFinite(pointA.lng) || !Number.isFinite(pointA.lat)) return false;
  if (!Number.isFinite(pointB.lng) || !Number.isFinite(pointB.lat)) return false;
  return Math.abs(pointA.lng - pointB.lng) < tolerance && Math.abs(pointA.lat - pointB.lat) < tolerance;
};

const sameMapItem = (a, b) => {
  if (!a || !b) return false;
  if (layerOf(a) !== layerOf(b)) return false;
  if (sameId(a.id, b.id)) return true;
  return almostSamePoint(a, b);
};

const withFocusedItem = (items, focusedItem) => {
  if (!focusedItem) return items;
  return [...items.filter((item) => !sameMapItem(item, focusedItem)), focusedItem];
};

const withPinnedItems = (items, pinnedItems) => pinnedItems.reduce(
  (currentItems, item) => withFocusedItem(currentItems, item),
  items,
);

const uniqueMapItems = (items) => items.reduce((uniqueItems, item) => {
  if (!uniqueItems.some((current) => sameMapItem(current, item))) {
    uniqueItems.push(item);
  }
  return uniqueItems;
}, []);

const findMatchingMapItem = (items, target) => items.find((item) => sameMapItem(item, target)) ?? target;

const isInMapItems = (items, target) => items.some((item) => sameMapItem(item, target));

const colorToCss = (color) => color.withAlpha(1).toCssColorString();

const boostColor = (color, amount = 0.14) => {
  const avg = (color.red + color.green + color.blue) / 3;
  const channel = (value) => Math.min(1, Math.max(0, avg + (value - avg) * (1 + amount)));
  return new Cesium.Color(channel(color.red), channel(color.green), channel(color.blue), 1);
};

const restaurantGlyph = (category) => {
  if (category === '饮品咖啡') {
    return '<path d="M37 38h20v12a10 10 0 0 1-20 0z"/><path d="M57 41h4a6 6 0 0 1 0 12h-4"/><path d="M42 30c3 3 0 5 3 8M50 30c3 3 0 5 3 8"/>';
  }
  if (category === '甜品烘焙') {
    return '<path d="M35 51h26l-3 13H38z"/><path d="M39 47c2-9 6-14 10-14s8 5 10 14"/><path d="M43 38h12"/>';
  }
  if (category === '火锅') {
    return '<path d="M32 43h32"/><path d="M36 43h24v7a12 12 0 0 1-24 0z"/><path d="M40 31c3 3 0 6 3 9M49 30c3 3 0 6 3 9M57 31c3 3 0 6 3 9"/>';
  }
  if (category === '西餐') {
    return '<path d="M39 31v32M33 31v13M45 31v13"/><path d="M58 31v32"/><path d="M58 31c7 8 7 17 0 23"/>';
  }
  return '<path d="M33 43h30v5a15 15 0 0 1-30 0z"/><path d="M39 36h18"/><path d="M42 30h12"/><path d="M37 64h22"/>';
};

const supportGlyph = (layerType) => {
  if (layerType === 'landmark') {
    return '<path d="M48 29l6 12 13 2-9 9 2 13-12-6-12 6 2-13-9-9 13-2z"/>';
  }
  return '<path d="M34 35h28a6 6 0 0 1 6 6v17H28V41a6 6 0 0 1 6-6z"/><path d="M36 43h24"/><path d="M36 52h24"/><circle cx="39" cy="63" r="4"/><circle cx="57" cy="63" r="4"/>';
};

const createPinIcon = (item, color, selected = false) => {
  const fill = colorToCss(color);
  const layerType = item?.layerType ?? 'restaurant';
  const category = item?.categoryGroup ?? item?.category ?? '';
  const key = `${layerType}:${category}:${fill}:${selected ? 'selected' : 'normal'}`;
  if (iconCache.has(key)) return iconCache.get(key);

  const glyph = layerType === 'restaurant' ? restaurantGlyph(category) : supportGlyph(layerType);
  const ring = selected ? '#fff7ec' : '#ffffff';
  const ringWidth = selected ? 8 : 6;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="256" height="300" viewBox="0 0 96 112">
      <path d="M48 101 39 74h18z" fill="${fill}" stroke="${ring}" stroke-width="${ringWidth}" stroke-linejoin="round"/>
      <circle cx="48" cy="42" r="34" fill="${fill}" stroke="${ring}" stroke-width="${ringWidth}"/>
      <circle cx="48" cy="42" r="20" fill="#ffffff" opacity="0.14"/>
      <g fill="none" stroke="#fff" stroke-width="5.8" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>
    </svg>
  `;
  const icon = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  iconCache.set(key, icon);
  return icon;
};

const getViewMetrics = (viewer) => {
  const rectangle = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid);
  const cameraHeight = viewer.camera.positionCartographic.height;
  if (!rectangle) return { span: cameraHeight / 700000, height: cameraHeight };

  const west = Cesium.Math.toDegrees(rectangle.west);
  const east = Cesium.Math.toDegrees(rectangle.east);
  const span = Math.abs(east - west);
  return {
    span: Number.isFinite(span) && span > 0 ? span : cameraHeight / 700000,
    height: cameraHeight,
  };
};

const displayConfig = (viewMetrics, layerType) => {
  const effectiveSpan = Math.max(viewMetrics.span, viewMetrics.height / 900000);
  const presets = {
    restaurant: [
      { span: 0.055, cellSize: 0.0048, maxCount: 45, minPixels: 46 },
      { span: 0.035, cellSize: 0.0032, maxCount: 80, minPixels: 42 },
      { span: 0.022, cellSize: 0.002, maxCount: 130, minPixels: 38 },
      { span: 0.012, cellSize: 0.0011, maxCount: 240, minPixels: 34 },
    ],
    landmark: [
      { span: 0.055, cellSize: 0.012, maxCount: 3, minPixels: 56 },
      { span: 0.035, cellSize: 0.008, maxCount: 5, minPixels: 52 },
      { span: 0.022, cellSize: 0.004, maxCount: 8, minPixels: 48 },
    ],
    transportation: [
      { span: 0.055, cellSize: 0.006, maxCount: 18, minPixels: 42 },
      { span: 0.035, cellSize: 0.004, maxCount: 38, minPixels: 38 },
      { span: 0.022, cellSize: 0.0025, maxCount: 72, minPixels: 34 },
      { span: 0.012, cellSize: 0.0014, maxCount: 120, minPixels: 30 },
    ],
  };

  return (presets[layerType] ?? presets.restaurant).find((preset) => effectiveSpan > preset.span)
    ?? { cellSize: 0, maxCount: Number.POSITIVE_INFINITY, minPixels: layerType === 'landmark' ? 44 : 28 };
};

const itemPriority = (item, layerType) => {
  if (layerType === 'restaurant') {
    return (Number(item.rating) || 0) * 100 + Math.min(Number(item.price) || 0, 120);
  }
  if (layerType === 'transportation') {
    if (item.category?.includes('地铁')) return 300;
    if (item.category?.includes('枢纽')) return 240;
    if (item.name?.includes('紫金港')) return 180;
    return 80;
  }
  if (item.category?.includes('餐饮')) return 260;
  if (item.category?.includes('校园')) return 220;
  return 120;
};

const decimateByGeoGrid = (items, config, layerType) => {
  if (!config.cellSize || items.length <= config.maxCount) return items;

  const buckets = new Map();
  items.forEach((item) => {
    const { lng, lat } = getLngLat(item);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    const key = `${Math.floor(lng / config.cellSize)}:${Math.floor(lat / config.cellSize)}`;
    const current = buckets.get(key);
    if (!current || itemPriority(item, layerType) > itemPriority(current, layerType)) {
      buckets.set(key, item);
    }
  });

  return Array.from(buckets.values())
    .sort((a, b) => itemPriority(b, layerType) - itemPriority(a, layerType))
    .slice(0, config.maxCount);
};

const avoidScreenOverlap = (viewer, items, minPixels, layerType, focusedId) => {
  if (!viewer || !minPixels) return items;

  const chosen = [];
  const chosenPixels = [];
  const ordered = [...items].sort((a, b) => {
    if (sameId(a.id, focusedId)) return -1;
    if (sameId(b.id, focusedId)) return 1;
    return itemPriority(b, layerType) - itemPriority(a, layerType);
  });

  ordered.forEach((item) => {
    const { lng, lat } = getLngLat(item);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;

    const pixel = Cesium.SceneTransforms.worldToWindowCoordinates(
      viewer.scene,
      Cesium.Cartesian3.fromDegrees(lng, lat),
    );
    if (!pixel) return;

    const focused = sameId(item.id, focusedId);
    const close = chosenPixels.some((other) => {
      const dx = pixel.x - other.x;
      const dy = pixel.y - other.y;
      return dx * dx + dy * dy < minPixels * minPixels;
    });
    if (focused || !close) {
      chosen.push(item);
      chosenPixels.push(pixel);
    }
  });

  return chosen;
};

// 灰色网格兜底层：确保 Cesium Ion token 缺失时也有可视化底图
const addFallbackGridLayer = (viewer) => {
  viewer.imageryLayers.addImageryProvider(new Cesium.GridImageryProvider({
    cells: 28,
    color: Cesium.Color.fromCssColorString('#9aa7a1').withAlpha(0.5),
    glowColor: Cesium.Color.fromCssColorString('#ffffff').withAlpha(0.35),
    backgroundColor: Cesium.Color.fromCssColorString('#dfe5dc'),
    glowWidth: 2,
  }));
};

// 创建底图：优先 CARTO light_all，底层始终有灰色网格兜底
const addBaseLayer = (viewer) => {
  viewer.imageryLayers.removeAll();
  addFallbackGridLayer(viewer);

  try {
    viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      subdomains: ['a', 'b', 'c', 'd'],
      credit: 'Map tiles by CARTO, data by OpenStreetMap contributors.',
      maximumLevel: 19,
    }));
  } catch (error) {
    console.warn('Base map failed, using local grid fallback.', error);
  }
};

// 在 dataSource 中创建一个 WGS84 billboard 实体；坐标直接使用后端/GeoJSON 的 lng/lat。
const createPointEntity = (dataSource, item, color, size) => {
  const { lng, lat } = getLngLat(item);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

  const image = createPinIcon(item, color);
  const entity = dataSource.entities.add({
    id: `${item.layerType ?? 'point'}:${item.id}`,
    name: item.name,
    position: Cesium.Cartesian3.fromDegrees(lng, lat),
    billboard: {
      image,
      width: size,
      height: Math.round(size * 1.17),
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });

  entity.mapItem = item;
  entity.categoryColor = color;
  entity.baseWidth = size;
  entity.baseHeight = Math.round(size * 1.17);
  entity.baseImage = image;
  entity.hoverImage = createPinIcon(item, color, true);
  entity.selectedImage = createPinIcon(item, selectedPointColor, true);
  entity.routeImage = createPinIcon(item, routePointColor, true);
  return entity;
};

/**
 * Cesium 地图组件。
 *
 * Props:
 *   restaurants / landmarks / transportations : 各图层数据
 *   analysisArea : { lng, lat, radius } | null — 范围搜索时绘制椭圆
 *   routePath     : [{lng, lat}, ...] — 打卡路线预览
 *   focusedRestaurantId : 当前高亮实体 ID
 *   onSelectRestaurant / onSelectMapItem : 点选回调，冒泡到 App 的 handleFocus*
 */
function CesiumMap({
  activeCategory,
  analysisArea,
  focusedRestaurantId,
  landmarks,
  restaurants,
  routeWaypoints,
  routePath,
  selectedMapItem,
  transportations,
  onSelectRestaurant,
  onSelectMapItem,
}) {
  const viewerRef = useRef(null);
  const restaurantDataSourceRef = useRef(null);
  const supportDataSourceRef = useRef(null);
  const overlayDataSourceRef = useRef(null);
  const containerId = 'cesiumContainer';
  const [hoveredItem, setHoveredItem] = useState(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const [viewMetrics, setViewMetrics] = useState({ span: 0.05, height: 0 });
  const [viewVersion, setViewVersion] = useState(0);

  // 初始化 Cesium Viewer（仅一次），注册点击和悬停事件
  useEffect(() => {
    if (viewerRef.current) return;

    const viewer = new Cesium.Viewer(containerId, {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      infoBox: false,
      selectionIndicator: false,
      sceneMode: Cesium.SceneMode.SCENE2D,
      skyBox: false,
      skyAtmosphere: false,
    });

    viewerRef.current = viewer;
    viewer.scene.globe.enableLighting = false;
    viewer.scene.postProcessStages.fxaa.enabled = true;
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#eef2ed');
    addBaseLayer(viewer);
    viewer.camera.setView({ destination: initialView });
    setViewMetrics(getViewMetrics(viewer));
    const removeCameraMoveListener = viewer.camera.moveEnd.addEventListener(() => {
      setViewMetrics(getViewMetrics(viewer));
      setViewVersion((version) => version + 1);
    });

    const clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    clickHandler.setInputAction((movement) => {
      const picked = viewer.scene.pick(movement.position);
      if (!Cesium.defined(picked?.id?.mapItem)) return;

      const item = picked.id.mapItem;
      if (item.layerType === 'restaurant') {
        onSelectRestaurant(item);
      } else {
        onSelectMapItem(item);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    clickHandler.setInputAction((movement) => {
      const picked = viewer.scene.pick(movement.endPosition);
      if (!Cesium.defined(picked?.id?.mapItem)) {
        setHoveredItem(null);
        return;
      }

      setHoveredItem(picked.id.mapItem);
      setHoverPosition({
        x: movement.endPosition.x,
        y: movement.endPosition.y,
      });
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    return () => {
      removeCameraMoveListener();
      clickHandler.destroy();
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [onSelectRestaurant, onSelectMapItem]);

  // 餐厅图层：按 visibleRestaurants 数组重建，颜色由菜系映射
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (restaurantDataSourceRef.current) {
      viewer.dataSources.remove(restaurantDataSourceRef.current, true);
    }

    const dataSource = new Cesium.CustomDataSource('restaurants');
    const config = displayConfig(viewMetrics, 'restaurant');
    const routeRestaurants = (routeWaypoints ?? [])
      .filter((item) => (item?.layerType ?? 'restaurant') === 'restaurant')
      .map((item) => findMatchingMapItem(restaurants, item));
    let visibleRestaurants = activeCategory
      ? restaurants
      : decimateByGeoGrid(restaurants, config, 'restaurant');
    const focusedRestaurant = selectedMapItem?.layerType === 'restaurant'
      ? selectedMapItem
      : restaurants.find((item) => sameId(item.id, focusedRestaurantId));
    visibleRestaurants = uniqueMapItems(withFocusedItem(withPinnedItems(visibleRestaurants, routeRestaurants), focusedRestaurant));
    if (!activeCategory) {
      visibleRestaurants = avoidScreenOverlap(viewer, visibleRestaurants, config.minPixels, 'restaurant', focusedRestaurant?.id);
    }

    visibleRestaurants.forEach((restaurant) => {
      const color = boostColor(colorFromCategory(restaurant.categoryGroup ?? restaurant.category));
      createPointEntity(dataSource, restaurant, color.withAlpha(1), 28);
    });

    restaurantDataSourceRef.current = dataSource;
    viewer.dataSources.add(dataSource);
  }, [restaurants, routeWaypoints, activeCategory, focusedRestaurantId, selectedMapItem, viewMetrics, viewVersion]);

  // 地标和交通设施图层（蓝色 → 地标，绿色 → 交通）
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (supportDataSourceRef.current) {
      viewer.dataSources.remove(supportDataSourceRef.current, true);
    }

    const dataSource = new Cesium.CustomDataSource('support-points');
    const landmarkConfig = displayConfig(viewMetrics, 'landmark');
    const transportationConfig = displayConfig(viewMetrics, 'transportation');
    let visibleLandmarks = decimateByGeoGrid(landmarks, landmarkConfig, 'landmark');
    let visibleTransportations = decimateByGeoGrid(transportations, transportationConfig, 'transportation');
    const focusedLandmark = selectedMapItem?.layerType === 'landmark'
      ? selectedMapItem
      : landmarks.find((item) => sameId(item.id, focusedRestaurantId));
    const focusedTransportation = selectedMapItem?.layerType === 'transportation'
      ? selectedMapItem
      : transportations.find((item) => sameId(item.id, focusedRestaurantId));

    visibleLandmarks = uniqueMapItems(withFocusedItem(visibleLandmarks, focusedLandmark));
    visibleTransportations = uniqueMapItems(withFocusedItem(visibleTransportations, focusedTransportation));

    visibleLandmarks = avoidScreenOverlap(viewer, visibleLandmarks, landmarkConfig.minPixels, 'landmark', focusedLandmark?.id);
    visibleTransportations = avoidScreenOverlap(
      viewer,
      visibleTransportations,
      transportationConfig.minPixels,
      'transportation',
      focusedTransportation?.id,
    );

    visibleLandmarks.forEach((item) => createPointEntity(dataSource, item, landmarkColor.withAlpha(1), 27));
    visibleTransportations.forEach((item) => createPointEntity(dataSource, item, transportationColor.withAlpha(1), 23));

    supportDataSourceRef.current = dataSource;
    viewer.dataSources.add(dataSource);
  }, [landmarks, transportations, focusedRestaurantId, selectedMapItem, viewMetrics, viewVersion]);

  // 分析覆盖层：范围搜索半透明圆 + 打卡路线折线
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (overlayDataSourceRef.current) {
      viewer.dataSources.remove(overlayDataSourceRef.current, true);
    }

    const overlay = new Cesium.CustomDataSource('analysis-overlays');

    if (analysisArea) {
      overlay.entities.add({
        name: '范围搜索区域',
        position: Cesium.Cartesian3.fromDegrees(analysisArea.lng, analysisArea.lat),
        ellipse: {
          semiMajorAxis: analysisArea.radius,
          semiMinorAxis: analysisArea.radius,
          material: Cesium.Color.fromCssColorString('#4b83c4').withAlpha(0.14),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('#2f6fb3').withAlpha(0.85),
          height: 0,
        },
      });
    }

    if (routePath?.length > 1) {
      overlay.entities.add({
        name: '打卡路线',
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(routePath.flatMap((item) => [item.lng, item.lat])),
          width: 5,
          material: Cesium.Color.fromCssColorString('#ff6b4a').withAlpha(0.9),
          clampToGround: true,
        },
      });
    }

    overlayDataSourceRef.current = overlay;
    viewer.dataSources.add(overlay);
  }, [analysisArea, routePath]);

  // 选中 & 悬停视觉反馈：选中变大变红、悬停微放大
  useEffect(() => {
    const allEntities = [
      ...(restaurantDataSourceRef.current?.entities.values ?? []),
      ...(supportDataSourceRef.current?.entities.values ?? []),
    ];

    allEntities.forEach((entity) => {
      const isSelected = sameMapItem(entity.mapItem, selectedMapItem);
      const isRoutePoint = entity.mapItem?.layerType === 'restaurant' && isInMapItems(routeWaypoints ?? [], entity.mapItem);
      const isHovered = sameMapItem(entity.mapItem, hoveredItem);
      if (!entity.billboard) return;

      const emphasized = isSelected || isRoutePoint;
      entity.billboard.width = emphasized ? entity.baseWidth + 12 : isHovered ? entity.baseWidth + 6 : entity.baseWidth;
      entity.billboard.height = emphasized ? entity.baseHeight + 15 : isHovered ? entity.baseHeight + 8 : entity.baseHeight;
      entity.billboard.image = isSelected
        ? entity.selectedImage
        : isRoutePoint
          ? entity.routeImage
          : isHovered
            ? entity.hoverImage
            : entity.baseImage;
    });
  }, [hoveredItem, restaurants, landmarks, transportations, routeWaypoints, selectedMapItem, viewVersion]);

  // FlyTo：相机飞行到选中实体的位置（0.65s 过渡）
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !focusedRestaurantId) return;

    const entity = [
      ...(restaurantDataSourceRef.current?.entities.values ?? []),
      ...(supportDataSourceRef.current?.entities.values ?? []),
    ].find((item) => sameMapItem(item.mapItem, selectedMapItem));

    if (!entity?.mapItem) return;

    const { lng, lat } = getLngLat(entity.mapItem);
    viewer.camera.flyTo({
      destination: Cesium.Rectangle.fromDegrees(
        lng - 0.004,
        lat - 0.003,
        lng + 0.004,
        lat + 0.003,
      ),
      duration: 0.65,
    });
  }, [focusedRestaurantId, selectedMapItem]);

  return (
    <div className="cesium-map-wrap">
      <div id={containerId} />
      {selectedMapItem && (
        <div className="map-hud map-hud-current">
          <span>当前</span>
          <strong>{selectedMapItem.name}</strong>
        </div>
      )}
      {hoveredItem && (
        <div
          className="map-hover-card"
          style={{
            left: `${hoverPosition.x + 14}px`,
            top: `${hoverPosition.y + 14}px`,
          }}
        >
          <strong>{hoveredItem.name}</strong>
          <span>{hoveredItem.category}</span>
          {hoveredItem.layerType === 'restaurant' && <span>评分 {hoveredItem.rating || '-'}</span>}
        </div>
      )}
    </div>
  );
}

export default CesiumMap;
