import AuthRouter from "@/components/auth/AuthRouter";
import LoginForm from "./LoginForm";

function getSafeNextPath(next: string | string[] | undefined) {
  const value = Array.isArray(next) ? next[0] : next;
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  if (value.startsWith("/api")) return "/dashboard";
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const nextPath = getSafeNextPath(params?.next);

  return (
    <AuthRouter mode="public" redirectTo={nextPath}>
      <LoginForm nextPath={nextPath} />
    </AuthRouter>
  );
}
