import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic } from 'antd';
import { 
  GlobalOutlined, 
  CheckCircleOutlined, 
  AlertOutlined, 
  CloudDownloadOutlined 
} from '@ant-design/icons';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalMonitors: 0,
    activeMonitors: 0,
    changesLast24h: 0,
    downloadedFilesCount: 0
  });
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/dashboard/stats');
      setStats(res.data);
    } catch (error) {
      console.error(error);
      // Fail silently for dashboard or show generic error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>{t('dashboard.title')}</h2>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card variant="borderless">
            <Statistic
              title={t('dashboard.totalMonitors')}
              value={stats.totalMonitors}
              prefix={<GlobalOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card variant="borderless">
            <Statistic
              title={t('dashboard.activeMonitors')}
              value={stats.activeMonitors}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card variant="borderless">
            <Statistic
              title={t('dashboard.changes24h')}
              value={stats.changesLast24h}
              valueStyle={{ color: '#cf1322' }}
              prefix={<AlertOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card variant="borderless">
            <Statistic
              title={t('dashboard.filesDownloaded')}
              value={stats.downloadedFilesCount}
              prefix={<CloudDownloadOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>
      
      {/* Placeholder for charts or recent activity */}
      <Card title={t('dashboard.recentActivity')} style={{ marginTop: 24 }} variant="borderless">
        <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>
          {t('dashboard.recentEmpty')}
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
