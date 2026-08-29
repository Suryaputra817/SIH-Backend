const { createClient } = require('redis');

const memory = new Map();
let redisClient;
let redisReady = false;

function pruneMemory() {
  const now = Date.now();
  for (const [key, item] of memory) if (item.expiresAt <= now) memory.delete(key);
}

async function initCache() {
  if (!process.env.REDIS_URL) return;
  try {
    redisClient = createClient({ url: process.env.REDIS_URL, socket: { reconnectStrategy: false } });
    redisClient.on('error', (error) => console.warn('Redis unavailable; using in-memory cache:', error.message));
    await redisClient.connect();
    redisReady = true;
    console.log('Redis cache connected');
  } catch (error) {
    redisReady = false;
    console.warn('Redis connection failed; using in-memory cache:', error.message);
  }
}

async function get(key) {
  if (redisReady) {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  }
  pruneMemory();
  return memory.get(key)?.value ?? null;
}

async function set(key, value, ttlSeconds) {
  if (redisReady) return redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
  memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

async function del(key) {
  if (redisReady) return redisClient.del(key);
  memory.delete(key);
}

// Returns 1 when consumed, -1 for a bad attempt, and 0 for an expired/locked OTP.
// Redis executes this script atomically, preserving the single-use guarantee across API instances.
async function compareAndConsumeOtp(key, submittedHash, maximumAttempts) {
  if (redisReady) {
    const result = await redisClient.eval(`
      local raw = redis.call('GET', KEYS[1])
      if not raw then return 0 end
      local record = cjson.decode(raw)
      if record.attempts >= tonumber(ARGV[2]) then return 0 end
      if record.hash == ARGV[1] then redis.call('DEL', KEYS[1]); return 1 end
      record.attempts = record.attempts + 1
      local ttl = redis.call('TTL', KEYS[1])
      if ttl > 0 then redis.call('SET', KEYS[1], cjson.encode(record), 'EX', ttl) end
      return -1
    `, { keys: [key], arguments: [submittedHash, String(maximumAttempts)] });
    return Number(result);
  }
  pruneMemory();
  const item = memory.get(key);
  if (!item || item.value.attempts >= maximumAttempts) return 0;
  const expected = Buffer.from(item.value.hash);
  const received = Buffer.from(submittedHash);
  if (expected.length === received.length && require('crypto').timingSafeEqual(expected, received)) {
    memory.delete(key);
    return 1;
  }
  item.value.attempts += 1; // Keep the original expiry; failed attempts must not extend an OTP's lifetime.
  return -1;
}

module.exports = { initCache, get, set, del, compareAndConsumeOtp };
