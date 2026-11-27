import { requireUser } from "@/lib/auth/current-user"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser()
  return <>{children}</>
}
