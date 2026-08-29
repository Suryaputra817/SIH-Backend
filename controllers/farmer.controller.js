const Joi = require('joi');
const Farmer = require('../models/Farmer');
const { getWeatherAndSoilData, getMandiPrices } = require('../services/agriDataService');
const { createAdvisory } = require('../services/advisoryService');
const { evaluateFarmer } = require('../services/riskEvaluationService');

const profileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  language: Joi.string().valid('en', 'hi', 'or', 'te').default('or'),
  location: Joi.object({
    state: Joi.string().trim().max(80).required(), district: Joi.string().trim().max(80).required(), block: Joi.string().trim().max(80).required(),
    coordinates: Joi.object({ type: Joi.string().valid('Point').required(), coordinates: Joi.array().ordered(Joi.number().min(-180).max(180), Joi.number().min(-90).max(90)).length(2).required() }).required(),
  }).required(),
  cropDetails: Joi.object({ cropName: Joi.string().trim().max(80).required(), sowingDate: Joi.date().max('now').required(), acreage: Joi.number().positive().max(100000).required(), stage: Joi.string().valid('Sowing', 'Vegetative', 'Flowering', 'Harvesting').required() }).required(),
  financials: Joi.object({ loanAmount: Joi.number().min(0).default(0), dueDate: Joi.date().allow(null), lenderType: Joi.string().valid('Bank', 'Cooperative', 'Moneylender', 'SHG', 'None').default('None'), insured: Joi.boolean().default(false) }).default(),
});

async function onboard(req, res, next) {
  try {
    const { value, error } = profileSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ error: error.message });
    const farmer = await Farmer.findByIdAndUpdate(req.user.farmerId, { $set: value }, { new: true, runValidators: true });
    if (!farmer) return res.status(404).json({ error: 'Farmer session no longer exists' });
    return res.status(200).json({ farmer });
  } catch (error) { return next(error); }
}

async function profile(req, res, next) {
  try {
    const farmer = await Farmer.findById(req.user.farmerId).lean();
    if (!farmer) return res.status(404).json({ error: 'Farmer not found' });
    return res.json({ farmer });
  } catch (error) { return next(error); }
}

async function dashboard(req, res, next) {
  try {
    const farmer = await Farmer.findById(req.user.farmerId).lean();
    if (!farmer) return res.status(404).json({ error: 'Farmer not found' });
    const [lng, lat] = farmer.location?.coordinates?.coordinates || [];
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !farmer.cropDetails?.cropName) return res.status(422).json({ error: 'Complete onboarding with location and crop details first' });
    const [weatherResult, marketResult] = await Promise.allSettled([
      getWeatherAndSoilData(lat, lng), getMandiPrices(farmer.cropDetails.cropName, farmer.location.district),
    ]);
    const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null;
    const market = marketResult.status === 'fulfilled' ? marketResult.value : null;
    if (!weather && !market) return res.status(503).json({ error: 'Agricultural data services are temporarily unavailable' });
    const advisory = weather ? createAdvisory({ weather, market, cropStage: farmer.cropDetails.stage, language: farmer.language }) : null;
    return res.json({ farmer: { name: farmer.name, language: farmer.language, crop: farmer.cropDetails, risk: farmer.distressProfile }, weather, market, advisory, unavailable: [!weather && 'weather', !market && 'market'].filter(Boolean) });
  } catch (error) { return next(error); }
}

async function triggerRiskEval(req, res, next) {
  try { return res.json({ evaluation: await evaluateFarmer(req.user.farmerId) }); } catch (error) { return next(error); }
}

module.exports = { onboard, profile, dashboard, triggerRiskEval };
