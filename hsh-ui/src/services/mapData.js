const PI = Math.PI;
const A = 6378245.0;
const EE = 0.006693421622965943;

const getProp = (properties, key, fallback = '') => {
  const value = properties?.[key];
  return value === null || value === undefined ? fallback : value;
};

const outOfChina = (lng, lat) => (
  lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271
);

const transformLat = (lng, lat) => {
  let ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat
    + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
  ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(lat * PI) + 40.0 * Math.sin(lat / 3.0 * PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(lat / 12.0 * PI) + 320 * Math.sin(lat * PI / 30.0)) * 2.0 / 3.0;
  return ret;
};

const transformLng = (lng, lat) => {
  let ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng
    + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
  ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(lng * PI) + 40.0 * Math.sin(lng / 3.0 * PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(lng / 12.0 * PI) + 300.0 * Math.sin(lng / 30.0 * PI)) * 2.0 / 3.0;
  return ret;
};

export const wgs84ToGcj02 = (lng, lat) => {
  if (outOfChina(lng, lat)) return { lng, lat };

  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = lat / 180.0 * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
  dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);

  return {
    lng: lng + dLng,
    lat: lat + dLat,
  };
};

const normalizePointFeature = (feature, type) => {
  const properties = feature?.properties ?? {};
  const coordinates = feature?.geometry?.coordinates ?? [];
  const rawLng = Number(coordinates[0]) || 0;
  const rawLat = Number(coordinates[1]) || 0;
  const display = wgs84ToGcj02(rawLng, rawLat);

  if (type === 'landmark') {
    return {
      id: `landmark-${getProp(properties, 'name')}`,
      layerType: 'landmark',
      name: getProp(properties, 'name', '未命名地标'),
      category: getProp(properties, 'type', 'landmark'),
      address: getProp(properties, 'text_locat', '暂无位置描述'),
      lng: rawLng,
      lat: rawLat,
      displayLng: display.lng,
      displayLat: display.lat,
    };
  }

  return {
    id: `transportation-${getProp(properties, 'F_id', getProp(properties, 'name'))}`,
    layerType: 'transportation',
    name: getProp(properties, 'name', '未命名交通点'),
    category: getProp(properties, 'highway', 'transportation'),
    address: '交通网点',
    lng: rawLng,
    lat: rawLat,
    displayLng: display.lng,
    displayLat: display.lat,
  };
};

export const normalizeLandmarkFeature = (feature) => normalizePointFeature(feature, 'landmark');

export const normalizeTransportationFeature = (feature) => normalizePointFeature(feature, 'transportation');
