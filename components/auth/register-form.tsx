"use client"

import Link from "next/link"
import { useActionState } from "react"
import { registerAction } from "@/actions/auth"
import { initialFormState } from "@/lib/auth/form-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initialFormState)

  if (state.status === "success") {
    return (
      <div className="border-l-2 border-brand pl-4">
        <h2 className="font-serif text-2xl leading-tight text-ink">Check your inbox</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{state.message}</p>
        <Button asChild variant="outline" className="mt-6 w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.status === "error" && state.message && (
        <p role="alert" className="border-l-2 border-destructive pl-3 text-sm leading-relaxed text-destructive">
          {state.message}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            placeholder="John Doe"
            required
            aria-invalid={Boolean(state.fieldErrors?.fullName)}
          />
          {state.fieldErrors?.fullName && <p className="text-xs text-destructive">{state.fieldErrors.fullName}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            placeholder="johndoe"
            required
            aria-invalid={Boolean(state.fieldErrors?.username)}
          />
          {state.fieldErrors?.username && <p className="text-xs text-destructive">{state.fieldErrors.username}</p>}
        </div>
      </div>

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

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            required
            aria-invalid={Boolean(state.fieldErrors?.password)}
          />
          {state.fieldErrors?.password && <p className="text-xs text-destructive">{state.fieldErrors.password}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat password"
            required
            aria-invalid={Boolean(state.fieldErrors?.confirmPassword)}
          />
          {state.fieldErrors?.confirmPassword && (
            <p className="text-xs text-destructive">{state.fieldErrors.confirmPassword}</p>
          )}
        </div>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  )
}
