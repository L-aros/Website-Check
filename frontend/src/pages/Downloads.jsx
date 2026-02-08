import React, { useEffect, useMemo, useState } from 'react';
import { Card, Input, Select, Table, Button, Space, Typography } from 'antd';
import { DownloadOutlined, HistoryOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const formatSize = (bytes) => {
  if (!bytes && bytes !== 0) return '-';
  const n = Number(bytes);
  if (!Number.isFinite(n)) return '-';
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
};

const Downloads = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [monitors, setMonitors] = useState([]);
  const [q, setQ] = useState('');
  const [monitorId, setMonitorId] = useState(undefined);
  const [ext, setExt] = useState(undefined);

  const fetchMonitors = async () => {
    try {
      const res = await axios.get('/api/monitors');
      setMonitors(res.data || []);
    } catch {
      setMonitors([]);
    }
  };

  const fetchDownloads = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/dashboard/downloads', {
        params: {
          q: q || undefined,
          monitorId: monitorId || undefined,
          ext: ext || undefined,
          limit: 200,
        },
      });
      setItems((res.data && res.data.items) || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitors();
  }, []);

  useEffect(() => {
    fetchDownloads();
  }, [q, monitorId, ext]);

  const extOptions = useMemo(() => {
    const set = new Set();
    for (const it of items) {
      const name = String(it.fileName || '');
      const e = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
      if (e) set.add(e);
    }
    return Array.from(set).sort().map((e) => ({ label: e, value: e }));
  }, [items]);

  const columns = [
    {
      title: t('downloads.colMonitor'),
      dataIndex: 'monitorName',
      key: 'monitorName',
      width: 200,
      render: (_, record) => (
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontWeight: 500 }}>{record.monitorName || '-'}</div>
          {record.monitorUrl ? (
            <a href={record.monitorUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>
              {record.monitorUrl}
            </a>
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>-</Text>
          )}
        </div>
      ),
    },
    {
      title: t('downloads.colFile'),
      dataIndex: 'fileName',
      key: 'fileName',
      ellipsis: true,
      render: (v, record) => (
        <a href={record.downloadUrl} target="_blank" rel="noopener noreferrer">
          {v || record.storedPath}
        </a>
      ),
    },
    {
      title: t('downloads.colSource'),
      dataIndex: 'sourceLink',
      key: 'sourceLink',
      width: 320,
      ellipsis: true,
      render: (_, record) => (
        record.sourceLink ? (
          <a href={record.sourceLink} target="_blank" rel="noopener noreferrer">
            {record.sourceTitle || record.sourceLink}
          </a>
        ) : (
          <Text type="secondary">-</Text>
        )
      ),
    },
    {
      title: t('downloads.colSize'),
      dataIndex: 'size',
      key: 'size',
      width: 120,
      render: (v) => formatSize(v),
    },
    {
      title: t('downloads.colTime'),
      dataIndex: 'checkTime',
      key: 'checkTime',
      width: 180,
      render: (v) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: t('downloads.colActions'),
      key: 'actions',
      width: 220,
      render: (_, record) => (
        <Space>
          <Button
            icon={<DownloadOutlined />}
            href={record.downloadUrl}
            target="_blank"
          >
            {t('downloads.actionDownload')}
          </Button>
          <Button
            icon={<HistoryOutlined />}
            onClick={() => navigate(`/history/${record.monitorId}`)}
          >
            {t('downloads.actionHistory')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>{t('downloads.title')}</h2>
      </div>

      <Card variant="borderless">
        <Space wrap style={{ marginBottom: 16 }}>
          <Input
            allowClear
            placeholder={t('downloads.searchPlaceholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 260 }}
          />
          <Select
            allowClear
            placeholder={t('downloads.filterMonitor')}
            value={monitorId}
            onChange={setMonitorId}
            style={{ width: 240 }}
            options={(monitors || []).map((m) => ({ label: m.name || m.url, value: m.id }))}
          />
          <Select
            allowClear
            placeholder={t('downloads.filterExt')}
            value={ext}
            onChange={setExt}
            style={{ width: 200 }}
            options={extOptions}
          />
          <Button onClick={fetchDownloads}>{t('common.refresh')}</Button>
        </Space>

        <Table
          rowKey={(r) => `${r.changeHistoryId}-${r.storedPath}`}
          loading={loading}
          columns={columns}
          dataSource={items}
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: t('downloads.empty') }}
        />
      </Card>
    </div>
  );
};

export default Downloads;
