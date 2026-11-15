const {
  isValidDate,
  isValidEmail,
  readBody,
  requireAdmin,
  respond,
  safeHttpUrl,
  supabaseRequest,
} = require("./_lib");

const resources = {
  events: {
    table: "events",
    fields: ["title", "category", "event_date", "venue", "description", "ticket_url", "image_url", "is_published"],
  },
  testimonials: {
    table: "testimonials",
    fields: ["client_name", "organization", "quote", "is_published"],
  },
  sponsors: {
    table: "sponsors",
    fields: ["name", "website_url", "logo_url", "is_published"],
  },
  inquiries: {
    table: "inquiries",
    fields: ["status"],
  },
};

const isText = (value, max, required = true) =>
  typeof value === "string" && value.trim().length <= max && (!required || value.trim().length > 0);

const validateResource = (resource, record) => {
  if (resource === "events") {
    return (
      isText(record.title, 120) &&
      ["concerts", "festivals", "corporate", "weddings", "other"].includes(record.category) &&
      isValidDate(record.event_date) &&
      isText(record.venue, 160) &&
      isText(record.description, 1200) &&
      isText(record.ticket_url, 2048, false) &&
      isText(record.image_url, 2048, false) &&
      (record.ticket_url === "" || safeHttpUrl(record.ticket_url)) &&
      (record.image_url === "" || safeHttpUrl(record.image_url)) &&
      typeof record.is_published === "boolean"
    );
  }
  if (resource === "testimonials") {
    return (
      isText(record.client_name, 120) &&
      isText(record.organization, 160, false) &&
      isText(record.quote, 1200) &&
      typeof record.is_published === "boolean"
    );
  }
  if (resource === "sponsors") {
    return (
      isText(record.name, 120) &&
      isText(record.website_url, 2048, false) &&
      isText(record.logo_url, 2048) &&
      (record.website_url === "" || safeHttpUrl(record.website_url)) &&
      safeHttpUrl(record.logo_url) &&
      typeof record.is_published === "boolean"
    );
  }
  return resource === "inquiries" && ["new", "contacted", "closed"].includes(record.status);
};

const isRecordId = (id) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id);

module.exports = async (request, response) => {
  let authorized;
  try {
    authorized = await requireAdmin(request);
  } catch (error) {
    respond(response, 503, { error: error instanceof Error ? error.message : "Admin access is unavailable." });
    return;
  }
  if (!authorized) {
    respond(response, 401, { error: "Sign in with the authorized admin account." });
    return;
  }

  const params = new URL(request.url || "/", "http://localhost").searchParams;
  const resourceName = params.get("resource");
  const resource = resources[resourceName];
  if (!resource) {
    respond(response, 400, { error: "Choose a supported dashboard section." });
    return;
  }
  const method = request.method;
  if (!["GET", "POST", "PATCH", "DELETE"].includes(method)) {
    response.setHeader("Allow", "GET, POST, PATCH, DELETE");
    respond(response, 405, { error: "Method not allowed." });
    return;
  }
  if (resourceName === "inquiries" && !["GET", "PATCH"].includes(method)) {
    respond(response, 405, { error: "Inquiry records can only be viewed or updated." });
    return;
  }

  try {
    if (method === "GET") {
      const order = resourceName === "inquiries" ? "created_at.desc" : "created_at.desc";
      const rows = await supabaseRequest(`${resource.table}?select=*&order=${order}`);
      respond(response, 200, Array.isArray(rows) ? rows : []);
      return;
    }

    const form = readBody(request);
    if (!form) {
      respond(response, 400, { error: "Enter valid dashboard data." });
      return;
    }
    if (method === "POST") {
      if (resourceName === "inquiries") {
        respond(response, 405, { error: "Inquiry records are created from the public forms." });
        return;
      }
      const record = Object.fromEntries(resource.fields.map((field) => [field, form[field]]));
      if (!validateResource(resourceName, record)) {
        respond(response, 400, { error: "Check the required fields, URLs, and publication setting." });
        return;
      }
      const created = await supabaseRequest(resource.table, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(record),
      });
      respond(response, 201, Array.isArray(created) ? created[0] : created);
      return;
    }

    const id = form.id;
    if (!isRecordId(id)) {
      respond(response, 400, { error: "Choose a valid dashboard record." });
      return;
    }
    if (method === "PATCH") {
      const record = Object.fromEntries(resource.fields.map((field) => [field, form[field]]));
      if (!validateResource(resourceName, record)) {
        respond(response, 400, { error: "Check the updated fields and try again." });
        return;
      }
      const updated = await supabaseRequest(`${resource.table}?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(record),
      });
      respond(response, 200, Array.isArray(updated) ? updated[0] || null : updated);
      return;
    }

    await supabaseRequest(`${resource.table}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    respond(response, 200, { status: "deleted" });
  } catch (error) {
    respond(response, 503, {
      error: error instanceof Error ? error.message : "The dashboard service is unavailable.",
    });
  }
};
