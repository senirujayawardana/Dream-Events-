const respond = (response, statusCode, payload) => {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  if (!response.getHeader?.("Cache-Control")) response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
};

const readBody = (request) => {
  if (request.body && typeof request.body === "object" && !Array.isArray(request.body)) {
    return request.body;
  }
  if (typeof request.body !== "string") return null;

  if (request.headers["content-type"]?.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(request.body));
  }
  try {
    const body = JSON.parse(request.body);
    return body && typeof body === "object" && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
};

const getSupabaseConfig = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured.");
  return { url: url.replace(/\/+$/, ""), key };
};

const supabaseRequest = async (path, options = {}) => {
  const { url, key } = getSupabaseConfig();
  let response;
  try {
    response = await fetch(`${url}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new Error("Supabase is temporarily unavailable.");
  }

  if (!response.ok) {
    console.error(`Supabase request failed with HTTP ${response.status}.`);
    throw new Error("The data service could not complete the request.");
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const insertInquiry = (inquiry) =>
  supabaseRequest("inquiries", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(inquiry),
  });

const sendEmail = async ({ to, subject, text, replyTo }) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Email delivery is not configured.");

  let response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
  } catch {
    throw new Error("The email service is temporarily unavailable.");
  }

  if (!response.ok) {
    console.error(`Resend request failed with HTTP ${response.status}.`);
    throw new Error("The email service could not send the message.");
  }
};

const isValidDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const isValidEmail = (value) =>
  typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const safeHttpUrl = (value, optional = false) => {
  if (optional && value === "") return true;
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

const requireAdmin = async (request) => {
  const adminEmail = process.env.ADMIN_EMAIL;
  const { url } = getSupabaseConfig();
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!adminEmail || !anonKey) throw new Error("Admin access is not configured.");

  const authorization = request.headers.authorization || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return false;

  let response;
  try {
    response = await fetch(`${url.replace(/\/+$/, "")}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error("The authentication service is temporarily unavailable.");
  }
  if (!response.ok) return false;

  const user = await response.json();
  return typeof user.email === "string" && user.email.toLowerCase() === adminEmail.toLowerCase();
};

module.exports = {
  insertInquiry,
  isValidDate,
  isValidEmail,
  readBody,
  requireAdmin,
  respond,
  safeHttpUrl,
  sendEmail,
  supabaseRequest,
};
