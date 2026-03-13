const puppeteer = require('puppeteer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { PageMonitor, ChangeHistory, AttachmentMonitor, MonitorLink } = require('../models');
const { Op } = require('sequelize');
const notificationService = require('./NotificationService');
const settingsService = require('./SettingsService');
const attachmentLoggingService = require('./AttachmentLoggingService');
const { logger } = require('../utils/logger');

class MonitorService {
  constructor() {
    this.log = logger.child({ module: 'MonitorService' });
  }

  resolveBrowserExecutablePath() {
    const configured = String(process.env.PUPPETEER_EXECUTABLE_PATH || '').trim();
    if (configured && fs.existsSync(configured)) return configured;

    const platform = process.platform;
    const candidates = [];

    if (platform === 'win32') {
      const localAppData = String(process.env.LOCALAPPDATA || '').trim();
      candidates.push(
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
      );
      if (localAppData) {
        candidates.push(
          path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
          path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
        );
      }
    } else if (platform === 'darwin') {
      candidates.push(
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/Applications/Chromium.app/Contents/MacOS/Chromium'
      );
    } else {
      candidates.push(
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/snap/bin/chromium'
      );
    }

    for (const candidate of candidates) {
      if (candidate && fs.existsSync(candidate)) return candidate;
    }

    try {
      const managed = puppeteer.executablePath();
      if (managed && fs.existsSync(managed)) return managed;
    } catch {}

    return '';
  }

  escapeHtmlAttr(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  injectBaseHref(html, baseHref) {
    const safe = this.escapeHtmlAttr(baseHref);
    if (!html || !safe) return html;

    const baseTag = `<base href="${safe}">`;
    if (/<base\b/i.test(html)) {
      return html.replace(/<base\b[^>]*>/i, baseTag);
    }
    if (/<head\b[^>]*>/i.test(html)) {
      return html.replace(/<head\b[^>]*>/i, (m) => `${m}\n${baseTag}`);
    }
    if (/<html\b[^>]*>/i.test(html)) {
      return html.replace(/<html\b[^>]*>/i, (m) => `${m}\n<head>\n${baseTag}\n</head>`);
    }
    return `<head>\n${baseTag}\n</head>\n${html}`;
  }

  normalizeExtensions(exts) {
    const set = new Set();
    for (const e of exts || []) {
      const v = String(e || '').trim().toLowerCase().replace('.', '');
      if (v) set.add(v);
    }
    return set;
  }

  getUrlExtension(url) {
    try {
      const u = new URL(url);
      return path.extname(u.pathname || '').replace('.', '').toLowerCase();
    } catch {
      return path.extname(String(url || '')).replace('.', '').toLowerCase();
    }
  }

  getUrlFileName(url) {
    try {
      const u = new URL(url);
      return decodeURIComponent(path.basename(u.pathname || ''));
    } catch {
      return path.basename(String(url || ''));
    }
  }

  normalizeUrl(raw) {
    try {
      const u = new URL(raw);
      u.hash = '';
      const entries = Array.from(u.searchParams.entries()).sort(([a], [b]) => a.localeCompare(b));
      u.search = '';
      for (const [k, v] of entries) u.searchParams.append(k, v);
      return u.toString();
    } catch {
      return '';
    }
  }

  urlHash(normalizedUrl) {
    return crypto.createHash('sha256').update(normalizedUrl).digest('hex');
  }

  getHeader(headers, name) {
    if (!headers || !name) return '';
    const lowered = String(name).toLowerCase();
    const key = Object.keys(headers).find((item) => String(item).toLowerCase() === lowered);
    return key ? String(headers[key] || '') : '';
  }

  getExtensionFromName(name) {
    const ext = path.extname(String(name || '')).replace('.', '').toLowerCase();
    return ext || '';
  }

  extensionFromContentType(contentType) {
    const normalized = String(contentType || '').split(';')[0].trim().toLowerCase();
    const map = {
      'application/pdf': 'pdf',
      'application/zip': 'zip',
      'application/x-zip-compressed': 'zip',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.ms-powerpoint': 'ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'text/csv': 'csv',
      'text/plain': 'txt',
      'application/vnd.rar': 'rar',
      'application/x-rar-compressed': 'rar',
      'application/x-7z-compressed': '7z',
      'application/gzip': 'gz',
      'application/x-gzip': 'gz',
      'application/x-tar': 'tar',
    };
    return map[normalized] || '';
  }

  isHtmlLikeResponse(headers) {
    const contentType = this.getHeader(headers, 'content-type').toLowerCase();
    return contentType.includes('text/html') || contentType.includes('application/xhtml+xml');
  }

  parseContentDispositionFilename(headerValue) {
    const header = String(headerValue || '');
    if (!header) return '';

    const starMatch = header.match(/filename\*=([^']*)''([^;]+)/i);
    if (starMatch && starMatch[2]) {
      try {
        return decodeURIComponent(starMatch[2]);
      } catch {
        return starMatch[2];
      }
    }

    const quotedMatch = header.match(/filename="([^"]+)"/i);
    if (quotedMatch && quotedMatch[1]) return quotedMatch[1];

    const plainMatch = header.match(/filename=([^;]+)/i);
    if (plainMatch && plainMatch[1]) return plainMatch[1].trim();

    return '';
  }

  sanitizeFileName(name, urlHash, extension) {
    const raw = String(name || '').replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '_').trim();
    const normalizedExt = String(extension || '').trim().toLowerCase().replace(/^\./, '');
    const fallbackBase = `download-${String(urlHash || '').slice(0, 12) || 'file'}`;

    let stem = raw.replace(/[. ]+$/g, '');
    if (!stem) stem = fallbackBase;

    let ext = this.getExtensionFromName(stem);
    if (!ext && normalizedExt) {
      stem = `${stem}.${normalizedExt}`;
      ext = normalizedExt;
    }

    if (!ext && normalizedExt) ext = normalizedExt;
    const parsed = path.parse(stem);
    const safeBase = String(parsed.name || fallbackBase).slice(0, 120) || fallbackBase;
    const safeExt = (ext || '').slice(0, 12);
    return safeExt ? `${safeBase}.${safeExt}` : safeBase;
  }

  resolveAttachmentMeta(url, headers = {}) {
    const normalizedUrl = this.normalizeUrl(url) || String(url || '');
    const urlHash = this.urlHash(normalizedUrl);
    const headerName = this.parseContentDispositionFilename(this.getHeader(headers, 'content-disposition'));
    const urlName = this.getUrlFileName(url);
    const contentType = this.getHeader(headers, 'content-type');
    const extension =
      this.getExtensionFromName(headerName) ||
      this.getExtensionFromName(urlName) ||
      this.extensionFromContentType(contentType);

    const preferredName = headerName || urlName || '';
    const safeName = this.sanitizeFileName(preferredName, urlHash, extension);

    return {
      urlHash,
      extension,
      contentType,
      fileName: safeName,
    };
  }

  buildStoredDownloadName(monitorId, timestamp, urlHash, fileName) {
    return `monitor_${monitorId}_${timestamp}_${String(urlHash || '').slice(0, 16)}_${fileName}`;
  }

  isPotentialAttachmentUrl(url, allowedExts) {
    const ext = this.getUrlExtension(url);
    return !ext || allowedExts.has(ext);
  }

  parseDateFilter(input) {
    const v = String(input || '').trim();
    if (!v) return null;
    if (/^\d+$/.test(v)) {
      const n = Number(v);
      if (!Number.isFinite(n)) return null;
      const ms = v.length <= 10 ? n * 1000 : n;
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const d = new Date(`${v}T00:00:00Z`);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  shouldRecordChangeByMatchRule(monitor, content) {
    const type = String(monitor.matchType || 'none').trim().toLowerCase();
    const pattern = String(monitor.matchPattern || '').trim();
    if (!pattern || type === 'none') return true;
    const ignoreCase = monitor.matchIgnoreCase !== false;
    const text = String(content || '');

    if (type === 'keyword') {
      return ignoreCase ? text.toLowerCase().includes(pattern.toLowerCase()) : text.includes(pattern);
    }

    if (type === 'regex') {
      try {
        const re = new RegExp(pattern, ignoreCase ? 'i' : '');
        return re.test(text);
      } catch {
        return false;
      }
    }

    return true;
  }

  async discoverAttachmentUrls(page) {
    const urls = await page.evaluate(() => {
      const uniq = new Set();
      const add = (s) => {
        if (!s) return;
        try {
          const u = new URL(s, window.location.href);
          if (!u || !u.href) return;
          uniq.add(u.href);
        } catch {
          return;
        }
      };

      document.querySelectorAll('a[href]').forEach((a) => add(a.getAttribute('href')));
      document.querySelectorAll('link[href]').forEach((a) => add(a.getAttribute('href')));
      document.querySelectorAll('img[src]').forEach((a) => add(a.getAttribute('src')));
      document.querySelectorAll('source[src]').forEach((a) => add(a.getAttribute('src')));
      document.querySelectorAll('video[src]').forEach((a) => add(a.getAttribute('src')));
      document.querySelectorAll('audio[src]').forEach((a) => add(a.getAttribute('src')));
      document.querySelectorAll('embed[src]').forEach((a) => add(a.getAttribute('src')));
      document.querySelectorAll('object[data]').forEach((a) => add(a.getAttribute('data')));

      return Array.from(uniq);
    });
    return urls || [];
  }

  async navigatePage(page, url) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    try {
      await page.waitForNetworkIdle({ idleTime: 1000, timeout: 5000 });
    } catch {}
  }

  async waitForXPath(page, xpathExpression, timeout = 10000) {
    await page.waitForFunction(
      (expression) => {
        try {
          return Boolean(
            document.evaluate(
              expression,
              document,
              null,
              XPathResult.FIRST_ORDERED_NODE_TYPE,
              null
            ).singleNodeValue
          );
        } catch {
          return false;
        }
      },
      { timeout },
      xpathExpression
    );
  }

  async getXPathTextContent(page, xpathExpression) {
    return page.evaluate((expression) => {
      const node = document.evaluate(
        expression,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue;
      return node ? node.textContent || '' : '';
    }, xpathExpression);
  }

  async getXPathLinks(page, xpathExpression) {
    return page.evaluate((expression) => {
      const node = document.evaluate(
        expression,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue;
      if (!node || typeof node.querySelectorAll !== 'function') return [];

      const uniq = new Set();
      node.querySelectorAll('a[href]').forEach((anchor) => {
        try {
          uniq.add(new URL(anchor.getAttribute('href'), window.location.href).href);
        } catch {
          return;
        }
      });
      return Array.from(uniq);
    }, xpathExpression);
  }

  async discoverLinkUrls(page, monitor) {
    const useCssScope = Boolean(monitor.linkScopeSelector);
    const scopeSelector = monitor.linkScopeSelector || monitor.selector;
    const scopeSelectorType = useCssScope ? 'css' : monitor.selectorType;

    try {
      if (scopeSelectorType === 'xpath') {
        await this.waitForXPath(page, scopeSelector, 3000);
        return (await this.getXPathLinks(page, scopeSelector)) || [];
      } else {
        await page.waitForSelector(scopeSelector, { timeout: 3000 });
        return (await page.$eval(scopeSelector, (el) => {
          const uniq = new Set();
          el.querySelectorAll('a[href]').forEach((a) => {
            try {
              uniq.add(new URL(a.getAttribute('href'), window.location.href).href);
            } catch {
              return;
            }
          });
          return Array.from(uniq);
        })) || [];
      }
    } catch {
      return (await page.$$eval('a[href]', (as) => as.map((a) => a.href))) || [];
    }

    return [];
  }

  async headWithFallback(url) {
    try {
      return await axios({
        url,
        method: 'HEAD',
        timeout: 15000,
        maxRedirects: 5,
        validateStatus: () => true,
      });
    } catch (e) {
      try {
        return await axios({
          url,
          method: 'GET',
          timeout: 15000,
          maxRedirects: 5,
          headers: { Range: 'bytes=0-0' },
          validateStatus: () => true,
        });
      } catch (err) {
        throw err;
      }
    }
  }

  async inspectAttachment(url, allowedExts) {
    const response = await this.headWithFallback(url);
    const lastModifiedHeader = this.getHeader(response.headers, 'last-modified');
    const lastModifiedAt = lastModifiedHeader ? new Date(lastModifiedHeader) : null;
    const etag = this.getHeader(response.headers, 'etag') || null;
    const contentLengthValue = Number(this.getHeader(response.headers, 'content-length'));
    const meta = this.resolveAttachmentMeta(url, response.headers);

    return {
      response,
      meta,
      etag,
      lastModifiedAt:
        lastModifiedAt && !Number.isNaN(lastModifiedAt.getTime()) ? lastModifiedAt : null,
      contentLength: Number.isFinite(contentLengthValue) ? contentLengthValue : null,
      isAllowed:
        Boolean(meta.extension && allowedExts.has(meta.extension)) &&
        !this.isHtmlLikeResponse(response.headers),
    };
  }

  async downloadAttachment({
    attachmentUrl,
    monitor,
    timestamp,
    downloadDir,
    allowedExts,
    sourceLink = null,
    sourceTitle = null,
    initialHeaders = {},
  }) {
    const response = await axios({
      url: attachmentUrl,
      method: 'GET',
      responseType: 'stream',
      timeout: 60000,
      maxRedirects: 5,
      validateStatus: () => true,
    });

    if (response.status >= 400) {
      if (response.data && typeof response.data.destroy === 'function') response.data.destroy();
      throw new Error(`http_${response.status}`);
    }

    const mergedHeaders = { ...(initialHeaders || {}), ...(response.headers || {}) };
    const meta = this.resolveAttachmentMeta(attachmentUrl, mergedHeaders);
    if (!meta.extension || !allowedExts.has(meta.extension) || this.isHtmlLikeResponse(mergedHeaders)) {
      if (response.data && typeof response.data.destroy === 'function') response.data.destroy();
      return null;
    }

    const storedName = this.buildStoredDownloadName(monitor.id, timestamp, meta.urlHash, meta.fileName);
    const filePath = path.join(downloadDir, storedName);
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    try {
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    } catch (error) {
      try {
        writer.destroy();
      } catch {}
      try {
        await fs.promises.unlink(filePath);
      } catch {}
      throw error;
    }

    return {
      record: {
        name: meta.fileName,
        path: storedName,
        size: fs.statSync(filePath).size,
        sourceLink,
        sourceTitle,
      },
      meta,
    };
  }

  async processLinksForAttachments({ browser, monitor, linkUrls, exts, cutoff, downloadDir, timestamp }) {
    const downloadedFiles = [];
    if (!browser) return downloadedFiles;
    const allowedExts = this.normalizeExtensions(exts);
    if (allowedExts.size === 0) return downloadedFiles;

    for (const linkUrl of linkUrls) {
      let articlePage = null;
      try {
        await attachmentLoggingService.log({
          monitorId: monitor.id,
          attachmentId: null,
          attachmentUrl: linkUrl,
          level: 'info',
          event: 'link_fetch_start',
          message: 'fetching new link page',
        });

        articlePage = await browser.newPage();
        await this.navigatePage(articlePage, linkUrl);
        const sourceTitle = (await articlePage.title()) || '';

        const rawAttachments = await this.discoverAttachmentUrls(articlePage);
        const now = new Date();
        const uniq = new Set();
        for (const raw of rawAttachments) {
          const normalized = this.normalizeUrl(raw);
          if (!normalized) continue;
          if (!this.isPotentialAttachmentUrl(normalized, allowedExts)) continue;
          uniq.add(normalized);
        }

        for (const attachmentUrl of Array.from(uniq)) {
          const uHash = this.urlHash(attachmentUrl);
          const [row, created] = await AttachmentMonitor.findOrCreate({
            where: { monitorId: monitor.id, urlHash: uHash },
            defaults: {
              monitorId: monitor.id,
              url: attachmentUrl,
              normalizedUrl: attachmentUrl,
              urlHash: uHash,
              firstSeenAt: now,
              lastSeenAt: now,
              status: 'discovered',
            },
          });

          if (!created) {
            await row.update({ lastSeenAt: now });
            await attachmentLoggingService.log({
              monitorId: monitor.id,
              attachmentId: row.id,
              attachmentUrl: attachmentUrl,
              level: 'debug',
              event: 'dedup',
              message: 'attachment already tracked, skip download',
              meta: { sourceLink: linkUrl },
            });
            continue;
          }

          await attachmentLoggingService.log({
            monitorId: monitor.id,
            attachmentId: row.id,
            attachmentUrl: attachmentUrl,
            level: 'info',
            event: 'discovered',
            message: 'attachment discovered from link page',
            meta: { sourceLink: linkUrl },
          });

          let lastModifiedAt = null;
          let isFiltered = false;
          let inspectResult = null;
          try {
            inspectResult = await this.inspectAttachment(attachmentUrl, allowedExts);
            lastModifiedAt = inspectResult.lastModifiedAt;
            if (cutoff && lastModifiedAt && !Number.isNaN(lastModifiedAt.getTime()) && lastModifiedAt <= cutoff) {
              isFiltered = true;
            }

            await row.update({
              lastCheckedAt: new Date(),
              status: isFiltered ? 'filtered' : inspectResult.isAllowed ? row.status : 'ignored',
              lastStatusAt: isFiltered ? new Date() : row.lastStatusAt,
              etag: inspectResult.etag || row.etag,
              lastModifiedAt: lastModifiedAt && !Number.isNaN(lastModifiedAt.getTime()) ? lastModifiedAt : row.lastModifiedAt,
              contentLength:
                Number.isFinite(Number(inspectResult.contentLength))
                  ? Number(inspectResult.contentLength)
                  : row.contentLength,
              lastError: null,
            });
          } catch (e) {
            await row.update({ lastCheckedAt: new Date(), status: 'error', lastStatusAt: new Date(), lastError: e.message || String(e) });
            await attachmentLoggingService.log({
              monitorId: monitor.id,
              attachmentId: row.id,
              attachmentUrl: attachmentUrl,
              level: 'error',
              event: 'head_failed',
              message: 'attachment head request failed',
              meta: { error: e.message || String(e), sourceLink: linkUrl },
            });
            continue;
          }

          if (isFiltered) {
            await attachmentLoggingService.log({
              monitorId: monitor.id,
              attachmentId: row.id,
              attachmentUrl: attachmentUrl,
              level: 'info',
              event: 'filtered',
              message: 'attachment filtered by date',
              meta: { sourceLink: linkUrl, lastModifiedAt: lastModifiedAt ? lastModifiedAt.toISOString() : null },
            });
            continue;
          }

          if (!inspectResult || !inspectResult.isAllowed) {
            await attachmentLoggingService.log({
              monitorId: monitor.id,
              attachmentId: row.id,
              attachmentUrl: attachmentUrl,
              level: 'debug',
              event: 'ignored',
              message: 'attachment ignored because extension or content type is not allowed',
              meta: { sourceLink: linkUrl },
            });
            continue;
          }

          try {
            await attachmentLoggingService.log({
              monitorId: monitor.id,
              attachmentId: row.id,
              attachmentUrl: attachmentUrl,
              level: 'info',
              event: 'download_attempt',
              message: 'attempting attachment download (link page)',
              meta: { sourceLink: linkUrl },
            });

            const downloadResult = await this.downloadAttachment({
              attachmentUrl,
              monitor,
              timestamp,
              downloadDir,
              allowedExts,
              sourceLink: linkUrl,
              sourceTitle,
              initialHeaders: inspectResult.response.headers,
            });
            if (!downloadResult) continue;
            downloadedFiles.push(downloadResult.record);

            await row.update({ lastDownloadedAt: new Date(), status: 'available', lastStatusAt: new Date(), lastError: null });
            await attachmentLoggingService.log({
              monitorId: monitor.id,
              attachmentId: row.id,
              attachmentUrl: attachmentUrl,
              level: 'info',
              event: 'download_success',
              message: 'attachment downloaded (link page)',
              meta: {
                filename: downloadResult.record.path,
                sourceLink: linkUrl,
                sourceTitle,
                size: downloadResult.record.size,
              },
            });
          } catch (err) {
            await row.update({ lastError: err.message || String(err), status: 'error', lastStatusAt: new Date() });
            await attachmentLoggingService.log({
              monitorId: monitor.id,
              attachmentId: row.id,
              attachmentUrl: attachmentUrl,
              level: 'error',
              event: 'download_failed',
              message: 'attachment download failed (link page)',
              meta: { error: err.message || String(err), sourceLink: linkUrl },
            });
          }
        }

        await attachmentLoggingService.log({
          monitorId: monitor.id,
          attachmentId: null,
          attachmentUrl: linkUrl,
          level: 'info',
          event: 'link_fetch_success',
          message: 'link page fetched',
        });
      } catch (e) {
        await attachmentLoggingService.log({
          monitorId: monitor.id,
          attachmentId: null,
          attachmentUrl: linkUrl,
          level: 'error',
          event: 'link_fetch_failed',
          message: 'link page fetch failed',
          meta: { error: e.message || String(e) },
        });
      } finally {
        if (articlePage) {
          try {
            await articlePage.close();
          } catch {}
        }
      }
    }

    return downloadedFiles;
  }

  async checkAll() {
    const monitors = await PageMonitor.findAll({ where: { status: 'active' } });
    console.log(`Checking ${monitors.length} monitors...`);
    for (const monitor of monitors) {
      try {
        await this.checkMonitor(monitor);
      } catch (error) {
        console.error(`Error checking monitor ${monitor.id}:`, error);
      }
    }
  }

  async checkMonitor(monitor) {
    let browser;
    try {
      const settings = await settingsService.getAll();
      const cutoff = this.parseDateFilter(settings.attachmentDateAfter);

      const launchOptions = {
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      };
      const executablePath = this.resolveBrowserExecutablePath();
      if (executablePath) launchOptions.executablePath = executablePath;
      this.log.info(
        { monitorId: monitor.id, executablePath: executablePath || 'managed-default' },
        'browser_launch_config'
      );

      browser = await puppeteer.launch({
        ...launchOptions,
      });
      const page = await browser.newPage();
      
      // Basic auth support can be added here
      await this.navigatePage(page, monitor.url);

      const shouldCollectLinks = Boolean(monitor.trackLinks || monitor.downloadAttachmentsFromNewLinks);
      let normalizedLinks = [];
      let linksContent = '';
      let linksHash = null;

      if (shouldCollectLinks) {
        const rawLinks = await this.discoverLinkUrls(page, monitor);
        const uniq = new Set();
        for (const raw of rawLinks) {
          const normalized = this.normalizeUrl(raw);
          if (normalized) uniq.add(normalized);
        }
        normalizedLinks = Array.from(uniq).slice(0, 5000);
        linksContent = normalizedLinks.slice().sort().join('\n');
        linksHash = crypto.createHash('md5').update(linksContent).digest('hex');
      }

      let content = '';
      if (monitor.trackLinks) {
        content = linksContent;
      } else if (monitor.selectorType === 'xpath') {
        await this.waitForXPath(page, monitor.selector, 10000);
        content = await this.getXPathTextContent(page, monitor.selector);
      } else {
        try {
          await page.waitForSelector(monitor.selector, { timeout: 10000 });
          content = await page.$eval(monitor.selector, el => el.textContent);
        } catch (e) {
          console.warn(`Selector ${monitor.selector} not found on ${monitor.url}`);
        }
      }

      content = content ? content.trim() : '';
      const currentHash = crypto.createHash('md5').update(content).digest('hex');
      const timestamp = Date.now();
      const exts = (monitor.attachmentTypes || '').split(',').map((ext) => ext.trim().toLowerCase()).filter(Boolean);
      const allowedExts = this.normalizeExtensions(exts);

      // Paths
      const screenshotDir = path.join(__dirname, '../storage/screenshots');
      const archiveDir = path.join(__dirname, '../storage/archives');
      const downloadDir = path.join(__dirname, '../storage/downloads');

      // Check for change
      let changeDetected = false;
      let changeType = 'update';
      const isInitial = !monitor.lastContentHash;

      if (isInitial) {
        changeDetected = true;
        changeType = 'initial';
      } else if (monitor.lastContentHash !== currentHash) {
        changeDetected = true;
        changeType = 'update';
      }

      let addedLinks = [];
      if (shouldCollectLinks) {
        const now = new Date();
        const isLinkInitial = !monitor.lastLinksHash;

        const hashes = normalizedLinks.map((u) => this.urlHash(u));
        if (hashes.length > 0) {
          const existing = await MonitorLink.findAll({
            where: { monitorId: monitor.id, urlHash: { [Op.in]: hashes } },
            attributes: ['id', 'urlHash'],
          });
          const existingSet = new Set(existing.map((r) => r.urlHash));
          const missingSet = new Set(hashes.filter((h) => !existingSet.has(h)));

          if (missingSet.size > 0) {
            const records = [];
            for (let i = 0; i < hashes.length; i++) {
              const h = hashes[i];
              if (!missingSet.has(h)) continue;
              const u = normalizedLinks[i];
              records.push({
                monitorId: monitor.id,
                url: u,
                normalizedUrl: u,
                urlHash: h,
                firstSeenAt: now,
                lastSeenAt: now,
              });
              if (!isLinkInitial) addedLinks.push(u);
            }
            if (records.length > 0) await MonitorLink.bulkCreate(records, { ignoreDuplicates: true });
          }

          const existingHashes = Array.from(existingSet);
          if (existingHashes.length > 0) {
            await MonitorLink.update(
              { lastSeenAt: now },
              { where: { monitorId: monitor.id, urlHash: { [Op.in]: existingHashes } } }
            );
          }

          if (!isLinkInitial && addedLinks.length > 0) {
            for (const u of addedLinks) {
              await attachmentLoggingService.log({
                monitorId: monitor.id,
                attachmentId: null,
                attachmentUrl: u,
                level: 'info',
                event: 'link_added',
                message: 'new link detected',
              });
            }
          }
        }
      }

      const attachmentsToMonitorAll = await AttachmentMonitor.findAll({ where: { monitorId: monitor.id } });
      if (attachmentsToMonitorAll.length > 0) {
        for (const a of attachmentsToMonitorAll) {
          try {
            const inspectResult = await this.inspectAttachment(a.normalizedUrl, allowedExts);
            const { response, lastModifiedAt, etag, contentLength, isAllowed } = inspectResult;
            const isFiltered = cutoff && lastModifiedAt && !Number.isNaN(lastModifiedAt.getTime()) && lastModifiedAt <= cutoff;

            let status = 'available';
            if (isFiltered) status = 'filtered';
            else if (!isAllowed) status = 'ignored';
            else if (response.status === 404) status = 'missing';
            else if (response.status >= 400) status = 'error';

            const metaChanged = Boolean(
              (etag && etag !== a.etag) ||
              (lastModifiedAt && (!a.lastModifiedAt || new Date(a.lastModifiedAt).getTime() !== lastModifiedAt.getTime())) ||
              (contentLength && Number(a.contentLength) !== contentLength)
            );
            const statusChanged = status !== a.status;

            await a.update({
              lastCheckedAt: new Date(),
              status,
              lastStatusAt: statusChanged ? new Date() : a.lastStatusAt,
              etag: etag || a.etag,
              lastModifiedAt: lastModifiedAt && !Number.isNaN(lastModifiedAt.getTime()) ? lastModifiedAt : a.lastModifiedAt,
              contentLength: Number.isFinite(contentLength) ? contentLength : a.contentLength,
              lastError: status === 'error' ? `http_${response.status}` : null,
            });

            if (statusChanged || metaChanged) {
              await attachmentLoggingService.log({
                monitorId: monitor.id,
                attachmentId: a.id,
                attachmentUrl: a.normalizedUrl,
                level: 'info',
                event: 'status_change',
                message: 'attachment status or metadata changed',
                meta: {
                  status,
                  httpStatus: response.status,
                  etag: etag || null,
                  lastModified: lastModifiedAt ? lastModifiedAt.toISOString() : null,
                  contentLength: Number.isFinite(contentLength) ? contentLength : null,
                },
              });
            }
          } catch (e) {
            await a.update({ lastCheckedAt: new Date(), status: 'error', lastStatusAt: new Date(), lastError: e.message || String(e) });
            await attachmentLoggingService.log({
              monitorId: monitor.id,
              attachmentId: a.id,
              attachmentUrl: a.normalizedUrl,
              level: 'error',
              event: 'head_failed',
              message: 'attachment head request failed',
              meta: { error: e.message || String(e) },
            });
          }
        }
      }

      const enableNewLinkFlow = Boolean(settings.autoDownloadAttachmentsFromNewLinks && monitor.downloadAttachmentsFromNewLinks);
      const maxNewLinks = Number.isFinite(Number(settings.maxNewLinksPerCheck)) ? Number(settings.maxNewLinksPerCheck) : 0;
      const shouldProcessBaseline = enableNewLinkFlow && !monitor.baselineLinksProcessedAt;
      const candidates = addedLinks.length > 0 ? addedLinks : (shouldProcessBaseline ? normalizedLinks : []);

      const downloadedFilesFromNewLinks = (enableNewLinkFlow && candidates.length > 0 && maxNewLinks > 0)
        ? await this.processLinksForAttachments({
          browser,
          monitor,
          linkUrls: candidates.slice(0, maxNewLinks),
          exts,
          cutoff,
          downloadDir,
          timestamp,
        })
        : [];

      if (shouldProcessBaseline && maxNewLinks > 0 && candidates.length > 0) {
        try {
          await monitor.update({ baselineLinksProcessedAt: new Date() });
        } catch {}
      }

      if (changeDetected) {
        if (!this.shouldRecordChangeByMatchRule(monitor, content)) {
          await monitor.update({
            lastContentHash: currentHash,
            lastCheckTime: new Date(),
            lastLinksHash: shouldCollectLinks ? linksHash : monitor.lastLinksHash,
          });
          return;
        }
        console.log(`Change detected for ${monitor.url} (${changeType})`);

        // 1. Take Screenshot
        const screenshotFilename = `monitor_${monitor.id}_${timestamp}.png`;
        const screenshotPath = path.join(screenshotDir, screenshotFilename);
        await page.screenshot({ path: screenshotPath, fullPage: true });

        // 2. Save HTML Snapshot (if enabled)
        let htmlFilename = null;
        if (monitor.saveHtml) {
          htmlFilename = `monitor_${monitor.id}_${timestamp}.html`;
          const htmlContent = this.injectBaseHref(await page.content(), monitor.url);
          fs.writeFileSync(path.join(archiveDir, htmlFilename), htmlContent);
        }

        // 3. Download Attachments (if enabled)
        let downloadedFiles = downloadedFilesFromNewLinks.slice();
        const perMonitorEnabled = Boolean(monitor.downloadAttachments && exts.length > 0);

        if (perMonitorEnabled) {
          const targets =
            (await page.$$eval('a[href]', (anchors) => {
              const uniq = new Set();
              anchors.forEach((anchor) => {
                try {
                  uniq.add(anchor.href);
                } catch {
                  return;
                }
              });
              return Array.from(uniq);
            })) || [];
          for (const fileUrl of targets) {
            if (!this.isPotentialAttachmentUrl(fileUrl, allowedExts)) continue;

            try {
              await attachmentLoggingService.log({
                monitorId: monitor.id,
                attachmentId: null,
                attachmentUrl: fileUrl,
                level: 'info',
                event: 'download_attempt',
                message: 'attempting attachment download (current page)',
              });

              const inspectResult = await this.inspectAttachment(fileUrl, allowedExts);
              if (!inspectResult.isAllowed) continue;

              const downloadResult = await this.downloadAttachment({
                attachmentUrl: fileUrl,
                monitor,
                timestamp,
                downloadDir,
                allowedExts,
                initialHeaders: inspectResult.response.headers,
              });
              if (!downloadResult) continue;
              downloadedFiles.push(downloadResult.record);

              await attachmentLoggingService.log({
                monitorId: monitor.id,
                attachmentId: null,
                attachmentUrl: fileUrl,
                level: 'info',
                event: 'download_success',
                message: 'attachment downloaded (current page)',
                meta: { filename: downloadResult.record.path, size: downloadResult.record.size },
              });
            } catch (err) {
              await attachmentLoggingService.log({
                monitorId: monitor.id,
                attachmentId: null,
                attachmentUrl: fileUrl,
                level: 'error',
                event: 'download_failed',
                message: 'attachment download failed (current page)',
                meta: { error: err.message || String(err) },
              });
            }
          }
        }

        // Save History
        const history = await ChangeHistory.create({
          monitorId: monitor.id,
          changeType: changeType,
          contentPreview: content.substring(0, 500),
          screenshotPath: screenshotFilename, // Store filename only
          htmlPath: htmlFilename,
          attachments: downloadedFiles.length > 0 ? downloadedFiles : null,
        });

        await monitor.update({
          lastContentHash: currentHash,
          lastCheckTime: new Date(),
          lastLinksHash: shouldCollectLinks ? linksHash : monitor.lastLinksHash,
        });

        // Send Notification
        await notificationService.notify(monitor, changeType, content, { historyId: history.id });
      } else {
        if (downloadedFilesFromNewLinks.length > 0) {
          await ChangeHistory.create({
            monitorId: monitor.id,
            changeType: 'update',
            contentPreview: 'attachments downloaded from link pages',
            screenshotPath: null,
            htmlPath: null,
            attachments: downloadedFilesFromNewLinks,
          });
        }
        // No change
        await monitor.update({
          lastCheckTime: new Date(),
          lastLinksHash: shouldCollectLinks ? linksHash : monitor.lastLinksHash,
        });
      }

    } catch (error) {
      this.log.error({ err: error, monitorId: monitor.id, url: monitor.url }, 'scrape_error');
    } finally {
      if (browser) await browser.close();
    }
  }
}

module.exports = new MonitorService();
