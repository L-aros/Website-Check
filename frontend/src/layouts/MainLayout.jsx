import React, { useState } from 'react';
import { Layout, Menu, Button, theme, Drawer, Dropdown, Space, Avatar } from 'antd';
import { 
  DashboardOutlined, 
  UnorderedListOutlined, 
  PlusCircleOutlined,
  InboxOutlined,
  SettingOutlined,
  MenuOutlined,
  MoonOutlined,
  SunOutlined,
  GlobalOutlined,
  UserOutlined,
  LogoutOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  StopOutlined
} from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from 'react-i18next';

const { Header, Content, Sider } = Layout;

const MainLayout = ({ children }) => {
  const { isDarkMode, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const {
    token: { colorBgContainer, colorBgElevated },
  } = theme.useToken();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: <Link to="/" onClick={() => setMobileMenuOpen(false)}>{t('menu.dashboard')}</Link>,
    },
    {
      type: 'group',
      label: t('menu.monitors'),
      children: [
        {
          key: '/monitors',
          icon: <UnorderedListOutlined />,
          label: <Link to="/monitors" onClick={() => setMobileMenuOpen(false)}>{t('menu.all')}</Link>,
        },
        {
          key: '/monitors?status=active',
          icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
          label: <Link to="/monitors?status=active" onClick={() => setMobileMenuOpen(false)}>{t('menu.running')}</Link>,
        },
        {
          key: '/monitors?status=error',
          icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
          label: <Link to="/monitors?status=error" onClick={() => setMobileMenuOpen(false)}>{t('menu.error')}</Link>,
        },
        {
          key: '/monitors?status=paused',
          icon: <StopOutlined style={{ color: '#faad14' }} />,
          label: <Link to="/monitors?status=paused" onClick={() => setMobileMenuOpen(false)}>{t('menu.stopped')}</Link>,
        },
      ]
    },
    {
      key: '/create',
      icon: <PlusCircleOutlined />,
      label: <Link to="/create" onClick={() => setMobileMenuOpen(false)}>{t('menu.newMonitor')}</Link>,
    },
    {
      key: '/downloads',
      icon: <InboxOutlined />,
      label: <Link to="/downloads" onClick={() => setMobileMenuOpen(false)}>{t('menu.downloads')}</Link>,
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: <Link to="/settings" onClick={() => setMobileMenuOpen(false)}>{t('menu.settings')}</Link>,
    },
  ];

  const userMenu = {
    items: [
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: t('common.logout'),
            onClick: handleLogout
        }
    ]
  };

  const langMenu = {
      items: [
          {
              key: 'en',
              label: 'English',
              onClick: () => changeLanguage('en')
          },
          {
              key: 'zh',
              label: '简体中文',
              onClick: () => changeLanguage('zh')
          }
      ]
  };

  // Determine selected key based on path and query
  const getSelectedKey = () => {
      if (location.pathname === '/monitors') {
          const params = new URLSearchParams(location.search);
          const status = params.get('status');
          if (status) return `/monitors?status=${status}`;
          return '/monitors';
      }
      return location.pathname;
  };

  return (
    <Layout style={{ minHeight: '100vh' }} className="app-shell">
      {/* Desktop Sider */}
      <Sider 
        breakpoint="lg" 
        collapsedWidth="0"
        trigger={null}
        style={{
            display: 'none', 
        }}
        className="desktop-sider"
        width={220}
      >
        <div
          className="demo-logo-vertical"
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isDarkMode ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.88)',
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 0.2,
          }}
        >
           {t('app.title')}
        </div>
        <Menu
          theme={isDarkMode ? 'dark' : 'light'}
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          defaultOpenKeys={['/monitors']}
          items={menuItems}
        />
      </Sider>

      {/* Mobile Drawer */}
      <Drawer
        placement="left"
        onClose={() => setMobileMenuOpen(false)}
        open={mobileMenuOpen}
        styles={{ body: { padding: 0 } }}
        width={250}
        className="glass-drawer"
      >
         <Menu
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          defaultOpenKeys={['/monitors']}
          items={menuItems}
          style={{ borderRight: 0 }}
        />
      </Drawer>

      <Layout>
        <Header
          className="app-header"
          style={{
            margin: '16px 24px 0',
            padding: '0 18px',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: 18,
          }}
        >
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <Button 
                    type="text" 
                    icon={<MenuOutlined />} 
                    onClick={() => setMobileMenuOpen(true)}
                    className="mobile-menu-btn"
                />
                <span style={{ fontSize: 18, fontWeight: 700, marginLeft: 16 }}>{t('app.title')}</span>
            </div>
            
            <Space size="large">
                <Button 
                    shape="circle" 
                    icon={isDarkMode ? <SunOutlined /> : <MoonOutlined />} 
                    onClick={toggleTheme}
                />
                
                <Dropdown menu={langMenu}>
                    <Button shape="circle" icon={<GlobalOutlined />} />
                </Dropdown>

                <Dropdown menu={userMenu}>
                    <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#0A84FF', cursor: 'pointer' }} />
                </Dropdown>
            </Space>
        </Header>
        <Content className="app-content" style={{ margin: '16px 24px 24px', overflow: 'initial' }}>
            {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
