const path = require('path');
const fs = require('fs');
const axios = require('axios');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const main = async () => {
  const baseUrl = 'http://localhost:3000';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const listUrl = 'http://localhost:5174/test-pages/list.html';
  const archiveDir = path.join(__dirname, '../storage/archives');

  const token = (await axios.post(`${baseUrl}/api/auth/login`, { password: adminPassword })).data.token;
  const api = axios.create({ baseURL: baseUrl, headers: { Authorization: `Bearer ${token}` } });

  const payload = {
    name: `TEST_SNAPSHOT_${Date.now()}`,
    url: listUrl,
    selectorType: 'css',
    selector: '#list',
    saveHtml: true,
    trackLinks: false,
    downloadAttachments: false,
    downloadAttachmentsFromNewLinks: false,
    frequency: '*/30 * * * *',
    notifyEmail: false,
    notifySms: false,
    notifyFeishu: false,
  };

  const created = await api.post('/api/monitors', payload);
  const monitorId = created.data.id;

  const beforeT = Date.now();
  await api.post(`/api/monitors/${monitorId}/check`);

  const start = Date.now();
  while (Date.now() - start < 180_000) {
    const cur = await api.get(`/api/monitors/${monitorId}`);
    const t = cur.data && cur.data.lastCheckTime ? new Date(cur.data.lastCheckTime).getTime() : 0;
    if (t && t > beforeT) break;
    await sleep(2000);
  }

  if (!fs.existsSync(archiveDir)) throw new Error('archive dir not found');
  const files = fs.readdirSync(archiveDir)
    .filter((f) => f.startsWith(`monitor_${monitorId}_`) && f.endsWith('.html'))
    .map((f) => ({ f, t: fs.statSync(path.join(archiveDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);

  if (files.length === 0) throw new Error('no html snapshot found');
  const latest = files[0].f;
  const html = fs.readFileSync(path.join(archiveDir, latest), 'utf8');
  const expected = `<base href=\"${listUrl}\">`;
  if (!html.includes(expected)) throw new Error(`base tag not found in ${latest}`);
  console.log(`verify ok: ${latest} contains base href`);
};

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

