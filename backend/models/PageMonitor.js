const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PageMonitor = sequelize.define('PageMonitor', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Friendly name for the monitor',
  },
  selector: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'CSS Selector or XPath',
  },
  selectorType: {
    type: DataTypes.ENUM('css', 'xpath'),
    defaultValue: 'css',
  },
  frequency: {
    type: DataTypes.STRING,
    defaultValue: '*/30 * * * *', // Default every 30 mins
    comment: 'Cron expression',
  },
  lastContentHash: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  lastCheckTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('active', 'paused', 'error'),
    defaultValue: 'active',
  },
  // Notification Config
  notifyEmail: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  notifySms: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  notifyFeishu: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  emailList: {
    type: DataTypes.TEXT, // Comma separated emails
    allowNull: true,
  },
  feishuWebhook: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  smsPhoneList: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Advanced Features
  saveHtml: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Save HTML snapshot on change',
  },
  downloadAttachments: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Automatically download attachments',
  },
  attachmentTypes: {
    type: DataTypes.STRING,
    defaultValue: 'pdf,doc,docx,xls,xlsx,zip,rar',
    comment: 'Comma separated extensions to download',
  },
  trackLinks: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Track link list changes on page',
  },
  linkScopeSelector: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'CSS selector scope used for extracting links; default uses selector',
  },
  downloadAttachmentsFromNewLinks: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Download attachments from newly added links',
  },
  lastLinksHash: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  baselineLinksProcessedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When existing link list has been processed for attachments',
  },
  matchType: {
    type: DataTypes.ENUM('none', 'keyword', 'regex'),
    defaultValue: 'none',
    comment: 'Only record change/notify when match is satisfied',
  },
  matchPattern: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Keyword or regex pattern',
  },
  matchIgnoreCase: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Ignore case for keyword/regex match',
  },
});

module.exports = PageMonitor;
