const { respond } = require("./_lib");

module.exports = async (request, response) => {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    respond(response, 405, { error: "Method not allowed." });
    return;
  }

  const siteKey = process.env.TURNSTILE_SITE_KEY;
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  const configured = Boolean(siteKey && secretKey);
  respond(response, 200, {
    turnstileEnabled: configured,
    ...(configured ? { siteKey } : {}),
  });
};
