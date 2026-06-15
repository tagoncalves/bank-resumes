"use client";

import { useUploadModal } from "@/components/upload/UploadModalProvider";

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
    <button type={type} onClick={() => openModal(kind)} className={className}>
      {children}
    </button>
  );
}
