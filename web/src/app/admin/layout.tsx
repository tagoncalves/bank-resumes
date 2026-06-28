import AuthRouter from "@/components/auth/AuthRouter";
import AppShell from "@/components/layout/AppShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthRouter mode="admin">
      <AppShell>{children}</AppShell>
    </AuthRouter>
  );
}
