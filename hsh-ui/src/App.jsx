import { useEffect, useMemo, useState } from 'react';
import { Layout } from 'antd';
import CesiumMap from './components/CesiumMap';
import Sidebar from './components/Sidebar';
import { normalizeRestaurantFeature, restaurantMatchesFilters } from './services/restaurantData';

const { Content } = Layout;

function App() {
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [focusedRestaurantId, setFocusedRestaurantId] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [filters, setFilters] = useState({
    keyword: '',
    category: null,
    priceRange: [0, 500],
    minRating: 0,
  });

  useEffect(() => {
    const loadRestaurants = async () => {
      const response = await fetch('/restaurants.geojson');
      const geojson = await response.json();
      setRestaurants(geojson.features.map(normalizeRestaurantFeature));
    };

    loadRestaurants().catch((error) => {
      console.error('读取本地餐厅数据失败:', error);
    });
  }, []);

  const categories = useMemo(() => (
    [...new Set(restaurants.map((item) => item.category))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
  ), [restaurants]);

  const filteredRestaurants = useMemo(() => (
    restaurants.filter((restaurant) => restaurantMatchesFilters(restaurant, filters))
  ), [restaurants, filters]);

  const filteredIds = useMemo(() => (
    new Set(filteredRestaurants.map((restaurant) => restaurant.id))
  ), [filteredRestaurants]);

  const stats = useMemo(() => {
    const rated = filteredRestaurants.filter((restaurant) => restaurant.rating > 0);
    const priced = filteredRestaurants.filter((restaurant) => restaurant.price > 0);

    return {
      total: restaurants.length,
      visible: filteredRestaurants.length,
      avgRating: rated.length
        ? (rated.reduce((sum, item) => sum + item.rating, 0) / rated.length).toFixed(1)
        : '-',
      avgPrice: priced.length
        ? Math.round(priced.reduce((sum, item) => sum + item.price, 0) / priced.length)
        : '-',
    };
  }, [filteredRestaurants, restaurants.length]);

  const categoryStats = useMemo(() => {
    const categoryCount = filteredRestaurants.reduce((acc, restaurant) => {
      acc[restaurant.category] = (acc[restaurant.category] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(categoryCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredRestaurants]);

  const handleFocusRestaurant = (restaurant) => {
    setSelectedRestaurant(restaurant);
    setFocusedRestaurantId(restaurant.id);
  };

  const handleSaveRestaurant = (restaurant) => {
    if (!restaurant) return;
    setChecklist((current) => {
      if (current.some((item) => item.id === restaurant.id)) return current;
      return [...current, restaurant];
    });
  };

  const handleRemoveRestaurant = (restaurantId) => {
    setChecklist((current) => current.filter((item) => item.id !== restaurantId));
  };

  return (
    <Layout className="app-shell">
      <Sidebar
        categories={categories}
        filters={filters}
        onFiltersChange={setFilters}
        restaurants={filteredRestaurants}
        selectedRestaurant={selectedRestaurant}
        stats={stats}
        categoryStats={categoryStats}
        checklist={checklist}
        onSelectRestaurant={handleFocusRestaurant}
        onSaveRestaurant={handleSaveRestaurant}
        onRemoveRestaurant={handleRemoveRestaurant}
      />
      <Content className="map-panel">
        <CesiumMap
          filteredIds={filteredIds}
          focusedRestaurantId={focusedRestaurantId}
          onSelectRestaurant={handleFocusRestaurant}
        />
      </Content>
    </Layout>
  );
}

export default App;
