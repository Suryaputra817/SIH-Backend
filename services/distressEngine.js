function clamp(value) { return Math.max(0, Math.min(100, Math.round(value))); }

function calculateDistress({ farmer, weather, market, now = new Date() }) {
  const reasons = [];
  let weatherScore = 0;
  if (weather.topsoilMoistureIndex < 0.15) { weatherScore += 65; reasons.push('Severe Drought'); }
  else if (weather.topsoilMoistureIndex < 0.20) { weatherScore += 35; reasons.push('Low Soil Moisture'); }
  if (weather.precipitationAnomalyMm < -15) { weatherScore += 20; reasons.push('Rainfall Deficit'); }
  if (weather.expectedPrecipitation24hMm > 35) { weatherScore += 35; reasons.push('Heavy Rain Risk'); }
  if (weather.temperatureC > 40) { weatherScore += 25; reasons.push('Heatwave'); }

  let marketScore = 0;
  if (market.deviationPercent >= 30) { marketScore = 100; reasons.push('Price Crash > 30%'); }
  else if (market.deviationPercent >= 25) { marketScore = 80; reasons.push('Price Dip > 25%'); }
  else if (market.deviationPercent > 0) { marketScore = market.deviationPercent * 2; reasons.push('Price Below MSP'); }

  const financials = farmer.financials || {};
  const acreage = Math.max(Number(farmer.cropDetails?.acreage) || 1, 0.1);
  let financialScore = 0;
  if (financials.loanAmount > 0 && financials.dueDate) {
    const days = Math.ceil((new Date(financials.dueDate) - now) / 86_400_000);
    if (days < 0) { financialScore = 100; reasons.push('Loan Overdue'); }
    else if (days <= 15) { financialScore = 70 + (15 - days) * 2; reasons.push('Loan Due Within 15 Days'); }
    else if (days <= 30) financialScore = 35;
    const debtPerAcre = financials.loanAmount / acreage;
    if (debtPerAcre > 100_000) financialScore += 15;
    else if (debtPerAcre > 50_000) financialScore += 8;
    if (financials.lenderType === 'Moneylender') { financialScore *= 1.3; reasons.push('Informal Lender Exposure'); }
  }
  const score = clamp(0.35 * clamp(weatherScore) + 0.35 * clamp(marketScore) + 0.30 * clamp(financialScore));
  const tier = score >= 70 ? 'Critical' : score >= 40 ? 'Vulnerable' : 'Stable';
  return { riskScore: score, tier, contributingFactors: [...new Set(reasons)], componentScores: { weather: clamp(weatherScore), market: clamp(marketScore), financial: clamp(financialScore) } };
}

module.exports = { calculateDistress };
