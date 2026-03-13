const path = require('path');
const {
  sequelize,
  PageMonitor,
  ChangeHistory,
  NotificationLog,
  AttachmentMonitor,
  AttachmentLog,
  MonitorLink,
} = require('../models');
const { deleteFileIfExists, resolveStorageFilePath } = require('../utils/storageFiles');
const { logger } = require('../utils/logger');

const log = logger.child({ module: 'MonitorCleanupService' });
const storageRoot = path.join(__dirname, '..', 'storage');

const collectStoredFiles = (histories) => {
  const files = [];

  for (const history of histories) {
    if (history.screenshotPath) {
      const resolved = resolveStorageFilePath(path.join(storageRoot, 'screenshots'), history.screenshotPath);
      if (resolved) files.push(resolved.filePath);
    }

    if (history.htmlPath) {
      const resolved = resolveStorageFilePath(path.join(storageRoot, 'archives'), history.htmlPath);
      if (resolved) files.push(resolved.filePath);
    }

    const attachments = Array.isArray(history.attachments) ? history.attachments : [];
    for (const attachment of attachments) {
      const resolved = resolveStorageFilePath(
        path.join(storageRoot, 'downloads'),
        attachment && attachment.path
      );
      if (resolved) files.push(resolved.filePath);
    }
  }

  return Array.from(new Set(files));
};

const deleteMonitor = async (monitorId) => {
  const transaction = await sequelize.transaction();

  try {
    const monitor = await PageMonitor.findByPk(monitorId, { transaction });
    if (!monitor) {
      await transaction.rollback();
      return { deleted: false };
    }

    const histories = await ChangeHistory.findAll({
      where: { monitorId },
      attributes: ['id', 'screenshotPath', 'htmlPath', 'attachments'],
      transaction,
    });

    const filesToDelete = collectStoredFiles(histories);

    await NotificationLog.destroy({ where: { monitorId }, transaction });
    await AttachmentLog.destroy({ where: { monitorId }, transaction });
    await AttachmentMonitor.destroy({ where: { monitorId }, transaction });
    await MonitorLink.destroy({ where: { monitorId }, transaction });
    await ChangeHistory.destroy({ where: { monitorId }, transaction });
    await monitor.destroy({ transaction });

    await transaction.commit();

    for (const filePath of filesToDelete) {
      try {
        await deleteFileIfExists(filePath);
      } catch (error) {
        log.warn({ err: error, monitorId, filePath }, 'monitor_file_cleanup_failed');
      }
    }

    return { deleted: true };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = { deleteMonitor };
