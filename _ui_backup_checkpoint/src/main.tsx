import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Provider as JotaiProvider } from "jotai";
import "./index.css";
import App from "./App";
import ErrorBoundary from "@/components/ErrorBoundary";

createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
        <JotaiProvider>
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </JotaiProvider>
    </ErrorBoundary>
);
