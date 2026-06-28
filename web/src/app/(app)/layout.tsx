import AuthRouter from "@/components/auth/AuthRouter";
import AppShell from "@/components/layout/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthRouter mode="private">
      <AppShell>{children}</AppShell>
    </AuthRouter>
  );
}
