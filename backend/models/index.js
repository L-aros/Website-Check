const sequelize = require('../config/db');
const PageMonitor = require('./PageMonitor');
const ChangeHistory = require('./ChangeHistory');
const NotificationLog = require('./NotificationLog');
const AppSetting = require('./AppSetting');
const AttachmentMonitor = require('./AttachmentMonitor');
const AttachmentLog = require('./AttachmentLog');
const MonitorLink = require('./MonitorLink');
const { logger } = require('../utils/logger');

PageMonitor.hasMany(NotificationLog, { foreignKey: 'monitorId', onDelete: 'CASCADE', hooks: true });
NotificationLog.belongsTo(PageMonitor, { foreignKey: 'monitorId', onDelete: 'CASCADE' });

ChangeHistory.hasMany(NotificationLog, { foreignKey: 'changeHistoryId', onDelete: 'CASCADE', hooks: true });
NotificationLog.belongsTo(ChangeHistory, { foreignKey: 'changeHistoryId', onDelete: 'CASCADE' });

PageMonitor.hasMany(AttachmentMonitor, { foreignKey: 'monitorId', onDelete: 'CASCADE', hooks: true });
AttachmentMonitor.belongsTo(PageMonitor, { foreignKey: 'monitorId', onDelete: 'CASCADE' });

PageMonitor.hasMany(AttachmentLog, { foreignKey: 'monitorId', onDelete: 'CASCADE', hooks: true });
AttachmentLog.belongsTo(PageMonitor, { foreignKey: 'monitorId', onDelete: 'CASCADE' });

AttachmentMonitor.hasMany(AttachmentLog, { foreignKey: 'attachmentId', onDelete: 'CASCADE', hooks: true });
AttachmentLog.belongsTo(AttachmentMonitor, { foreignKey: 'attachmentId', onDelete: 'CASCADE' });

PageMonitor.hasMany(MonitorLink, { foreignKey: 'monitorId', onDelete: 'CASCADE', hooks: true });
MonitorLink.belongsTo(PageMonitor, { foreignKey: 'monitorId', onDelete: 'CASCADE' });

const syncDatabase = async () => {
  try {
    await sequelize.authenticate();
    logger.info({}, 'db_connected');
    
    const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();
    const isProd = nodeEnv === 'production';
    const parseBool = (v, defaultValue) => {
      const s = String(v ?? '').trim().toLowerCase();
      if (s === '') return defaultValue;
      if (s === 'true' || s === '1' || s === 'yes') return true;
      if (s === 'false' || s === '0' || s === 'no') return false;
      return defaultValue;
    };
    const dialect = String(process.env.DB_DIALECT || '').trim().toLowerCase();
    const syncAlterDefault = !isProd && dialect !== 'sqlite';
    const syncAlter = parseBool(process.env.DB_SYNC_ALTER, syncAlterDefault);
    const syncForce = parseBool(process.env.DB_SYNC_FORCE, false);
    if (syncForce) {
      await sequelize.sync({ force: true });
    } else if (syncAlter && !isProd) {
      await sequelize.sync({ alter: true });
    } else {
      await sequelize.sync();
    }
    logger.info({ syncAlter, syncForce, isProd }, 'db_synced');
    return true;
  } catch (error) {
    logger.error({ err: error }, 'db_connect_failed');
    return false;
  }
};

module.exports = {
  sequelize,
  PageMonitor,
  ChangeHistory,
  NotificationLog,
  AppSetting,
  AttachmentMonitor,
  AttachmentLog,
  MonitorLink,
  syncDatabase,
};
