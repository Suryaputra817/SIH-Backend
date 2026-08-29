const Farmer = require('../models/Farmer');
const EscalationAlert = require('../models/EscalationAlert');
const { getWeatherAndSoilData, getMandiPrices } = require('./agriDataService');
const { calculateDistress } = require('./distressEngine');

async function notifyOfficer(alert, farmer) {
  const payload = { alertId: String(alert._id), farmerId: String(farmer._id), district: alert.district, riskScore: alert.riskScore, reasons: alert.triggerReasons };
  if (process.env.OFFICER_WEBHOOK_URL) {
    try {
      const response = await fetch(process.env.OFFICER_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      // Notification failure must never prevent recording a critical alert.
      console.error('Officer webhook failed:', error.message);
    }
  } else {
    console.warn('[critical-distress-alert]', payload);
  }
}

async function evaluateFarmer(farmerOrId) {
  const farmer = typeof farmerOrId === 'object' ? farmerOrId : await Farmer.findById(farmerOrId).lean();
  if (!farmer) { const error = new Error('Farmer not found'); error.statusCode = 404; throw error; }
  const [lng, lat] = farmer.location?.coordinates?.coordinates || [];
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !farmer.cropDetails?.cropName) {
    const error = new Error('Complete location coordinates and crop name before evaluating risk');
    error.statusCode = 422;
    throw error;
  }
  const [weather, market] = await Promise.all([
    getWeatherAndSoilData(lat, lng),
    getMandiPrices(farmer.cropDetails.cropName, farmer.location.district),
  ]);
  const assessment = calculateDistress({ farmer, weather, market });
  await Farmer.findByIdAndUpdate(farmer._id, { $set: {
    'distressProfile.riskScore': assessment.riskScore,
    'distressProfile.tier': assessment.tier,
    'distressProfile.contributingFactors': assessment.contributingFactors,
    'distressProfile.lastEvaluated': new Date(),
  } }, { runValidators: true });

  let alert = null;
  if (assessment.tier === 'Critical') {
    alert = await EscalationAlert.findOneAndUpdate(
      { farmerId: farmer._id, status: { $in: ['Pending', 'Assigned', 'Contacted'] } },
      { $set: { district: farmer.location.district || 'Unspecified', riskScore: assessment.riskScore, triggerReasons: assessment.contributingFactors }, $setOnInsert: { farmerId: farmer._id, status: 'Pending' } },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
    );
    await notifyOfficer(alert, farmer);
  }
  return { ...assessment, weather, market, alert };
}

function startRiskScheduler() {
  const minutes = Number(process.env.RISK_EVALUATION_INTERVAL_MINUTES || 0);
  if (!Number.isFinite(minutes) || minutes <= 0) return;
  const intervalMs = Math.max(minutes, 15) * 60_000;
  const run = async () => {
    const farmers = await Farmer.find({
      'location.coordinates': { $exists: true },
      'cropDetails.cropName': { $exists: true, $ne: '' },
    }).select('_id').lean();
    for (const farmer of farmers) {
      try { await evaluateFarmer(farmer._id); } catch (error) { console.error(`Scheduled evaluation failed for ${farmer._id}:`, error.message); }
    }
  };
  setInterval(() => run().catch((error) => console.error('Risk scheduler failed:', error.message)), intervalMs).unref();
  console.log(`Risk scheduler enabled every ${Math.max(minutes, 15)} minutes`);
}

module.exports = { evaluateFarmer, startRiskScheduler };
