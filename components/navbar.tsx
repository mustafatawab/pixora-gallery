import Link from "next/link"
import { Camera, Upload } from "lucide-react"
import { getCurrentProfile } from "@/lib/auth/current-user"
import { Button } from "@/components/ui/button"
import { UserMenu } from "@/components/user-menu"

export default async function Navbar() {
  const profile = await getCurrentProfile()

  return (
    <nav className="border-b bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <Camera className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">Pixora</span>
            </Link>
          </div>

          <div className="flex items-center space-x-3">
            {profile ? (
              <>
                <Button asChild variant="outline" size="sm">
                  <Link href="/upload">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </Link>
                </Button>
                <UserMenu username={profile.username} fullName={profile.full_name} />
              </>
            ) : (
              <>
                <Button asChild variant="outline" size="sm">
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/register">Sign Up</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
