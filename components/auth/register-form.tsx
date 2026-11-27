"use client"

import Link from "next/link"
import { useActionState } from "react"
import { Mail, Lock, User } from "lucide-react"
import { registerAction } from "@/actions/auth"
import { initialFormState } from "@/lib/auth/form-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initialFormState)

  if (state.status === "success") {
    return (
      <div className="space-y-4 rounded-lg border bg-white p-6 text-center">
        <h2 className="text-lg font-semibold text-gray-900">Check your inbox</h2>
        <p className="text-sm text-gray-600">{state.message}</p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status === "error" && state.message && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.message}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              placeholder="John Doe"
              className="pl-10"
              required
              aria-invalid={Boolean(state.fieldErrors?.fullName)}
            />
          </div>
          {state.fieldErrors?.fullName && <p className="text-xs text-red-600">{state.fieldErrors.fullName}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">@</span>
            <Input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              placeholder="johndoe"
              className="pl-8"
              required
              aria-invalid={Boolean(state.fieldErrors?.username)}
            />
          </div>
          {state.fieldErrors?.username && <p className="text-xs text-red-600">{state.fieldErrors.username}</p>}
        </div>
      </div>

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="pl-10"
              required
              aria-invalid={Boolean(state.fieldErrors?.password)}
            />
          </div>
          {state.fieldErrors?.password && <p className="text-xs text-red-600">{state.fieldErrors.password}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat password"
              className="pl-10"
              required
              aria-invalid={Boolean(state.fieldErrors?.confirmPassword)}
            />
          </div>
          {state.fieldErrors?.confirmPassword && (
            <p className="text-xs text-red-600">{state.fieldErrors.confirmPassword}</p>
          )}
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account..." : "Create Account"}
      </Button>

      <p className="text-center text-sm text-gray-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
          Sign in
        </Link>
      </p>
    </form>
  )
}
