const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Authentication token is required' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (_) {
    return res.status(401).json({ error: 'Invalid or expired authentication token' });
  }
}

module.exports = { authenticate };
