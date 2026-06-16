import { useEffect, useMemo, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Button,
  Empty,
  Input,
  Layout,
  List,
  message,
  Select,
  Slider,
  Space,
  Statistic,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import {
  AimOutlined,
  CompassOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
  GiftOutlined,
  HeartOutlined,
  PlusOutlined,
  RadiusSettingOutlined,
  SearchOutlined,
  StarFilled,
  SwapOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;
const { Text, Title } = Typography;

const travelModes = [
  { value: 'walking', label: '步行' },
  { value: 'bicycling', label: '骑行' },
  { value: 'driving', label: '驾车' },
];

const uniqueBy = (items, getKey) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// Haversine 公式计算两点间距离（米）
// 用于客户端范围距离搜索，不依赖后端 API
const haversineDistance = (lng1, lat1, lng2, lat2) => {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

function Sidebar({
  categories,
  filters,
  onFiltersChange,
  restaurants,
  landmarks,
  transportations,
  selectedRestaurant,
  selectedMapItem,
  stats,
  categoryStats,
  checklist,
  bufferInfo,
  onBufferChange,
  onSelectRestaurant,
  onSaveRestaurant,
  onRemoveRestaurant,
  onSelectMapItem,
}) {
  const [radius, setRadius] = useState(1000);
  const [routeMode, setRouteMode] = useState('walking');
  const [routeStart, setRouteStart] = useState('当前位置');
  const [analysisCenterId, setAnalysisCenterId] = useState(null);
  const [bufferResult, setBufferResult] = useState(null);
  const [sortBy, setSortBy] = useState('relevance');
  const [isRevealing, setIsRevealing] = useState(false);
  const [revealRestaurant, setRevealRestaurant] = useState(null);

  // 搜索结果列表容器 ref，用于自动滚动到选中项
  const searchListRef = useRef(null);

  // 结果列表中选中餐厅时自动滚动到该项
  const prevSelectedIdRef = useRef(null);
  useEffect(() => {
    if (selectedRestaurant?.id === prevSelectedIdRef.current) return;
    prevSelectedIdRef.current = selectedRestaurant?.id;
    if (!selectedRestaurant) return;
    // 延迟一帧，等 render 完成再滚动
    requestAnimationFrame(() => {
      const activeEl = searchListRef.current?.querySelector('.restaurant-item.active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }, [selectedRestaurant, restaurants]);

  const updateFilters = (patch) => {
    onFiltersChange((current) => ({ ...current, ...patch }));
  };

  const categoryOptions = categories.map((category) => ({
    value: category,
    label: category,
  }));

  const uniqueTransportations = uniqueBy(
    transportations,
    (item) => `${item.name}-${item.category}`,
  );

  const analysisCenterOptions = [
    ...landmarks.map((item) => ({
      value: item.id,
      label: `地标 · ${item.name}`,
      item,
    })),
    ...uniqueTransportations.slice(0, 80).map((item) => ({
      value: item.id,
      label: `交通 · ${item.name}`,
      item,
    })),
  ];

  const routeStartOptions = [
    { value: '当前位置', label: '当前位置' },
    ...uniqueBy(uniqueTransportations, (item) => item.name).slice(0, 80).map((item) => ({
      value: item.name,
      label: item.name,
    })),
  ];

  // 饼图数据来源：有缓冲分析结果优先用缓冲区结果，否则用全局筛选结果
  const pieChartData = useMemo(() => {
    const source = bufferResult ?? categoryStats;
    return source.slice(0, 6);
  }, [bufferResult, categoryStats]);

  // 饼图扇区点击 → 自动联动菜系筛选
  const handlePieClick = (params) => {
    if (!params?.name) return;
    updateFilters({ category: params.name === filters.category ? null : params.name });
    message.info(params.name === filters.category ? '已取消菜系筛选' : `已筛选「${params.name}」`);
  };

  const bufferChartOption = useMemo(() => ({
    color: ['#e76f51', '#f4a261', '#8ab17d', '#6d9dc5', '#b07aa1', '#7f8c8d'],
    tooltip: { trigger: 'item' },
    legend: {
      bottom: 0,
      left: 'center',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: '#6b5f57', fontSize: 11 },
    },
    series: [
      {
        name: '菜系占比',
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['50%', '43%'],
        avoidLabelOverlap: true,
        label: { formatter: '{b}', color: '#3c342f', fontSize: 11 },
        data: pieChartData,
        emphasis: {
          label: { fontSize: 14, fontWeight: 'bold' },
          scaleSize: 8,
        },
        selectedMode: 'single',
        selectedOffset: 8,
      },
    ],
  }), [pieChartData]);

  // 排序后的餐厅列表
  const sortedRestaurants = useMemo(() => {
    const list = [...restaurants];
    switch (sortBy) {
      case 'rating-desc': return list.sort((a, b) => b.rating - a.rating);
      case 'rating-asc': return list.sort((a, b) => a.rating - b.rating);
      case 'price-desc': return list.sort((a, b) => b.price - a.price);
      case 'price-asc': return list.sort((a, b) => a.price - b.price);
      case 'name': return list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
      default: return list; // relevance = 默认按原始顺序
    }
  }, [restaurants, sortBy]);

  const handleRandom = () => {
    if (!restaurants.length) return;
    const picked = restaurants[Math.floor(Math.random() * restaurants.length)];
    // 盲盒揭示：先触发动画，动画结束再选中
    setIsRevealing(true);
    setRevealRestaurant(picked);
    // 1.5s 后动画结束，选中餐厅
    setTimeout(() => {
      setIsRevealing(false);
      setRevealRestaurant(null);
      onSelectRestaurant(picked);
    }, 1600);
  };

  const resetFilters = () => {
    onFiltersChange({
      keyword: '',
      category: null,
      priceRange: [0, 500],
      minRating: 0,
    });
  };

  // 从清单点击餐厅 → 清除筛选并飞行定位（确保地图上可见）
  const handleChecklistSelect = (restaurant) => {
    resetFilters();
    onSelectRestaurant(restaurant);
  };

  const currentMapItemName = selectedMapItem?.name ?? selectedRestaurant?.name ?? '请先在地图或列表中选择餐厅';

  const handleAnalysisCenterChange = (value, option) => {
    setAnalysisCenterId(value);
    if (option?.item) onSelectMapItem(option.item);
  };

  // 客户端范围距离搜索 + 缓冲区分析
  // 选中地图项后，以其坐标为中心，计算半径内所有筛选结果中的餐厅
  const handleBufferSearch = () => {
    const center = selectedMapItem;
    if (!center) return;
    const centerLng = center.displayLng ?? center.lng;
    const centerLat = center.displayLat ?? center.lat;

    // 根据当前筛选条件 + 空间距离筛选
    const nearby = restaurants.filter((r) => {
      const rLng = r.displayLng ?? r.lng;
      const rLat = r.displayLat ?? r.lat;
      return haversineDistance(centerLng, centerLat, rLng, rLat) <= radius;
    });

    // 统计缓冲区内菜系分布
    const catCount = nearby.reduce((acc, r) => {
      acc[r.category] = (acc[r.category] ?? 0) + 1;
      return acc;
    }, {});

    const stats = Object.entries(catCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    setBufferResult(stats);

    // 同步到 App 状态，驱动 Cesium 画圆 + 高亮
    onBufferChange({
      center: { lng: centerLng, lat: centerLat },
      radius,
      nearbyIds: new Set(nearby.map((r) => r.id)),
    });

    message.success(
      `在「${center.name ?? '选中点'}」周边 ${radius}m 内找到 ${nearby.length} 家餐厅`,
    );
  };

  const searchPanel = (
    <>
      <section className="control-section">
        <div className="section-title">
          <SearchOutlined />
          <span>多条件检索</span>
        </div>
        <Space orientation="vertical" size={14} className="control-stack">
          <Input
            placeholder="餐厅、地址或菜系"
            prefix={<SearchOutlined />}
            value={filters.keyword}
            onChange={(event) => updateFilters({ keyword: event.target.value })}
            allowClear
          />
          <Select
            placeholder="全部菜系"
            allowClear
            value={filters.category}
            onChange={(category) => updateFilters({ category })}
            options={categoryOptions}
          />
          <div className="slider-block">
            <div className="slider-label">
              <span>人均价格</span>
              <strong>¥{filters.priceRange[0]} - ¥{filters.priceRange[1]}</strong>
            </div>
            <Slider
              range
              min={0}
              max={500}
              value={filters.priceRange}
              onChange={(priceRange) => updateFilters({ priceRange })}
            />
          </div>
          <div className="slider-block">
            <div className="slider-label">
              <span>最低评分</span>
              <strong>{filters.minRating.toFixed(1)}</strong>
            </div>
            <Slider
              min={0}
              max={5}
              step={0.1}
              value={filters.minRating}
              onChange={(minRating) => updateFilters({ minRating })}
            />
          </div>
          <div className="action-row">
            <Button icon={<GiftOutlined />} onClick={handleRandom}>
              随机
            </Button>
            <Button icon={<AimOutlined />} onClick={resetFilters}>
              重置
            </Button>
          </div>
        </Space>
      </section>

      {selectedRestaurant && (
        <section className="selected-card highlight-card">
          <Text type="secondary">当前选中</Text>
          <Title level={4}>{selectedRestaurant.name}</Title>
          <div className="meta-row">
            <Tag>{selectedRestaurant.category}</Tag>
            <span><StarFilled /> {selectedRestaurant.rating || '-'}</span>
            <span>¥{selectedRestaurant.price || '-'}</span>
          </div>
          <p><EnvironmentOutlined /> {selectedRestaurant.address}</p>
          <Button
            block
            type="primary"
            icon={<HeartOutlined />}
            onClick={() => onSaveRestaurant(selectedRestaurant)}
          >
            保存想去
          </Button>
        </section>
      )}

      <section className="result-section">
        <div className="section-title">
          <EnvironmentOutlined />
          <span>结果列表</span>
          {restaurants.length > 0 && (
            <span style={{ marginLeft: 'auto', color: '#a39b94', fontSize: 12 }}>
              共 {restaurants.length} 家
            </span>
          )}
        </div>
        <Select
          size="small"
          value={sortBy}
          onChange={setSortBy}
          style={{ width: '100%', marginBottom: 10 }}
          options={[
            { value: 'relevance', label: '默认排序' },
            { value: 'rating-desc', label: '评分从高到低' },
            { value: 'rating-asc', label: '评分从低到高' },
            { value: 'price-desc', label: '价格从高到低' },
            { value: 'price-asc', label: '价格从低到高' },
            { value: 'name', label: '按名称排序' },
          ]}
        />
        <div ref={searchListRef}>
        <List
          className="restaurant-list"
          dataSource={sortedRestaurants.slice(0, 80)}
          locale={{ emptyText: '没有匹配的餐厅' }}
          renderItem={(restaurant) => (
            <List.Item
              className={restaurant.id === selectedRestaurant?.id ? 'restaurant-item active' : 'restaurant-item'}
              onClick={() => onSelectRestaurant(restaurant)}
            >
              <div className="restaurant-main">
                <Text strong>{restaurant.name}</Text>
                <Text type="secondary">{restaurant.address}</Text>
              </div>
              <div className="restaurant-side">
                <span><StarFilled /> {restaurant.rating || '-'}</span>
                <Tag>{restaurant.category}</Tag>
              </div>
            </List.Item>
          )}
        />
        </div>
      </section>

      {/* 盲盒揭示覆盖层 — 高级感金色光扫 + 文字渐现 */}
      {isRevealing && revealRestaurant && (
        <div className="reveal-overlay">
          <div className="reveal-card">
            <div className="reveal-shimmer" />
            <div className="reveal-content">
              <div className="reveal-subtitle">为你发现</div>
              <div className="reveal-name">{revealRestaurant.name}</div>
              <div className="reveal-meta">
                <Tag>{revealRestaurant.category}</Tag>
                <span><StarFilled style={{ color: '#ffb23f' }} /> {revealRestaurant.rating || '-'}</span>
                <span>¥{revealRestaurant.price || '-'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const analysisPanel = (
    <>
      <section className="control-section">
        <div className="section-title">
          <RadiusSettingOutlined />
          <span>范围距离搜索</span>
        </div>
        <Space orientation="vertical" size={14} className="control-stack">
          <div className="info-strip">
            <EnvironmentOutlined />
            <span>{currentMapItemName}</span>
          </div>
          <Select
            placeholder="选择地标或交通点作为中心"
            allowClear
            showSearch
            value={analysisCenterId}
            onChange={handleAnalysisCenterChange}
            options={analysisCenterOptions}
            optionFilterProp="label"
          />
          <div className="slider-block">
            <div className="slider-label">
              <span>搜索半径</span>
              <strong>{radius} m</strong>
            </div>
            <Slider min={200} max={3000} step={100} value={radius} onChange={setRadius} />
          </div>
          <Button type="primary" icon={<SearchOutlined />} disabled={!selectedMapItem} onClick={handleBufferSearch}>
            查询范围内餐厅
          </Button>
          {bufferInfo && (
            <Button icon={<DeleteOutlined />} onClick={() => { onBufferChange(null); setBufferResult(null); }}>
              清除缓冲区
            </Button>
          )}
        </Space>
      </section>

      <section className="control-section">
        <div className="section-title">
          <AimOutlined />
          <span>缓冲区分析</span>
        </div>
        <div className="chart-card">
          {pieChartData.length ? (
            <ReactECharts
              option={bufferChartOption}
              style={{ height: 240 }}
              onEvents={{ click: handlePieClick }}
            />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择中心点并搜索" />
          )}
        </div>
      </section>
    </>
  );

  const routePanel = (
    <section className="control-section">
      <div className="section-title">
        <SwapOutlined />
        <span>路径规划</span>
      </div>
      <Space orientation="vertical" size={14} className="control-stack">
        <Select
          value={routeStart}
          onChange={setRouteStart}
          options={routeStartOptions}
          showSearch
          optionFilterProp="label"
        />
        <Input value={selectedRestaurant?.name ?? ''} placeholder="选择一个餐厅作为终点" prefix={<AimOutlined />} readOnly />
        <Select value={routeMode} onChange={setRouteMode} options={travelModes} />
        <div className="route-summary">
          <Statistic title="预计距离" value="--" suffix="km" />
          <Statistic title="预计时间" value="--" suffix="min" />
        </div>
        <Button type="primary" icon={<SwapOutlined />} disabled={!selectedRestaurant}>
          生成路线
        </Button>
        <Text type="secondary">
          后续接入 pgRouting 或第三方路径 API 后，这里展示路线距离、时间和地图路径。
        </Text>
      </Space>
    </section>
  );

  const checklistPanel = (
    <section className="result-section checklist-section">
      <div className="section-title">
        <HeartOutlined />
        <span>打卡清单</span>
      </div>
      <Button
        block
        type="primary"
        icon={<PlusOutlined />}
        disabled={!selectedRestaurant}
        onClick={() => onSaveRestaurant(selectedRestaurant)}
      >
        保存当前餐厅
      </Button>
      <List
        className="restaurant-list checklist-list"
        dataSource={checklist}
        locale={{ emptyText: '还没有保存想去的餐厅' }}
        renderItem={(restaurant, index) => (
          <List.Item className="restaurant-item">
            <div className="check-order">{index + 1}</div>
            <div className="restaurant-main" onClick={() => handleChecklistSelect(restaurant)}>
              <Text strong>{restaurant.name}</Text>
              <Text type="secondary">{restaurant.address}</Text>
            </div>
            <Button
              type="text"
              icon={<DeleteOutlined />}
              onClick={() => onRemoveRestaurant(restaurant.id)}
            />
          </List.Item>
        )}
      />
    </section>
  );

  return (
    <Sider width={420} className="sidebar">
      <div className="brand">
        <div className="brand-mark"><CompassOutlined /></div>
        <div>
          <Title level={3}>CityTaste</Title>
          <Text>紫金港餐饮探索地图</Text>
        </div>
      </div>

      <div className="summary-grid">
        <Statistic title="均分" value={stats.avgRating} />
        <Statistic title="人均" value={stats.avgPrice} prefix="¥" />
        <Statistic title="结果" value={stats.visible} suffix="家" />
      </div>

      <div className="layer-summary">
        <span>地标 {landmarks.length}</span>
        <span>交通 {transportations.length}</span>
      </div>

      <Tabs
        className="feature-tabs"
        defaultActiveKey="search"
        items={[
          { key: 'search', label: '搜索', children: searchPanel },
          { key: 'analysis', label: '分析', children: analysisPanel },
          { key: 'route', label: '路线', children: routePanel },
          { key: 'checklist', label: '清单', children: checklistPanel },
        ]}
      />
    </Sider>
  );
}

export default Sidebar;
