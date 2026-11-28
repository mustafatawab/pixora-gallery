/**
 * End-to-end auth smoke test using the locally installed Chrome.
 *
 * Prerequisites:
 *   bun run db:start && bun run db:reset
 *   bun run dev
 *
 * Run: bun run test:e2e:auth
 */
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
const email = `e2e-${suffix}@example.com`
const username = `e2e_${suffix}`
const fullName = "E2E Tester"
const password = "password123"

const confirmEmail = `e2e-confirm-${suffix}@example.com`
const confirmUsername = `e2e_c_${suffix}`
const confirmFullName = "Confirm Flow"

async function cleanup() {
  const { data } = await admin.auth.admin.listUsers()
  for (const candidate of data.users) {
    if (candidate.email === email || candidate.email === confirmEmail) {
      await admin.auth.admin.deleteUser(candidate.id)
    }
  }
}

const browser = await chromium.launch({ channel: "chrome", headless: true })

try {
  const context = await browser.newContext()
  const page = await context.newPage()

  // 1. Unauthenticated access to a protected route redirects to login with `next`.
  await page.goto(`${BASE_URL}/upload`)
  await page.waitForURL(/\/login\?next=%2Fupload/, { timeout: 30_000 })

  // 2. Register (local stack has email confirmations disabled).
  await page.goto(`${BASE_URL}/register`)
  await page.getByLabel("Full name").fill(fullName)
  await page.getByLabel("Username").fill(username)
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByLabel("Confirm password").fill(password)
  await page.getByRole("button", { name: "Create account" }).click()
  await page.waitForURL(`${BASE_URL}/profile`, { timeout: 30_000 })
  await page.getByRole("heading", { name: fullName }).waitFor()
  await page.getByText(`@${username}`).first().waitFor()

  // 3. Navbar reflects the session; sign out.
  await page.getByRole("button", { name: "Account menu" }).click()
  await page.getByText("Sign out").click()
  await page.waitForURL(`${BASE_URL}/`, { timeout: 30_000 })
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Sign in" }).waitFor()

  // 4. Protected route redirects, then login honors the safe `next` path.
  await page.goto(`${BASE_URL}/profile`)
  await page.waitForURL(/\/login\?next=%2Fprofile/, { timeout: 30_000 })
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL(`${BASE_URL}/profile`, { timeout: 30_000 })

  // 5. Upload page is reachable while authenticated.
  await page.goto(`${BASE_URL}/upload`)
  await page.getByRole("heading", { name: "Add to your archive." }).waitFor()

  // 6. Email confirmation callback (token_hash flow) creates a session.
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "signup",
    email: confirmEmail,
    password,
    options: { data: { username: confirmUsername, full_name: confirmFullName } },
  })

  if (linkError) throw new Error(`generateLink failed: ${linkError.message}`)

  const tokenHash = linkData.properties.hashed_token
  const verificationType = linkData.properties.verification_type ?? "signup"

  const confirmContext = await browser.newContext()
  const confirmPage = await confirmContext.newPage()
  await confirmPage.goto(
    `${BASE_URL}/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=${verificationType}&next=${encodeURIComponent("/profile")}`,
  )
  await confirmPage.waitForURL(`${BASE_URL}/profile`, { timeout: 30_000 })
  await confirmPage.getByRole("heading", { name: confirmFullName }).waitFor()
  await confirmContext.close()

  console.log("E2E auth smoke passed")
} finally {
  await browser.close()
  await cleanup()
}
