import { Outlet } from "react-router-dom";
import PrivateNavbar from "./navbar";
import BottomTabBar from "./bottom-tab-bar";

export default function PrivateLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/20">
      {/* Ottodot-style responsive top navbar with brand, nav pills, and actions */}
      <PrivateNavbar />

      {/* Main Workspace: Natural page scrolling, generous responsive max-width container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 sm:pb-10">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar (sm:hidden) */}
      <BottomTabBar />
    </div>
  );
}
