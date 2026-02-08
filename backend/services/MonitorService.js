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

class MonitorService {
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

  async discoverLinkUrls(page, monitor) {
    const useCssScope = Boolean(monitor.linkScopeSelector);
    const scopeSelector = monitor.linkScopeSelector || monitor.selector;
    const scopeSelectorType = useCssScope ? 'css' : monitor.selectorType;

    try {
      if (scopeSelectorType === 'xpath') {
        const elements = await page.$x(scopeSelector);
        if (elements.length > 0) {
          return (await page.evaluate((el) => {
            const uniq = new Set();
            el.querySelectorAll('a[href]').forEach((a) => {
              try {
                uniq.add(new URL(a.getAttribute('href'), window.location.href).href);
              } catch {
                return;
              }
            });
            return Array.from(uniq);
          }, elements[0])) || [];
        }
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

  isAttachmentCandidate(url, extraExtensions = []) {
    const ext = path.extname(url).replace('.', '').toLowerCase();
    if (!ext) return false;
    const defaultExts = new Set([
      'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
      'zip', 'rar', '7z', 'tar', 'gz',
      'csv', 'txt',
    ]);
    for (const e of extraExtensions) defaultExts.add(String(e || '').trim().replace('.', '').toLowerCase());
    return defaultExts.has(ext);
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
        await articlePage.goto(linkUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        const sourceTitle = (await articlePage.title()) || '';

        const rawAttachments = await this.discoverAttachmentUrls(articlePage);
        const now = new Date();
        const uniq = new Set();
        for (const raw of rawAttachments) {
          const normalized = this.normalizeUrl(raw);
          if (!normalized) continue;
          const ext = this.getUrlExtension(normalized);
          if (!ext || !allowedExts.has(ext)) continue;
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
          try {
            const headRes = await this.headWithFallback(attachmentUrl);
            const lastModifiedHeader = headRes.headers && (headRes.headers['last-modified'] || headRes.headers['Last-Modified']);
            lastModifiedAt = lastModifiedHeader ? new Date(lastModifiedHeader) : null;
            if (cutoff && lastModifiedAt && !Number.isNaN(lastModifiedAt.getTime()) && lastModifiedAt <= cutoff) {
              isFiltered = true;
            }

            const etag = headRes.headers && (headRes.headers.etag || headRes.headers.ETag);
            const lenHeader = headRes.headers && (headRes.headers['content-length'] || headRes.headers['Content-Length']);
            const contentLength = lenHeader ? Number(lenHeader) : null;

            await row.update({
              lastCheckedAt: new Date(),
              status: isFiltered ? 'filtered' : row.status,
              lastStatusAt: isFiltered ? new Date() : row.lastStatusAt,
              etag: etag || row.etag,
              lastModifiedAt: lastModifiedAt && !Number.isNaN(lastModifiedAt.getTime()) ? lastModifiedAt : row.lastModifiedAt,
              contentLength: Number.isFinite(Number(contentLength)) ? Number(contentLength) : row.contentLength,
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

            const filename = `monitor_${monitor.id}_${timestamp}_${path.basename(attachmentUrl)}`;
            const filePath = path.join(downloadDir, filename);

            const response = await axios({
              url: attachmentUrl,
              method: 'GET',
              responseType: 'stream',
              timeout: 60000,
              maxRedirects: 5,
            });

            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
              writer.on('finish', resolve);
              writer.on('error', reject);
            });

            const size = fs.statSync(filePath).size;
            downloadedFiles.push({
              name: path.basename(attachmentUrl),
              path: filename,
              size,
              sourceLink: linkUrl,
              sourceTitle,
            });

            await row.update({ lastDownloadedAt: new Date(), status: 'available', lastStatusAt: new Date(), lastError: null });
            await attachmentLoggingService.log({
              monitorId: monitor.id,
              attachmentId: row.id,
              attachmentUrl: attachmentUrl,
              level: 'info',
              event: 'download_success',
              message: 'attachment downloaded (link page)',
              meta: { filename, sourceLink: linkUrl, sourceTitle, size },
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

      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      
      // Basic auth support can be added here
      await page.goto(monitor.url, { waitUntil: 'networkidle2', timeout: 60000 });

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
        const elements = await page.$x(monitor.selector);
        if (elements.length > 0) {
          content = await page.evaluate(el => el.textContent, elements[0]);
        }
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
      const dateStr = new Date().toISOString().split('T')[0];
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
      const attachmentsToMonitor = [];
      for (const a of attachmentsToMonitorAll) {
        const ext = this.getUrlExtension(a.normalizedUrl);
        if (!ext || !allowedExts.has(ext)) {
          if (a.status !== 'ignored') {
            try {
              await a.update({ status: 'ignored', lastStatusAt: new Date(), lastError: null });
            } catch {}
          }
          continue;
        }
        if (a.status === 'ignored') continue;
        attachmentsToMonitor.push(a);
      }

      if (attachmentsToMonitor.length > 0) {
        for (const a of attachmentsToMonitor) {
          try {
            const res = await this.headWithFallback(a.normalizedUrl);
            const lastModifiedHeader = res.headers && (res.headers['last-modified'] || res.headers['Last-Modified']);
            const etag = res.headers && (res.headers.etag || res.headers.ETag);
            const lenHeader = res.headers && (res.headers['content-length'] || res.headers['Content-Length']);
            const lastModifiedAt = lastModifiedHeader ? new Date(lastModifiedHeader) : null;
            const contentLength = lenHeader ? Number(lenHeader) : null;
            const isFiltered = cutoff && lastModifiedAt && !Number.isNaN(lastModifiedAt.getTime()) && lastModifiedAt <= cutoff;

            let status = 'available';
            if (isFiltered) status = 'filtered';
            else if (res.status === 404) status = 'missing';
            else if (res.status >= 400) status = 'error';

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
              lastError: status === 'error' ? `http_${res.status}` : null,
            });

            if (statusChanged || metaChanged) {
              await attachmentLoggingService.log({
                monitorId: monitor.id,
                attachmentId: a.id,
                attachmentUrl: a.normalizedUrl,
                level: 'info',
                event: 'status_change',
                message: 'attachment status or metadata changed',
                meta: { status, httpStatus: res.status, etag: etag || null, lastModified: lastModifiedHeader || null, contentLength: Number.isFinite(contentLength) ? contentLength : null },
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
          const targets = (await page.$$eval('a', (as) => as.map((a) => a.href))) || [];
          for (const fileUrl of targets) {
            const ext = path.extname(fileUrl).replace('.', '').toLowerCase();
            if (!exts.includes(ext)) continue;

            try {
              await attachmentLoggingService.log({
                monitorId: monitor.id,
                attachmentId: null,
                attachmentUrl: fileUrl,
                level: 'info',
                event: 'download_attempt',
                message: 'attempting attachment download (current page)',
              });

              const filename = `monitor_${monitor.id}_${timestamp}_${path.basename(fileUrl)}`;
              const filePath = path.join(downloadDir, filename);

              const response = await axios({
                url: fileUrl,
                method: 'GET',
                responseType: 'stream',
                timeout: 60000,
                maxRedirects: 5,
              });

              const writer = fs.createWriteStream(filePath);
              response.data.pipe(writer);

              await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
              });

              downloadedFiles.push({
                name: path.basename(fileUrl),
                path: filename,
                size: fs.statSync(filePath).size,
              });

              await attachmentLoggingService.log({
                monitorId: monitor.id,
                attachmentId: null,
                attachmentUrl: fileUrl,
                level: 'info',
                event: 'download_success',
                message: 'attachment downloaded (current page)',
                meta: { filename },
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
      console.error(`Scraping error for ${monitor.url}:`, error);
    } finally {
      if (browser) await browser.close();
    }
  }
}

module.exports = new MonitorService();
