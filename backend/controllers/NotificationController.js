const { NotificationLog } = require('../models');

exports.getMonitorNotifications = async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;

    const logs = await NotificationLog.findAll({
      where: { monitorId: req.params.id },
      order: [['id', 'DESC']],
      limit,
    });

    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

