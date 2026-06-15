"use client";
import { create } from "zustand";

export type PayslipAdminItem = {
  id: string;
  rawFilename: string;
  employerName: string | null;
  employeeName: string | null;
  periodLabel: string | null;
  processingStatus: string;
  analysisProvider: string | null;
  analysisNotes: string | null;
  analysisStructuredJson: string | null;
  uploadedAt: string;
  user: { username: string; displayName: string | null } | null;
};

type PayslipAdminState = {
  items: PayslipAdminItem[];
  loading: boolean;
  error: string | null;
  actionId: string | null;
  fetch: () => Promise<void>;
  setActionId: (id: string | null) => void;
  setError: (err: string | null) => void;
  patchItem: (id: string, changes: Partial<PayslipAdminItem>) => void;
};

export const usePayslipAdminStore = create<PayslipAdminState>((set, get) => ({
  items: [],
  loading: true,
  error: null,
  actionId: null,

  fetch: async () => {
    const isInitial = get().items.length === 0;
    if (isInitial) set({ loading: true, error: null });

    try {
      const r = await fetch("/api/admin/payslips");
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? `Error ${r.status}`);
      }
      const data: PayslipAdminItem[] = await r.json();
      set({ items: data, error: null, loading: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error de red";
      set({ error: msg, loading: false });
    }
  },

  setActionId: (id) => set({ actionId: id }),
  setError: (err) => set({ error: err }),

  patchItem: (id, changes) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...changes } : item,
      ),
    }));
  },
}));
