import type React from "react"
import type { Metadata } from "next"
import { Instrument_Serif, Manrope } from "next/font/google"
import { getSupabaseEnv } from "@/lib/supabase/env"
import { getCurrentProfile } from "@/lib/auth/current-user"
import { SiteFooter } from "@/components/site-footer"
import Navbar from "@/components/navbar"
import "./globals.css"

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "Pixora — A gallery for photographers",
    template: "%s | Pixora",
  },
  description:
    "An independent photography gallery. Publish your work, keep it private until you're ready, and browse photographs from the community.",
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { url } = getSupabaseEnv()
  const profile = await getCurrentProfile()
  const year = new Date().getFullYear()

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href={url} />
        <link rel="dns-prefetch" href={url} />
      </head>
      <body className={`${manrope.variable} ${instrumentSerif.variable} font-sans`}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-paper"
        >
          Skip to content
        </a>
        <Navbar />
        <main id="main">{children}</main>
        <SiteFooter year={year} signedIn={Boolean(profile)} />
      </body>
    </html>
  )
}
