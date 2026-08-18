import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Provider as JotaiProvider } from "jotai";
import "./index.css";
import App from "./App";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/toast";

createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
        <JotaiProvider>
            <BrowserRouter>
                <App />
                <Toaster />
            </BrowserRouter>
        </JotaiProvider>
    </ErrorBoundary>
);
