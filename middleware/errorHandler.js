function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(err);
  if (err.name === 'ValidationError' || err.isJoi) return res.status(400).json({ error: err.message });
  if (err.code === 11000) return res.status(409).json({ error: 'A record with that value already exists' });
  res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Internal server error' });
}

module.exports = { notFound, errorHandler };
