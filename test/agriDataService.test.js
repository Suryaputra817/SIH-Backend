const test = require('node:test');
const assert = require('node:assert/strict');
const { getHistoricalRainfallBaseline, getWeatherAndSoilData } = require('../services/agriDataService');

function formatDate(date) { return date.toISOString().slice(0, 10); }

function historicalFixture() {
  const time = [];
  const precipitation_sum = [];
  for (let year = 2016; year <= 2025; year += 1) {
    for (let day = 0; day < 7; day += 1) {
      const date = new Date(Date.UTC(year, 7, 29 + day));
      time.push(formatDate(date));
      precipitation_sum.push(4);
    }
  }
  return { daily: { time, precipitation_sum } };
}

function forecastFixture() {
  const time = Array.from({ length: 168 }, (_, hour) => `2026-08-${String(29 + Math.floor(hour / 24)).padStart(2, '0')}T${String(hour % 24).padStart(2, '0')}:00`);
  return {
    hourly: {
      time,
      temperature_2m: Array(168).fill(32),
      relative_humidity_2m: Array(168).fill(70),
      precipitation: Array(168).fill(1),
      soil_moisture_0_to_1cm: Array(168).fill(0.25),
      soil_temperature_0_to_7cm: Array(168).fill(29),
    },
  };
}

test('historical baseline rejects null precipitation instead of converting it to zero', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ daily: { time: ['2016-08-29'], precipitation_sum: [null] } }) });
  try {
    await assert.rejects(
      getHistoricalRainfallBaseline(12.111, 77.111, new Date('2026-08-29T00:00:00Z')),
      /Insufficient historical rainfall coverage/,
    );
  } finally { global.fetch = originalFetch; }
});

test('weather payload uses a location-specific historical baseline and validated soil data', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => ({
    ok: true,
    json: async () => (url.includes('archive-api') ? historicalFixture() : forecastFixture()),
  });
  let result;
  try { result = await getWeatherAndSoilData(13.222, 78.222); } finally { global.fetch = originalFetch; }

  assert.equal(result.precipitation7dBaselineMm, 28);
  assert.equal(result.precipitation7dMm, 168);
  assert.equal(result.precipitationAnomalyMm, 140);
  assert.equal(result.topsoilMoistureIndex, 0.25);
  assert.equal(result.dataQuality, 'verified-historical-baseline');
});

test('weather service rejects invalid coordinates before calling an external API', async () => {
  await assert.rejects(getWeatherAndSoilData(91, 78), (error) => error.statusCode === 400);
});
