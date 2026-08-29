const cache = require('./cacheService');

const WEATHER_TTL_SECONDS = 3600;
const MSP = {
  paddy: 2300, rice: 2300, cotton: 7121, groundnut: 6783, sugarcane: 340,
  wheat: 2425, maize: 2400, soybean: 4892, tur: 7550, gram: 5650,
};

function cacheKey(...parts) {
  return `agri:${parts.map((part) => String(part).toLowerCase().replace(/[^a-z0-9.-]/g, '_')).join(':')}`;
}

function normalizeHourly(hourly) {
  const keys = hourly.time || [];
  return keys.map((time, i) => ({
    time,
    temperature: Number(hourly.temperature_2m?.[i] ?? 0),
    humidity: Number(hourly.relative_humidity_2m?.[i] ?? hourly.relativehumidity_2m?.[i] ?? 0),
    precipitation: Number(hourly.precipitation?.[i] ?? 0),
    soilMoisture: Number(hourly.soil_moisture_0_to_1cm?.[i] ?? 0),
    soilTemperature: Number(hourly.soil_temperature_0_to_7cm?.[i] ?? 0),
  }));
}

async function getWeatherAndSoilData(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('Valid latitude and longitude are required');
  const key = cacheKey('weather', lat.toFixed(3), lng.toFixed(3));
  const cached = await cache.get(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    latitude: String(lat), longitude: String(lng), timezone: 'auto', forecast_days: '7',
    hourly: 'temperature_2m,relative_humidity_2m,precipitation,soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,soil_temperature_0_to_7cm',
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
    signal: AbortSignal.timeout(Number(process.env.OPEN_METEO_TIMEOUT_MS || 6000)),
  });
  if (!response.ok) throw new Error(`Open-Meteo returned HTTP ${response.status}`);
  const raw = await response.json();
  const hours = normalizeHourly(raw.hourly || {});
  if (!hours.length) throw new Error('Open-Meteo returned no hourly observations');

  const next24 = hours.slice(0, 24);
  const next7 = hours.slice(0, 168);
  const precipitation24h = next24.reduce((sum, h) => sum + h.precipitation, 0);
  const precipitation7d = next7.reduce((sum, h) => sum + h.precipitation, 0);
  const baseline = Number(process.env.HISTORICAL_DAILY_RAINFALL_MM || 4) * 7;
  const result = {
    temperatureC: Math.max(...next24.map((h) => h.temperature)),
    humidityPercent: Math.round(next24.reduce((sum, h) => sum + h.humidity, 0) / next24.length),
    expectedPrecipitation24hMm: Number(precipitation24h.toFixed(1)),
    precipitation7dMm: Number(precipitation7d.toFixed(1)),
    precipitationAnomalyMm: Number((precipitation7d - baseline).toFixed(1)),
    topsoilMoistureIndex: Number((next24.reduce((sum, h) => sum + h.soilMoisture, 0) / next24.length).toFixed(3)),
    soilTemperatureC: Number((next24.reduce((sum, h) => sum + h.soilTemperature, 0) / next24.length).toFixed(1)),
    flags: {
      heatwave: next24.some((h) => h.temperature > 40),
      heavyRain: precipitation24h > 35,
      drySpell: precipitation7d < baseline * 0.4,
    },
    source: 'open-meteo',
    observedAt: new Date().toISOString(),
  };
  await cache.set(key, result, WEATHER_TTL_SECONDS);
  return result;
}

// Deterministic daily variation produces testable, realistic price movement while retaining a stable cached quote.
function getMandiPrices(cropName, district) {
  const crop = (cropName || '').trim().toLowerCase();
  const msp = MSP[crop] || 3000;
  const day = Math.floor(Date.now() / 86_400_000);
  const seed = [...`${crop}:${district || ''}:${day}`].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
  const volatilityPercent = ((seed % 4101) / 100) - 30; // -30.00% to +11.00%
  const currentPrice = Math.max(1, Math.round(msp * (1 + volatilityPercent / 100)));
  const deviationPercent = Number((((msp - currentPrice) / msp) * 100).toFixed(2));
  return Promise.resolve({ cropName, district, msp, currentPrice, deviationPercent, volatilityPercent: Number(volatilityPercent.toFixed(2)), market: 'Agmarknet simulation', quotedAt: new Date().toISOString() });
}

module.exports = { getWeatherAndSoilData, getMandiPrices };
