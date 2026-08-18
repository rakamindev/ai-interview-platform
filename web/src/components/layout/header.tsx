import { Link } from "@tanstack/react-router";
import { NavApp } from "./nav-app";
import { NavUser } from "./nav-user";

export function Header() {
  return (
    <header className="sticky top-0 z-50 flex w-full items-center border-b bg-background">
      <div className="mx-auto flex h-13 w-full max-w-4xl items-center justify-between gap-4 px-4">
        <Link to="/" preload={false} className="flex items-center gap-1.5">
          <img src="/rakamin.png" alt="Rakamin" className="size-6" />
          <span className="text-lg font-semibold tracking-tight text-foreground">AI Interview</span>
        </Link>
        <NavApp />
        <NavUser />
      </div>
    </header>
  );
}
