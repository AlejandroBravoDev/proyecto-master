import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { loginUser } from './services/authService';

const AUTH_STORAGE_KEY = 'masterfood_auth_user';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem(AUTH_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(false);

  const login = useCallback(async (username, password) => {
    setLoading(true);
    try {
      const userData = await loginUser({ username, password });
      setUser(userData);
      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
      return userData;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
  }, []);

  const isAdmin = useMemo(() => user?.role === 'ADMIN', [user]);
  const isAuthenticated = useMemo(() => Boolean(user && user.active), [user]);

  const value = useMemo(
    () => ({
      user,
      isAdmin,
      isAuthenticated,
      loading,
      login,
      logout,
    }),
    [user, isAdmin, isAuthenticated, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
