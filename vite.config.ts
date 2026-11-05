import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    port: 5173,
    // 测试脚本会往 .smoke 写截图；不忽略的话 watcher 会触发整页重载，
    // 把抽屉 / 面板 / 分页状态清掉。
    watch: { ignored: ["**/.smoke/**", "**/dist/**"] },
  },
  build: {
    target: "es2021",
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom", "zustand"],
          flow: ["@xyflow/react"],
          motion: ["framer-motion"],
          radix: [
            "@radix-ui/react-dialog",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
          ],
        },
      },
    },
  },
});
