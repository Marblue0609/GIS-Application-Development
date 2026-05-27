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

function Sidebar({
  categories,
  filters,
  onFiltersChange,
  restaurants,
  selectedRestaurant,
  stats,
  categoryStats,
  checklist,
  onSelectRestaurant,
  onSaveRestaurant,
  onRemoveRestaurant,
}) {
  const [radius, setRadius] = useState(1000);
  const [routeMode, setRouteMode] = useState('walking');
  const [routeStart, setRouteStart] = useState('当前位置');

  const updateFilters = (patch) => {
    onFiltersChange((current) => ({ ...current, ...patch }));
  };

  const categoryOptions = categories.map((category) => ({
    value: category,
    label: category,
  }));

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
        data: categoryStats.slice(0, 6),
      },
    ],
  }), [categoryStats]);

  const handleRandom = () => {
    if (!restaurants.length) return;
    const picked = restaurants[Math.floor(Math.random() * restaurants.length)];
    onSelectRestaurant(picked);
  };

  const resetFilters = () => {
    onFiltersChange({
      keyword: '',
      category: null,
      priceRange: [0, 500],
      minRating: 0,
    });
  };

  const selectedName = selectedRestaurant?.name ?? '请先在地图或列表中选择餐厅';

  const searchPanel = (
    <>
      <section className="control-section">
        <div className="section-title">
          <SearchOutlined />
          <span>多条件检索</span>
        </div>
        <Space direction="vertical" size={14} className="control-stack">
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
        </div>
        <List
          className="restaurant-list"
          dataSource={restaurants.slice(0, 80)}
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
        <Space direction="vertical" size={14} className="control-stack">
          <div className="info-strip">
            <EnvironmentOutlined />
            <span>{selectedName}</span>
          </div>
          <div className="slider-block">
            <div className="slider-label">
              <span>搜索半径</span>
              <strong>{radius} m</strong>
            </div>
            <Slider min={200} max={3000} step={100} value={radius} onChange={setRadius} />
          </div>
          <Button type="primary" icon={<SearchOutlined />} disabled={!selectedRestaurant}>
            查询范围内餐厅
          </Button>
        </Space>
      </section>

      <section className="control-section">
        <div className="section-title">
          <AimOutlined />
          <span>缓冲区分析</span>
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
        <span>路径规划</span>
      </div>
      <Space direction="vertical" size={14} className="control-stack">
        <Input value={routeStart} onChange={(event) => setRouteStart(event.target.value)} prefix={<EnvironmentOutlined />} />
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
            <div className="restaurant-main" onClick={() => onSelectRestaurant(restaurant)}>
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
