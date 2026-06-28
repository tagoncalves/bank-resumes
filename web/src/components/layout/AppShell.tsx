"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { UploadModalProvider } from "@/components/upload/UploadModalProvider";
import { ToastProvider } from "@/components/ui/toast-provider";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ToastProvider>
      <UploadModalProvider>
        <div className="flex h-dvh overflow-hidden bg-background text-foreground">
          <Sidebar isMobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <Header onMenuClick={() => setSidebarOpen(true)} />
            <main className="app-content flex-1 overflow-y-auto overflow-x-auto bg-background/80 p-3 sm:p-4 lg:p-6">
              {children}
            </main>
          </div>
        </div>
      </UploadModalProvider>
    </ToastProvider>
  );
}
