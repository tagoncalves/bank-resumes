import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { UploadModalProvider } from "@/components/upload/UploadModalProvider";
import { ToastProvider } from "@/components/ui/toast-provider";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <UploadModalProvider>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header />
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
          </div>
        </div>
      </UploadModalProvider>
    </ToastProvider>
  );
}
