import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

type AuthRouterMode = "public" | "private" | "admin";

interface AuthRouterProps {
  children: React.ReactNode;
  mode?: AuthRouterMode;
  redirectTo?: string;
}

export default async function AuthRouter({
  children,
  mode = "private",
  redirectTo,
}: AuthRouterProps) {
  const session = await getSession();

  if (mode === "public") {
    if (session) redirect(redirectTo ?? "/dashboard");
    return <>{children}</>;
  }

  if (!session) {
    redirect(redirectTo ?? "/login");
  }

  if (mode === "admin" && session.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
