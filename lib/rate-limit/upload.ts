import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/types/database"

/**
 * Upload quota helpers.
 *
 * The actual counter lives in Postgres (`public.consume_upload_quota`), so it
 * works across serverless instances and cannot be reset by the browser. The
 * SQL function hard-codes the limit; this module only formats the result.
 */

export const UPLOAD_QUOTA_LIMIT = 30
export const UPLOAD_QUOTA_WINDOW_HOURS = 1
export const UPLOAD_EVENT_RETENTION_DAYS = 7

export type UploadQuotaResult = {
  allowed: boolean
  used: number
  remaining: number
  resetAt: string | null
}

type ServerSupabase = SupabaseClient<Database>

/**
 * Records an upload attempt and reports whether it is allowed. Returns `null`
 * when the quota check itself fails; callers fail open so a transient database
 * error does not block a legitimate upload (the metadata insert would fail
 * anyway if the database were truly unavailable).
 */
export async function consumeUploadQuota(supabase: ServerSupabase): Promise<UploadQuotaResult | null> {
  const { data, error } = await supabase.rpc("consume_upload_quota")

  if (error) {
    console.error("[rate-limit] upload quota check failed", { error: error.message })
    return null
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null

  return {
    allowed: row.allowed,
    used: row.used,
    remaining: row.remaining,
    resetAt: row.reset_at,
  }
}

export type UploadEventCleanup = {
  deleted: number
  error: string | null
}

/** Removes expired quota events. Called by the daily cron job. */
export async function cleanupUploadEvents(admin: ServerSupabase): Promise<UploadEventCleanup> {
  const cutoff = new Date(Date.now() - UPLOAD_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { error, count } = await admin.from("upload_events").delete({ count: "exact" }).lt("created_at", cutoff)

  if (error) {
    console.error("[rate-limit] could not remove expired upload events", { error: error.message })
    return { deleted: 0, error: error.message }
  }

  return { deleted: count ?? 0, error: null }
}
