module.exports = (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    response.statusCode = 405;
    response.end("Method not allowed.");
    return;
  }

  const health = JSON.stringify({ status: "ok", service: "dream-events" });
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.statusCode = 200;
  response.end(request.method === "HEAD" ? undefined : health);
};
