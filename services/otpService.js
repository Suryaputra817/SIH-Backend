const crypto = require('crypto');
const cache = require('./cacheService');

const otpTtl = Number(process.env.OTP_TTL_SECONDS || 300);
const maxAttempts = Number(process.env.OTP_MAX_ATTEMPTS || 5);
const requestLimit = Number(process.env.OTP_REQUEST_LIMIT || 3);
const requestWindow = Number(process.env.OTP_REQUEST_WINDOW_SECONDS || 600);

const keyFor = (phone) => `otp:${phone}`;
const rateKeysFor = (phone, ip) => [`otp-rate:phone:${phone}`, `otp-rate:ip:${ip}`];

function generateOtp() {
  return crypto.randomInt(100_000, 1_000_000).toString();
}

async function canRequest(phone, ip) {
  const now = Date.now();
  const entries = await Promise.all(rateKeysFor(phone, ip).map(async (key) => ({ key, requests: (await cache.get(key)) || [] })));
  const liveEntries = entries.map(({ key, requests }) => ({ key, requests: requests.filter((time) => now - time < requestWindow * 1000) }));
  if (liveEntries.some(({ requests }) => requests.length >= requestLimit)) return false;
  await Promise.all(liveEntries.map(({ key, requests }) => cache.set(key, [...requests, now], requestWindow)));
  return true;
}

async function issueOtp(phone, ip) {
  if (!(await canRequest(phone, ip))) {
    const error = new Error('Too many OTP requests. Please try again later.');
    error.statusCode = 429;
    throw error;
  }
  const otp = generateOtp();
  // Storing only a hash means a cache dump cannot be used to authenticate.
  const hash = crypto.createHash('sha256').update(`${phone}:${otp}`).digest('hex');
  await cache.set(keyFor(phone), { hash, attempts: 0 }, otpTtl);
  return otp;
}

async function verifyOtp(phone, otp) {
  const submitted = crypto.createHash('sha256').update(`${phone}:${otp}`).digest('hex');
  return (await cache.compareAndConsumeOtp(keyFor(phone), submitted, maxAttempts)) === 1;
}

async function revokeOtp(phone) { await cache.del(keyFor(phone)); }

async function sendSms(phone, otp) {
  if (process.env.FAST2SMS_ENABLED !== 'true' || !process.env.FAST2SMS_API_KEY) {
    if (process.env.NODE_ENV !== 'production') console.info(`[sandbox OTP] ${phone}: ${otp}`);
    return { provider: 'sandbox' };
  }
  const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'POST',
    headers: { authorization: process.env.FAST2SMS_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ route: 'q', message: `Your Smart Crop Advisory OTP is ${otp}. It expires in 5 minutes.`, language: 'english', numbers: phone }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Fast2SMS returned HTTP ${response.status}`);
  const body = await response.json();
  if (body.return === false) throw new Error(body.message || 'Fast2SMS rejected OTP request');
  return { provider: 'fast2sms' };
}

module.exports = { issueOtp, verifyOtp, revokeOtp, sendSms };
