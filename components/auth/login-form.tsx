"use client"

import { useActionState } from "react"
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
    state.status === "error"
      ? state.message
      : callbackFailed
        ? "That confirmation link is invalid or has expired."
        : undefined

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />

      {errorMessage && (
        <p role="alert" className="border-l-2 border-destructive pl-3 text-sm leading-relaxed text-destructive">
          {errorMessage}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          aria-invalid={Boolean(state.fieldErrors?.email)}
        />
        {state.fieldErrors?.email && <p className="text-xs text-destructive">{state.fieldErrors.email}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          required
          aria-invalid={Boolean(state.fieldErrors?.password)}
        />
        {state.fieldErrors?.password && <p className="text-xs text-destructive">{state.fieldErrors.password}</p>}
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  )
}
