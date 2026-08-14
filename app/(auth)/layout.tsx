import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-[1120px] items-center gap-3 px-5 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-[26px] place-items-center rounded-[8px] bg-s1">
            <svg viewBox="0 0 24 24" className="size-[15px]" aria-hidden="true">
              <path
                d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"
                fill="none"
                stroke="#fff"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="text-base font-bold tracking-[-0.02em]">FitTrack</span>
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-5 pb-20 pt-6 sm:items-center sm:pt-0">
        {children}
      </main>
    </div>
  );
}
