const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/DashboardController');
const downloadController = require('../controllers/DownloadController');

router.get('/stats', dashboardController.getStats);
router.get('/downloads', downloadController.listDownloads);

module.exports = router;
