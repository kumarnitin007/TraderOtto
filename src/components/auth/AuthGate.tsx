"use client";

import type { ReactNode } from "react";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { useAuth } from "@/hooks/useAuth";

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-otto-bg" />;
  }
  if (!user) return <LoginScreen />;
  return <>{children}</>;
}
