const { Sequelize } = require('sequelize');
require('dotenv').config();

const dialect = String(process.env.DB_DIALECT || 'mysql').trim().toLowerCase();

const sequelize =
  dialect === 'sqlite'
    ? new Sequelize({
        dialect: 'sqlite',
        storage: process.env.DB_STORAGE || './data/website_check.sqlite',
        logging: false,
      })
    : new Sequelize(process.env.DB_NAME || 'website_check', process.env.DB_USER || 'root', process.env.DB_PASS || '', {
        host: process.env.DB_HOST || 'localhost',
        dialect: 'mysql',
        logging: false,
        timezone: '+08:00',
        dialectOptions: {
          connectTimeout: 60000,
        },
      });

module.exports = sequelize;
