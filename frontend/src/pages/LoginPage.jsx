import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography, message, Layout } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';

const { Title } = Typography;
const { Content } = Layout;

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { authenticated, login } = useAuth();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      await login(values.password);
      message.success(t('common.login') + ' ' + t('common.success', { defaultValue: 'Success' }));
      navigate('/');
    } catch (error) {
      message.error(t('common.loginFailed', { defaultValue: 'Login failed, please check password' }));
    } finally {
      setLoading(false);
    }
  };

  if (authenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <Layout style={{ minHeight: '100vh', justifyContent: 'center', alignItems: 'center' }} className="login-page">
      <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
        <Card style={{ width: 360 }} bordered={false}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
             <Title level={3}>WebMonitor</Title>
             <Typography.Text type="secondary">Admin Access</Typography.Text>
          </div>
          
          <Form
            name="login"
            onFinish={onFinish}
          >
            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Please input your password!' }]}
            >
              <Input.Password 
                prefix={<LockOutlined />} 
                placeholder={t('common.password')} 
                size="large"
              />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                {t('common.login')}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Content>
    </Layout>
  );
};

export default LoginPage;
