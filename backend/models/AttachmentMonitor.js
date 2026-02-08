const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AttachmentMonitor = sequelize.define('AttachmentMonitor', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  monitorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  url: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  normalizedUrl: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  urlHash: {
    type: DataTypes.STRING(64),
    allowNull: false,
  },
  firstSeenAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  lastSeenAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  lastCheckedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('discovered', 'available', 'missing', 'error', 'filtered', 'ignored'),
    allowNull: false,
    defaultValue: 'discovered',
  },
  lastStatusAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  etag: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  lastModifiedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  contentLength: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  lastDownloadedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  lastError: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  indexes: [
    { unique: true, fields: ['monitorId', 'urlHash'] },
    { fields: ['monitorId', 'lastCheckedAt'] },
  ],
});

module.exports = AttachmentMonitor;
