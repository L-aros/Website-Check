const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AttachmentLog = sequelize.define('AttachmentLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  monitorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  attachmentId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  attachmentUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  level: {
    type: DataTypes.ENUM('error', 'warn', 'info', 'debug'),
    allowNull: false,
  },
  event: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  meta: {
    type: DataTypes.JSON,
    allowNull: true,
  },
});

module.exports = AttachmentLog;
