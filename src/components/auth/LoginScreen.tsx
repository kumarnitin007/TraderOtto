"use client";

import { useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type Step = "email" | "otp" | "signup" | "reset";

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.417 2.06-1.25 2.86-1.003.94-2.15 1.43-3.28 1.33-.14-1.1.42-2.1 1.28-2.9.86-.8 2.06-1.35 3.06-1.39.03.03.19.06.19.1zM20.6 17.24c-.55 1.24-.81 1.79-1.52 2.87-.98 1.5-2.37 3.38-4.09 3.4-1.53.02-1.93-1-4.01-.99-2.08.01-2.52 1.01-4.05.99-1.72-.02-3.03-1.7-4.02-3.2C.14 16.5-.47 12.3 1.03 9.7c1.07-1.86 2.86-2.95 4.53-2.95 1.7 0 2.77 1 4.17 1 1.36 0 2.19-1 4.16-1 1.5 0 3.08.82 4.2 2.24-3.69 2.03-3.1 7.3 2.5 8.25-.28.71-.44.99-.99 1.99z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#4285F4" d="M45 24c0-1.6-.14-3.14-.4-4.6H24v9h11.8c-.5 2.7-2.05 5-4.36 6.55v5.4h7.05C42.6 36.5 45 30.8 45 24z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.85-1.95 14.47-5.3l-7.05-5.4c-1.96 1.3-4.47 2.08-7.42 2.08-5.7 0-10.53-3.85-12.25-9.02H4.5v5.57C8.1 41.05 15.5 46 24 46z" />
      <path fill="#FBBC05" d="M11.75 28.36A13.4 13.4 0 0 1 11 24c0-1.52.27-2.99.75-4.36v-5.57H4.5A22 22 0 0 0 2 24c0 3.55.85 6.9 2.5 9.93z" />
      <path fill="#EA4335" d="M24 10.75c3.2 0 6.08 1.1 8.35 3.26l6.26-6.26C34.84 4.2 29.9 2 24 2 15.5 2 8.1 6.95 4.5 14.07l7.25 5.57c1.72-5.17 6.55-9.02 12.25-8.89z" />
    </svg>
  );
}

function Divider({ children }: { children: string }) {
  return (
    <div className="my-[22px] flex items-center gap-3">
      <div className="h-px flex-1 bg-otto-divider" />
      <span className="text-[12.5px] text-otto-text-faint">{children}</span>
      <div className="h-px flex-1 bg-otto-divider" />
    </div>
  );
}

export function LoginScreen() {
  const {
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
  } = useAuth();
  const canAuth = configured && !usingServiceRole;
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [digits, setDigits] = useState(Array(6).fill(""));
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const validEmail = /\S+@\S+\.\S+/.test(email);
  const codeComplete = digits.every((d) => d !== "");

  function handleDigit(index: number, value: string) {
    if (!/^[0-9]?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < 5) inputs.current[index + 1]?.focus();
  }

  return (
    <div className="flex min-h-screen justify-center bg-otto-bg text-otto-text">
      <div className="flex min-h-screen w-full max-w-[380px] flex-col px-6 pb-10 pt-14">
        {step !== "email" && (
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setNotice("");
              setDigits(Array(6).fill(""));
            }}
            className="mb-8 flex items-center gap-1 self-start bg-transparent p-0 text-[13.5px] text-otto-text-dim"
          >
            <ChevronLeft size={16} />
            {step === "otp" ? "Change email" : "Back"}
          </button>
        )}

        {step === "email" && (
          <div className="mb-9 mt-5">
            <div className="mb-7 flex items-center gap-2">
              <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-otto-green text-[15px] font-extrabold text-black">
                O
              </div>
              <span className="text-base font-bold">Trader Otto</span>
            </div>
            <h1 className="mb-2 text-[25px] font-extrabold tracking-[-0.3px]">
              Log in or sign up
            </h1>
            <p className="text-sm leading-snug text-otto-text-dim">
              Track every spread, one trade at a time.
            </p>
          </div>
        )}

        {usingServiceRole && (
          <div className="mb-4 rounded-xl border border-otto-amber/30 bg-otto-amber-soft px-3 py-2.5 text-xs text-otto-amber">
            Supabase is reachable, but this is the service-role key. Paste the anon public key to enable login.
          </div>
        )}
        {!configured && (
          <div className="mb-4 rounded-xl border border-otto-red/30 bg-otto-red-soft px-3 py-2.5 text-xs text-otto-red">
            Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart the app.
          </div>
        )}

        {step === "email" && (
          <>
            <button
              type="button"
              disabled={busy || !canAuth}
              onClick={() => void signInWithOAuth("apple")}
              className="mb-2.5 flex w-full items-center justify-center gap-2.5 rounded-full bg-white py-[13px] text-[14.5px] font-semibold text-black disabled:opacity-50"
            >
              <AppleIcon />
              Continue with Apple
            </button>
            <button
              type="button"
              disabled={busy || !canAuth}
              onClick={() => void signInWithOAuth("google")}
              className="mb-2.5 flex w-full items-center justify-center gap-2.5 rounded-full bg-white py-[13px] text-[14.5px] font-semibold text-black disabled:opacity-50"
            >
              <GoogleIcon />
              Continue with Google
            </button>

            <Divider>or continue with email</Divider>

            <label className="mb-1.5 block text-xs font-medium text-otto-text-dim">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="mb-4"
            />

            <button
              type="button"
              disabled={!validEmail || busy || !canAuth}
              onClick={async () => {
                setNotice("");
                setBusy(true);
                const sent = await sendOtp(email.trim());
                setBusy(false);
                if (sent) {
                  setDigits(Array(6).fill(""));
                  setStep("otp");
                }
              }}
              className={`w-full rounded-full py-3.5 text-[15px] font-bold ${
                validEmail && canAuth
                  ? "bg-otto-green text-black"
                  : "bg-otto-surface text-otto-text-faint"
              }`}
            >
              {busy ? "Sending…" : "Continue"}
            </button>
            <p className="mt-3.5 text-center text-xs leading-relaxed text-otto-text-faint">
              We’ll email you a one-time code — no password to remember.
            </p>

            <Divider>or</Divider>

            <label className="mb-1.5 block text-xs font-medium text-otto-text-dim">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="mb-2"
            />
            <button
              type="button"
              onClick={() => {
                setStep("reset");
                setNotice("");
              }}
              className="mb-4 self-end bg-transparent p-0 text-right text-xs font-medium text-otto-green"
            >
              Forgot password?
            </button>
            <button
              type="button"
              disabled={!validEmail || password.length < 6 || busy || !canAuth}
              onClick={async () => {
                setNotice("");
                setBusy(true);
                await signInWithPassword(email.trim(), password);
                setBusy(false);
              }}
              className={`mb-2.5 w-full rounded-full py-3.5 text-[15px] font-bold ${
                validEmail && password.length >= 6 && canAuth
                  ? "bg-otto-green text-black"
                  : "bg-otto-surface text-otto-text-faint"
              }`}
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("signup");
                setNotice("");
              }}
              className="mb-2.5 w-full rounded-full border-2 border-otto-green py-[13px] text-[14.5px] font-semibold text-otto-text"
            >
              Create a new account
            </button>
            <button
              type="button"
              onClick={skipLogin}
              className="w-full rounded-full border border-otto-divider bg-otto-surface py-[13px] text-[14.5px] font-semibold text-otto-text-dim"
            >
              Skip login for now
            </button>
          </>
        )}

        {step === "otp" && (
          <>
            <h1 className="mb-2 text-[25px] font-extrabold tracking-[-0.3px]">
              Enter your code
            </h1>
            <p className="mb-7 text-sm leading-snug text-otto-text-dim">
              We sent a 6-digit code to{" "}
              <span className="font-semibold text-otto-text">{email}</span>
            </p>
            <div className="mb-6 flex gap-2">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputs.current[index] = el;
                  }}
                  value={digit}
                  onChange={(event) => handleDigit(index, event.target.value.slice(-1))}
                  onKeyDown={(event) => {
                    if (event.key === "Backspace" && !digits[index] && index > 0) {
                      inputs.current[index - 1]?.focus();
                    }
                  }}
                  inputMode="numeric"
                  maxLength={1}
                  className={`rounded-[10px] border bg-otto-surface py-3 text-center text-xl font-bold ${
                    digit ? "border-otto-green" : "border-otto-divider"
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              disabled={!codeComplete || busy}
              onClick={async () => {
                setBusy(true);
                await verifyOtp(email.trim(), digits.join(""));
                setBusy(false);
              }}
              className={`mb-4 w-full rounded-full py-3.5 text-[15px] font-bold ${
                codeComplete ? "bg-otto-green text-black" : "bg-otto-surface text-otto-text-faint"
              }`}
            >
              {busy ? "Verifying…" : "Verify & continue"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const sent = await sendOtp(email.trim());
                setBusy(false);
                if (sent) setNotice("Code resent. Check your inbox.");
              }}
              className="w-full bg-transparent text-center text-[13.5px] text-otto-text-dim"
            >
              Didn’t get it? <span className="font-semibold text-otto-green">Resend code</span>
            </button>
          </>
        )}

        {step === "signup" && (
          <>
            <h1 className="mb-2 text-[25px] font-extrabold tracking-[-0.3px]">
              Create an account
            </h1>
            <p className="mb-7 text-sm leading-snug text-otto-text-dim">
              Use email and a password. We’ll send a confirmation if your project requires it.
            </p>
            <label className="mb-1.5 block text-xs font-medium text-otto-text-dim">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="mb-4"
            />
            <label className="mb-1.5 block text-xs font-medium text-otto-text-dim">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              className="mb-5"
            />
            <button
              type="button"
              disabled={!validEmail || password.length < 6 || busy || !canAuth}
              onClick={async () => {
                setNotice("");
                setBusy(true);
                const pending = await signUpWithPassword(email.trim(), password);
                setBusy(false);
                if (pending) setNotice(pending);
              }}
              className={`mb-2.5 w-full rounded-full py-3.5 text-[15px] font-bold ${
                validEmail && password.length >= 6 && canAuth
                  ? "bg-otto-green text-black"
                  : "bg-otto-surface text-otto-text-faint"
              }`}
            >
              {busy ? "Creating…" : "Create account"}
            </button>
            <button
              type="button"
              onClick={skipLogin}
              className="w-full rounded-full border border-otto-divider bg-otto-surface py-[13px] text-[14.5px] font-semibold text-otto-text-dim"
            >
              Skip login for now
            </button>
          </>
        )}

        {step === "reset" && (
          <>
            <h1 className="mb-2 text-[25px] font-extrabold tracking-[-0.3px]">
              Reset password
            </h1>
            <p className="mb-7 text-sm leading-snug text-otto-text-dim">
              We’ll email a reset link if that address exists.
            </p>
            <label className="mb-1.5 block text-xs font-medium text-otto-text-dim">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="mb-5"
            />
            <button
              type="button"
              disabled={!validEmail || busy || !canAuth}
              onClick={async () => {
                setNotice("");
                setBusy(true);
                const sent = await resetPassword(email.trim());
                setBusy(false);
                if (sent) setNotice("Reset email sent. Check your inbox.");
              }}
              className={`w-full rounded-full py-3.5 text-[15px] font-bold ${
                validEmail && canAuth
                  ? "bg-otto-green text-black"
                  : "bg-otto-surface text-otto-text-faint"
              }`}
            >
              {busy ? "Sending…" : "Send reset email"}
            </button>
          </>
        )}

        {(notice || error) && (
          <div className={`mt-4 text-center text-xs font-medium ${error ? "text-otto-red" : "text-otto-amber"}`}>
            {error || notice}
          </div>
        )}

        <div className="flex-1" />
        <p className="mt-8 text-center text-[11.5px] leading-relaxed text-otto-text-faint">
          By continuing, you agree to Trader Otto’s Terms and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
