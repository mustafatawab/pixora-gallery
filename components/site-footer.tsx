"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const AUTH_ROUTES = new Set(["/login", "/register"])

export function SiteFooter({ year, signedIn }: { year: number; signedIn: boolean }) {
  const pathname = usePathname()

  if (AUTH_ROUTES.has(pathname)) return null

  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.6fr_1fr_1fr]">
        <div>
          <Link href="/" className="font-serif text-2xl leading-none tracking-[-0.03em] text-ink">
            Pixora<span className="text-brand">.</span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            An independent gallery for photographers to publish their work — and keep it private until they&apos;re
            ready.
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Explore</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <Link href="/" className="text-ink transition-colors hover:text-brand">
                Public gallery
              </Link>
            </li>
            <li>
              <Link href="/upload" className="text-ink transition-colors hover:text-brand">
                Upload
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Account</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {signedIn ? (
              <li>
                <Link href="/profile" className="text-ink transition-colors hover:text-brand">
                  Your dashboard
                </Link>
              </li>
            ) : (
              <>
                <li>
                  <Link href="/login" className="text-ink transition-colors hover:text-brand">
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="text-ink transition-colors hover:text-brand">
                    Create an account
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-5 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>© {year} Pixora</span>
          <span>Photographs belong to their makers.</span>
        </div>
      </div>
    </footer>
  )
}
