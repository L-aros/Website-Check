const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const NotificationLog = sequelize.define('NotificationLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  monitorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  changeHistoryId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  channel: {
    type: DataTypes.ENUM('email', 'feishu', 'sms'),
    allowNull: false,
  },
  provider: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  recipient: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('success', 'failed'),
    allowNull: false,
  },
  requestId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  payloadPreview: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  sentAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

module.exports = NotificationLog;
