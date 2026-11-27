import { createHash, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cleanupUploadEvents } from "@/lib/rate-limit/upload"
import { cleanupOrphanObjects, ORPHAN_MAX_AGE_MS } from "@/lib/storage/cleanup"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function digest(value: string) {
  return createHash("sha256").update(value).digest()
}

function isAuthorized(request: Request, secret: string): boolean {
  const header = request.headers.get("authorization") ?? ""
  const provided = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : ""

  if (!provided) return false

  // Hash both sides so the comparison is constant-time even for different lengths.
  return timingSafeEqual(digest(provided), digest(secret))
}

/**
 * Daily orphan cleanup. Vercel Cron calls this with
 * `Authorization: Bearer $CRON_SECRET`; the secret is required so the endpoint
 * cannot be used by the public to trigger bucket-wide deletes.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET

  if (!secret) {
    console.error("[cleanup] CRON_SECRET is not configured")
    return NextResponse.json({ error: "Cleanup is not configured." }, { status: 503 })
  }

  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const [result, quotaCleanup] = await Promise.all([
      cleanupOrphanObjects(admin, { minAgeMs: ORPHAN_MAX_AGE_MS }),
      cleanupUploadEvents(admin),
    ])

    const errors = quotaCleanup.error ? [...result.errors, quotaCleanup.error] : result.errors
    const payload = {
      ...result,
      errors,
      uploadEventsDeleted: quotaCleanup.deleted,
    }

    if (errors.length > 0) {
      console.error("[cleanup] completed with errors", payload)
    } else {
      console.info("[cleanup] completed", payload)
    }

    return NextResponse.json({ ok: errors.length === 0, ...payload }, { status: errors.length > 0 ? 500 : 200 })
  } catch (error) {
    console.error("[cleanup] failed", error)
    return NextResponse.json({ error: "Cleanup failed." }, { status: 500 })
  }
}
