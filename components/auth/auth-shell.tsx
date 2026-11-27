import Link from "next/link"
import { Camera } from "lucide-react"

type AuthShellProps = {
  title: string
  subtitle: string
  accentClassName?: string
  children: React.ReactNode
}

export function AuthShell({ title, subtitle, accentClassName = "bg-blue-600", children }: AuthShellProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Link href="/" className={`p-3 rounded-full ${accentClassName}`} aria-label="Pixora home">
              <Camera className="h-8 w-8 text-white" />
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          <p className="mt-2 text-gray-600">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  )
}
