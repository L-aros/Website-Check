const axios = require('axios');

const main = async () => {
  const baseUrl = 'http://localhost:3000';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const targetUrl = 'https://www.lnzsks.com/listinfo/NewsList_2401_1.html';

  const loginRes = await axios.post(`${baseUrl}/api/auth/login`, { password: adminPassword });
  const token = loginRes.data.token;
  const api = axios.create({
    baseURL: baseUrl,
    headers: { Authorization: `Bearer ${token}` },
  });

  const settings = await api.get('/api/settings');
  console.log('settings:', settings.data);

  const all = await api.get('/api/monitors');
  const monitor = (all.data || []).find((m) => m.url === targetUrl);
  if (!monitor) {
    console.log('monitor not found for url:', targetUrl);
    process.exit(0);
  }

  const detail = await api.get(`/api/monitors/${monitor.id}`);
  console.log('monitor:', {
    id: detail.data.id,
    name: detail.data.name,
    url: detail.data.url,
    selector: detail.data.selector,
    selectorType: detail.data.selectorType,
    trackLinks: detail.data.trackLinks,
    linkScopeSelector: detail.data.linkScopeSelector,
    downloadAttachments: detail.data.downloadAttachments,
    downloadAttachmentsFromNewLinks: detail.data.downloadAttachmentsFromNewLinks,
    attachmentTypes: detail.data.attachmentTypes,
    lastLinksHash: detail.data.lastLinksHash,
    lastContentHash: detail.data.lastContentHash,
    lastCheckTime: detail.data.lastCheckTime,
  });

  const links = await api.get(`/api/monitors/${monitor.id}/links`, { params: { limit: 50 } });
  console.log('links count (top50):', Array.isArray(links.data) ? links.data.length : 0);
  if (Array.isArray(links.data) && links.data[0]) console.log('latest link:', links.data[0].normalizedUrl || links.data[0].url);

  const linkLogs = await api.get(`/api/monitors/${monitor.id}/link-logs`, { params: { limit: 20, minLevel: 'debug' } });
  console.log('recent link logs:', (linkLogs.data || []).slice(0, 10).map((x) => ({ level: x.level, event: x.event, url: x.attachmentUrl, at: x.createdAt })));

  const attLogs = await api.get(`/api/monitors/${monitor.id}/attachment-logs`, { params: { limit: 20, minLevel: 'debug' } });
  console.log('recent attachment logs:', (attLogs.data || []).slice(0, 10).map((x) => ({ level: x.level, event: x.event, url: x.attachmentUrl, at: x.createdAt, meta: x.meta })));
};

main().catch((e) => {
  console.error(e?.response?.data || e.message || e);
  process.exit(1);
});

