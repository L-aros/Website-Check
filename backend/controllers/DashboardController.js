const { PageMonitor, ChangeHistory } = require('../models');
const { Op } = require('sequelize');

exports.getStats = async (req, res) => {
  try {
    const totalMonitors = await PageMonitor.count();
    const activeMonitors = await PageMonitor.count({ where: { status: 'active' } });
    
    // Get checks in last 24 hours
    const oneDayAgo = new Date(new Date() - 24 * 60 * 60 * 1000);
    const changesLast24h = await ChangeHistory.count({
      where: {
        checkTime: {
          [Op.gte]: oneDayAgo
        },
        changeType: {
            [Op.ne]: 'initial'
        }
      }
    });

    // Get attachment downloads count
    // This is a bit tricky with JSON column, but we can approximate or fetch recent
    const recentHistory = await ChangeHistory.findAll({
        where: {
            checkTime: { [Op.gte]: oneDayAgo }
        },
        attributes: ['attachments']
    });
    
    let downloadedFilesCount = 0;
    recentHistory.forEach(h => {
        if (h.attachments && Array.isArray(h.attachments)) {
            downloadedFilesCount += h.attachments.length;
        }
    });

    res.json({
      totalMonitors,
      activeMonitors,
      changesLast24h,
      downloadedFilesCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
