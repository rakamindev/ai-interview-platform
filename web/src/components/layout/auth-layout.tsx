import { Link } from "@tanstack/react-router";

type AuthLayoutProps = {
  children: React.ReactNode;
};

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-svh w-full flex-col">
      <header className="flex items-center justify-between gap-4 px-6 py-5 sm:px-8 sm:py-6 lg:px-10">
        <Link to="/" preload={false} className="flex items-center gap-1.5">
          <img src="/rakamin.png" alt="Rakamin" className="size-6" />
          <span className="text-lg font-semibold tracking-tight text-foreground">AI Interview</span>
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-10 sm:px-8 sm:py-12">{children}</main>
    </div>
  );
}
