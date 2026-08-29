const mongoose = require('mongoose');

const pointSchema = new mongoose.Schema({
  type: { type: String, enum: ['Point'], required: true },
  coordinates: {
    type: [Number],
    required: true,
    validate: {
      validator: (value) => Array.isArray(value) && value.length === 2 &&
        value[0] >= -180 && value[0] <= 180 && value[1] >= -90 && value[1] <= 90,
      message: 'coordinates must be [longitude, latitude] within valid ranges',
    },
  },
}, { _id: false });

const farmerSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true, index: true, match: /^[6-9]\d{9}$/ },
  // A temporary value lets a newly OTP-verified farmer receive an authenticated token before onboarding.
  name: { type: String, required: true, trim: true, maxlength: 100, default: 'New Farmer' },
  language: { type: String, enum: ['en', 'hi', 'or', 'te'], default: 'or' },
  location: {
    state: { type: String, trim: true, maxlength: 80 },
    district: { type: String, trim: true, maxlength: 80, index: true },
    block: { type: String, trim: true, maxlength: 80 },
    coordinates: pointSchema,
  },
  cropDetails: {
    cropName: { type: String, trim: true, maxlength: 80 },
    sowingDate: Date,
    acreage: { type: Number, min: 0, max: 100_000 },
    stage: { type: String, enum: ['Sowing', 'Vegetative', 'Flowering', 'Harvesting'] },
  },
  financials: {
    loanAmount: { type: Number, min: 0, default: 0 },
    dueDate: Date,
    lenderType: { type: String, enum: ['Bank', 'Cooperative', 'Moneylender', 'SHG', 'None'], default: 'None' },
    insured: { type: Boolean, default: false },
  },
  distressProfile: {
    riskScore: { type: Number, min: 0, max: 100, default: 0 },
    tier: { type: String, enum: ['Stable', 'Vulnerable', 'Critical'], default: 'Stable' },
    contributingFactors: { type: [String], default: [] },
    lastEvaluated: Date,
  },
}, { timestamps: true, strict: 'throw' });

farmerSchema.index({ 'location.coordinates': '2dsphere' });
farmerSchema.index({ 'location.state': 1, 'location.district': 1, 'distressProfile.tier': 1 });

module.exports = mongoose.model('Farmer', farmerSchema);
