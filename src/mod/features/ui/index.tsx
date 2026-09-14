import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App.tsx";

const queryClient = new QueryClient();

document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.createElement("div");
  sidebar.id = "yandex-music-mod-sidebar";
  document.body.appendChild(sidebar);

  createRoot(sidebar, {}).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );
});
