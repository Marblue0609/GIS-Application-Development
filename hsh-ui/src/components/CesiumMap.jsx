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
const selectedOutlineColor = Cesium.Color.fromCssColorString('#fff7ec');
const landmarkColor = Cesium.Color.fromCssColorString('#2f6fb3');
const transportationColor = Cesium.Color.fromCssColorString('#2c9a5f');

// 根据菜系从 categoryPalette 获取 Cesium 颜色，未匹配到时用灰色
const colorFromCategory = (category) => Cesium.Color.fromCssColorString(
  categoryPalette[category] ?? categoryPalette['其他'] ?? '#8f98a8',
);

// 柔化颜色 → 更浅的色调，让地图上大片点位更柔和
const softenColor = (color, amount = 0.42) => new Cesium.Color(
  color.red + (0.86 - color.red) * amount,
  color.green + (0.86 - color.green) * amount,
  color.blue + (0.86 - color.blue) * amount,
  1,
);

// 提取经纬度工具函数
const getLngLat = (item) => ({
  lng: Number(item?.lng ?? item?.displayLng),
  lat: Number(item?.lat ?? item?.displayLat),
});

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

// 在 dataSource 中创建一个 WGS84 点位实体，返回实体引用供后续样式更新
const createPointEntity = (dataSource, item, color, size) => {
  const { lng, lat } = getLngLat(item);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

  const entity = dataSource.entities.add({
    id: item.id,
    name: item.name,
    position: Cesium.Cartesian3.fromDegrees(lng, lat),
    point: {
      pixelSize: size,
      color,
      outlineColor: Cesium.Color.WHITE.withAlpha(0.9),
      outlineWidth: 2,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });

  entity.mapItem = item;
  entity.categoryColor = color;
  entity.baseSize = size;
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
  analysisArea,
  apiStatus,
  focusedRestaurantId,
  landmarks,
  restaurants,
  routePath,
  selectedRestaurant,
  stats,
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
    restaurants.forEach((restaurant) => {
      const color = softenColor(colorFromCategory(restaurant.category));
      createPointEntity(dataSource, restaurant, color.withAlpha(1), 9);
    });

    restaurantDataSourceRef.current = dataSource;
    viewer.dataSources.add(dataSource);
  }, [restaurants]);

  // 地标和交通设施图层（蓝色 → 地标，绿色 → 交通）
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (supportDataSourceRef.current) {
      viewer.dataSources.remove(supportDataSourceRef.current, true);
    }

    const dataSource = new Cesium.CustomDataSource('support-points');
    landmarks.forEach((item) => createPointEntity(dataSource, item, landmarkColor.withAlpha(1), 13));
    transportations.forEach((item) => createPointEntity(dataSource, item, transportationColor.withAlpha(1), 5));

    supportDataSourceRef.current = dataSource;
    viewer.dataSources.add(dataSource);
  }, [landmarks, transportations]);

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
      const isSelected = entity.id === focusedRestaurantId;
      const isHovered = entity.id === hoveredItem?.id;
      if (!entity.point) return;

      entity.point.pixelSize = isSelected ? 18 : isHovered ? entity.baseSize + 4 : entity.baseSize;
      entity.point.outlineWidth = isSelected ? 4 : isHovered ? 3 : 2;
      entity.point.color = isSelected
        ? selectedPointColor.withAlpha(1)
        : entity.categoryColor.withAlpha(1);
      entity.point.outlineColor = isSelected
        ? selectedOutlineColor.withAlpha(1)
        : Cesium.Color.WHITE.withAlpha(isHovered ? 1 : 0.9);
    });
  }, [focusedRestaurantId, hoveredItem, restaurants, landmarks, transportations]);

  // FlyTo：相机飞行到选中实体的位置（0.65s 过渡）
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !focusedRestaurantId) return;

    const entity = [
      ...(restaurantDataSourceRef.current?.entities.values ?? []),
      ...(supportDataSourceRef.current?.entities.values ?? []),
    ].find((item) => item.id === focusedRestaurantId);

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
  }, [focusedRestaurantId]);

  return (
    <div className="cesium-map-wrap">
      <div id={containerId} />
      <div className="map-hud">
        <div>
          <strong>紫金港餐饮空间图层</strong>
          <span>{apiStatus === 'online' ? 'FastAPI 数据源' : '本地 GeoJSON 数据源'}</span>
        </div>
        <div className="map-hud-metrics">
          <span>{stats?.visible ?? restaurants.length} 家餐厅</span>
          <span>{landmarks.length} 个地标</span>
          <span>{transportations.length} 个交通点</span>
        </div>
        {selectedRestaurant && (
          <div className="map-hud-focus">
            <span>当前</span>
            <strong>{selectedRestaurant.name}</strong>
          </div>
        )}
      </div>
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
      <div className="map-legend">
        <span><i className="legend-rest" />餐厅</span>
        <span><i className="legend-landmark" />地标</span>
        <span><i className="legend-transport" />交通</span>
      </div>
    </div>
  );
}

export default CesiumMap;
