import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

function vitrinePlugin(): Plugin {
  const vitrineRoot = path.resolve(__dirname, "..");
  const mimeTypes: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".mp3": "audio/mpeg",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2"
  };

  return {
    name: "serve-sm-travel-vitrine",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith("/vitrine")) return next();

        const urlPath = decodeURIComponent(req.url.split("?")[0]).replace(/^\/vitrine\/?/, "");
        const relative = urlPath || "index.html";
        const filePath = path.resolve(vitrineRoot, relative);

        if (!filePath.startsWith(vitrineRoot) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          return next();
        }

        res.setHeader("Content-Type", mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream");
        fs.createReadStream(filePath).pipe(res);
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), vitrinePlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  server: {
    port: 5174,
    fs: {
      allow: [path.resolve(__dirname, "..")]
    }
  }
});
