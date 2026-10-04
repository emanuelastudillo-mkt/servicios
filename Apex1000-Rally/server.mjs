import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url)),
  port = Number(process.env.PORT || 4182),
  mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".ttf": "font/ttf",
    ".png": "image/png",
    ".json": "application/json; charset=utf-8",
    ".md": "text/plain; charset=utf-8",
  };
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      const file = path.resolve(
        root,
        "." +
          decodeURIComponent(
            url.pathname.endsWith("/")
              ? url.pathname + "index.html"
              : url.pathname,
          ),
      );
      if (!file.startsWith(root + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("No encontrado");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`Apex1000 Rally: http://127.0.0.1:${port}`),
  );
