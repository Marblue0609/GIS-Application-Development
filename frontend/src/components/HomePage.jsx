import { Button, Statistic, Tag, Typography } from 'antd';
import {
  ApiOutlined,
  ArrowRightOutlined,
  CompassOutlined,
  EnvironmentOutlined,
  HeartOutlined,
  RadiusSettingOutlined,
  SearchOutlined,
  SwapOutlined,
} from '@ant-design/icons';

const { Text, Title } = Typography;

const featureEntries = [
  {
    key: 'search',
    icon: <SearchOutlined />,
    title: '餐饮检索',
    desc: '按名称、菜系、价格与评分筛选紫金港周边餐饮点位。',
    action: '进入搜索',
  },
  {
    key: 'analysis',
    icon: <RadiusSettingOutlined />,
    title: '范围分析',
    desc: '选择地标或交通点作为中心，查看缓冲区内的餐饮结构。',
    action: '进入分析',
  },
  {
    key: 'route',
    icon: <SwapOutlined />,
    title: '路线预览',
    desc: '把目标餐厅加入清单，形成打卡顺序和路线距离预估。',
    action: '进入路线',
  },
];

function HomePage({
  apiStatus,
  landmarks,
  restaurants,
  stats,
  transportations,
  onEnterWorkspace,
}) {
  const previewPoints = restaurants.slice(0, 18);
  const apiLabel = apiStatus === 'online' ? 'FastAPI 已连接' : apiStatus === 'checking' ? '正在连接 API' : '本地 GeoJSON 模式';

  return (
    <main className="home-page">
      <header className="home-nav">
        <div className="home-brand">
          <div className="brand-mark"><CompassOutlined /></div>
          <div>
            <Text className="brand-kicker">GIS Food Analysis</Text>
            <Title level={3}>CityTaste</Title>
          </div>
        </div>
        <Button type="primary" icon={<ArrowRightOutlined />} onClick={() => onEnterWorkspace('search')}>
          打开工作台
        </Button>
      </header>

      <section className="home-hero">
        <div className="home-copy">
          <Tag className={`home-status ${apiStatus}`} icon={<ApiOutlined />}>{apiLabel}</Tag>
          <Title>紫金港餐饮空间分析工作台</Title>
          <Text>
            面向课程 GIS 应用开发任务，整合餐厅检索、范围缓冲分析、打卡清单与路线预览。
            首页负责快速理解项目，工作台负责完成真实操作。
          </Text>
          <div className="home-actions">
            <Button size="large" type="primary" icon={<SearchOutlined />} onClick={() => onEnterWorkspace('search')}>
              开始探索餐厅
            </Button>
            <Button size="large" icon={<RadiusSettingOutlined />} onClick={() => onEnterWorkspace('analysis')}>
              查看范围分析
            </Button>
          </div>
        </div>

        <div className="map-preview" aria-label="紫金港餐饮点位预览">
          <div className="preview-toolbar">
            <span><EnvironmentOutlined /> 紫金港片区</span>
            <strong>{stats.visible} 个当前结果</strong>
          </div>
          <div className="preview-grid">
            {previewPoints.map((restaurant, index) => (
              <span
                key={restaurant.id}
                className="preview-point"
                title={restaurant.name}
                style={{
                  left: `${12 + ((index * 19) % 76)}%`,
                  top: `${16 + ((index * 29) % 68)}%`,
                }}
              />
            ))}
            <span className="preview-route" />
            <span className="preview-zone" />
          </div>
          <div className="preview-metrics">
            <Statistic title="餐厅" value={stats.visible} />
            <Statistic title="地标" value={landmarks.length} />
            <Statistic title="交通点" value={transportations.length} />
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="section-heading">
          <Text className="brand-kicker">Workflow</Text>
          <Title level={2}>按任务进入，而不是挤在一个侧栏里找功能</Title>
        </div>
        <div className="feature-entry-grid">
          {featureEntries.map((feature) => (
            <article className="feature-entry" key={feature.key}>
              <div className="feature-entry-icon">{feature.icon}</div>
              <Title level={4}>{feature.title}</Title>
              <Text>{feature.desc}</Text>
              <Button type="link" icon={<ArrowRightOutlined />} onClick={() => onEnterWorkspace(feature.key)}>
                {feature.action}
              </Button>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-split">
        <div>
          <Text className="brand-kicker">Current Layer</Text>
          <Title level={2}>工作台保留完整地图能力</Title>
        </div>
        <div className="layer-facts">
          <span><SearchOutlined /> 多条件筛选</span>
          <span><RadiusSettingOutlined /> 缓冲区查询</span>
          <span><HeartOutlined /> 打卡清单</span>
          <span><SwapOutlined /> 路线预览</span>
        </div>
      </section>
    </main>
  );
}

export default HomePage;
