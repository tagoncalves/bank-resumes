import { useId } from "react";
import { cn } from "@/lib/utils";

type NerumMarkProps = {
  className?: string;
  title?: string;
};

export function NerumMark({ className, title = "Nerum isotipo" }: NerumMarkProps) {
  const id = useId().replace(/:/g, "");
  const strokeId = `${id}-nerum-mark-stroke`;
  const leafId = `${id}-nerum-leaf`;
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;

  return (
    <svg
      width="128"
      height="128"
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
      className={cn("h-8 w-8", className)}
    >
      <title id={titleId}>{title}</title>
      <desc id={descId}>Isotipo de Nerum Finance con una N fluida en verde petroleo y acento mint.</desc>
      <defs>
        <linearGradient id={strokeId} x1="18" y1="17" x2="111" y2="112" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--brand-logo-stroke-from, #0F3D37)" />
          <stop offset="1" stopColor="var(--brand-logo-stroke-to, #168570)" />
        </linearGradient>
        <linearGradient id={leafId} x1="69" y1="56" x2="101" y2="83" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--brand-logo-leaf-from, #A8DCC1)" />
          <stop offset="1" stopColor="var(--brand-logo-leaf-to, #74C7B7)" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="32" fill="var(--brand-logo-bg, #FAF8F3)" />
      <path
        d="M35.5 103.5C23.2 94 17 80.8 17 64C17 34.3 36.6 15 64 15C91.4 15 111 34.3 111 64C111 93.7 91.4 113 64 113C51.4 113 41.3 109.7 32.8 102.9"
        stroke={`url(#${strokeId})`}
        strokeWidth="8.5"
        strokeLinecap="round"
      />
      <path
        d="M39 86V45.5C39 39.4 46.2 36.3 50.7 40.4L78.2 65.6C83.7 70.7 92.5 66.8 92.5 59.3V42"
        stroke="var(--brand-logo-n, #0F3D37)"
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M70.8 76.4C74.1 62.2 85 53.9 100 55.8C98.5 70.8 87 80.8 70.8 76.4Z" fill={`url(#${leafId})`} />
      <path d="M74.8 72.8C81.4 68.4 88.2 64.7 96 60.6" stroke="var(--brand-logo-vein, #FAF8F3)" strokeWidth="2.4" strokeLinecap="round" opacity=".85" />
    </svg>
  );
}
