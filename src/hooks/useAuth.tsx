"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AuthMethod = "apple" | "google" | "otp" | "password" | "signup" | "demo";

export type AuthUser = {
  id: string;
  email: string;
  method: AuthMethod;
};

const STORAGE_KEY = "trader-otto:session";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  signIn: (user: Omit<AuthUser, "id"> & { id?: string }) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      setUser(raw ? (JSON.parse(raw) as AuthUser) : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = useCallback((next: Omit<AuthUser, "id"> & { id?: string }) => {
    const user: AuthUser = {
      id: next.id ?? crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
      email: next.email,
      method: next.method,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    setUser(user);
  }, []);

  const signOut = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signOut }),
    [user, loading, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
