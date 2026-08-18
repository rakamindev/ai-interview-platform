import { Outlet } from "react-router-dom";

export default function CandidateLayout() {
  return (
    <div className="h-screen w-full flex items-center justify-center p-3 sm:p-6 bg-slate-100/70 overflow-hidden">
      <main className="w-full max-w-xl h-[640px] max-h-[92vh] flex flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
