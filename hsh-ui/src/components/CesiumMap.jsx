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

const normalPointAlpha = 0.58;
const selectedPointColor = Cesium.Color.fromCssColorString('#ff4d2e');
const selectedOutlineColor = Cesium.Color.fromCssColorString('#fff7ec');

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
      credit: 'Map tiles by CARTO, under CC BY 3.0. Data by OpenStreetMap, under ODbL.',
      maximumLevel: 19,
    }));
  } catch (error) {
    console.warn('平面底图加载失败，已使用本地网格底图:', error);
    addFallbackGridLayer(viewer);
  }
};

function CesiumMap({ filteredIds, focusedRestaurantId, onSelectRestaurant }) {
  const viewerRef = useRef(null);
  const dataSourceRef = useRef(null);
  const containerId = 'cesiumContainer';
  const [hoveredRestaurant, setHoveredRestaurant] = useState(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (viewerRef.current) return; // 防止 React StrictMode 下重复初始化

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
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#edf0ea');

    addBaseLayer(viewer);

    const loadRestaurants = async () => {
      try {
        const response = await fetch('/restaurants.geojson');
        const geojson = await response.json();
        const dataSource = new Cesium.CustomDataSource('restaurants');

        geojson.features.forEach((feature) => {
          const restaurant = normalizeRestaurantFeature(feature);
          if (!restaurant.id || !restaurant.lng || !restaurant.lat) return;

          const color = colorFromCategory(restaurant.category);

          const entity = dataSource.entities.add({
            id: restaurant.id,
            name: restaurant.name,
            position: Cesium.Cartesian3.fromDegrees(restaurant.lng, restaurant.lat),
            properties: feature.properties,
            point: {
              pixelSize: 12,
              color: color.withAlpha(normalPointAlpha),
              outlineColor: Cesium.Color.WHITE.withAlpha(0.8),
              outlineWidth: 2,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          });

          entity.restaurantData = restaurant;
          entity.categoryColor = color;
          entity.point.color = color.withAlpha(normalPointAlpha);
          entity.point.outlineColor = Cesium.Color.WHITE.withAlpha(0.8);
        });

        dataSourceRef.current = dataSource;
        await viewer.dataSources.add(dataSource);
        viewer.camera.setView({
          destination: Cesium.Rectangle.fromDegrees(120.055, 30.285, 120.105, 30.326),
        });
      } catch (error) {
        console.error('加载餐厅数据失败:', error);
      }
    };

    loadRestaurants();

    const clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    clickHandler.setInputAction((movement) => {
      const picked = viewer.scene.pick(movement.position);
      if (!Cesium.defined(picked?.id?.restaurantData)) return;

      onSelectRestaurant(picked.id.restaurantData);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    clickHandler.setInputAction((movement) => {
      const picked = viewer.scene.pick(movement.endPosition);
      if (!Cesium.defined(picked?.id?.restaurantData)) {
        setHoveredRestaurant(null);
        return;
      }

      setHoveredRestaurant(picked.id.restaurantData);
      setHoverPosition({
        x: movement.endPosition.x,
        y: movement.endPosition.y,
      });
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // 组件卸载时销毁 Viewer，释放 Cesium 占用的资源
    return () => {
      clickHandler.destroy();
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [onSelectRestaurant]);

  useEffect(() => {
    const dataSource = dataSourceRef.current;
    if (!dataSource || !filteredIds) return;

    dataSource.entities.values.forEach((entity) => {
      const isVisible = filteredIds.has(entity.id);
      const isSelected = entity.id === focusedRestaurantId;
      const isHovered = entity.id === hoveredRestaurant?.id;
      entity.show = isVisible;
      if (entity.point) {
        entity.point.pixelSize = isSelected ? 21 : isHovered ? 16 : 12;
        entity.point.outlineWidth = isSelected ? 4 : isHovered ? 3 : 2;
        entity.point.color = isSelected
          ? selectedPointColor.withAlpha(1)
          : entity.categoryColor.withAlpha(isHovered ? 0.86 : normalPointAlpha);
        entity.point.outlineColor = isSelected
          ? selectedOutlineColor.withAlpha(1)
          : Cesium.Color.WHITE.withAlpha(isHovered ? 0.96 : 0.8);
      }
    });
  }, [filteredIds, focusedRestaurantId, hoveredRestaurant]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const dataSource = dataSourceRef.current;
    if (!viewer || !dataSource || !focusedRestaurantId) return;

    const entity = dataSource.entities.values.find(
      (item) => item.id === focusedRestaurantId,
    );
    if (entity) {
      const restaurant = entity.restaurantData;
      viewer.camera.flyTo({
        destination: Cesium.Rectangle.fromDegrees(
          restaurant.lng - 0.004,
          restaurant.lat - 0.003,
          restaurant.lng + 0.004,
          restaurant.lat + 0.003,
        ),
        duration: 0.7,
      });
    }
  }, [focusedRestaurantId]);

  return (
    <div className="cesium-map-wrap">
      <div id={containerId} />
      {hoveredRestaurant && (
        <div
          className="map-hover-card"
          style={{
            left: `${hoverPosition.x + 14}px`,
            top: `${hoverPosition.y + 14}px`,
          }}
        >
          <strong>{hoveredRestaurant.name}</strong>
          <span>{hoveredRestaurant.category}</span>
          <span>评分 {hoveredRestaurant.rating || '-'}</span>
        </div>
      )}
    </div>
  );
}

export default CesiumMap;
