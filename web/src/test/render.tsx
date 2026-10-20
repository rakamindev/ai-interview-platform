import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider, createStore } from "jotai";
import { MemoryRouter } from "react-router-dom";
import App from "@/App";
import ErrorBoundary from "@/components/ErrorBoundary";
import { authAtom, saveToken } from "@/stores/authAtom";

interface RenderAppOptions {
  /** Signed-in assessor token; pass null for a signed-out visitor or a candidate. */
  token?: string | null;
}

/**
 * Renders the whole app (real routes, layouts, guards and services) at a URL,
 * the way a user arrives at it. The wrapping mirrors main.tsx, including the
 * error boundary, so a render crash shows what a user would see.
 */
export function renderApp(path: string, { token = "test-assessor-token" }: RenderAppOptions = {}) {
  if (token) saveToken(token);

  const store = createStore();
  store.set(authAtom, { token });

  const user = userEvent.setup();
  const view = render(
    <ErrorBoundary>
      <Provider store={store}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </Provider>
    </ErrorBoundary>
  );

  return { user, store, ...view };
}
