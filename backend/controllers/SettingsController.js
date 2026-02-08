const settingsService = require('../services/SettingsService');

exports.getSettings = async (req, res) => {
  try {
    const settings = await settingsService.getAll();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const settings = await settingsService.update(req.body || {});
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

