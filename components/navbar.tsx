import { getCurrentProfile } from "@/lib/auth/current-user"
import { SiteHeader } from "@/components/site-header"

export default async function Navbar() {
  const profile = await getCurrentProfile()

  return (
    <SiteHeader
      profile={profile ? { username: profile.username, fullName: profile.full_name } : null}
    />
  )
}
