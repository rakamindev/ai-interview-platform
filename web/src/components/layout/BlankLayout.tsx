import { Outlet } from "react-router-dom";

export default function BlankLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Outlet />
    </div>
  );
}
