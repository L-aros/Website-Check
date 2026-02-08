const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { syncDatabase } = require('./models');
const monitorRoutes = require('./routes/monitorRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const authRoutes = require('./routes/authRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const { verifyToken } = require('./controllers/AuthController');
const schedulerService = require('./services/SchedulerService');
require('dotenv').config();
const { validateEnv } = require('./config/validateEnv');
const { logger } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  const requestId = String(req.headers['x-request-id'] || '').trim() || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  const start = Date.now();
  res.on('finish', () => {
    logger.info(
      {
        requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Date.now() - start,
      },
      'http_request'
    );
  });
  next();
});

// Static files
app.use('/storage', express.static(path.join(__dirname, 'storage')));
app.use('/api/storage', express.static(path.join(__dirname, 'storage')));

// Routes
app.use('/api/auth', authRoutes);
// Protect API routes
app.use('/api/monitors', verifyToken, monitorRoutes);
app.use('/api/dashboard', verifyToken, dashboardRoutes);
app.use('/api/settings', verifyToken, settingsRoutes);

// Serve frontend (production build) if available
const distDir = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// Start server
const startServer = async () => {
  validateEnv();
  app.listen(PORT, () => {
    logger.info({ port: PORT }, 'server_listening');
  });

  (async () => {
    const ok = await syncDatabase();
    if (!ok) return;
    try {
      await schedulerService.init();
    } catch (e) {
      logger.error({ err: e }, 'scheduler_init_failed');
    }
  })();
};

startServer();
