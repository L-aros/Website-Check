const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const PageMonitor = require('./PageMonitor');

const ChangeHistory = sequelize.define('ChangeHistory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  monitorId: {
    type: DataTypes.INTEGER,
    references: {
      model: PageMonitor,
      key: 'id',
    },
    allowNull: false,
  },
  checkTime: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  contentPreview: {
    type: DataTypes.TEXT,
    comment: 'Snippet of the content that changed',
  },
  changeType: {
    type: DataTypes.ENUM('new', 'update', 'delete', 'initial'),
    defaultValue: 'update',
  },
  // New Fields
  screenshotPath: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Path to the screenshot file',
  },
  htmlPath: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Path to the HTML snapshot file',
  },
  attachments: {
    type: DataTypes.JSON, // Use JSON to store list of downloaded files
    allowNull: true,
    comment: 'List of downloaded attachments [{name, path, size}]',
  },
});

// Define association
PageMonitor.hasMany(ChangeHistory, { foreignKey: 'monitorId' });
ChangeHistory.belongsTo(PageMonitor, { foreignKey: 'monitorId' });

module.exports = ChangeHistory;
