import { createRoot } from "react-dom/client";

import { AppProviders } from "@/app/app-providers";

import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <AppProviders>
    <App />
  </AppProviders>,
);
