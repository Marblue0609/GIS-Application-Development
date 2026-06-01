import { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { categoryPalette, normalizeRestaurantFeature } from '../services/restaurantData';

const cesiumToken = import.meta.env.VITE_CESIUM_ION_TOKEN;

if (cesiumToken) {
  Cesium.Ion.defaultAccessToken = cesiumToken;
}

const colorFromCategory = (category) => Cesium.Color.fromCssColorString(
  categoryPalette[category] ?? categoryPalette['其他'],
);

const normalPointAlpha = 1;
const selectedPointColor = Cesium.Color.fromCssColorString('#ff4d2e');
const selectedOutlineColor = Cesium.Color.fromCssColorString('#fff7ec');
const landmarkColor = Cesium.Color.fromCssColorString('#4b83c4');
const transportationColor = Cesium.Color.fromCssColorString('#7eb892');
const initialView = Cesium.Rectangle.fromDegrees(120.055, 30.285, 120.105, 30.326);

const desaturateColor = (color, amount = 0.5) => new Cesium.Color(
  color.red + (0.78 - color.red) * amount,
  color.green + (0.78 - color.green) * amount,
  color.blue + (0.78 - color.blue) * amount,
  1,
);

const getDisplayCenter = (item) => ({
  lng: item.displayLng ?? item.lng,
  lat: item.displayLat ?? item.lat,
});

const addFallbackGridLayer = (viewer) => {
  viewer.imageryLayers.removeAll();
  viewer.imageryLayers.addImageryProvider(new Cesium.GridImageryProvider({
    cells: 24,
    color: Cesium.Color.fromCssColorString('#9aa799').withAlpha(0.45),
    glowColor: Cesium.Color.fromCssColorString('#f3f0e8').withAlpha(0.35),
    backgroundColor: Cesium.Color.fromCssColorString('#dfe5dc'),
    glowWidth: 2,
  }));
};

const addBaseLayer = async (viewer) => {
  try {
    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      subdomains: ['a', 'b', 'c', 'd'],
      credit: 'Map tiles by CARTO. Data by OpenStreetMap.',
      maximumLevel: 19,
    }));
  } catch (error) {
    console.warn('平面底图加载失败，已使用本地网格底图:', error);
    addFallbackGridLayer(viewer);
  }
};

const createPointEntity = (dataSource, item, color, size) => {
  const entity = dataSource.entities.add({
    id: item.id,
    name: item.name,
    position: Cesium.Cartesian3.fromDegrees(item.displayLng ?? item.lng, item.displayLat ?? item.lat),
    point: {
      pixelSize: size,
      color,
      outlineColor: Cesium.Color.WHITE.withAlpha(0.86),
      outlineWidth: 2,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });

  entity.mapItem = item;
  entity.categoryColor = color;
  entity.baseSize = size;
  return entity;
};

// 生成缓冲区圆的坐标点（经纬度），用于 Cesium 画 polygon
// 在 WGS84 球面上按距离逐方位角采样
const computeCirclePoints = (centerLng, centerLat, radiusMeters, segments = 72) => {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const centerLatRad = toRad(centerLat);
  const angularDist = radiusMeters / R;

  const points = [];
  for (let i = 0; i <= segments; i++) {
    const bearing = (2 * Math.PI * i) / segments;
    const latRad = Math.asin(
      Math.sin(centerLatRad) * Math.cos(angularDist) +
      Math.cos(centerLatRad) * Math.sin(angularDist) * Math.cos(bearing),
    );
    const lngRad =
      toRad(centerLng) +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDist) * Math.cos(centerLatRad),
        Math.cos(angularDist) - Math.sin(centerLatRad) * Math.sin(latRad),
      );
    points.push(toDeg(lngRad), toDeg(latRad));
  }
  return points;
};

function CesiumMap({
  filteredIds,
  focusedRestaurantId,
  landmarks,
  transportations,
  bufferInfo,
  onSelectRestaurant,
  onSelectMapItem,
}) {
  const viewerRef = useRef(null);
  const dataSourceRef = useRef(null);
  const supportDataSourceRef = useRef(null);
  const bufferEntityRef = useRef(null);
  const containerId = 'cesiumContainer';
  const [hoveredItem, setHoveredItem] = useState(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });

  // 图例点击切换图层显隐
  const [showRestaurant, setShowRestaurant] = useState(true);
  const [showLandmark, setShowLandmark] = useState(true);
  const [showTransportation, setShowTransportation] = useState(true);

  useEffect(() => {
    if (viewerRef.current) return; // 防止 React StrictMode 下重复初始化
    let cancelled = false;

    // 初始化 Cesium Viewer，隐藏不需要的默认控件，保持界面简洁
    const viewer = new Cesium.Viewer(containerId, {
      animation: false,        // 隐藏左下角动画控件
      timeline: false,         // 隐藏底部时间轴
      baseLayerPicker: false,  // 隐藏底图选择器（右上角）
      fullscreenButton: false, // 隐藏全屏按钮
      geocoder: false,         // 隐藏地名搜索框
      homeButton: false,       // 隐藏 Home 按钮
      sceneModePicker: false,  // 隐藏 2D/3D 切换按钮
      navigationHelpButton: false, // 隐藏导航帮助按钮
      infoBox: false,          // 隐藏 Cesium 默认信息框，后续用自定义信息面板替代
      selectionIndicator: false,
      sceneMode: Cesium.SceneMode.SCENE2D,
      skyBox: false,
      skyAtmosphere: false,
    });

    viewerRef.current = viewer;
    viewer.scene.globe.enableLighting = false;
    viewer.scene.postProcessStages.fxaa.enabled = true;
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#f4f0e8');

    addBaseLayer(viewer);

    const loadRestaurants = async () => {
      try {
        const response = await fetch('/restaurants.geojson');
        const geojson = await response.json();
        const dataSource = new Cesium.CustomDataSource('restaurants');

        geojson.features.forEach((feature) => {
          const restaurant = normalizeRestaurantFeature(feature);
          if (!restaurant.id || !restaurant.lng || !restaurant.lat) return;

          const color = desaturateColor(colorFromCategory(restaurant.category), 0.52);

          const entity = createPointEntity(dataSource, restaurant, color.withAlpha(normalPointAlpha), 9);
          entity.categoryColor = color;
        });

        if (cancelled || viewer.isDestroyed()) return;
        dataSourceRef.current = dataSource;
        await viewer.dataSources.add(dataSource);
        if (!cancelled && !viewer.isDestroyed()) {
          viewer.camera.setView({
            destination: initialView,
          });
        }
      } catch (error) {
        console.error('加载餐厅数据失败:', error);
      }
    };

    loadRestaurants();

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

    // 组件卸载时销毁 Viewer，释放 Cesium 占用的资源
    return () => {
      cancelled = true;
      clickHandler.destroy();
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [onSelectRestaurant, onSelectMapItem]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (supportDataSourceRef.current) {
      viewer.dataSources.remove(supportDataSourceRef.current, true);
    }

    const supportDataSource = new Cesium.CustomDataSource('support-points');
    landmarks.forEach((item) => {
      createPointEntity(supportDataSource, item, landmarkColor.withAlpha(1), 14);
    });
    transportations.forEach((item) => {
      createPointEntity(supportDataSource, item, transportationColor.withAlpha(1), 5);
    });

    supportDataSourceRef.current = supportDataSource;
    viewer.dataSources.add(supportDataSource);
  }, [landmarks, transportations]);

  // 绘制/更新缓冲区圆 + 中心 pin
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // 清理旧的缓冲区实体（圆 + pin）
    if (bufferEntityRef.current) {
      viewer.entities.remove(bufferEntityRef.current);
      bufferEntityRef.current = null;
    }
    // 也清理可能残留的旧 pin
    const oldPins = viewer.entities.values.filter((e) => e.id && e.id.startsWith('buffer-center-'));
    oldPins.forEach((e) => viewer.entities.remove(e));

    if (!bufferInfo) return;

    const { center, radius: radiusMeters } = bufferInfo;
    const positions = computeCirclePoints(center.lng, center.lat, radiusMeters, 72);

    bufferEntityRef.current = viewer.entities.add({
      polygon: {
        hierarchy: Cesium.Cartesian3.fromDegreesArray(positions),
        material: Cesium.Color.fromCssColorString('#ff6b4a').withAlpha(0.14),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('#ff6b4a').withAlpha(0.55),
        outlineWidth: 2,
      },
    });

    // 中心发光 Pin — 外层脉冲光环 + 内层实心点
    viewer.entities.add({
      id: 'buffer-center-ring',
      position: Cesium.Cartesian3.fromDegrees(center.lng, center.lat),
      ellipse: {
        semiMinorAxis: 30,
        semiMajorAxis: 30,
        material: Cesium.Color.fromCssColorString('#ff6b4a').withAlpha(0.25),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('#ff6b4a').withAlpha(0.6),
        outlineWidth: 2,
      },
    });
    viewer.entities.add({
      id: 'buffer-center-dot',
      position: Cesium.Cartesian3.fromDegrees(center.lng, center.lat),
      point: {
        pixelSize: 12,
        color: Cesium.Color.fromCssColorString('#ff6b4a').withAlpha(1),
        outlineColor: Cesium.Color.fromCssColorString('#fff7ec').withAlpha(1),
        outlineWidth: 3,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    // 脉冲动画 — 用 EllipseGeometry 要求 semiMajor >= semiMinor，共享一个计算值确保一致
    const pulseRadius = new Cesium.CallbackProperty(() => {
      const phase = (Date.now() % 1500) / 1500;
      return 20 + 30 * Math.sin(phase * Math.PI);
    }, false);
    viewer.entities.add({
      id: 'buffer-center-pulse',
      position: Cesium.Cartesian3.fromDegrees(center.lng, center.lat),
      ellipse: {
        semiMinorAxis: pulseRadius,
        semiMajorAxis: pulseRadius,
        material: Cesium.Color.fromCssColorString('#ff6b4a').withAlpha(0.18),
        outline: false,
      },
    });
  }, [bufferInfo]);

  useEffect(() => {
    const restaurantDataSource = dataSourceRef.current;
    const supportDataSource = supportDataSourceRef.current;
    if (!restaurantDataSource || !filteredIds) return;

    // 缓冲区激活时：范围内不透明度 1，范围外半透明
    const hasBuffer = bufferInfo && bufferInfo.nearbyIds.size > 0;
    const outsideAlpha = 0.18;

    restaurantDataSource.entities.values.forEach((entity) => {
      const isVisible = filteredIds.has(entity.id) && showRestaurant;
      const isSelected = entity.id === focusedRestaurantId;
      const isHovered = entity.id === hoveredItem?.id;
      const isInBuffer = !hasBuffer || bufferInfo.nearbyIds.has(entity.id);
      entity.show = isVisible;
      if (entity.point) {
        entity.point.pixelSize = isSelected ? 18 : isHovered ? 13 : 9;
        entity.point.outlineWidth = isSelected ? 4 : isHovered ? 3 : 2;
        entity.point.color = isSelected
          ? selectedPointColor.withAlpha(1)
          : entity.categoryColor.withAlpha(isInBuffer ? 1 : outsideAlpha);
        entity.point.outlineColor = isSelected
          ? selectedOutlineColor.withAlpha(1)
          : Cesium.Color.WHITE.withAlpha(isHovered ? 1 : isInBuffer ? 0.86 : 0.2);
      }
    });

    supportDataSource?.entities.values.forEach((entity) => {
      const item = entity.mapItem;
      const isLandmark = item?.layerType === 'landmark';
      const layerVisible = isLandmark ? showLandmark : showTransportation;
      entity.show = layerVisible;

      const isSelected = entity.id === focusedRestaurantId;
      const isHovered = entity.id === hoveredItem?.id;
      if (entity.point) {
        entity.point.pixelSize = isSelected ? 20 : isHovered ? entity.baseSize + 4 : entity.baseSize;
        entity.point.outlineWidth = isSelected ? 4 : isHovered ? 3 : 2;
        entity.point.color = isSelected
          ? selectedPointColor.withAlpha(1)
          : entity.categoryColor.withAlpha(1);
        entity.point.outlineColor = isSelected
          ? selectedOutlineColor.withAlpha(1)
          : Cesium.Color.WHITE.withAlpha(0.86);
      }
    });
  }, [filteredIds, focusedRestaurantId, hoveredItem, showRestaurant, showLandmark, showTransportation, bufferInfo]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const restaurantDataSource = dataSourceRef.current;
    const supportDataSource = supportDataSourceRef.current;
    if (!viewer || !focusedRestaurantId) return;

    const entity = [
      ...(restaurantDataSource?.entities.values ?? []),
      ...(supportDataSource?.entities.values ?? []),
    ].find((item) => item.id === focusedRestaurantId);

    if (entity) {
      const item = entity.mapItem;
      const { lng, lat } = getDisplayCenter(item);
      viewer.camera.flyTo({
        destination: Cesium.Rectangle.fromDegrees(
          lng - 0.004,
          lat - 0.003,
          lng + 0.004,
          lat + 0.003,
        ),
        duration: 0.7,
      });

    }
  }, [focusedRestaurantId]);

  return (
    <div className="cesium-map-wrap">
      <div id={containerId} />
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
        <span
          className={showRestaurant ? '' : 'legend-off'}
          onClick={() => setShowRestaurant((v) => !v)}
          style={{ cursor: 'pointer' }}
        >
          <i className="legend-rest" />餐厅
        </span>
        <span
          className={showLandmark ? '' : 'legend-off'}
          onClick={() => setShowLandmark((v) => !v)}
          style={{ cursor: 'pointer' }}
        >
          <i className="legend-landmark" />地标
        </span>
        <span
          className={showTransportation ? '' : 'legend-off'}
          onClick={() => setShowTransportation((v) => !v)}
          style={{ cursor: 'pointer' }}
        >
          <i className="legend-transport" />交通
        </span>
      </div>
    </div>
  );
}

export default CesiumMap;
