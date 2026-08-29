const mongoose = require('mongoose');

const escalationAlertSchema = new mongoose.Schema({
  farmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true, index: true },
  district: { type: String, required: true, trim: true, index: true },
  riskScore: { type: Number, required: true, min: 0, max: 100 },
  triggerReasons: { type: [String], default: [] },
  status: { type: String, enum: ['Pending', 'Assigned', 'Contacted', 'Resolved'], default: 'Pending', index: true },
  assignedOfficer: {
    name: { type: String, trim: true },
    phone: { type: String, match: /^[6-9]\d{9}$/ },
    department: { type: String, trim: true },
  },
  notes: { type: String, trim: true, maxlength: 2_000 },
}, { timestamps: true, strict: 'throw' });

escalationAlertSchema.index({ status: 1, createdAt: -1 });
escalationAlertSchema.index({ farmerId: 1, status: 1 });

module.exports = mongoose.model('EscalationAlert', escalationAlertSchema);
