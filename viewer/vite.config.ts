import { defineConfig } from "vite";

// web-ifc traz .wasm; excluir do pre-bundle evita erro de otimização.
export default defineConfig({
  server: { port: 5173 },
  optimizeDeps: { exclude: ["web-ifc"] },
  // top-level await no main.ts + wasm exigem alvo moderno.
  build: { target: "esnext" },
  esbuild: { target: "esnext" },
});
