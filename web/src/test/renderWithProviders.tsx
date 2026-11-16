import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Provider, createStore } from "jotai";
import type { WritableAtom } from "jotai";

type Init = [WritableAtom<any, any[], any>, unknown][];

export function renderWithProviders(
  ui: ReactElement,
  { route = "/", atoms = [] as Init } = {}
) {
  const store = createStore();
  atoms.forEach(([a, v]) => store.set(a, v));
  return {
    store,
    ...render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </Provider>
    ),
  };
}
