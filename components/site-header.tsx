"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { UserMenu } from "@/components/user-menu"

type SiteHeaderProps = {
  profile: { username: string; fullName: string | null } | null
}

const AUTH_ROUTES = new Set(["/login", "/register"])

export function SiteHeader({ profile }: SiteHeaderProps) {
  const pathname = usePathname()

  if (AUTH_ROUTES.has(pathname)) return null

  const onGallery = pathname === "/"
  const onUpload = pathname.startsWith("/upload")

  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="font-serif text-[26px] leading-none tracking-[-0.03em] text-ink"
          aria-label="Pixora home"
        >
          Pixora<span className="text-brand">.</span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
          <Link
            href="/"
            aria-current={onGallery ? "page" : undefined}
            className={cn(
              "px-2 py-2 text-sm transition-colors hover:text-ink",
              onGallery ? "text-ink" : "text-muted-foreground",
            )}
          >
            Gallery
          </Link>

          {profile ? (
            <>
              <Link
                href="/upload"
                aria-current={onUpload ? "page" : undefined}
                className={cn(
                  "px-2 py-2 text-sm transition-colors hover:text-ink",
                  onUpload ? "text-ink" : "text-muted-foreground",
                )}
              >
                Upload
              </Link>
              <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden="true" />
              <UserMenu username={profile.username} fullName={profile.fullName} />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-2 py-2 text-sm text-muted-foreground transition-colors hover:text-ink"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="ml-1 inline-flex h-9 items-center bg-ink px-4 text-sm font-medium text-paper transition-colors hover:bg-brand"
              >
                Join Pixora
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
