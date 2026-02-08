const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AppSetting = sequelize.define('AppSetting', {
  key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
});

module.exports = AppSetting;
