import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { getSupabaseEnv } from "@/lib/supabase/env"
import "./globals.css"
import Navbar from "@/components/navbar"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: {
    default: "Pixora — Share Your Photography",
    template: "%s | Pixora",
  },
  description: "A gallery platform for photographers to share their work and deliver client galleries.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { url } = getSupabaseEnv()

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href={url} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={url} />
      </head>
      <body className={inter.className}>
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  )
}
