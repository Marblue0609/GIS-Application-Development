const getProp = (properties, key, fallback = '') => {
  const value = properties?.[key];
  return value === null || value === undefined ? fallback : value;
};

const normalizeCategory = (category) => {
  if (!category) return '其他';
  if (category.includes('饮品') || category.includes('咖啡') || category.includes('茶')) return '饮品咖啡';
  if (category.includes('糕') || category.includes('饼') || category.includes('甜品')) return '甜品烘焙';
  if (category.includes('川') || category.includes('渝')) return '川渝菜';
  if (category.includes('粤') || category.includes('广东')) return '粤菜';
  if (category.includes('日') || category.includes('韩国')) return '日韩料理';
  if (category.includes('西餐') || category.includes('意式')) return '西餐';
  if (category.includes('火锅')) return '火锅';
  if (category.includes('快餐')) return '快餐简食';
  if (category.includes('浙江') || category.includes('江苏') || category.includes('安徽')) return '江浙本帮';
  if (category.includes('清真') || category.includes('西北')) return '清真西北';
  if (category.includes('湘') || category.includes('东北') || category.includes('地方') || category.includes('风味')) return '地方风味';
  if (category.includes('综合')) return '综合酒楼';
  return '其他';
};

export const normalizeRestaurantFeature = (feature) => {
  const properties = feature?.properties ?? {};
  const coordinates = feature?.geometry?.coordinates ?? [];
  const category = normalizeCategory(getProp(properties, 'restaura_4', '其他'));

  return {
    id: String(getProp(properties, 'restaurant', '')),
    name: getProp(properties, 'restaura_1', '未命名餐厅'),
    rating: Number(getProp(properties, 'restaura_2', 0)) || 0,
    phone: getProp(properties, 'restaura_3', '暂无电话'),
    category,
    categoryRaw: getProp(properties, 'restaura_4', '其他'),
    categoryCode: getProp(properties, 'restaura_5', ''),
    price: Number(getProp(properties, 'restaura_6', 0)) || 0,
    address: getProp(properties, 'restaura_7', '暂无地址'),
    lng: Number(getProp(properties, 'lng_wgs84', coordinates[0])) || coordinates[0],
    lat: Number(getProp(properties, 'lat_wgs84', coordinates[1])) || coordinates[1],
  };
};

export const restaurantMatchesFilters = (restaurant, filters) => {
  const keyword = filters.keyword.trim().toLowerCase();
  const text = `${restaurant.name} ${restaurant.address} ${restaurant.categoryRaw}`.toLowerCase();

  return (
    (!keyword || text.includes(keyword)) &&
    (!filters.category || restaurant.category === filters.category) &&
    restaurant.price >= filters.priceRange[0] &&
    restaurant.price <= filters.priceRange[1] &&
    restaurant.rating >= filters.minRating
  );
};

export const categoryPalette = {
  '饮品咖啡': '#4f9d8f',
  '甜品烘焙': '#f2a7a0',
  '川渝菜': '#e85d3f',
  '粤菜': '#78a864',
  '日韩料理': '#5f8ec5',
  '西餐': '#b45b7a',
  '火锅': '#f49b3f',
  '快餐简食': '#d5a12d',
  '江浙本帮': '#8ab17d',
  '清真西北': '#8c6f4f',
  '地方风味': '#c06c54',
  '综合酒楼': '#7b6d63',
  '其他': '#9a948d',
};
