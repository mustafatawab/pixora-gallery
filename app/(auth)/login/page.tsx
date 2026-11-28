import type { Metadata } from "next"
import Link from "next/link"
import { AuthShell } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"
import { safeNextPath } from "@/lib/auth/redirects"

export const metadata: Metadata = { title: "Sign in" }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { next, error } = await searchParams

  return (
    <AuthShell
      title="Welcome back."
      subtitle="Sign in to publish new work and keep your archive in order."
      footer={
        <>
          New to Pixora?{" "}
          <Link href="/register" className="link-underline font-medium text-ink">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm next={safeNextPath(next)} callbackFailed={error === "auth_callback_failed"} />
    </AuthShell>
  )
}
