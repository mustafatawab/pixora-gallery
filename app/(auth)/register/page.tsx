import type { Metadata } from "next"
import Link from "next/link"
import { AuthShell } from "@/components/auth/auth-shell"
import { RegisterForm } from "@/components/auth/register-form"

export const metadata: Metadata = { title: "Create account" }

export default function RegisterPage() {
  return (
    <AuthShell
      title="Join Pixora."
      subtitle="A public gallery for your best frames — and a private archive for everything else."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="link-underline font-medium text-ink">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  )
}
