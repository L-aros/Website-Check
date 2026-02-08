const express = require('express');
const cors = require('cors');
const path = require('path');
const { syncDatabase } = require('./models');
const monitorRoutes = require('./routes/monitorRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const authRoutes = require('./routes/authRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const { verifyToken } = require('./controllers/AuthController');
const schedulerService = require('./services/SchedulerService');
require('dotenv').config();
const { validateEnv } = require('./config/validateEnv');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Static files
app.use('/storage', express.static(path.join(__dirname, 'storage')));
app.use('/api/storage', express.static(path.join(__dirname, 'storage')));

// Routes
app.use('/api/auth', authRoutes);
// Protect API routes
app.use('/api/monitors', verifyToken, monitorRoutes);
app.use('/api/dashboard', verifyToken, dashboardRoutes);
app.use('/api/settings', verifyToken, settingsRoutes);

// Start server
const startServer = async () => {
  validateEnv();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

  (async () => {
    const ok = await syncDatabase();
    if (!ok) return;
    try {
      await schedulerService.init();
    } catch (e) {
      console.error('Scheduler init failed:', e);
    }
  })();
};

startServer();
