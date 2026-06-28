"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";

type ToastTone = "success" | "info" | "error";

type ToastItem = {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
};

type ToastContextValue = {
  showToast: (toast: Omit<ToastItem, "id">) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((toast: Omit<ToastItem, "id">) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 3500);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast debe usarse dentro de ToastProvider");
  }

  return context;
}

function ToastCard({ toast }: { toast: ToastItem }) {
  const tones: Record<ToastTone, { icon: typeof Info; classes: string }> = {
    success: { icon: CheckCircle2, classes: "border-[color-mix(in_srgb,var(--color-income)_30%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-income)_12%,var(--color-surface))] text-income" },
    info: { icon: Info, classes: "border-[color-mix(in_srgb,var(--color-primary)_30%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-primary)_12%,var(--color-surface))] text-primary" },
    error: { icon: XCircle, classes: "border-[color-mix(in_srgb,var(--color-expense)_30%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-expense)_12%,var(--color-surface))] text-expense" },
  };

  const config = tones[toast.tone];
  const Icon = config.icon;

  return (
    <div className={`pointer-events-auto rounded-[var(--radius-md)] border px-4 py-3 shadow-card ${config.classes}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="text-sm font-medium">{toast.title}</p>
          {toast.description && <p className="mt-0.5 text-xs opacity-80">{toast.description}</p>}
        </div>
      </div>
    </div>
  );
}
