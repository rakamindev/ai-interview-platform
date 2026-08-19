import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Provider as JotaiProvider, createStore } from "jotai";
import type { ReactElement, ReactNode } from "react";

interface RenderWithProvidersOptions {
  route?: string;
  initialEntries?: Array<string | { pathname: string; state?: unknown }>;
  wrapper?: ({ children }: { children: ReactNode }) => ReactNode;
  store?: ReturnType<typeof createStore>;
}

export function renderWithProviders(
  ui: ReactElement,
  { route = "/", initialEntries, wrapper, store }: RenderWithProvidersOptions = {},
) {
  return render(
    <JotaiProvider store={store ?? createStore()}>
      <MemoryRouter initialEntries={initialEntries ?? [route]}>{ui}</MemoryRouter>
    </JotaiProvider>,
    ...(wrapper ? [{ wrapper }] : []),
  );
}
