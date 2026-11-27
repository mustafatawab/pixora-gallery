#!/usr/bin/env node
/**
 * Fails the build if a server-only secret appears in the browser bundle.
 *
 * Run after `next build`:
 *   bun run check:client-secrets
 *
 * The scan never prints the secret itself — only the offending file and a
 * category — so CI logs stay safe.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const ROOT = process.cwd()
const CLIENT_DIR = join(ROOT, ".next", "static")

const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g
const SECRET_MARKERS = [
  { label: "service-role env name", pattern: /SUPABASE_SERVICE_ROLE_KEY/ },
  { label: "cron secret env name", pattern: /\bCRON_SECRET\b/ },
  { label: "private key material", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { label: "Stripe live secret", pattern: /\bsk_live_[A-Za-z0-9]{16,}/ },
]

function walk(dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    const stats = statSync(path)
    if (stats.isDirectory()) files.push(...walk(path))
    else if (/\.(?:js|mjs|cjs|css|html|json)$/.test(entry)) files.push(path)
  }
  return files
}

function decodeJwtRole(token) {
  const payload = token.split(".")[1]
  if (!payload) return null

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
    const parsed = JSON.parse(Buffer.from(padded, "base64").toString("utf8"))
    return typeof parsed.role === "string" ? parsed.role : null
  } catch {
    return null
  }
}

function suspiciousPublicEnv() {
  return Object.keys(process.env).filter(
    (name) =>
      name.startsWith("NEXT_PUBLIC_") &&
      /(SECRET|SERVICE_ROLE|PRIVATE_KEY|PASSWORD|CRON)/i.test(name),
  )
}

function main() {
  if (!existsSync(CLIENT_DIR)) {
    console.error("Missing .next/static. Run `bun run build` before this check.")
    process.exit(1)
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const findings = []

  const envIssues = suspiciousPublicEnv()
  for (const name of envIssues) {
    findings.push({ file: "environment", label: `suspicious public env var ${name}` })
  }

  for (const file of walk(CLIENT_DIR)) {
    const content = readFileSync(file, "utf8")
    const display = relative(ROOT, file)

    for (const marker of SECRET_MARKERS) {
      if (marker.pattern.test(content)) {
        findings.push({ file: display, label: marker.label })
      }
    }

    if (serviceRoleKey && content.includes(serviceRoleKey)) {
      findings.push({ file: display, label: "SUPABASE_SERVICE_ROLE_KEY value" })
    }

    for (const match of content.matchAll(JWT_PATTERN)) {
      if (decodeJwtRole(match[0]) === "service_role") {
        findings.push({ file: display, label: "service_role JWT" })
      }
    }
  }

  if (findings.length > 0) {
    console.error("Client bundle secret scan failed:")
    for (const finding of findings) {
      console.error(`  - ${finding.label} in ${finding.file}`)
    }
    process.exit(1)
  }

  console.log(`Client bundle secret scan passed (${walk(CLIENT_DIR).length} files checked).`)
}

main()
