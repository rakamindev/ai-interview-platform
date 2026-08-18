import { BottomNav } from "./bottom-nav";
import { Header } from "./header";

type AppLayoutProps = {
  children: React.ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="@container flex min-h-screen w-full items-start justify-center">
      <div className="flex min-h-svh w-full flex-col pb-16 md:pb-0">
        <Header />
        {children}
        <BottomNav />
      </div>
    </div>
  );
}
