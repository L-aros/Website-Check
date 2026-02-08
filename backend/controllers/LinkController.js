const { MonitorLink, AttachmentLog } = require('../models');

const LEVELS = ['error', 'warn', 'info', 'debug'];

exports.getLinks = async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 2000) : 2000;

    const rows = await MonitorLink.findAll({
      where: { monitorId: req.params.id },
      order: [['lastSeenAt', 'DESC']],
      limit,
    });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getLinkLogs = async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200;
    const minLevel = String(req.query.minLevel || '').trim().toLowerCase();

    let allowed = LEVELS;
    if (minLevel && LEVELS.includes(minLevel)) {
      allowed = LEVELS.slice(0, LEVELS.indexOf(minLevel) + 1);
    }

    const rows = await AttachmentLog.findAll({
      where: {
        monitorId: req.params.id,
        level: allowed,
        attachmentId: null,
      },
      order: [['id', 'DESC']],
      limit,
    });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

