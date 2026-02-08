const { AttachmentMonitor, AttachmentLog } = require('../models');

const LEVELS = ['error', 'warn', 'info', 'debug'];

exports.getAttachments = async (req, res) => {
  try {
    const rows = await AttachmentMonitor.findAll({
      where: { monitorId: req.params.id },
      order: [['id', 'DESC']],
    });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAttachmentLogs = async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200;
    const minLevel = String(req.query.minLevel || '').trim().toLowerCase();
    const attachmentId = req.query.attachmentId ? Number(req.query.attachmentId) : null;

    let allowed = LEVELS;
    if (minLevel && LEVELS.includes(minLevel)) {
      allowed = LEVELS.slice(0, LEVELS.indexOf(minLevel) + 1);
    }

    const where = { monitorId: req.params.id, level: allowed };
    if (attachmentId) where.attachmentId = attachmentId;

    const rows = await AttachmentLog.findAll({
      where,
      order: [['id', 'DESC']],
      limit,
    });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

