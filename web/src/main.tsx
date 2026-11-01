import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Provider as JotaiProvider } from "jotai";
import "./index.css";
import App from "./App";
import ErrorBoundary from "@/components/ErrorBoundary";

// A data router is required for useBlocker (unsaved-changes prompts); App keeps its <Routes>.
const router = createBrowserRouter([{ path: "*", element: <App /> }]);

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <JotaiProvider>
      <RouterProvider router={router} />
    </JotaiProvider>
  </ErrorBoundary>,
);
