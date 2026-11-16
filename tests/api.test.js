const test = require("node:test");
const assert = require("node:assert/strict");

const reservationHandler = require("../api/reservation");
const inquiryHandler = require("../api/inquiry");
const adminHandler = require("../api/admin");
const adminAuthHandler = require("../api/admin-auth");
const securityConfigHandler = require("../api/security-config");

const withEnvironment = async (values, callback) => {
  const previous = {};
  Object.keys(values).forEach((key) => {
    previous[key] = process.env[key];
    process.env[key] = values[key];
  });
  try {
    await callback();
  } finally {
    Object.entries(previous).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  }
};

const invoke = async (
  handler,
  body,
  accept = "application/json",
  method = "POST",
  url = "/",
) => {
  const request = {
    method,
    url,
    headers: {
      accept,
      "content-type": "application/json",
      authorization: "Bearer invalid-token",
      host: "dream-events.example",
    },
    body,
  };
  const headers = {};
  const response = {
    statusCode: 200,
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    getHeader(name) { return headers[name.toLowerCase()]; },
    end(value) { this.body = value; },
  };
  await handler(request, response);
  let parsedBody = response.body || "";
  try {
    parsedBody = JSON.parse(parsedBody || "{}");
  } catch {
    parsedBody = response.body || "";
  }
  return { statusCode: response.statusCode, headers, body: parsedBody };
};

const configuredEnvironment = {
  SUPABASE_URL: "https://supabase.example",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
  RESEND_API_KEY: "test-resend-key",
  RESEND_FROM_EMAIL: "Dream Events <notifications@example.com>",
  TURNSTILE_SECRET_KEY: "test-turnstile-secret",
};

const configuredAdminEnvironment = {
  SUPABASE_URL: "https://supabase.example",
  SUPABASE_ANON_KEY: "test-anon-key",
  ADMIN_EMAIL: "admin@example.com",
};

const turnstileSuccess = (action) => ({
  ok: true,
  status: 200,
  json: async () => ({ success: true, action, hostname: "dream-events.example" }),
});

test("public security configuration exposes only the site key when both keys are present", async () => {
  await withEnvironment({
    TURNSTILE_SITE_KEY: "public-site-key",
    TURNSTILE_SECRET_KEY: "private-secret-key",
  }, async () => {
    const result = await invoke(securityConfigHandler, null, "application/json", "GET");

    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body, { turnstileEnabled: true, siteKey: "public-site-key" });
    assert.equal(result.headers["cache-control"], "no-store");
  });
});

test("public security configuration does not enable Turnstile with incomplete settings", async () => {
  await withEnvironment({
    TURNSTILE_SITE_KEY: "public-site-key",
    TURNSTILE_SECRET_KEY: "",
  }, async () => {
    const result = await invoke(securityConfigHandler, null, "application/json", "GET");

    assert.equal(result.body.turnstileEnabled, false);
    assert.equal("siteKey" in result.body, false);
  });
});

test("public inquiry rejects missing Turnstile configuration before saving", async (t) => {
  await withEnvironment({
    SUPABASE_URL: "https://supabase.example",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
    RESEND_API_KEY: "test-resend-key",
    RESEND_FROM_EMAIL: "Dream Events <notifications@example.com>",
    TURNSTILE_SITE_KEY: "",
    TURNSTILE_SECRET_KEY: "",
  }, async () => {
    const originalFetch = global.fetch;
    t.after(() => { global.fetch = originalFetch; });
    global.fetch = async () => { throw new Error("Unexpected request"); };

    const result = await invoke(inquiryHandler, {
      kind: "event",
      name: "Test Contact",
      email: "contact@example.com",
      event_type: "Concert",
      message: "We are planning an event.",
      turnstile_token: "test-token",
    });

    assert.equal(result.statusCode, 503);
    assert.match(result.body.error, /bot protection is not configured/i);
  });
});

test("public inquiry rejects a Turnstile token verified for a different action", async (t) => {
  await withEnvironment(configuredEnvironment, async () => {
    const originalFetch = global.fetch;
    t.after(() => { global.fetch = originalFetch; });
    const calls = [];
    global.fetch = async (url) => {
      calls.push(url);
      return turnstileSuccess("reservation");
    };

    const result = await invoke(inquiryHandler, {
      kind: "event",
      name: "Test Contact",
      email: "contact@example.com",
      event_type: "Concert",
      message: "We are planning an event.",
      turnstile_token: "test-turnstile-token",
    });
    assert.equal(result.statusCode, 403);
    assert.equal(calls.length, 1);
    assert.equal(calls[0], "https://challenges.cloudflare.com/turnstile/v0/siteverify");
  });
});

test("public inquiry rejects a Turnstile token verified for a different hostname", async (t) => {
  await withEnvironment(configuredEnvironment, async () => {
    const originalFetch = global.fetch;
    t.after(() => { global.fetch = originalFetch; });
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, action: "inquiry", hostname: "attacker.example" }),
    });

    const result = await invoke(inquiryHandler, {
      kind: "event",
      name: "Test Contact",
      email: "contact@example.com",
      event_type: "Concert",
      message: "We are planning an event.",
      turnstile_token: "test-turnstile-token",
    });

    assert.equal(result.statusCode, 403);
  });
});

test("the authorized admin can sign in with a password without exposing refresh credentials", async (t) => {
  await withEnvironment(configuredAdminEnvironment, async () => {
    const originalFetch = global.fetch;
    t.after(() => { global.fetch = originalFetch; });
    global.fetch = async (url, options) => {
      assert.equal(url, "https://supabase.example/auth/v1/token?grant_type=password");
      assert.equal(options.headers.apikey, "test-anon-key");
      assert.deepEqual(JSON.parse(options.body), {
        email: "admin@example.com",
        password: "correct horse battery staple",
      });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "admin-access-token",
          refresh_token: "must-not-be-returned",
        }),
      };
    };

    const result = await invoke(adminAuthHandler, {
      mode: "password",
      email: "ADMIN@example.com",
      password: "correct horse battery staple",
    });

    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body, { access_token: "admin-access-token" });
  });
});
test("password sign-in rejects unknown emails without contacting Supabase", async (t) => {
  await withEnvironment(configuredAdminEnvironment, async () => {
    const originalFetch = global.fetch;
    t.after(() => { global.fetch = originalFetch; });
    global.fetch = async () => { throw new Error("Unexpected authentication request"); };

    const result = await invoke(adminAuthHandler, {
      mode: "password",
      email: "someone-else@example.com",
      password: "some-password",
    });

    assert.equal(result.statusCode, 401);
    assert.equal(result.body.error, "Invalid admin email or password.");
  });
});

test("password sign-in returns the same generic error for an incorrect password", async (t) => {
  await withEnvironment(configuredAdminEnvironment, async () => {
    const originalFetch = global.fetch;
    t.after(() => { global.fetch = originalFetch; });
    global.fetch = async () => ({ ok: false, status: 400 });

    const result = await invoke(adminAuthHandler, {
      mode: "password",
      email: "admin@example.com",
      password: "incorrect-password",
    });

    assert.equal(result.statusCode, 401);
    assert.equal(result.body.error, "Invalid admin email or password.");
  });
});

test("the admin can still request a magic link as a password sign-in fallback", async (t) => {
  await withEnvironment({
    ...configuredAdminEnvironment,
    PUBLIC_SITE_URL: "https://dream-events.example",
  }, async () => {
    const originalFetch = global.fetch;
    t.after(() => { global.fetch = originalFetch; });
    global.fetch = async (url, options) => {
      assert.match(url, /^https:\/\/supabase\.example\/auth\/v1\/otp\?redirect_to=/);
      assert.deepEqual(JSON.parse(options.body), { email: "admin@example.com", create_user: false });
      return { ok: true, status: 200 };
    };

    const result = await invoke(adminAuthHandler, {
      mode: "magic_link",
      email: "admin@example.com",
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.status, "sent");
  });
});

test("reservation requests are saved before team and customer emails are sent", async (t) => {
  await withEnvironment(configuredEnvironment, async () => {
    const calls = [];
    const originalFetch = global.fetch;
    t.after(() => { global.fetch = originalFetch; });
    global.fetch = async (url, options) => {
      if (url === "https://challenges.cloudflare.com/turnstile/v0/siteverify") {
        assert.deepEqual(JSON.parse(options.body), {
          secret: "test-turnstile-secret",
          response: "test-turnstile-token",
        });
        return turnstileSuccess("reservation");
      }
      calls.push({ url, options });
      return { ok: true, status: 201, text: async () => "" };
    };

    const result = await invoke(reservationHandler, {
      package: "executive",
      customer_name: "Test Customer",
      mobile_number: "+94712345678",
      email: "customer@example.com",
      event_start_date: "2027-03-10",
      event_end_date: "2027-03-11",
      customer_comments: "Test request",
      turnstile_token: "test-turnstile-token",
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.status, "sent");
    assert.equal(calls.length, 3);
    assert.match(calls[0].url, /\/rest\/v1\/inquiries$/);
    assert.equal(JSON.parse(calls[0].options.body).kind, "reservation");
    assert.equal(calls[1].url, "https://api.resend.com/emails");
    assert.equal(calls[2].url, "https://api.resend.com/emails");
  });
});

test("invalid reservation details are rejected before reaching external services", async (t) => {
  await withEnvironment(configuredEnvironment, async () => {
    const originalFetch = global.fetch;
    t.after(() => { global.fetch = originalFetch; });
    global.fetch = async () => { throw new Error("Unexpected network request"); };

    const result = await invoke(reservationHandler, { package: "unknown" });
    assert.equal(result.statusCode, 400);
    assert.match(result.body.error, /selected package/i);
  });
});

test("non-JavaScript reservation submits retain the email delivery warning", async (t) => {
  await withEnvironment(configuredEnvironment, async () => {
    const originalFetch = global.fetch;
    const originalConsoleError = console.error;
    t.after(() => {
      global.fetch = originalFetch;
      console.error = originalConsoleError;
    });
    console.error = () => {};
    global.fetch = async (url) => {
      if (url === "https://challenges.cloudflare.com/turnstile/v0/siteverify") return turnstileSuccess("reservation");
      if (url === "https://api.resend.com/emails") return { ok: false, status: 503, text: async () => "" };
      return { ok: true, status: 201, text: async () => "" };
    };

    const result = await invoke(reservationHandler, {
      package: "executive",
      customer_name: "Test Customer",
      mobile_number: "+94712345678",
      email: "customer@example.com",
      event_start_date: "2027-03-10",
      event_end_date: "2027-03-11",
      customer_comments: "",
      turnstile_token: "test-turnstile-token",
    }, "text/html");

    assert.equal(result.statusCode, 303);
    assert.equal(result.headers.location, "/reservation-success.html?notification=unavailable");
  });
});

test("an inquiry remains recorded when email delivery fails", async (t) => {
  await withEnvironment(configuredEnvironment, async () => {
    const calls = [];
    const originalFetch = global.fetch;
    const originalConsoleError = console.error;
    t.after(() => {
      global.fetch = originalFetch;
      console.error = originalConsoleError;
    });
    console.error = () => {};
    global.fetch = async (url, options) => {
      if (url === "https://challenges.cloudflare.com/turnstile/v0/siteverify") {
        return turnstileSuccess("inquiry");
      }
      calls.push({ url, options });
      if (url === "https://api.resend.com/emails") {
        return { ok: false, status: 503, text: async () => "" };
      }
      return { ok: true, status: 201, text: async () => "" };
    };

    const result = await invoke(inquiryHandler, {
      kind: "sponsor",
      name: "Test Contact",
      email: "contact@example.com",
      phone: "",
      organization: "Example Organization",
      message: "We would like to discuss a partnership.",
      turnstile_token: "test-turnstile-token",
    });

    assert.equal(result.statusCode, 202);
    assert.equal(result.body.status, "saved_notification_failed");
    assert.match(result.body.message, /was saved/i);
    assert.equal(calls[0].url, "https://supabase.example/rest/v1/inquiries");
    assert.equal(JSON.parse(calls[0].options.body).kind, "sponsor");
  });
});

test("the admin API rejects an invalid Supabase session before reading private data", async (t) => {
  await withEnvironment({
    ...configuredEnvironment,
    SUPABASE_ANON_KEY: "test-anon-key",
    ADMIN_EMAIL: "admin@example.com",
  }, async () => {
    const originalFetch = global.fetch;
    t.after(() => { global.fetch = originalFetch; });
    global.fetch = async (url) => {
      assert.equal(url, "https://supabase.example/auth/v1/user");
      return { ok: false, status: 401 };
    };

    const result = await invoke(adminHandler, {}, "application/json", "GET", "/api/admin?resource=inquiries");
    assert.equal(result.statusCode, 401);
    assert.match(result.body.error, /authorized admin account/i);
  });
});

test("the authenticated admin can create a validated upcoming event", async (t) => {
  await withEnvironment({
    ...configuredEnvironment,
    SUPABASE_ANON_KEY: "test-anon-key",
    ADMIN_EMAIL: "admin@example.com",
  }, async () => {
    const calls = [];
    const originalFetch = global.fetch;
    t.after(() => { global.fetch = originalFetch; });
    global.fetch = async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith("/auth/v1/user")) {
        return { ok: true, status: 200, json: async () => ({ email: "ADMIN@example.com" }) };
      }
      return {
        ok: true,
        status: 201,
        text: async () => JSON.stringify([{ id: "00000000-0000-4000-8000-000000000001" }]),
      };
    };

    const result = await invoke(adminHandler, {
      title: "Future showcase",
      category: "concerts",
      event_date: "2027-05-12",
      venue: "Galle",
      description: "An upcoming public event.",
      ticket_url: "",
      image_url: "",
      is_published: true,
    }, "application/json", "POST", "/api/admin?resource=events");

    assert.equal(result.statusCode, 201);
    assert.equal(calls.length, 2);
    assert.match(calls[1].url, /\/rest\/v1\/events$/);
    assert.equal(JSON.parse(calls[1].options.body).is_published, true);
  });
});
