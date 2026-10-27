import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Provider as JotaiProvider } from "jotai";
import "./index.css";
import App from "./App";
import ErrorBoundary from "@/components/ErrorBoundary";
import MotionProvider from "@/components/motion/MotionProvider";

createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
        <JotaiProvider>
            <BrowserRouter>
                <MotionProvider>
                    <App />
                </MotionProvider>
            </BrowserRouter>
        </JotaiProvider>
    </ErrorBoundary>
);
