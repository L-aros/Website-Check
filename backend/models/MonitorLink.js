const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const MonitorLink = sequelize.define('MonitorLink', {
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
}, {
  indexes: [
    { unique: true, fields: ['monitorId', 'urlHash'] },
    { fields: ['monitorId', 'lastSeenAt'] },
  ],
});

module.exports = MonitorLink;

