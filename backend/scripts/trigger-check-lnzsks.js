const axios = require('axios');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const main = async () => {
  const baseUrl = 'http://localhost:3000';
  const adminPassword = String(process.env.ADMIN_PASSWORD || '').trim();
  if (!adminPassword) throw new Error('Missing ADMIN_PASSWORD');
  const targetUrl = 'https://www.lnzsks.com/listinfo/NewsList_2401_1.html';

  const loginRes = await axios.post(`${baseUrl}/api/auth/login`, { password: adminPassword });
  const token = loginRes.data.token;
  const api = axios.create({
    baseURL: baseUrl,
    headers: { Authorization: `Bearer ${token}` },
  });

  const all = await api.get('/api/monitors');
  const monitor = (all.data || []).find((m) => m.url === targetUrl);
  if (!monitor) throw new Error('monitor not found');

  const before = await api.get(`/api/monitors/${monitor.id}`);
  const beforeT = before.data && before.data.lastCheckTime ? new Date(before.data.lastCheckTime).getTime() : 0;

  await api.post(`/api/monitors/${monitor.id}/check`);

  const start = Date.now();
  while (Date.now() - start < 180_000) {
    const cur = await api.get(`/api/monitors/${monitor.id}`);
    const t = cur.data && cur.data.lastCheckTime ? new Date(cur.data.lastCheckTime).getTime() : 0;
    if (t && t > beforeT) break;
    await sleep(2000);
  }

  const attLogs = await api.get(`/api/monitors/${monitor.id}/attachment-logs`, { params: { limit: 50, minLevel: 'debug' } });
  console.log('recent attachment logs:', (attLogs.data || []).slice(0, 20).map((x) => ({ level: x.level, event: x.event, url: x.attachmentUrl, meta: x.meta })));

  const downloads = await api.get('/api/dashboard/downloads', { params: { monitorId: monitor.id, limit: 20 } });
  console.log('downloads (top5):', (downloads.data?.items || downloads.data || []).slice(0, 5).map((x) => ({
    fileName: x.fileName,
    sourceTitle: x.sourceTitle,
    sourceLink: x.sourceLink,
    downloadUrl: x.downloadUrl,
  })));
};

main().catch((e) => {
  console.error(e?.response?.data || e.message || e);
  process.exit(1);
});
