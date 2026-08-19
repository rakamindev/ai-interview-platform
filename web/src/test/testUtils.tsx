import type { ReactElement } from "react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { render } from "@testing-library/react";

// Exposes the router's current location as text so tests can assert on URL
// changes (e.g. search params) driven by the page under test, without
// reaching into react-router internals.
function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname + location.search}</div>;
}

export function renderWithRoute(
  element: ReactElement,
  { path, initialEntries }: { path: string; initialEntries: string[] }
) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path={path} element={element} />
      </Routes>
      <LocationDisplay />
    </MemoryRouter>
  );
}
