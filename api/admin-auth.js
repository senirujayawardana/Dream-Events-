const { readBody, respond } = require("./_lib");

module.exports = async (request, response) => {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    respond(response, 405, { error: "Method not allowed." });
    return;
  }

  const form = readBody(request);
  const mode = form?.mode || "magic_link";
  const email = typeof form?.email === "string" ? form.email.trim().toLowerCase() : "";
  const password = typeof form?.password === "string" ? form.password : "";
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const siteUrl = process.env.PUBLIC_SITE_URL;

  if (mode !== "password" && mode !== "magic_link") {
    respond(response, 400, { error: "Unsupported sign-in method." });
    return;
  }
  if (!supabaseUrl || !anonKey || !adminEmail || (mode === "magic_link" && !siteUrl)) {
    respond(response, 503, { error: "Admin sign-in is not configured yet." });
    return;
  }
  if (mode === "password" && (!email || email !== adminEmail || !password || password.length > 1024)) {
    respond(response, 401, { error: "Invalid admin email or password." });
    return;
  }
  if (mode === "magic_link" && (!email || email !== adminEmail)) {
    respond(response, 200, { status: "sent", message: "If this address is authorized, a sign-in link will arrive shortly." });
    return;
  }

  const supabaseBaseUrl = supabaseUrl.replace(/\/+$/, "");
  const endpoint = mode === "password"
    ? `${supabaseBaseUrl}/auth/v1/token?grant_type=password`
    : `${supabaseBaseUrl}/auth/v1/otp?redirect_to=${encodeURIComponent(new URL("/admin.html", siteUrl).toString())}`;
  const body = mode === "password"
    ? { email, password }
    : { email, create_user: false };
  let result;
  try {
    result = await fetch(endpoint, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    respond(response, 502, { error: "The sign-in service is temporarily unavailable. Please try again." });
    return;
  }

  if (!result.ok) {
    if (mode === "password" && [400, 401, 422].includes(result.status)) {
      respond(response, 401, { error: "Invalid admin email or password." });
      return;
    }
    if (mode === "password" && result.status === 429) {
      respond(response, 429, { error: "Too many sign-in attempts. Please wait and try again." });
      return;
    }
    console.error(`Supabase sign-in request failed with HTTP ${result.status}.`);
    if (mode === "password") {
      respond(response, 502, { error: "The sign-in service is temporarily unavailable. Please try again." });
      return;
    }
    respond(response, 502, { error: "A sign-in link could not be sent. Check the Supabase Auth email configuration." });
    return;
  }

  if (mode === "password") {
    let session;
    try {
      session = await result.json();
    } catch {
      respond(response, 502, { error: "The sign-in service returned an invalid response." });
      return;
    }
    if (typeof session?.access_token !== "string" || !session.access_token) {
      respond(response, 502, { error: "The sign-in service returned an invalid response." });
      return;
    }
    respond(response, 200, { access_token: session.access_token });
    return;
  }

  respond(response, 200, { status: "sent", message: "If this address is authorized, a sign-in link will arrive shortly." });
};
