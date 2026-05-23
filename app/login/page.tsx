import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/auth/login-form";
import { Badge } from "@/components/ui/badge";

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="space-y-2 text-center">
          <p className="text-sm font-semibold text-foreground">NZT Studio</p>
          <Badge variant="outline">Private workspace</Badge>
        </div>
        <LoginForm />
        <p className="text-center text-xs text-muted-foreground">
          Acceso restringido · Solo uso interno
        </p>
      </div>
    </div>
  );
}
