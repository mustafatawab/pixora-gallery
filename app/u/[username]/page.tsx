import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Calendar, Camera, EyeOff, LayoutDashboard, Upload } from "lucide-react"
import { getCurrentProfile } from "@/lib/auth/current-user"
import { getGalleryImages } from "@/lib/services/images"
import { getProfileByUsername } from "@/lib/services/profiles"
import { GalleryImageCard } from "@/components/gallery/gallery-image-card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type PublicProfilePageProps = {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: PublicProfilePageProps): Promise<Metadata> {
  const { username } = await params
  const profile = await getProfileByUsername(username)

  if (!profile) return { title: "Profile not found" }

  const name = profile.full_name || profile.username
  return {
    title: `${name} (@${profile.username})`,
    description: profile.bio || `Photography by @${profile.username} on Pixora.`,
  }
}

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { username } = await params
  const profile = await getProfileByUsername(username)

  if (!profile) notFound()

  const [gallery, viewer] = await Promise.all([getGalleryImages(profile.id), getCurrentProfile()])
  const isOwner = viewer?.id === profile.id

  const images = [...gallery.publicImages, ...gallery.privateImages].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )
  const publicCount = gallery.publicImages.length
  const privateCount = gallery.privateImages.length

  const displayName = profile.full_name || profile.username
  const joined = new Date(profile.created_at).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start gap-5 md:flex-row md:items-center md:gap-6">
            <Avatar className="h-24 w-24">
              <AvatarFallback className="bg-blue-100 text-2xl text-blue-600">
                {profile.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
              <p className="text-gray-600">@{profile.username}</p>
              {profile.bio && <p className="mt-2 max-w-2xl text-gray-700">{profile.bio}</p>}

              <div className="mt-4 flex flex-wrap items-center gap-6 text-sm">
                <div className="flex items-center space-x-1">
                  <Camera className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">{isOwner ? images.length : publicCount}</span>
                  <span className="text-gray-500">{isOwner ? "images" : "public images"}</span>
                </div>
                {isOwner && privateCount > 0 && (
                  <div className="flex items-center space-x-1">
                    <EyeOff className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">{privateCount}</span>
                    <span className="text-gray-500">private</span>
                  </div>
                )}
                <div className="flex items-center space-x-1">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-500">Joined {joined}</span>
                </div>
              </div>
            </div>

            {isOwner && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild variant="outline">
                  <Link href="/profile">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Dashboard
                  </Link>
                </Button>
                <Button asChild>
                  <Link href="/upload">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </Link>
                </Button>
              </div>
            )}
          </div>

          {isOwner && (
            <p className="mt-5 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
              You are viewing your public profile. Private images are shown with a badge and are visible only to you.
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {images.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Camera className="mx-auto mb-4 h-16 w-16 text-gray-400" />
              <p className="mb-2 text-lg text-gray-600">
                {isOwner ? "You haven't uploaded any images yet." : "No public images yet."}
              </p>
              <p className="mb-4 text-gray-400">
                {isOwner
                  ? "Upload your first photo and choose whether it is public or private."
                  : `@${profile.username} hasn't published any images.`}
              </p>
              {isOwner && (
                <Button asChild>
                  <Link href="/upload">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload an image
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold text-gray-900">
                {isOwner ? "All images" : "Public gallery"} ({isOwner ? images.length : publicCount})
              </h2>
              {isOwner && privateCount > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <EyeOff className="h-3 w-3" />
                  {privateCount} private
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {images.map((image) => (
                <GalleryImageCard
                  key={image.id}
                  image={image}
                  owner={profile}
                  showVisibility={isOwner}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
