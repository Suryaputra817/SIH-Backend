const crypto = require('crypto');

function authenticateAdmin(req, res, next) {
  const supplied = req.get('x-admin-api-key');
  const expected = process.env.ADMIN_API_KEY;
  if (!supplied || !expected || supplied.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return res.status(403).json({ error: 'Administrator credentials are required' });
  }
  next();
}

module.exports = { authenticateAdmin };
