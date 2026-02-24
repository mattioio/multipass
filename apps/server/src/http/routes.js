import path from "path";
import { existsSync, readFileSync, statSync } from "fs";

const CONTENT_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
});

function json(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

export function createHttpRequestHandler({ webRoot, roomService, logger, serveStatic = true }) {
  return function requestHandler(req, res) {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(requestUrl.pathname);

    if (pathname === "/healthz") {
      json(res, 200, {
        status: "ok",
        timestamp: Date.now()
      });
      return;
    }

    if (pathname === "/readyz") {
      const ready = roomService?.isReady?.() ?? true;
      json(res, ready ? 200 : 503, {
        status: ready ? "ready" : "not_ready",
        checks: {
          gameRegistry: ready ? "ok" : "missing"
        }
      });
      return;
    }

    if (!serveStatic) {
      res.writeHead(404);
      res.end("Not found.");
      return;
    }

    if (pathname === "/") {
      pathname = "/index.html";
    }

    const filePath = path.join(webRoot, pathname);
    if (!filePath.startsWith(webRoot)) {
      res.writeHead(400);
      res.end("Bad request.");
      return;
    }

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404);
      res.end("Not found.");
      return;
    }

    const ext = path.extname(filePath);
    const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
    const data = readFileSync(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);

    logger?.info?.("http.static", {
      method: req.method,
      path: pathname,
      contentType
    });
  };
}
