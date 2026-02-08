const { PageMonitor, ChangeHistory } = require('../models');
const schedulerService = require('../services/SchedulerService');
const monitorService = require('../services/MonitorService');

exports.createMonitor = async (req, res) => {
  try {
    const monitor = await PageMonitor.create(req.body);
    schedulerService.scheduleTask(monitor);
    res.status(201).json(monitor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllMonitors = async (req, res) => {
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
  try {
    const monitor = await PageMonitor.findByPk(req.params.id);
    if (!monitor) return res.status(404).json({ error: 'Monitor not found' });
    
    await monitor.update(req.body);
    schedulerService.refreshMonitor(monitor.id);
    
    res.json(monitor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteMonitor = async (req, res) => {
  try {
    const monitor = await PageMonitor.findByPk(req.params.id);
    if (!monitor) return res.status(404).json({ error: 'Monitor not found' });
    
    await monitor.destroy();
    schedulerService.stopTask(monitor.id);
    
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
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.triggerCheck = async (req, res) => {
    try {
        const monitor = await PageMonitor.findByPk(req.params.id);
        if (!monitor) return res.status(404).json({ error: 'Monitor not found' });
        
        // Run async without waiting
        schedulerService.runNow(monitor.id);
        
        res.json({ message: 'Check triggered successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
