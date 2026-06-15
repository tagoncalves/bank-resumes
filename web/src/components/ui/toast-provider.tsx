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
    success: { icon: CheckCircle2, classes: "border-emerald-200 bg-emerald-50 text-emerald-900" },
    info: { icon: Info, classes: "border-indigo-200 bg-indigo-50 text-indigo-900" },
    error: { icon: XCircle, classes: "border-red-200 bg-red-50 text-red-900" },
  };

  const config = tones[toast.tone];
  const Icon = config.icon;

  return (
    <div className={`pointer-events-auto rounded-xl border px-4 py-3 shadow-lg ${config.classes}`}>
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
