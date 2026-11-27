"use client"

import Link from "next/link"
import { useActionState } from "react"
import { Mail, Lock } from "lucide-react"
import { loginAction } from "@/actions/auth"
import { initialFormState } from "@/lib/auth/form-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type LoginFormProps = {
  next: string
  callbackFailed?: boolean
}

export function LoginForm({ next, callbackFailed = false }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(loginAction, initialFormState)

  const errorMessage =
    state.status === "error" ? state.message : callbackFailed ? "That confirmation link is invalid or has expired." : undefined

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />

      {errorMessage && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="pl-10"
            required
            aria-invalid={Boolean(state.fieldErrors?.email)}
          />
        </div>
        {state.fieldErrors?.email && <p className="text-xs text-red-600">{state.fieldErrors.email}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            className="pl-10"
            required
            aria-invalid={Boolean(state.fieldErrors?.password)}
          />
        </div>
        {state.fieldErrors?.password && <p className="text-xs text-red-600">{state.fieldErrors.password}</p>}
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in..." : "Sign In"}
      </Button>

      <p className="text-center text-sm text-gray-600">
        {"Don't have an account? "}
        <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500">
          Create one
        </Link>
      </p>
    </form>
  )
}
