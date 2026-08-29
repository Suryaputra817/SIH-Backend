const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/auth.controller');

const router = express.Router();
const otpLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many authentication requests. Please try again later.' } });

router.post('/send-otp', otpLimiter, controller.sendOtp);
router.post('/verify-otp', otpLimiter, controller.verifyOtp);

module.exports = router;
