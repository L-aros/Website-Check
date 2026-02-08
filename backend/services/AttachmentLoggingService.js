const { AttachmentLog } = require('../models');
const settingsService = require('./SettingsService');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

class AttachmentLoggingService {
  levelValue(level) {
    return LEVELS[level] ?? LEVELS.info;
  }

  async shouldRecord(level) {
    const settings = await settingsService.getAll();
    const threshold = this.levelValue(settings.attachmentLogLevel);
    return this.levelValue(level) <= threshold;
  }

  async log({ monitorId, attachmentId = null, attachmentUrl = null, level = 'info', event, message, meta = null }) {
    const record = await this.shouldRecord(level);
    if (!record) return;

    try {
      await AttachmentLog.create({
        monitorId,
        attachmentId,
        attachmentUrl,
        level,
        event,
        message,
        meta,
      });
    } catch {
      return;
    }
  }
}

module.exports = new AttachmentLoggingService();

