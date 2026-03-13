import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api, { setUnauthorizedHandler } from '../lib/api';

const AuthContext = createContext(null);

const emptyState = {
  authenticated: false,
  user: null,
};

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState(emptyState);
  const [loading, setLoading] = useState(true);

  const applyLoggedOutState = () => {
    setAuthState(emptyState);
    setLoading(false);
  };

  const refreshSession = async () => {
    try {
      const res = await api.get('/api/auth/session', { skipAuthRedirect: true });
      if (res.data?.authenticated) {
        setAuthState({
          authenticated: true,
          user: res.data.user || null,
        });
      } else {
        setAuthState(emptyState);
      }
    } catch {
      setAuthState(emptyState);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setUnauthorizedHandler(applyLoggedOutState);
    refreshSession();
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = async (password) => {
    await api.post(
      '/api/auth/login',
      { password },
      { skipAuthRedirect: true }
    );
    await refreshSession();
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout', {}, { skipAuthRedirect: true });
    } finally {
      applyLoggedOutState();
    }
  };

  const value = useMemo(
    () => ({
      ...authState,
      loading,
      login,
      logout,
      refreshSession,
    }),
    [authState, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
