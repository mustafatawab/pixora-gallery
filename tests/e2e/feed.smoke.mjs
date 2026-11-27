/**
 * End-to-end visibility + feed smoke test using the locally installed Chrome.
 *
 * Prerequisites:
 *   bun run db:start && bun run db:reset
 *   bun run dev
 *
 * Run: bun run test:e2e:feed
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
const email = `e2e-feed-${suffix}@example.com`
const username = `e2e_feed_${suffix}`
const fullName = "Feed Tester"
const password = "password123"
const title = `E2E feed ${suffix}`

// 1x1 transparent PNG.
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
)

async function findUser() {
  const { data } = await admin.auth.admin.listUsers()
  return data.users.find((user) => user.email === email) ?? null
}

async function waitFor(check, message, timeout = 20_000) {
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

async function expectHeadingCount(page, name, expected) {
  await waitFor(
    async () => (await page.getByRole("heading", { name }).count()) === expected,
    `expected ${expected} heading(s) named "${name}"`,
  )
}

const browser = await chromium.launch({ channel: "chrome", headless: true })

try {
  const ownerContext = await browser.newContext()
  const page = await ownerContext.newPage()

  // Register a throwaway user (local stack has email confirmations disabled).
  await page.goto(`${BASE_URL}/register`)
  await page.getByLabel("Full name").fill(fullName)
  await page.getByLabel("Username").fill(username)
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByLabel("Confirm password").fill(password)
  await page.getByRole("button", { name: "Create Account" }).click()
  await page.waitForURL(`${BASE_URL}/profile`, { timeout: 30_000 })

  // Upload a private image (the default).
  await page.goto(`${BASE_URL}/upload`)
  await page.locator('input[type="file"]').setInputFiles({
    name: "e2e-feed.png",
    mimeType: "image/png",
    buffer: png,
  })
  await page.locator("#title").fill(title)
  await page.getByRole("button", { name: "Upload 1 Image" }).click()

  await page.waitForURL(`${BASE_URL}/profile?tab=private`, { timeout: 30_000 })
  await page.getByRole("heading", { name: title }).waitFor({ timeout: 30_000 })

  const user = await findUser()
  assert.ok(user, "test user should exist")

  const { data: rows } = await admin.from("images").select("id, title, visibility").eq("owner_id", user.id)
  const row = rows?.find((candidate) => candidate.title === title)
  assert.ok(row, "image metadata should be inserted")
  assert.equal(row.visibility, "private")

  const anonContext = await browser.newContext()
  const anonPage = await anonContext.newPage()

  // Private images must not leak into the anonymous feed or public profile.
  await anonPage.goto(`${BASE_URL}/`)
  await expectHeadingCount(anonPage, title, 0)

  await anonPage.goto(`${BASE_URL}/u/${username}`)
  await expectHeadingCount(anonPage, title, 0)

  // Owner publishes it from the dashboard.
  await page.bringToFront()
  await page.getByRole("button", { name: "Make public" }).click()
  await waitFor(async () => {
    const { data } = await admin.from("images").select("visibility").eq("id", row.id).single()
    return data?.visibility === "public"
  }, "visibility should become public")
  await page.getByRole("heading", { name: title }).waitFor({ state: "detached", timeout: 30_000 })

  // Anonymous visitors now see it on the home feed and public profile.
  await anonPage.goto(`${BASE_URL}/`)
  await anonPage.getByRole("heading", { name: title }).waitFor({ timeout: 30_000 })

  const preview = anonPage.getByRole("img", { name: title })
  await preview.waitFor({ timeout: 30_000 })
  await waitFor(
    () => preview.evaluate((element) => element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0),
    "public feed preview should load",
  )

  await anonPage.goto(`${BASE_URL}/u/${username}`)
  await anonPage.getByRole("heading", { name: title }).waitFor({ timeout: 30_000 })

  // Owner makes it private again; it disappears everywhere for visitors.
  await page.bringToFront()
  await page.goto(`${BASE_URL}/profile?tab=public`)
  await page.getByRole("heading", { name: title }).waitFor({ timeout: 30_000 })
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: "Make private" }).click()
  await waitFor(async () => {
    const { data } = await admin.from("images").select("visibility").eq("id", row.id).single()
    return data?.visibility === "private"
  }, "visibility should become private")
  await page.getByRole("heading", { name: title }).waitFor({ state: "detached", timeout: 30_000 })

  await anonPage.goto(`${BASE_URL}/`)
  await expectHeadingCount(anonPage, title, 0)

  await anonPage.goto(`${BASE_URL}/u/${username}`)
  await expectHeadingCount(anonPage, title, 0)

  console.log("E2E feed smoke passed")
} finally {
  await browser.close()
  await cleanup()
}
