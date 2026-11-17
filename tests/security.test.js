const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

test("Vercel sends baseline browser security headers on every route", () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  const headers = config.headers.find((rule) => rule.source === "/(.*)")?.headers;
  const headerMap = new Map(headers?.map(({ key, value }) => [key.toLowerCase(), value]));

  assert.equal(headerMap.get("x-content-type-options"), "nosniff");
  assert.equal(headerMap.get("x-frame-options"), "DENY");
  assert.equal(headerMap.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(headerMap.get("permissions-policy"), "camera=(), geolocation=(), microphone=()");

  const csp = headerMap.get("content-security-policy");
  assert.ok(csp);
  assert.match(csp, /script-src 'self' https:\/\/challenges\.cloudflare\.com/);
  assert.match(csp, /frame-src https:\/\/challenges\.cloudflare\.com/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);

  const html = fs.readFileSync(path.join(root, "frontend", "index.html"), "utf8");
  const inlineScriptHashes = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((match) => `'sha256-${crypto.createHash("sha256").update(match[1]).digest("base64")}'`);
  inlineScriptHashes.forEach((hash) => assert.ok(csp.includes(hash), `CSP should allow JSON-LD script ${hash}`));
});

test("the admin sign-in page is not indexed or cached", () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  const rule = config.headers.find((item) => item.source === "/admin.html");
  const headerMap = new Map(rule?.headers.map(({ key, value }) => [key.toLowerCase(), value]));

  assert.equal(headerMap.get("x-robots-tag"), "noindex, nofollow, noarchive");
  assert.equal(headerMap.get("cache-control"), "no-store, max-age=0, must-revalidate");
  assert.match(fs.readFileSync(path.join(root, "frontend", "admin.html"), "utf8"), /name="robots" content="noindex, nofollow, noarchive"/);
});

test("all public forms include server-verifiable Turnstile challenges", () => {
  const frontend = path.join(root, "frontend");
  const forms = [
    ["index.html", "event-inquiry-form", "inquiry"],
    ["investor-relations.html", "sponsor-inquiry-form", "inquiry"],
    ["reservation.html", "reservation-form", "reservation"],
  ];

  forms.forEach(([file, formId, action]) => {
    const html = fs.readFileSync(path.join(frontend, file), "utf8");
    const form = html.match(new RegExp("<form[^>]*id=\"" + formId + "\"[\\s\\S]*?</form>"))?.[0];

    assert.ok(form, `${formId} should exist`);
    assert.match(form, new RegExp(`data-turnstile data-action="${action}"`));
    assert.match(form, /name="turnstile_token"/);
    assert.match(form, /type="submit" disabled/);
  });
});
