const express = require('express');
const { authenticate } = require('../middleware/auth');
const controller = require('../controllers/farmer.controller');

const router = express.Router();
router.use(authenticate);
router.post('/onboard', controller.onboard);
router.get('/profile', controller.profile);
router.get('/dashboard', controller.dashboard);
router.post('/trigger-risk-eval', controller.triggerRiskEval);

module.exports = router;
