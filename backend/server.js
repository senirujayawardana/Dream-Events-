const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const reservationHandler = require("../api/reservation");
const frontendRoot = path.resolve(__dirname, "..", "frontend");
const port = Number(process.env.PORT || 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const sendText = (response, statusCode, message) => {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(message);
};

const server = http.createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
  } catch {
    sendText(response, 400, "Invalid request path.");
    return;
  }

  if (pathname === "/api/reservation") {
    if (request.method !== "POST") {
      response.writeHead(405, { Allow: "POST", "Content-Type": "text/plain; charset=utf-8" });
      response.end("Method not allowed.");
      return;
    }

    let body = "";
    let bodyTooLarge = false;
    request.on("data", (chunk) => {
      if (bodyTooLarge) return;
      body += chunk;
      if (Buffer.byteLength(body) > 10_000) {
        bodyTooLarge = true;
        sendText(response, 413, "Request is too large.");
        request.resume();
      }
    });
    request.on("end", () => {
      if (bodyTooLarge) return;
      request.body = body;
      reservationHandler(request, response).catch((error) => {
        console.error("Unable to process reservation request:", error);
        if (response.headersSent) {
          response.destroy(error);
        } else {
          sendText(response, 500, "Unable to process reservation request.");
        }
      });
    });
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" });
    response.end("Method not allowed.");
    return;
  }

  if (pathname === "/api/health") {
    const health = JSON.stringify({ status: "ok", service: "dream-events" });
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Length": Buffer.byteLength(health),
      "Content-Type": "application/json; charset=utf-8",
    });
    response.end(request.method === "HEAD" ? undefined : health);
    return;
  }

  const relativePath = pathname.replace(/^[/\\]+/, "") || "index.html";
  const filePath = path.resolve(frontendRoot, relativePath);
  const pathFromRoot = path.relative(frontendRoot, filePath);
  if (
    pathFromRoot === ".." ||
    pathFromRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(pathFromRoot)
  ) {
    sendText(response, 403, "Forbidden.");
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError) {
      const notFound = statError.code === "ENOENT" || statError.code === "ENOTDIR";
      if (!notFound) console.error("Unable to inspect requested file:", statError);
      sendText(response, notFound ? 404 : 500, notFound ? "Not found." : "Unable to read requested file.");
      return;
    }

    if (!stats.isFile()) {
      sendText(response, 404, "Not found.");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Cache-Control": "no-cache",
      "Content-Length": stats.size,
      "Content-Type": contentTypes[extension] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    const fileStream = fs.createReadStream(filePath);
    fileStream.on("error", (streamError) => {
      console.error("Unable to stream requested file:", streamError);
      if (response.headersSent) {
        response.destroy(streamError);
      } else {
        sendText(response, 500, "Unable to read requested file.");
      }
    });
    fileStream.pipe(response);
  });
});

server.on("error", (error) => {
  console.error("Dream Events server failed to start:", error);
  process.exitCode = 1;
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Dream Events is running at http://127.0.0.1:${port}`);
});
