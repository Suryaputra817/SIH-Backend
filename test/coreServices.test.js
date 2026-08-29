const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateDistress } = require('../services/distressEngine');
const { createAdvisory } = require('../services/advisoryService');

test('critical climate, market, and debt conditions escalate to Critical', () => {
  const result = calculateDistress({
    farmer: { cropDetails: { acreage: 1 }, financials: { loanAmount: 120000, dueDate: new Date(Date.now() - 86400000), lenderType: 'Moneylender' } },
    weather: { topsoilMoistureIndex: 0.1, precipitationAnomalyMm: -20, expectedPrecipitation24hMm: 0, temperatureC: 42 },
    market: { deviationPercent: 31 },
  });
  assert.equal(result.tier, 'Critical');
  assert.ok(result.riskScore >= 70);
  assert.ok(result.contributingFactors.includes('Price Crash > 30%'));
});

test('Odia emergency advisory includes all applicable actions and speech metadata', () => {
  const advisory = createAdvisory({
    weather: { expectedPrecipitation24hMm: 25, topsoilMoistureIndex: 0.1, temperatureC: 39 },
    market: { deviationPercent: 20 }, cropStage: 'Harvesting', language: 'or',
  });
  assert.equal(advisory.language, 'or');
  assert.equal(advisory.tts.locale, 'or-IN');
  assert.ok(advisory.messages.length >= 4);
});
