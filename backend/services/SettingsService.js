const { AppSetting } = require('../models');

const DEFAULTS = {
  autoDownloadAttachmentsFromNewLinks: false,
  attachmentDateAfter: '',
  attachmentLogLevel: 'info',
  maxNewLinksPerCheck: 20,
};

const toBool = (v) => v === true || v === 'true' || v === 1 || v === '1';
const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

class SettingsService {
  constructor() {
    this.cache = null;
    this.cacheAt = 0;
    this.ttlMs = 30_000;
  }

  async getAll() {
    const now = Date.now();
    if (this.cache && now - this.cacheAt < this.ttlMs) return this.cache;

    const rows = await AppSetting.findAll();
    const map = {};
    for (const r of rows) map[r.key] = r.value;

    const legacyAutoDiscover = toBool(map.autoDiscoverAttachmentsOnFirstCheck);
    const autoDownloadFromNewLinksRaw = typeof map.autoDownloadAttachmentsFromNewLinks === 'undefined'
      ? legacyAutoDiscover
      : toBool(map.autoDownloadAttachmentsFromNewLinks);

    const maxNewLinksRaw = toInt(map.maxNewLinksPerCheck);
    const maxNewLinksPerCheck = maxNewLinksRaw === null ? DEFAULTS.maxNewLinksPerCheck : Math.min(Math.max(maxNewLinksRaw, 0), 500);

    const settings = {
      autoDownloadAttachmentsFromNewLinks: autoDownloadFromNewLinksRaw ?? DEFAULTS.autoDownloadAttachmentsFromNewLinks,
      attachmentDateAfter: (map.attachmentDateAfter ?? DEFAULTS.attachmentDateAfter) || '',
      attachmentLogLevel: (map.attachmentLogLevel ?? DEFAULTS.attachmentLogLevel) || 'info',
      maxNewLinksPerCheck,
    };

    this.cache = settings;
    this.cacheAt = now;
    return settings;
  }

  async update(partial) {
    const updates = {};
    if (typeof partial.autoDownloadAttachmentsFromNewLinks !== 'undefined') {
      updates.autoDownloadAttachmentsFromNewLinks = String(Boolean(partial.autoDownloadAttachmentsFromNewLinks));
    }
    if (typeof partial.attachmentDateAfter !== 'undefined') {
      updates.attachmentDateAfter = String(partial.attachmentDateAfter || '');
    }
    if (typeof partial.attachmentLogLevel !== 'undefined') {
      updates.attachmentLogLevel = String(partial.attachmentLogLevel || 'info');
    }
    if (typeof partial.maxNewLinksPerCheck !== 'undefined') {
      const n = toInt(partial.maxNewLinksPerCheck);
      updates.maxNewLinksPerCheck = String(n === null ? DEFAULTS.maxNewLinksPerCheck : Math.min(Math.max(n, 0), 500));
    }

    const entries = Object.entries(updates);
    for (const [key, value] of entries) {
      await AppSetting.upsert({ key, value });
    }

    this.cache = null;
    this.cacheAt = 0;
    return this.getAll();
  }
}

module.exports = new SettingsService();
