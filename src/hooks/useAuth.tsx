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
import type { User } from "@supabase/supabase-js";
import {
  getSupabaseClient,
  isServiceRoleKey,
  isSupabaseConfigured,
} from "@/lib/supabase";

export type AuthMethod = "apple" | "google" | "otp" | "password" | "signup" | "demo";

export type AuthUser = {
  id: string;
  email: string;
  method: AuthMethod;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  configured: boolean;
  usingServiceRole: boolean;
  error: string;
  signInWithPassword: (email: string, password: string) => Promise<boolean>;
  signUpWithPassword: (email: string, password: string) => Promise<string | null>;
  sendOtp: (email: string) => Promise<boolean>;
  verifyOtp: (email: string, token: string) => Promise<boolean>;
  signInWithOAuth: (provider: "google" | "apple") => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  skipLogin: () => void;
  signOut: () => Promise<void>;
};

const BYPASS_KEY = "trader-otto:bypass-auth";
const BYPASS_USER: AuthUser = {
  id: "local-bypass",
  email: "bypass@local",
  method: "demo",
};

const AuthContext = createContext<AuthContextValue | null>(null);

function hasBypassCookie() {
  return document.cookie
    .split(";")
    .some((part) => part.trim() === `${BYPASS_KEY}=1`);
}

function setBypassCookie(enabled: boolean) {
  document.cookie = enabled
    ? `${BYPASS_KEY}=1; Path=/; Max-Age=2592000; SameSite=Lax`
    : `${BYPASS_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function mapUser(user: User): AuthUser {
  const provider = user.app_metadata?.provider;
  const method: AuthMethod =
    provider === "google"
      ? "google"
      : provider === "apple"
        ? "apple"
        : "password";
  return {
    id: user.id,
    email: user.email ?? "",
    method,
  };
}

function messageFrom(error: { message?: string } | null) {
  return error?.message || "Something went wrong. Try again.";
}

function missingConfigMessage() {
  if (isServiceRoleKey()) {
    return "Use the anon public key in NEXT_PUBLIC_SUPABASE_ANON_KEY, not the service role.";
  }
  return "Supabase is not configured.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const configured = isSupabaseConfigured();
  const usingServiceRole = isServiceRoleKey();

  useEffect(() => {
    const bypass = hasBypassCookie();
    const supabase = getSupabaseClient();
    if (!supabase) {
      setUser(bypass ? BYPASS_USER : null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session?.user) setUser(mapUser(data.session.user));
      else setUser(bypass ? BYPASS_USER : null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setBypassCookie(false);
        setUser(mapUser(session.user));
        return;
      }
      const stillBypass = hasBypassCookie();
      setUser(stillBypass ? BYPASS_USER : null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const supabase = getSupabaseClient();
    setError("");
    if (!supabase) {
      setError(missingConfigMessage());
      return false;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setError(messageFrom(signInError));
      return false;
    }
    return true;
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    const supabase = getSupabaseClient();
    setError("");
    if (!supabase) {
      setError(missingConfigMessage());
      return null;
    }
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (signUpError) {
      setError(messageFrom(signUpError));
      return null;
    }
    if (data.session?.user) return null;
    return "Check your email to confirm the account, then sign in.";
  }, []);

  const sendOtp = useCallback(async (email: string) => {
    const supabase = getSupabaseClient();
    setError("");
    if (!supabase) {
      setError(missingConfigMessage());
      return false;
    }
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (otpError) {
      setError(messageFrom(otpError));
      return false;
    }
    return true;
  }, []);

  const verifyOtp = useCallback(async (email: string, token: string) => {
    const supabase = getSupabaseClient();
    setError("");
    if (!supabase) {
      setError(missingConfigMessage());
      return false;
    }
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    if (verifyError) {
      setError(messageFrom(verifyError));
      return false;
    }
    return true;
  }, []);

  const signInWithOAuth = useCallback(async (provider: "google" | "apple") => {
    const supabase = getSupabaseClient();
    setError("");
    if (!supabase) {
      setError(missingConfigMessage());
      return false;
    }
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (oauthError) {
      setError(messageFrom(oauthError));
      return false;
    }
    return true;
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const supabase = getSupabaseClient();
    setError("");
    if (!supabase) {
      setError(missingConfigMessage());
      return false;
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    if (resetError) {
      setError(messageFrom(resetError));
      return false;
    }
    return true;
  }, []);

  const skipLogin = useCallback(() => {
    setError("");
    setBypassCookie(true);
    setUser(BYPASS_USER);
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    setError("");
    setBypassCookie(false);
    if (supabase) await supabase.auth.signOut();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      configured,
      usingServiceRole,
      error,
      signInWithPassword,
      signUpWithPassword,
      sendOtp,
      verifyOtp,
      signInWithOAuth,
      resetPassword,
      skipLogin,
      signOut,
    }),
    [
      user,
      loading,
      configured,
      usingServiceRole,
      error,
      signInWithPassword,
      signUpWithPassword,
      sendOtp,
      verifyOtp,
      signInWithOAuth,
      resetPassword,
      skipLogin,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
