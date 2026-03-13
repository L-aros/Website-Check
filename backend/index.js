const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { syncDatabase } = require('./models');
const monitorRoutes = require('./routes/monitorRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const authRoutes = require('./routes/authRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const storageRoutes = require('./routes/storageRoutes');
const publicRoutes = require('./routes/publicRoutes');
const { verifyToken } = require('./controllers/AuthController');
const schedulerService = require('./services/SchedulerService');
require('dotenv').config();
const { validateEnv } = require('./config/validateEnv');
const { logger } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

const isProd = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';

const parseCorsOrigins = () => {
  const configured = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (configured.length > 0) return configured;
  if (isProd) return [];

  return [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
  ];
};

const allowedOrigins = new Set(parseCorsOrigins());

const corsOptions = {
  credentials: true,
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
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

app.use('/', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/monitors', verifyToken, monitorRoutes);
app.use('/api/dashboard', verifyToken, dashboardRoutes);
app.use('/api/settings', verifyToken, settingsRoutes);
app.use('/api/storage', storageRoutes);

const distDir = path.join(__dirname, '..', 'frontend', 'dist');
const shouldServeDist =
  fs.existsSync(distDir) &&
  (process.env.NODE_ENV === 'production' ||
    String(process.env.SERVE_FRONTEND || '')
      .trim()
      .toLowerCase() === 'true');

if (shouldServeDist) {
  app.use(
    '/assets',
    express.static(path.join(distDir, 'assets'), {
      immutable: true,
      maxAge: '365d',
    })
  );
  app.use(
    express.static(distDir, {
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(`${path.sep}index.html`)) {
          res.setHeader('Cache-Control', 'no-store');
          return;
        }
        res.setHeader('Cache-Control', 'no-cache');
      },
    })
  );
  app.get('/assets/*', (_req, res) => {
    res.status(404).end();
  });
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (
      /\.(?:js|css|map|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot)$/i.test(req.path)
    ) {
      res.status(404).end();
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

const startServer = async () => {
  validateEnv();
  const ok = await syncDatabase();
  if (!ok) {
    const err = new Error('Database initialization failed');
    err.code = 'DB_INIT_FAILED';
    throw err;
  }

  try {
    await schedulerService.init();
  } catch (error) {
    logger.error({ err: error }, 'scheduler_init_failed');
  }

  app.listen(PORT, () => {
    logger.info({ port: PORT }, 'server_listening');
  });
};

startServer().catch((error) => {
  logger.error({ err: error }, 'startup_failed');
  process.exit(1);
});
