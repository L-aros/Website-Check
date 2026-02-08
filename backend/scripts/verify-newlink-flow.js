const path = require('path');
const fs = require('fs');
const axios = require('axios');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const main = async () => {
  const baseUrl = 'http://localhost:3000';
  const adminPassword = String(process.env.ADMIN_PASSWORD || '').trim();
  if (!adminPassword) throw new Error('Missing ADMIN_PASSWORD');

  const linksPath = path.join(__dirname, '../../frontend/public/test-pages/links.json');
  const downloadsDir = path.join(__dirname, '../storage/downloads');

  const setLinks = (withD) => {
    const links = [
      { title: 'A', url: '/test-pages/a.html' },
      { title: 'B', url: '/test-pages/b.html' },
      { title: 'C', url: '/test-pages/c.html' },
    ];
    if (withD) links.push({ title: 'D', url: '/test-pages/d.html' });
    fs.writeFileSync(linksPath, JSON.stringify({ links }, null, 2));
  };

  const loginRes = await axios.post(`${baseUrl}/api/auth/login`, { password: adminPassword });
  const token = loginRes.data.token;
  const api = axios.create({
    baseURL: baseUrl,
    headers: { Authorization: `Bearer ${token}` },
  });

  const waitForCheck = async (id, minLastCheckTimeMs) => {
    const start = Date.now();
    while (Date.now() - start < 180_000) {
      const res = await api.get(`/api/monitors/${id}`);
      const t = res.data && res.data.lastCheckTime ? new Date(res.data.lastCheckTime).getTime() : 0;
      if (t && t > minLastCheckTimeMs) return;
      await sleep(2000);
    }
    throw new Error('timeout waiting for check to finish');
  };

  await api.put('/api/settings', {
    autoDownloadAttachmentsFromNewLinks: true,
    maxNewLinksPerCheck: 10,
    attachmentLogLevel: 'debug',
  });

  const testMonitorName = `TEST_NEWLINKS_${Date.now()}`;
  const listUrl = 'http://localhost:5174/test-pages/list.html';

  const payload = {
    name: testMonitorName,
    url: listUrl,
    selectorType: 'css',
    selector: '#list',
    trackLinks: true,
    linkScopeSelector: '#list',
    downloadAttachmentsFromNewLinks: true,
    saveHtml: false,
    downloadAttachments: false,
    attachmentTypes: 'zip,rar,pdf',
    frequency: '*/30 * * * *',
    notifyEmail: false,
    notifySms: false,
    notifyFeishu: false,
  };

  const created = await api.post('/api/monitors', payload);
  const monitorId = created.data.id;

  setLinks(false);
  const t1 = Date.now();
  await api.post(`/api/monitors/${monitorId}/check`);
  await waitForCheck(monitorId, t1);
  const links1 = await api.get(`/api/monitors/${monitorId}/links`);
  console.log(`links after baseline: ${Array.isArray(links1.data) ? links1.data.length : 0}`);

  setLinks(true);
  const t2 = Date.now();
  await api.post(`/api/monitors/${monitorId}/check`);
  await waitForCheck(monitorId, t2);
  const links2 = await api.get(`/api/monitors/${monitorId}/links`);
  const linkUrls2 = Array.isArray(links2.data) ? links2.data.map((x) => x.normalizedUrl || x.url) : [];
  console.log(`links after update: ${linkUrls2.length}`);
  console.log(`has D: ${linkUrls2.some((u) => String(u).includes('/test-pages/d.html'))}`);

  const attachments = await api.get(`/api/monitors/${monitorId}/attachments`);
  console.log(`attachments tracked: ${Array.isArray(attachments.data) ? attachments.data.length : 0}`);

  const logs = await api.get(`/api/monitors/${monitorId}/link-logs`, { params: { limit: 50, minLevel: 'debug' } });
  const logItems = Array.isArray(logs.data) ? logs.data.slice(0, 10) : [];
  console.log(`recent link logs: ${logItems.map((l) => l.event).join(', ')}`);

  const files = fs.existsSync(downloadsDir) ? fs.readdirSync(downloadsDir) : [];
  const hit = files.find((f) => f.endsWith('_d.zip') || f.endsWith('d.zip') || f.includes('d.zip'));
  const img = files.find((f) => f.endsWith('pic.jpg') || f.includes('pic.jpg'));

  if (!hit) {
    console.error('verify failed: d.zip not downloaded');
    process.exit(1);
  }
  if (img) {
    console.error(`verify failed: unexpected image downloaded: ${img}`);
    process.exit(1);
  }

  const downloads = await api.get('/api/dashboard/downloads', { params: { monitorId, limit: 20 } });
  const item = (downloads.data.items || []).find((x) => String(x.fileName || '').includes('d.zip'));
  console.log('download meta:', item ? { fileName: item.fileName, sourceTitle: item.sourceTitle, sourceLink: item.sourceLink } : null);

  console.log(`verify ok: downloaded ${hit}`);
  process.exit(0);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
