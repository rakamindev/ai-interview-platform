import { Outlet } from "react-router-dom";

export default function CandidateLayout() {
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
