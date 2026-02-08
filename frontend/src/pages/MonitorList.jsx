import React, { useEffect, useState } from 'react';
import { List, Card, Button, Tag, Popconfirm, App, Typography, Tooltip, Space, Avatar } from 'antd';
import { 
  EditOutlined, 
  DeleteOutlined, 
  HistoryOutlined, 
  ThunderboltOutlined,
  GlobalOutlined,
  ClockCircleOutlined,
  PaperClipOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  StopFilled
} from '@ant-design/icons';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const MonitorList = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = App.useApp();
  const { t } = useTranslation();

  const fetchMonitors = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/monitors');
      setData(res.data);
    } catch (error) {
      message.error('Failed to load monitors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitors();
  }, []);

  const handleDelete = async (id) => {
    try {
      await axios.delete(`/api/monitors/${id}`);
      message.success(t('common.delete') + ' ' + t('common.success', { defaultValue: 'Success' }));
      fetchMonitors();
    } catch (error) {
      message.error('Failed to delete monitor');
    }
  };

  const handleCheckNow = async (id) => {
    try {
      await axios.post(`/api/monitors/${id}/check`);
      message.success(t('common.checkNow') + ' ' + t('common.success', { defaultValue: 'Success' }));
    } catch (error) {
      message.error('Failed to trigger check');
    }
  };

  // Filter logic
  const getFilteredData = () => {
      const params = new URLSearchParams(location.search);
      const statusFilter = params.get('status');
      
      if (!statusFilter) return data;
      return data.filter(item => item.status === statusFilter);
  };

  const filteredData = getFilteredData();

  const getStatusIcon = (status) => {
      switch(status) {
          case 'active': return <CheckCircleFilled style={{ color: '#52c41a' }} />;
          case 'error': return <CloseCircleFilled style={{ color: '#ff4d4f' }} />;
          case 'paused': return <StopFilled style={{ color: '#faad14' }} />;
          default: return <StopFilled style={{ color: '#d9d9d9' }} />;
      }
  };

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{t('monitorList.title')} ({filteredData.length})</h2>
        <Space>
             <Button type="primary" onClick={fetchMonitors}>{t('common.refresh')}</Button>
             <Button type="primary" icon={<EditOutlined />} onClick={() => navigate('/create')}>
                {t('menu.newMonitor')}
             </Button>
        </Space>
      </div>
      
      <List
        dataSource={filteredData}
        loading={loading}
        renderItem={(item) => (
          <List.Item>
            <Card
               variant="borderless"
               style={{ width: '100%', borderRadius: 0, borderBottom: '1px solid #f0f0f0' }}
               styles={{ body: { padding: '12px 24px' } }}
            >
               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                   {/* Left: Icon & Name & URL */}
                   <div style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden' }}>
                       <div style={{ marginRight: 16, fontSize: 18 }}>
                           {getStatusIcon(item.status)}
                       </div>
                       <div style={{ overflow: 'hidden' }}>
                           <div style={{ fontWeight: 500, fontSize: 16, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                               <Link to={`/edit/${item.id}`} style={{ color: 'inherit' }}>
                                   {item.name || 'Unnamed Monitor'}
                               </Link>
                           </div>
                           <div style={{ color: '#888', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                               <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: '#888' }}>{item.url}</a>
                           </div>
                       </div>
                   </div>

                   {/* Middle: Status & Info */}
                   <div style={{ display: 'flex', alignItems: 'center', gap: 24, margin: '0 24px' }}>
                       {item.downloadAttachments && (
                           <Tag icon={<PaperClipOutlined />} color="blue" style={{ margin: 0 }}>
                               {t('monitorList.autoDownload')}
                           </Tag>
                       )}
                       <div style={{ textAlign: 'right', minWidth: 120 }}>
                           <div style={{ fontSize: 12, color: '#888' }}>{t('monitorList.lastCheck')}</div>
                           <div style={{ fontSize: 13 }}>
                               {item.lastCheckTime ? new Date(item.lastCheckTime).toLocaleString() : t('monitorList.never')}
                           </div>
                       </div>
                   </div>

                   {/* Right: Actions */}
                   <Space size="middle">
                        <Tooltip title={t('common.checkNow')}>
                            <Button 
                                type="text" 
                                icon={<ThunderboltOutlined />} 
                                onClick={() => handleCheckNow(item.id)}
                            />
                        </Tooltip>
                        <Tooltip title={t('common.viewHistory')}>
                            <Button 
                                type="text" 
                                icon={<HistoryOutlined />} 
                                onClick={() => navigate(`/history/${item.id}`)}
                            />
                        </Tooltip>
                        <Tooltip title={t('common.edit')}>
                            <Button 
                                type="text" 
                                icon={<EditOutlined />} 
                                onClick={() => navigate(`/edit/${item.id}`)}
                            />
                        </Tooltip>
                        <Popconfirm
                            title={t('common.delete')}
                            onConfirm={() => handleDelete(item.id)}
                            okText={t('common.submit')}
                            cancelText={t('common.cancel')}
                        >
                            <Button type="text" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                   </Space>
               </div>
            </Card>
          </List.Item>
        )}
      />
    </div>
  );
};

export default MonitorList;
