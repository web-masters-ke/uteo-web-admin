'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserRole } from './types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  hasRole: (roles: UserRole[]) => boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('uteo-admin-token');
    const storedUser = localStorage.getItem('uteo-admin-user');
    if (storedToken && storedUser) {
      try { setToken(storedToken); setUser(JSON.parse(storedUser)); }
      catch { localStorage.removeItem('uteo-admin-token'); localStorage.removeItem('uteo-admin-user'); }
    }
    setLoading(false);
  }, []);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('uteo-admin-token', newToken);
    localStorage.setItem('uteo-admin-user', JSON.stringify(newUser));
    setToken(newToken); setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('uteo-admin-token'); localStorage.removeItem('uteo-admin-user');
    setToken(null); setUser(null); window.location.href = '/login';
  };

  const hasRole = (roles: UserRole[]) => { if (!user) return false; return roles.includes(user.role); };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token, hasRole, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
