import { Outlet, useParams } from "react-router-dom";
import NotFoundPage from "@/pages/NotFoundPage";

// Assessor URLs carry database ids; a non-numeric id would otherwise reach the API as NaN.
export default function NumericParamsRoute() {
  const params = useParams();
  // "*" is the catch-all segment of the parent data route in main.tsx, not an id.
  const valid = Object.entries(params).every(
    ([key, value]) => key === "*" || value === undefined || /^\d+$/.test(value),
  );
  return valid ? <Outlet /> : <NotFoundPage />;
}
