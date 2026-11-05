import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { useWorkspace } from "@/stores/useWorkspace";
import { useUI } from "@/stores/useUI";
import "./index.css";

// 仅开发环境：把 store 挂到 window，便于 E2E / 冒烟测试断言，不影响生产包。
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__mubu = { useWorkspace, useUI };
}

const container = document.getElementById("root");
if (!container) throw new Error("root element missing");

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
