import type { Metadata } from "next"
import { requireProfile } from "@/lib/auth/current-user"
import { getGalleryImages } from "@/lib/services/images"
import { ProfileView } from "@/components/profile/profile-view"

export const metadata: Metadata = { title: "Profile" }

type ProfilePageProps = {
  searchParams: Promise<{ tab?: string }>
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const [profile, params] = await Promise.all([requireProfile("/profile"), searchParams])
  const images = await getGalleryImages(profile.id)

  const initialTab = params.tab === "private" || params.tab === "settings" ? params.tab : "public"

  return <ProfileView profile={profile} images={images} initialTab={initialTab} />
}
