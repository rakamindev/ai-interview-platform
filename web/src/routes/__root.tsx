import { TanStackDevtools } from "@tanstack/react-devtools";
import { Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { Provider as JotaiProvider } from "jotai";

import { ThemeProvider } from "@/providers/theme-provider";
import { AnchoredToastProvider, ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  component: RootDocument,
  notFoundComponent: () => (
    <main className="container mx-auto p-4 pt-16">
      <h1>404</h1>
      <p>The requested page could not be found.</p>
    </main>
  ),
});

function RootDocument() {
  return (
    <>
      <JotaiProvider>
        <ThemeProvider>
          <ToastProvider position="bottom-center" timeout={3000}>
            <AnchoredToastProvider>
              <TooltipProvider>
                <Outlet />
              </TooltipProvider>
            </AnchoredToastProvider>
          </ToastProvider>
        </ThemeProvider>
      </JotaiProvider>
      <TanStackDevtools
        config={{
          position: "bottom-right",
        }}
        plugins={[
          {
            name: "Tanstack Router",
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      />
      <Scripts />
    </>
  );
}
