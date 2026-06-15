"use client";
import { create } from "zustand";

export type ParserAdminItem = {
  id: string;
  payslipId: string | null;
  statementId: string | null;
  sourceType: string;
  bankName: string | null;
  employerName: string | null;
  status: string;
  createdAt: string;
  reviewedBy: { username: string; displayName: string | null } | null;
  reviewedAt: string | null;
  payslip: {
    rawFilename: string;
    employerName: string | null;
    employeeName: string | null;
    periodLabel: string | null;
    payDate: string | null;
    netAmount: unknown;
    grossAmount: unknown;
    processingStatus: string;
    analysisProvider: string | null;
    analysisConfidence: number | null;
    analysisNotes: string | null;
    analysisStructuredJson: string | null;
    analysisModel: string | null;
    analysisPromptVersion: string | null;
  } | null;
  statement: {
    rawFilename: string;
    bankName: string | null;
    processingStatus: string;
    analysisProvider: string | null;
    analysisConfidence: number | null;
    analysisNotes: string | null;
    analysisStructuredJson: string | null;
    analysisModel: string | null;
    analysisPromptVersion: string | null;
    card: {
      holderName: string;
      lastFour: string;
      cardNetwork: string;
    } | null;
  } | null;
};

type ParserAdminState = {
  items: ParserAdminItem[];
  loading: boolean;
  savingId: string | null;
  expandedResult: string | null;
  fetch: () => Promise<void>;
  setSavingId: (id: string | null) => void;
  setExpandedResult: (id: string | null) => void;
  patchItem: (id: string, changes: Partial<ParserAdminItem>) => void;
};

export const useParserAdminStore = create<ParserAdminState>((set, get) => ({
  items: [],
  loading: true,
  savingId: null,
  expandedResult: null,

  fetch: async () => {
    const isInitial = get().items.length === 0;
    if (isInitial) set({ loading: true });

    try {
      const r = await fetch("/api/admin/ai-parsers");
      const data: ParserAdminItem[] = await r.json();
      set({ items: data, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setSavingId: (id) => set({ savingId: id }),
  setExpandedResult: (id) => set({ expandedResult: id }),

  patchItem: (id, changes) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...changes } : item,
      ),
    }));
  },
}));
