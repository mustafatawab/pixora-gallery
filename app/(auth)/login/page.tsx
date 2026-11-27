import type { Metadata } from "next"
import { AuthShell } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"
import { safeNextPath } from "@/lib/auth/redirects"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = { title: "Sign in" }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { next, error } = await searchParams

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your Pixora account">
      <Card className="shadow-xl border-0">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-2xl font-bold">Sign In</CardTitle>
          <CardDescription>Enter your credentials to manage your galleries</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={safeNextPath(next)} callbackFailed={error === "auth_callback_failed"} />
        </CardContent>
      </Card>
    </AuthShell>
  )
}
