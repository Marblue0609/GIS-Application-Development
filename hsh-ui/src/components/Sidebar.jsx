import { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Button,
  Empty,
  Input,
  Layout,
  List,
  Select,
  Slider,
  Space,
  Statistic,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  AimOutlined,
  ApiOutlined,
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
  ArrowDownOutlined,
  ArrowUpOutlined,
  HomeOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;
const { Text, Title } = Typography;

// 路线规划出行方式选项
const travelModes = [
  { value: 'walking', label: '步行' },
  { value: 'bicycling', label: '骑行' },
  { value: 'driving', label: '驾车' },
];

// 数组去重工具函数，按自定义 key 判断
const uniqueBy = (items, getKey) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// 格式化距离显示：>= 1000m 显示 km，否则显示 m
const formatDistance = (distance) => {
  if (distance === null || distance === undefined || distance === '') return null;
  if (!Number.isFinite(Number(distance))) return null;
  if (distance >= 1000) return `${(distance / 1000).toFixed(1)} km`;
  return `${Math.round(distance)} m`;
};

/**
 * 侧栏主组件 — 搜索 / 分析 / 路线 / 清单四大 Tab。
 *
 * Props 由 App 统一管理数据流，Sidebar 只负责 UI 渲染和事件冒泡。
 */
function Sidebar({
  activeFeature,
  analysisArea,
  apiStatus,
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
  routeDistanceM,
  routeMethod,
  routeNote,
  onFeatureChange,
  onGoHome,
  onSelectRestaurant,
  onSaveRestaurant,
  onRemoveRestaurant,
  onMoveChecklistItem,
  onSelectMapItem,
  onRadiusSearch,
  onPlanRoute,
  onRandomRestaurant,
}) {
  const [radius, setRadius] = useState(1000);
  const [routeMode, setRouteMode] = useState('walking');
  const [routeStart, setRouteStart] = useState('当前位置');
  const [analysisCenterId, setAnalysisCenterId] = useState(null);
  const [analysisCenter, setAnalysisCenter] = useState(null);

  // 局部更新筛选条件（合并到当前 state）
  const updateFilters = (patch) => {
    onFiltersChange((current) => ({ ...current, ...patch }));
  };

  // 菜系下拉选项
  const categoryOptions = categories.map((category) => ({
    value: category,
    label: category,
  }));

  // 交通设施去重（同名同类型只显示一条）
  const uniqueTransportations = uniqueBy(
    transportations,
    (item) => `${item.name}-${item.category}`,
  );

  // 范围搜索中心点选项：地标 + 交通设施（去重后取前 90 条）
  const analysisCenterOptions = [
    ...landmarks.map((item) => ({
      value: item.id,
      label: `地标 · ${item.name}`,
      item,
    })),
    ...uniqueTransportations.slice(0, 90).map((item) => ({
      value: item.id,
      label: `交通 · ${item.name}`,
      item,
    })),
  ];

  // 路线起点选项：当前位置 + 交通设施名称列表
  const routeStartOptions = [
    { value: '当前位置', label: '当前位置' },
    ...uniqueBy(uniqueTransportations, (item) => item.name).slice(0, 90).map((item) => ({
      value: item.name,
      label: item.name,
    })),
  ];

  // ECharts 环形饼图（甜甜圈图）— 缓冲区菜系结构展示
  const bufferChartOption = useMemo(() => ({
    color: ['#dc5b3c', '#d9952e', '#4f9b6d', '#3b83bd', '#996bb2', '#6f7782'],
    tooltip: { trigger: 'item' },
    legend: {
      bottom: 0,
      left: 'center',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: '#59615d', fontSize: 11 },
    },
    series: [
      {
        name: '菜系占比',
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['50%', '43%'],
        avoidLabelOverlap: true,
        label: { formatter: '{b}', color: '#27302d', fontSize: 11 },
        data: categoryStats.slice(0, 6),
      },
    ],
  }), [categoryStats]);

  // 重置筛选条件到默认值
  const resetFilters = () => {
    onFiltersChange({
      keyword: '',
      category: null,
      priceRange: [0, 500],
      minRating: 0,
    });
  };

  // 盲盒推荐：从当前可见餐厅中随机选择一家
  const handleRandom = () => {
    onRandomRestaurant();
  };

  // 范围搜索中心点变更：更新中心点定位并选中对应地图实体
  const handleAnalysisCenterChange = (value, option) => {
    setAnalysisCenterId(value);
    setAnalysisCenter(option?.item ?? null);
    if (option?.item) onSelectMapItem(option.item);
  };

  const currentCenter = analysisCenter ?? selectedMapItem ?? selectedRestaurant;
  const selectedName = selectedRestaurant?.name ?? '请先在地图或列表中选择餐厅';
  const currentMapItemName = currentCenter?.name ?? selectedName;
  const apiLabel = apiStatus === 'online' ? 'API 已连接' : apiStatus === 'checking' ? '连接中' : '本地数据';
  const routeDistanceText = formatDistance(routeDistanceM) ?? '--';
  const routeMethodLabel = routeMethod === 'amap'
    ? '高德路网'
    : routeMethod === 'straight_line'
      ? '直线兜底'
      : routeMethod === 'none'
        ? '未成线'
        : '待规划';
  const routeDistanceTitle = routeMethod === 'amap' ? '路网距离' : '预估距离';

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
              盲盒
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
          <div className="detail-grid">
            <span>联系电话</span>
            <strong>{selectedRestaurant.phone || '暂无'}</strong>
            <span>数据坐标</span>
            <strong>{selectedRestaurant.lng.toFixed(4)}, {selectedRestaurant.lat.toFixed(4)}</strong>
          </div>
          <Button
            block
            type="primary"
            icon={<HeartOutlined />}
            onClick={() => onSaveRestaurant(selectedRestaurant)}
          >
            加入打卡清单
          </Button>
        </section>
      )}

      <section className="result-section">
        <div className="section-title">
          <EnvironmentOutlined />
          <span>结果列表</span>
        </div>
        <List
          className="restaurant-list"
          dataSource={restaurants.slice(0, 120)}
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
                <Tag>{formatDistance(restaurant.distanceM) ?? restaurant.category}</Tag>
              </div>
            </List.Item>
          )}
        />
      </section>
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
          <Button
            type="primary"
            icon={<SearchOutlined />}
            disabled={!currentCenter}
            onClick={() => onRadiusSearch(currentCenter, radius)}
          >
            查询范围内餐厅
          </Button>
          {analysisArea && (
            <Text type="secondary">
              当前地图已绘制 {analysisArea.radius} m 范围圈。
            </Text>
          )}
        </Space>
      </section>

      <section className="control-section">
        <div className="section-title">
          <AimOutlined />
          <span>缓冲区菜系结构</span>
        </div>
        <div className="chart-card">
          {categoryStats.length ? (
            <ReactECharts option={bufferChartOption} style={{ height: 240 }} />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="等待分析结果" />
          )}
        </div>
      </section>
    </>
  );

  const routePanel = (
    <section className="control-section">
      <div className="section-title">
        <SwapOutlined />
        <span>打卡路线预览</span>
      </div>
      <Space orientation="vertical" size={14} className="control-stack">
        <Select
          value={routeStart}
          onChange={setRouteStart}
          options={routeStartOptions}
          showSearch
          optionFilterProp="label"
        />
        <Select value={routeMode} onChange={setRouteMode} options={travelModes} />
        <div className="route-summary">
          <Statistic title="清单点位" value={checklist.length} suffix="个" />
          <Statistic title={routeDistanceTitle} value={routeDistanceText} />
        </div>
        <div className={`route-method ${routeMethod ?? 'pending'}`}>
          <span>{routeMethodLabel}</span>
          {routeNote && <Text type="secondary">{routeNote}</Text>}
        </div>
        <Button
          type="primary"
          icon={<SwapOutlined />}
          disabled={checklist.length < 2}
          onClick={() => onPlanRoute(routeMode)}
        >
          预览清单路线
        </Button>
        <Text type="secondary">
          后端配置 AMAP_KEY 后返回高德真实路网；未配置或调用失败时，自动退回直线估算，前端按返回 path 绘制。
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
            <div className="restaurant-main" onClick={() => onSelectRestaurant(restaurant)}>
              <Text strong>{restaurant.name}</Text>
              <Text type="secondary">{restaurant.address}</Text>
            </div>
            <div className="check-actions">
              <Tooltip title="上移">
                <Button
                  type="text"
                  icon={<ArrowUpOutlined />}
                  disabled={index === 0}
                  onClick={() => onMoveChecklistItem(restaurant.id, -1)}
                />
              </Tooltip>
              <Tooltip title="下移">
                <Button
                  type="text"
                  icon={<ArrowDownOutlined />}
                  disabled={index === checklist.length - 1}
                  onClick={() => onMoveChecklistItem(restaurant.id, 1)}
                />
              </Tooltip>
              <Tooltip title="移除">
                <Button
                  type="text"
                  icon={<DeleteOutlined />}
                  onClick={() => onRemoveRestaurant(restaurant.id)}
                />
              </Tooltip>
            </div>
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
          <Text className="brand-kicker">GIS Food Analysis</Text>
          <Title level={3}>CityTaste</Title>
          <Text>紫金港餐饮空间分析</Text>
        </div>
      </div>

      <Button className="home-return" icon={<HomeOutlined />} onClick={onGoHome}>
        返回首页
      </Button>

      <div className={`api-pill ${apiStatus}`}>
        <ApiOutlined />
        <span>{apiLabel}</span>
      </div>

      <div className="summary-grid">
        <Statistic title="均分" value={stats.avgRating} />
        <Statistic title="人均" value={stats.avgPrice} prefix="¥" />
        <Statistic title="结果" value={stats.visible} suffix="家" />
      </div>

      <div className="layer-summary">
        <span>地标 {landmarks.length}</span>
        <span>交通 {transportations.length}</span>
        <span>总量 {stats.total}</span>
      </div>

      <Tabs
        className="feature-tabs"
        activeKey={activeFeature}
        onChange={onFeatureChange}
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
