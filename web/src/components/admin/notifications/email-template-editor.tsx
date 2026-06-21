"use client";

import { useEffect, useRef } from "react";
import { EmailEditor, type EmailEditorRef } from "@react-email/editor";

export function EmailTemplateEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const editorRef = useRef<EmailEditorRef>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function scheduleExport(ref: EmailEditorRef) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const html = await ref.getEmailHTML();
      if (html) onChange(html);
    }, 500);
  }

  async function syncNow() {
    const html = await editorRef.current?.getEmailHTML();
    if (html) onChange(html);
  }

  return (
    <div className="space-y-2">
      <div className="min-h-[360px] overflow-hidden rounded border border-zinc-200 bg-white">
        <EmailEditor
          ref={editorRef}
          content={value}
          theme="basic"
          placeholder="Editá el template del email..."
          onUpdate={scheduleExport}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>Editor visual React Email. Usá el modo código si necesitás ajustar HTML o variables.</span>
        <button type="button" onClick={syncNow} className="text-indigo-600 hover:underline">
          Sincronizar HTML
        </button>
      </div>
    </div>
  );
}
