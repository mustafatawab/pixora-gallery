"use client"

import Link from "next/link"
import { useEffect, useActionState } from "react"
import { useRouter } from "next/navigation"
import { Camera, Calendar, ExternalLink, Upload } from "lucide-react"
import { updateProfileAction } from "@/actions/auth"
import { initialFormState } from "@/lib/auth/form-state"
import type { OwnerImage, Profile } from "@/lib/types/domain"
import { ProfileImageCard } from "@/components/profile/profile-image-card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

type ProfileViewProps = {
  profile: Profile
  images: { publicImages: OwnerImage[]; privateImages: OwnerImage[] }
  initialTab?: "public" | "private" | "settings"
}

export function ProfileView({ profile, images, initialTab = "public" }: ProfileViewProps) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialFormState)
  const router = useRouter()

  useEffect(() => {
    if (state.status === "success") router.refresh()
  }, [state.status, router])

  const displayName = profile.full_name || profile.username
  const joined = new Date(profile.created_at).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  })
  const publicCount = images.publicImages.length
  const privateCount = images.privateImages.length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6">
            <Avatar className="h-24 w-24">
              <AvatarFallback className="text-2xl bg-blue-100 text-blue-600">
                {profile.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
              <p className="text-gray-600">@{profile.username}</p>
              {profile.bio && <p className="text-gray-700 mt-2 max-w-2xl">{profile.bio}</p>}

              <div className="flex flex-wrap items-center gap-6 mt-4 text-sm">
                <div className="flex items-center space-x-1">
                  <Camera className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">{publicCount + privateCount}</span>
                  <span className="text-gray-500">images</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-500">Joined {joined}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="outline">
                <Link href={`/u/${profile.username}`}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Public profile
                </Link>
              </Button>
              <Button asChild>
                <Link href="/upload">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload images
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue={initialTab} className="space-y-6">
          <TabsList className="grid w-full sm:w-auto grid-cols-3">
            <TabsTrigger value="public">Public ({publicCount})</TabsTrigger>
            <TabsTrigger value="private">Private ({privateCount})</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="public">
            <ImageGallery
              images={images.publicImages}
              emptyTitle="No public images yet"
              emptyDescription="Images you make public appear on your profile and in the gallery."
            />
          </TabsContent>

          <TabsContent value="private">
            <ImageGallery
              images={images.privateImages}
              emptyTitle="No private images"
              emptyDescription="Private images are visible only to you. Uploads are private by default."
            />
          </TabsContent>

          <TabsContent value="settings">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>Update your public profile details</CardDescription>
                </CardHeader>
                <CardContent>
                  <form action={formAction} className="space-y-4" noValidate>
                    {state.status === "success" && (
                      <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{state.message}</p>
                    )}
                    {state.status === "error" && state.message && (
                      <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                        {state.message}
                      </p>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full name</Label>
                      <Input
                        id="fullName"
                        name="fullName"
                        defaultValue={profile.full_name ?? ""}
                        aria-invalid={Boolean(state.fieldErrors?.fullName)}
                      />
                      {state.fieldErrors?.fullName && (
                        <p className="text-xs text-red-600">{state.fieldErrors.fullName}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        name="username"
                        defaultValue={profile.username}
                        aria-invalid={Boolean(state.fieldErrors?.username)}
                      />
                      {state.fieldErrors?.username && (
                        <p className="text-xs text-red-600">{state.fieldErrors.username}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        name="bio"
                        defaultValue={profile.bio ?? ""}
                        placeholder="Tell people about your photography..."
                        rows={4}
                        aria-invalid={Boolean(state.fieldErrors?.bio)}
                      />
                      {state.fieldErrors?.bio && <p className="text-xs text-red-600">{state.fieldErrors.bio}</p>}
                    </div>

                    <Button type="submit" disabled={pending}>
                      {pending ? "Updating..." : "Update Profile"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Visibility</CardTitle>
                  <CardDescription>How your images are shared</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-gray-600">
                  <p>
                    <span className="font-medium text-gray-900">Public</span> images are listed in the gallery and
                    visible to anyone.
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">Private</span> images are visible only to you and are
                    served through short-lived signed links.
                  </p>
                  <p>
                    Choose visibility when uploading, then use <span className="font-medium text-gray-900">Make public</span>{" "}
                    or <span className="font-medium text-gray-900">Make private</span> on any image to change it later.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function ImageGallery({
  images,
  emptyTitle,
  emptyDescription,
}: {
  images: OwnerImage[]
  emptyTitle: string
  emptyDescription: string
}) {
  if (images.length === 0) {
    return <EmptyGallery title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {images.map((image) => (
        <ProfileImageCard key={image.id} image={image} />
      ))}
    </div>
  )
}

function EmptyGallery({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardContent className="text-center py-16">
        <Camera className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 text-lg mb-2">{title}</p>
        <p className="text-gray-400 mb-4">{description}</p>
        <Button asChild variant="outline">
          <Link href="/upload">
            <Upload className="h-4 w-4 mr-2" />
            Upload an image
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
