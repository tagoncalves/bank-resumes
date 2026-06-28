"use client";

import { useUploadModal } from "@/components/upload/UploadModalProvider";
import { cn } from "@/lib/utils";

export default function OpenUploadButton({
  kind,
  className,
  children,
  type = "button",
}: {
  kind: "statement" | "payslip";
  className?: string;
  children: React.ReactNode;
  type?: "button" | "submit" | "reset";
}) {
  const { openModal } = useUploadModal();

  return (
    <button
      type={type}
      onClick={() => openModal(kind)}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-primary px-4 py-2 text-sm font-medium text-[var(--color-on-primary)] transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}
