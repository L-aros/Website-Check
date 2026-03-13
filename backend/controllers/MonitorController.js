const {
  sequelize,
  PageMonitor,
  ChangeHistory,
  AttachmentMonitor,
  AttachmentLog,
  MonitorLink,
} = require('../models');
const schedulerService = require('../services/SchedulerService');
const { signDownloadToken } = require('../utils/downloadToken');
const {
  findHistoryRecord,
  getSanitizedSnapshotPayload,
  resolveHistoryScreenshot,
} = require('../services/HistoryAssetService');
const { deleteMonitor: deleteMonitorWithCleanup } = require('../services/MonitorCleanupService');

const EDITABLE_FIELDS = new Set([
  'url',
  'name',
  'selector',
  'selectorType',
  'frequency',
  'status',
  'notifyEmail',
  'notifySms',
  'notifyFeishu',
  'emailList',
  'feishuWebhook',
  'smsPhoneList',
  'saveHtml',
  'downloadAttachments',
  'attachmentTypes',
  'trackLinks',
  'linkScopeSelector',
  'downloadAttachmentsFromNewLinks',
  'matchType',
  'matchPattern',
  'matchIgnoreCase',
]);

const BOOLEAN_FIELDS = new Set([
  'notifyEmail',
  'notifySms',
  'notifyFeishu',
  'saveHtml',
  'downloadAttachments',
  'trackLinks',
  'downloadAttachmentsFromNewLinks',
  'matchIgnoreCase',
]);

const RESET_BASELINE_FIELDS = [
  'url',
  'selector',
  'selectorType',
  'trackLinks',
  'linkScopeSelector',
  'downloadAttachmentsFromNewLinks',
  'attachmentTypes',
  'matchType',
  'matchPattern',
  'matchIgnoreCase',
];

const toBoolean = (value) => value === true || value === 'true' || value === 1 || value === '1';

const normalizeText = (value, fallback = null) => {
  const normalized = String(value || '').trim();
  return normalized || fallback;
};

const normalizeAttachmentTypes = (value) => {
  const parts = String(value || '')
    .split(',')
    .map((part) => String(part || '').trim().toLowerCase().replace(/^\./, ''))
    .filter(Boolean);
  return Array.from(new Set(parts)).join(',');
};

const normalizeMonitorPayload = (input, { isCreate = false } = {}) => {
  const payload = {};
  const source = input || {};

  for (const field of EDITABLE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(source, field)) continue;
    const value = source[field];

    if (BOOLEAN_FIELDS.has(field)) {
      payload[field] = toBoolean(value);
      continue;
    }

    if (field === 'selectorType') {
      const selectorType = normalizeText(value, 'css');
      payload.selectorType = selectorType === 'xpath' ? 'xpath' : 'css';
      continue;
    }

    if (field === 'status') {
      const status = normalizeText(value, isCreate ? 'active' : null);
      if (status === 'active' || status === 'paused') {
        payload.status = status;
      }
      continue;
    }

    if (field === 'matchType') {
      const matchType = normalizeText(value, 'none');
      payload.matchType =
        matchType === 'keyword' || matchType === 'regex' ? matchType : 'none';
      continue;
    }

    if (field === 'attachmentTypes') {
      payload.attachmentTypes = normalizeAttachmentTypes(value);
      continue;
    }

    if (field === 'linkScopeSelector' || field === 'matchPattern') {
      payload[field] = normalizeText(value);
      continue;
    }

    payload[field] = typeof value === 'string' ? value.trim() : value;
  }

  if (payload.matchType === 'none') {
    payload.matchPattern = null;
  }

  return payload;
};

const comparableValue = (value, field) => {
  if (field === 'attachmentTypes') return normalizeAttachmentTypes(value);
  if (BOOLEAN_FIELDS.has(field)) return Boolean(value);
  return value == null ? null : String(value);
};

const shouldResetBaseline = (monitor, payload) =>
  RESET_BASELINE_FIELDS.some((field) => {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) return false;
    return comparableValue(monitor[field], field) !== comparableValue(payload[field], field);
  });

const withDownloadUrls = (monitorId, row) => {
  const value = row.toJSON ? row.toJSON() : row;
  const attachments = Array.isArray(value.attachments) ? value.attachments : null;
  const item = {
    ...value,
    hasScreenshot: Boolean(value.screenshotPath),
    screenshotUrl: value.screenshotPath
      ? `/api/monitors/${monitorId}/history/${value.id}/screenshot`
      : '',
    hasSnapshot: Boolean(value.htmlPath),
    snapshotUrl: value.htmlPath
      ? `/api/monitors/${monitorId}/history/${value.id}/snapshot`
      : '',
  };

  delete item.screenshotPath;
  delete item.htmlPath;

  if (!attachments || attachments.length === 0) return item;

  item.attachments = attachments.map((file) => {
    const fileName = String(file.name || '');
    const storedPath = String(file.path || '');
    const token = signDownloadToken({ path: storedPath, name: fileName }, 300);
    const rest = { ...file };
    delete rest.path;
    return {
      ...rest,
      downloadUrl: token ? `/d/${encodeURIComponent(token)}` : '',
    };
  });

  return item;
};

const getErrorStatus = (error) => {
  if (!error) return 500;
  if (
    error.name === 'SequelizeValidationError' ||
    error.name === 'SequelizeUniqueConstraintError'
  ) {
    return 400;
  }
  return 500;
};

const resetMonitorTrackingState = async (monitorId, transaction) => {
  await AttachmentLog.destroy({ where: { monitorId }, transaction });
  await AttachmentMonitor.destroy({ where: { monitorId }, transaction });
  await MonitorLink.destroy({ where: { monitorId }, transaction });
};

exports.createMonitor = async (req, res) => {
  try {
    const payload = normalizeMonitorPayload(req.body, { isCreate: true });
    const monitor = await PageMonitor.create(payload);
    schedulerService.scheduleTask(monitor);
    res.status(201).json(monitor);
  } catch (error) {
    res.status(getErrorStatus(error)).json({ error: error.message });
  }
};

exports.getAllMonitors = async (_req, res) => {
  try {
    const monitors = await PageMonitor.findAll();
    res.json(monitors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getMonitor = async (req, res) => {
  try {
    const monitor = await PageMonitor.findByPk(req.params.id);
    if (!monitor) return res.status(404).json({ error: 'Monitor not found' });
    res.json(monitor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateMonitor = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const monitor = await PageMonitor.findByPk(req.params.id, { transaction });
    if (!monitor) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Monitor not found' });
    }

    const payload = normalizeMonitorPayload(req.body);
    const resetBaseline = shouldResetBaseline(monitor, payload);

    if (resetBaseline) {
      payload.lastContentHash = null;
      payload.lastLinksHash = null;
      payload.baselineLinksProcessedAt = null;
      payload.lastCheckTime = null;
      await resetMonitorTrackingState(monitor.id, transaction);
    }

    await monitor.update(payload, { transaction });
    await transaction.commit();

    await schedulerService.refreshMonitor(monitor.id);

    res.json(monitor);
  } catch (error) {
    await transaction.rollback();
    res.status(getErrorStatus(error)).json({ error: error.message });
  }
};

exports.deleteMonitor = async (req, res) => {
  try {
    const result = await deleteMonitorWithCleanup(req.params.id);
    if (!result.deleted) return res.status(404).json({ error: 'Monitor not found' });

    schedulerService.stopTask(Number(req.params.id));
    res.json({ message: 'Monitor deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const history = await ChangeHistory.findAll({
      where: { monitorId: req.params.id },
      order: [['checkTime', 'DESC']],
      limit: 50,
    });
    res.json(history.map((row) => withDownloadUrls(req.params.id, row)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getHistoryScreenshot = async (req, res) => {
  try {
    const history = await findHistoryRecord(req.params.id, req.params.historyId);
    if (!history) return res.status(404).json({ error: 'History not found' });

    const resolved = resolveHistoryScreenshot(history);
    if (!resolved) return res.status(404).json({ error: 'Screenshot not found' });

    res.setHeader('Cache-Control', 'no-store');
    return res.sendFile(resolved.filePath);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.getHistorySnapshot = async (req, res) => {
  try {
    const history = await findHistoryRecord(req.params.id, req.params.historyId);
    if (!history) return res.status(404).json({ error: 'History not found' });

    const payload = await getSanitizedSnapshotPayload(history);
    if (!payload) return res.status(404).json({ error: 'Snapshot not found' });

    res.setHeader('Cache-Control', 'no-store');
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.triggerCheck = async (req, res) => {
  try {
    const monitor = await PageMonitor.findByPk(req.params.id);
    if (!monitor) return res.status(404).json({ error: 'Monitor not found' });
    if (monitor.status !== 'active') {
      return res.status(409).json({ error: 'Only active monitors can be queued' });
    }

    const queued = await schedulerService.runNow(monitor.id);
    return res.json({
      queued,
      reason: queued ? undefined : 'already_pending',
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
