"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import type { ZodError } from "zod"
import { createClient } from "@/lib/supabase/server"
import { requireUser } from "@/lib/auth/current-user"
import { safeNextPath } from "@/lib/auth/redirects"
import type { FormState } from "@/lib/auth/form-state"
import { loginSchema, registerSchema, updateProfileSchema } from "@/lib/validation/auth"

function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message
  }
  return fieldErrors
}

function mapAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "Invalid email or password."
  if (/email not confirmed/i.test(message)) return "Please confirm your email before signing in."
  if (/already registered/i.test(message)) return "An account with this email already exists."
  if (/rate limit|too many/i.test(message)) return "Too many attempts. Please try again shortly."
  return "Something went wrong. Please try again."
}

async function getRequestOrigin(): Promise<string> {
  const headerStore = await headers()
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host")
  const proto =
    headerStore.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https")

  return host ? `${proto}://${host}` : "http://localhost:3000"
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { status: "error", message: mapAuthError(error.message) }
  }

  redirect(safeNextPath(parsed.data.next))
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) }
  }

  const { email, password, username, fullName } = parsed.data
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle()

  if (existing) {
    return { status: "error", fieldErrors: { username: "That username is already taken." } }
  }

  const origin = await getRequestOrigin()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, full_name: fullName },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/profile")}`,
    },
  })

  if (error) {
    if (/duplicate|unique|database error/i.test(error.message)) {
      return { status: "error", fieldErrors: { username: "That username is already taken." } }
    }
    return { status: "error", message: mapAuthError(error.message) }
  }

  // Supabase returns a user with no identities when the email already exists.
  if (data.user && data.user.identities?.length === 0) {
    return {
      status: "success",
      message: "If an account already exists for this email, check your inbox for a confirmation link.",
    }
  }

  if (data.session) {
    // Email confirmations are disabled (local development): the user is signed in.
    redirect("/profile")
  }

  return {
    status: "success",
    message: "Account created. Check your email to confirm your address, then sign in.",
  }
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/")
}

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/profile")
  const parsed = updateProfileSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) }
  }

  const { fullName, username, bio } = parsed.data
  const supabase = await createClient()

  const { data: conflict } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .neq("id", user.id)
    .maybeSingle()

  if (conflict) {
    return { status: "error", fieldErrors: { username: "That username is already taken." } }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, username, bio: bio || null })
    .eq("id", user.id)

  if (error) {
    if (error.code === "23505") {
      return { status: "error", fieldErrors: { username: "That username is already taken." } }
    }
    return { status: "error", message: "Could not update your profile. Please try again." }
  }

  revalidatePath("/", "layout")
  revalidatePath("/profile")
  return { status: "success", message: "Profile updated." }
}
