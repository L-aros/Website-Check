const express = require('express');
const router = express.Router();
const monitorController = require('../controllers/MonitorController');
const notificationController = require('../controllers/NotificationController');
const attachmentController = require('../controllers/AttachmentController');
const linkController = require('../controllers/LinkController');

router.post('/', monitorController.createMonitor);
router.get('/', monitorController.getAllMonitors);
router.get('/:id', monitorController.getMonitor);
router.put('/:id', monitorController.updateMonitor);
router.delete('/:id', monitorController.deleteMonitor);
router.get('/:id/history', monitorController.getHistory);
router.get('/:id/notifications', notificationController.getMonitorNotifications);
router.get('/:id/links', linkController.getLinks);
router.get('/:id/link-logs', linkController.getLinkLogs);
router.get('/:id/attachments', attachmentController.getAttachments);
router.get('/:id/attachment-logs', attachmentController.getAttachmentLogs);
router.post('/:id/check', monitorController.triggerCheck);

module.exports = router;
