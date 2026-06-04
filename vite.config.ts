import { defineConfig } from "vite";

export default defineConfig({
  server: {
    // HTTPS opcional en local; Web Bluetooth también funciona en localhost sin HTTPS
    // https: true,
    port: 5173,
    open: true,
  },
  build: {
    target: "es2020",
    outDir: "dist",
  },
});
