import React, { useEffect, useState } from 'react';
import { Timeline, Card, Tag, Button, Image, List, Typography, App, Space } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, FileTextOutlined, PictureOutlined, LinkOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const tokenize = (s) => String(s || '').split(/(\s+)/).filter((x) => x !== '');

const diffTokens = (oldTokens, newTokens) => {
  const a = oldTokens;
  const b = newTokens;
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ op: 'eq', text: a[i] });
      i += 1;
      j += 1;
      continue;
    }
    if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ op: 'del', text: a[i] });
      i += 1;
    } else {
      out.push({ op: 'add', text: b[j] });
      j += 1;
    }
  }
  while (i < n) {
    out.push({ op: 'del', text: a[i] });
    i += 1;
  }
  while (j < m) {
    out.push({ op: 'add', text: b[j] });
    j += 1;
  }
  return out;
};

const HistoryList = () => {
  const [monitor, setMonitor] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [diffOpen, setDiffOpen] = useState({});
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { t } = useTranslation();

  useEffect(() => {
    fetchMonitor();
    fetchHistory();
  }, [id]);

  const fetchMonitor = async () => {
    try {
      const res = await axios.get(`/api/monitors/${id}`);
      setMonitor(res.data);
    } catch (error) {
      setMonitor(null);
    }
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/monitors/${id}/history`);
      setData(res.data);
    } catch (error) {
      message.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const getChangeTypeColor = (type) => {
      switch(type) {
          case 'initial': return 'blue';
          case 'update': return 'orange';
          case 'delete': return 'red';
          default: return 'default';
      }
  };

  const getChangeTypeLabel = (type) => {
      const key = `history.changeType.${type}`;
      const label = t(key);
      // Fallback if key doesn't exist or is same as key
      return label === key ? type.toUpperCase() : label;
  };

  const getMonitorLinkText = (url) => {
    if (!url) return '';
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  return (
    <Card 
      title={t('history.title')}
      extra={
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/monitors')}>
          {t('history.backToMonitors')}
        </Button>
      }
      variant="borderless"
    >
      <Timeline
        mode="left"
        style={{ marginTop: 20 }}
        items={data.map((item, index) => ({
          color: getChangeTypeColor(item.changeType),
          children: (
            <Card
              size="small"
              style={{ marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
              variant="borderless"
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                  borderBottom: '1px solid #f0f0f0',
                  paddingBottom: 8,
                }}
              >
                <Space size={12} wrap>
                  <Tag color={getChangeTypeColor(item.changeType)} style={{ marginRight: 0 }}>
                    {getChangeTypeLabel(item.changeType)}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(item.checkTime).toLocaleString()}
                  </Text>
                  {monitor?.url && (
                    <a
                      href={monitor.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12 }}
                    >
                      <Space size={6}>
                        <LinkOutlined />
                        <span>{getMonitorLinkText(monitor.url)}</span>
                      </Space>
                    </a>
                  )}
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  ID: {item.id}
                </Text>
              </div>

                        {/* Content Preview */}
                        <div style={{ marginBottom: 16 }}>
                            <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                                {t('history.contentPreview')}
                            </Text>
                            <div style={{ 
                                background: 'var(--ant-color-bg-layout)', 
                                padding: 12, 
                                borderRadius: 6,
                                maxHeight: 150,
                                overflow: 'auto',
                                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                                fontSize: 13,
                                lineHeight: 1.5,
                                color: item.contentPreview ? 'inherit' : '#999'
                            }}>
                                {item.contentPreview || t('history.noPreview')}
                            </div>
                            {data[index + 1]?.contentPreview ? (
                              <div style={{ marginTop: 8, textAlign: 'right' }}>
                                <Button
                                  type="link"
                                  size="small"
                                  onClick={() => setDiffOpen((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                                >
                                  {diffOpen[item.id] ? t('history.hideDiff') : t('history.viewDiff')}
                                </Button>
                              </div>
                            ) : null}
                            {diffOpen[item.id] && data[index + 1]?.contentPreview ? (
                              <div style={{
                                marginTop: 8,
                                background: 'var(--ant-color-bg-layout)',
                                padding: 12,
                                borderRadius: 6,
                                maxHeight: 220,
                                overflow: 'auto',
                                fontFamily: 'Menlo, Monaco, \"Courier New\", monospace',
                                fontSize: 13,
                                lineHeight: 1.6,
                                wordBreak: 'break-word',
                              }}>
                                {diffTokens(tokenize(data[index + 1].contentPreview), tokenize(item.contentPreview)).map((seg, idx) => (
                                  <span
                                    key={idx}
                                    style={
                                      seg.op === 'add'
                                        ? { background: '#d9f7be' }
                                        : seg.op === 'del'
                                          ? { background: '#ffccc7', textDecoration: 'line-through' }
                                          : undefined
                                    }
                                  >
                                    {seg.text}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                        </div>

                        {/* Screenshot */}
                        {item.screenshotPath && (
                            <div style={{ marginBottom: 16 }}>
                                <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                                    <PictureOutlined /> {t('history.screenshot')}
                                </Text>
                                <div style={{ border: '1px solid #f0f0f0', borderRadius: 4, overflow: 'hidden', display: 'inline-block' }}>
                                    <Image 
                                        height={120}
                                        src={`/api/storage/screenshots/${item.screenshotPath}`}
                                        placeholder={<Image preview={false} src={`/api/storage/screenshots/${item.screenshotPath}?width=20`} />}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Attachments */}
                        {item.attachments && item.attachments.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                                <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                                    <DownloadOutlined /> {t('history.attachments')}
                                </Text>
                                <List
                                    size="small"
                                    dataSource={item.attachments}
                                    renderItem={file => (
                                        <List.Item style={{ padding: '4px 0' }}>
                                            <Space>
                                                <FileTextOutlined style={{ color: '#1890ff' }} />
                                                <a href={`/api/storage/downloads/${file.path}`} target="_blank" rel="noopener noreferrer">
                                                    {file.name}
                                                </a> 
                                                <Text type="secondary" style={{ fontSize: 12 }}>
                                                    ({(file.size / 1024).toFixed(1)} KB)
                                                </Text>
                                                {file.sourceLink ? (
                                                  <a href={file.sourceLink} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>
                                                    {t('history.source')}: {file.sourceTitle || file.sourceLink}
                                                  </a>
                                                ) : null}
                                            </Space>
                                        </List.Item>
                                    )}
                                />
                            </div>
                        )}

                        {/* HTML Snapshot */}
                        {item.htmlPath && (
                            <div style={{ marginTop: 12, textAlign: 'right' }}>
                                <Button 
                                    type="link" 
                                    size="small" 
                                    icon={<FileTextOutlined />}
                                    href={`/api/storage/archives/${item.htmlPath}`}
                                    target="_blank"
                                >
                                    {t('history.viewSnapshot')}
                                </Button>
                            </div>
                        )}
            </Card>
          ),
        }))}
      />
      {data.length === 0 && !loading && (
        <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>{t('history.noData')}</div>
      )}
    </Card>
  );
};

export default HistoryList;
