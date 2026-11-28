import Link from "next/link"

type AuthShellProps = {
  title: string
  subtitle: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between bg-ink p-10 text-paper lg:flex xl:p-14">
        <Link href="/" className="font-serif text-[26px] leading-none tracking-[-0.03em]" aria-label="Pixora home">
          Pixora<span className="text-brand-soft">.</span>
        </Link>

        <div className="max-w-md">
          <p className="font-serif text-[44px] leading-[1.02] tracking-[-0.03em] xl:text-[56px]">
            Photographs deserve a room of their own.
          </p>
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-paper/70">
            Publish your work to a public gallery, or keep a private archive until the moment is right. Every frame
            stays yours.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-paper/50">
          <span className="h-1.5 w-1.5 bg-brand-soft" aria-hidden="true" />
          An independent gallery for photographers
        </div>
      </aside>

      <div className="flex min-h-screen flex-col justify-start px-5 py-10 sm:px-10 sm:py-14 lg:justify-center lg:px-16">
        <div className="mx-auto w-full max-w-[400px]">
          <Link
            href="/"
            className="mb-12 inline-block font-serif text-[26px] leading-none tracking-[-0.03em] text-ink lg:hidden"
            aria-label="Pixora home"
          >
            Pixora<span className="text-brand">.</span>
          </Link>

          <h1 className="font-serif text-4xl leading-[1.05] tracking-[-0.03em] text-ink sm:text-[44px]">{title}</h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">{subtitle}</p>

          <div className="mt-9">{children}</div>

          {footer && <div className="mt-8 border-t border-line pt-5 text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>
    </div>
  )
}
