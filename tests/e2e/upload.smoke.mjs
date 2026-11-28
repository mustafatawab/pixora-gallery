/**
 * End-to-end upload smoke test using the locally installed Chrome.
 *
 * Prerequisites:
 *   bun run db:start && bun run db:reset
 *   bun run dev
 *
 * Run: bun run test:e2e:upload
 */
import assert from "node:assert/strict"
import { chromium } from "playwright-core"
import { createClient } from "@supabase/supabase-js"

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000"
const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321"
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const suffix = Date.now().toString(36)
const email = `e2e-upload-${suffix}@example.com`
const username = `e2e_up_${suffix}`
const fullName = "Upload Tester"
const password = "password123"
const title = `E2E upload ${suffix}`

// 1x1 transparent PNG.
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
)

async function findUser() {
  const { data } = await admin.auth.admin.listUsers()
  return data.users.find((user) => user.email === email) ?? null
}

async function waitFor(check, message, timeout = 15_000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await check()) return
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out: ${message}`)
}

async function listFolder(userId) {
  const { data, error } = await admin.storage.from("media").list(userId, { limit: 100 })
  if (error) throw new Error(`storage list failed: ${error.message}`)
  return (data ?? []).filter((entry) => entry.id !== null).map((entry) => entry.name)
}

async function cleanup() {
  const user = await findUser()
  if (!user) return

  const names = await listFolder(user.id).catch(() => [])
  if (names.length > 0) {
    await admin.storage.from("media").remove(names.map((name) => `${user.id}/${name}`))
  }
  await admin.auth.admin.deleteUser(user.id)
}

const browser = await chromium.launch({ channel: "chrome", headless: true })

try {
  const context = await browser.newContext()
  const page = await context.newPage()

  // Register a throwaway user (local stack has email confirmations disabled).
  await page.goto(`${BASE_URL}/register`)
  await page.getByLabel("Full name").fill(fullName)
  await page.getByLabel("Username").fill(username)
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByLabel("Confirm password").fill(password)
  await page.getByRole("button", { name: "Create account" }).click()
  await page.waitForURL(`${BASE_URL}/profile`, { timeout: 30_000 })

  // Upload a private image (the default).
  await page.goto(`${BASE_URL}/upload`)
  await page.locator('input[type="file"]').setInputFiles({
    name: "e2e-upload.png",
    mimeType: "image/png",
    buffer: png,
  })
  await page.locator("#title").fill(title)

  const submit = page.getByRole("button", { name: "Upload 1 image" })
  await submit.waitFor()
  await submit.click()

  await page.waitForURL(`${BASE_URL}/profile?tab=private`, { timeout: 30_000 })
  await page.getByRole("heading", { name: title }).waitFor({ timeout: 30_000 })

  const preview = page.getByRole("img", { name: title })
  await preview.waitFor({ timeout: 30_000 })
  await waitFor(
    () => preview.evaluate((element) => element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0),
    "signed preview URL should load",
  )

  const user = await findUser()
  assert.ok(user, "test user should exist")

  const { data: rows, error: rowsError } = await admin
    .from("images")
    .select("id, owner_id, title, storage_path, thumbnail_path, mime_type, visibility")
    .eq("owner_id", user.id)
  assert.equal(rowsError, null)

  const row = rows.find((candidate) => candidate.title === title)
  assert.ok(row, "image metadata should be inserted")
  assert.equal(row.visibility, "private")
  assert.equal(row.mime_type, "image/png")
  assert.ok(row.storage_path.startsWith(`${user.id}/`), "object path must be owner-scoped")
  assert.ok(row.thumbnail_path, "thumbnail path should be stored")
  assert.ok(row.thumbnail_path.startsWith(`${user.id}/`), "thumbnail path must be owner-scoped")
  assert.ok(row.thumbnail_path.includes(".thumb."), "thumbnail path should use the derivative suffix")

  const objectName = row.storage_path.slice(user.id.length + 1)
  const thumbnailName = row.thumbnail_path.slice(user.id.length + 1)
  await waitFor(
    async () => {
      const names = await listFolder(user.id)
      return names.includes(objectName) && names.includes(thumbnailName)
    },
    "stored original and thumbnail should exist",
  )

  // Delete the image: the row and the stored object must both disappear.
  await page.getByRole("button", { name: `Delete ${title}` }).click()
  const dialog = page.getByRole("alertdialog")
  await dialog.waitFor()
  await dialog.getByRole("button", { name: "Delete", exact: true }).click()

  await page.getByRole("heading", { name: title }).waitFor({ state: "detached", timeout: 30_000 })

  await waitFor(async () => {
    const { data } = await admin.from("images").select("id").eq("id", row.id)
    return (data ?? []).length === 0
  }, "image row should be deleted")

  await waitFor(
    async () => {
      const names = await listFolder(user.id)
      return !names.includes(objectName) && !names.includes(thumbnailName)
    },
    "stored original and thumbnail should be deleted",
  )

  console.log("E2E upload smoke passed")
} finally {
  await browser.close()
  await cleanup()
}
