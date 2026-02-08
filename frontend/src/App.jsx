import React from 'react';
import { ConfigProvider, theme, App as AntdApp } from 'antd';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import MonitorList from './pages/MonitorList';
import MonitorForm from './pages/MonitorForm';
import HistoryList from './pages/HistoryList';
import Downloads from './pages/Downloads';
import Settings from './pages/Settings';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import axios from 'axios';

// Axios Interceptor for Token
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

const AppContent = () => {
  const { isDarkMode } = useTheme();
  const glass = isDarkMode
    ? {
        colorPrimary: '#0A84FF',
        colorBgLayout: 'transparent',
        colorBgContainer: 'rgba(20, 20, 24, 0.55)',
        colorBgElevated: 'rgba(28, 28, 30, 0.72)',
        colorBorderSecondary: 'rgba(255, 255, 255, 0.10)',
        colorText: 'rgba(255, 255, 255, 0.92)',
        colorTextSecondary: 'rgba(255, 255, 255, 0.68)',
        borderRadius: 14,
        borderRadiusLG: 16,
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.45)',
        boxShadowSecondary: '0 6px 24px rgba(0, 0, 0, 0.35)',
      }
    : {
        colorPrimary: '#007AFF',
        colorBgLayout: 'transparent',
        colorBgContainer: 'rgba(255, 255, 255, 0.60)',
        colorBgElevated: 'rgba(255, 255, 255, 0.78)',
        colorBorderSecondary: 'rgba(255, 255, 255, 0.26)',
        colorText: 'rgba(0, 0, 0, 0.88)',
        colorTextSecondary: 'rgba(0, 0, 0, 0.55)',
        borderRadius: 14,
        borderRadiusLG: 16,
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.12)',
        boxShadowSecondary: '0 6px 24px rgba(0, 0, 0, 0.10)',
      };

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: glass,
      }}
    >
      <AntdApp>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            
            <Route path="/" element={
              <ProtectedRoute>
                <MainLayout>
                  <Dashboard />
                </MainLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/monitors" element={
              <ProtectedRoute>
                <MainLayout>
                  <MonitorList />
                </MainLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/create" element={
              <ProtectedRoute>
                <MainLayout>
                  <MonitorForm />
                </MainLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/edit/:id" element={
              <ProtectedRoute>
                <MainLayout>
                  <MonitorForm />
                </MainLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/history/:id" element={
              <ProtectedRoute>
                <MainLayout>
                  <HistoryList />
                </MainLayout>
              </ProtectedRoute>
            } />

            <Route path="/downloads" element={
              <ProtectedRoute>
                <MainLayout>
                  <Downloads />
                </MainLayout>
              </ProtectedRoute>
            } />

            <Route path="/settings" element={
              <ProtectedRoute>
                <MainLayout>
                  <Settings />
                </MainLayout>
              </ProtectedRoute>
            } />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  );
};

const App = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App;
