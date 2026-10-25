import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Provider as JotaiProvider } from "jotai";
import { QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App";
import ErrorBoundary from "@/components/ErrorBoundary";
import { store } from "@/stores/toastStore";
import { queryClient } from "@/lib/queryClient";

createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
            <JotaiProvider store={store}>
                <BrowserRouter>
                    <App />
                </BrowserRouter>
            </JotaiProvider>
        </QueryClientProvider>
    </ErrorBoundary>
);
