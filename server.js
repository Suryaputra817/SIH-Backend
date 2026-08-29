require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { connectDatabase } = require('./config/db');
const { initCache } = require('./services/cacheService');
const { startRiskScheduler } = require('./services/riskEvaluationService');
const authRoutes = require('./routes/auth.routes');
const farmerRoutes = require('./routes/farmer.routes');
const adminRoutes = require('./routes/admin.routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

function buildApp() {
  const app = express();
  const origins = (process.env.CORS_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean);
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: origins.length ? origins : false, methods: ['GET', 'POST', 'PATCH'], allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-API-Key'] }));
  app.use(express.json({ limit: '32kb' }));
  app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/farmer', farmerRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

async function start() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');
  await connectDatabase();
  await initCache();
  startRiskScheduler();
  const port = Number(process.env.PORT || 5000);
  buildApp().listen(port, () => console.log(`Smart Crop Advisory API listening on port ${port}`));
}

if (require.main === module) start().catch((error) => { console.error('Startup failed:', error.message); process.exit(1); });

module.exports = { buildApp, start };
