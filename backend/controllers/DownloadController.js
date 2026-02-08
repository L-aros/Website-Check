const { ChangeHistory, PageMonitor } = require('../models');
const { Op } = require('sequelize');

exports.listDownloads = async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 200;

    const q = (req.query.q || '').trim().toLowerCase();
    const ext = (req.query.ext || '').trim().toLowerCase();
    const monitorId = req.query.monitorId ? Number(req.query.monitorId) : null;

    const where = {};
    if (monitorId) where.monitorId = monitorId;

    const rows = await ChangeHistory.findAll({
      where,
      order: [['checkTime', 'DESC']],
      limit,
      include: [{ model: PageMonitor, attributes: ['id', 'name', 'url', 'attachmentTypes'] }],
      attributes: ['id', 'monitorId', 'checkTime', 'attachments'],
    });

    const items = [];
    for (const row of rows) {
      const attachments = row.attachments;
      if (!attachments || !Array.isArray(attachments) || attachments.length === 0) continue;

      for (const f of attachments) {
        const fileName = String(f.name || '');
        const storedPath = String(f.path || '');
        if (!storedPath) continue;

        if (q && !fileName.toLowerCase().includes(q) && !storedPath.toLowerCase().includes(q)) continue;
        if (ext) {
          const dotExt = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
          if (dotExt !== ext.replace('.', '')) continue;
        }
        if (row.PageMonitor && row.PageMonitor.attachmentTypes) {
          const allowSet = new Set(String(row.PageMonitor.attachmentTypes).split(',').map((s) => s.trim().toLowerCase().replace('.', '')).filter(Boolean));
          const dotExt = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
          if (dotExt && allowSet.size > 0 && !allowSet.has(dotExt)) continue;
        }

        items.push({
          monitorId: row.monitorId,
          monitorName: row.PageMonitor ? (row.PageMonitor.name || '') : '',
          monitorUrl: row.PageMonitor ? (row.PageMonitor.url || '') : '',
          changeHistoryId: row.id,
          checkTime: row.checkTime,
          fileName,
          storedPath,
          size: Number(f.size) || null,
          sourceLink: f.sourceLink || null,
          sourceTitle: f.sourceTitle || null,
          downloadUrl: `/api/storage/downloads/${encodeURIComponent(storedPath)}`,
        });
      }
    }

    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
