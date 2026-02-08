const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'website_check',
  process.env.DB_USER || 'root',
  process.env.DB_PASS || '',
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'mysql',
    logging: false,
    timezone: '+08:00', // China Standard Time
    dialectOptions: {
      connectTimeout: 60000, // 60s timeout
    },
  }
);

module.exports = sequelize;
