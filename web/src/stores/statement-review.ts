"use client";
import { create } from "zustand";

export type ReviewStatementItem = {
  id: string;
  bankName: string;
  holderName: string;
  cardLastFour: string;
  cardNetwork: string;
  periodEnd: string;
  dueDate: string;
  uploadedAt: string;
  processingStatus: "PRELIMINARY" | "REVIEW_REQUIRED" | "REJECTED" | "COMPLETED";
  analysisProvider?: string | null;
  analysisModel?: string | null;
  analysisPromptVersion?: string | null;
  analysisConfidence?: number | null;
  analysisNotes?: string | null;
  analysisStructuredJson?: string | null;
  sourceTextExcerpt?: string | null;
  aiRequestPayload?: string | null;
  aiRawResponse?: string | null;
  latestJobId?: string | null;
  latestJobStatus?: string | null;
  latestJobAttempts: number;
  latestJobLastProcessedAt?: string | null;
  reviewNotes?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  transactionCount: number;
  currentBalance: number;
};

type ReviewStatementState = {
  items: ReviewStatementItem[];
  loading: boolean;
  error: string | null;
  savingId: string | null;
  notes: Record<string, string>;
  expandedEvidenceId: string | null;
  fetch: () => Promise<void>;
  setSavingId: (id: string | null) => void;
  setError: (err: string | null) => void;
  setNote: (id: string, note: string) => void;
  setExpandedEvidenceId: (id: string | null) => void;
  patchItem: (id: string, changes: Partial<ReviewStatementItem>) => void;
};

export const useReviewStore = create<ReviewStatementState>((set, get) => ({
  items: [],
  loading: true,
  error: null,
  savingId: null,
  notes: {},
  expandedEvidenceId: null,

  fetch: async () => {
    const isInitial = get().items.length === 0;
    if (isInitial) set({ loading: true, error: null });

    try {
      const res = await fetch("/api/admin/review-statements");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudieron cargar los resúmenes");
      set({ items: json, error: null, loading: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      set({ error: msg, loading: false });
    }
  },

  setSavingId: (id) => set({ savingId: id }),
  setError: (err) => set({ error: err }),
  setNote: (id, note) => {
    set((state) => ({ notes: { ...state.notes, [id]: note } }));
  },
  setExpandedEvidenceId: (id) => set({ expandedEvidenceId: id }),

  patchItem: (id, changes) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...changes } : item,
      ),
    }));
  },
}));
