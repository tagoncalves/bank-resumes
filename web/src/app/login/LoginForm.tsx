"use client";

import { useState } from "react";
import type { FormEvent, HTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import { NerumMark } from "@/components/brand/nerum-mark";

interface LoginFormProps {
  nextPath: string;
}

type Mode = "login" | "register" | "verify";

interface PendingVerification {
  username: string;
  email: string;
  mailtoUrl: string;
}

export default function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ username: "", email: "", password: "" });
  const [verifyForm, setVerifyForm] = useState({ username: "", code: "" });
  const [pendingVerification, setPendingVerification] = useState<PendingVerification | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setError(null);
    setMessage(null);
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginForm),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      if (data.error === "EMAIL_NOT_VERIFIED") {
        setVerifyForm((current) => ({ ...current, username: loginForm.username }));
        setMode("verify");
        setError(data.message ?? "Validá tu email antes de iniciar sesión");
        return;
      }

      setError(data.error ?? "Error al iniciar sesión");
      return;
    }

    router.push(nextPath);
    router.refresh();
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registerForm),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Error al registrarse");
      return;
    }

    const pending = {
      username: data.username as string,
      email: data.email as string,
      mailtoUrl: data.mailtoUrl as string,
    };
    setPendingVerification(pending);
    setVerifyForm({ username: pending.username, code: "" });
    setMode("verify");
    setMessage("Cuenta creada. Abrí el correo generado y pegá la clave de validación.");
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const res = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(verifyForm),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Error al validar email");
      return;
    }

    setLoginForm((current) => ({ ...current, username: verifyForm.username }));
    setMode("login");
    setMessage(data.message ?? "Email validado. Ya podés iniciar sesión.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <NerumMark className="h-14 w-14 shadow-card" />
          <p className="text-xl font-semibold text-foreground">Nerum Finance</p>
          <p className="text-sm text-muted">Gestor de resúmenes bancarios</p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 shadow-card sm:p-8">
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-[var(--radius-md)] bg-surface-alt p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`rounded-[var(--radius-sm)] px-3 py-2 transition-colors ${mode === "login" ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
            >
              Ingresar
            </button>
            <button
              type="button"
              onClick={() => switchMode("register")}
              className={`rounded-[var(--radius-sm)] px-3 py-2 transition-colors ${mode === "register" ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
            >
              Registrarse
            </button>
          </div>

          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <h1 className="text-base font-semibold text-foreground">Iniciar sesión</h1>
              <TextField
                label="Usuario"
                autoComplete="username"
                value={loginForm.username}
                onChange={(value) => setLoginForm((form) => ({ ...form, username: value }))}
              />
              <TextField
                label="Contraseña"
                type="password"
                autoComplete="current-password"
                value={loginForm.password}
                onChange={(value) => setLoginForm((form) => ({ ...form, password: value }))}
              />
              <Feedback message={message} error={error} />
              <button type="submit" disabled={loading} className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-[var(--color-on-primary)] hover:bg-primary-hover disabled:opacity-50">
                {loading ? "Ingresando..." : "Ingresar"}
              </button>
              <button type="button" onClick={() => switchMode("verify")} className="w-full text-xs font-medium text-primary hover:underline">
                Ya tengo una clave de validación
              </button>
            </form>
          )}

          {mode === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <h1 className="text-base font-semibold text-foreground">Crear cuenta</h1>
                <p className="mt-1 text-xs text-muted">Se generará un correo con una clave para validar tu email.</p>
              </div>
              <TextField
                label="Usuario"
                autoComplete="username"
                value={registerForm.username}
                onChange={(value) => setRegisterForm((form) => ({ ...form, username: value }))}
              />
              <TextField
                label="Email"
                type="email"
                autoComplete="email"
                value={registerForm.email}
                onChange={(value) => setRegisterForm((form) => ({ ...form, email: value }))}
              />
              <TextField
                label="Contraseña"
                type="password"
                autoComplete="new-password"
                value={registerForm.password}
                onChange={(value) => setRegisterForm((form) => ({ ...form, password: value }))}
              />
              <Feedback message={message} error={error} />
              <button type="submit" disabled={loading} className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-[var(--color-on-primary)] hover:bg-primary-hover disabled:opacity-50">
                {loading ? "Creando..." : "Crear cuenta"}
              </button>
            </form>
          )}

          {mode === "verify" && (
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <h1 className="text-base font-semibold text-foreground">Validar email</h1>
                <p className="mt-1 text-xs text-muted">Ingresá la clave recibida por correo para habilitar el login.</p>
              </div>
              {pendingVerification?.mailtoUrl && (
                <a
                  href={pendingVerification.mailtoUrl}
                  className="block rounded-lg border border-border bg-surface-alt px-3 py-2 text-center text-sm font-medium text-primary hover:bg-[var(--color-hover)]"
                >
                  Abrir correo con clave
                </a>
              )}
              {pendingVerification?.email && (
                <p className="text-center text-[11px] text-muted">Destino: {pendingVerification.email}</p>
              )}
              <TextField
                label="Usuario"
                autoComplete="username"
                value={verifyForm.username}
                onChange={(value) => setVerifyForm((form) => ({ ...form, username: value }))}
              />
              <TextField
                label="Clave de validación"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={verifyForm.code}
                onChange={(value) => setVerifyForm((form) => ({ ...form, code: value }))}
              />
              <Feedback message={message} error={error} />
              <button type="submit" disabled={loading} className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-[var(--color-on-primary)] hover:bg-primary-hover disabled:opacity-50">
                {loading ? "Validando..." : "Validar email"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      <input
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}

function Feedback({ message, error }: { message: string | null; error: string | null }) {
  if (error) {
    return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>;
  }

  if (message) {
    return <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600">{message}</p>;
  }

  return null;
}
