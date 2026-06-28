"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { X } from "lucide-react";
import StatementUploadPanel from "@/components/upload/StatementUploadPanel";
import PayslipUploadPanel from "@/components/payslips/PayslipUploadPanel";

type UploadModalKind = "statement" | "payslip";

type UploadModalContextValue = {
  openModal: (kind: UploadModalKind) => void;
  closeModal: () => void;
  isOpen: boolean;
  kind: UploadModalKind | null;
};

const UploadModalContext = createContext<UploadModalContextValue | null>(null);

export function UploadModalProvider({ children }: { children: React.ReactNode }) {
  const [kind, setKind] = useState<UploadModalKind | null>(null);

  const value = useMemo<UploadModalContextValue>(() => ({
    openModal: (nextKind) => setKind(nextKind),
    closeModal: () => setKind(null),
    isOpen: kind !== null,
    kind,
  }), [kind]);

  return (
    <UploadModalContext.Provider value={value}>
      {children}
      {kind && <UploadModal kind={kind} onClose={() => setKind(null)} />}
    </UploadModalContext.Provider>
  );
}

export function useUploadModal() {
  const context = useContext(UploadModalContext);
  if (!context) {
    throw new Error("useUploadModal debe usarse dentro de UploadModalProvider");
  }

  return context;
}

function UploadModal({ kind, onClose }: { kind: UploadModalKind; onClose: () => void }) {
  const title = kind === "statement" ? "Importar resumen" : "Cargar recibo de sueldo";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div
        className="max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-surface text-foreground shadow-xl sm:max-h-[calc(100dvh-2rem)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[calc(100dvh-5.5rem)] overflow-y-auto p-3 sm:p-5">
          {kind === "statement"
            ? <StatementUploadPanel onComplete={onClose} />
            : <PayslipUploadPanel onComplete={onClose} />}
        </div>
      </div>
    </div>
  );
}
