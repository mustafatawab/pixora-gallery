import type { Metadata } from "next"
import { requireProfile } from "@/lib/auth/current-user"
import { UploadForm } from "@/components/upload/upload-form"

export const metadata: Metadata = { title: "Upload" }

export default async function UploadPage() {
  const profile = await requireProfile("/upload")

  return <UploadForm profile={profile} />
}
