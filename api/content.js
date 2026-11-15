const { respond, supabaseRequest } = require("./_lib");

const contentTables = {
  events: "events?select=id,title,category,event_date,venue,description,ticket_url,image_url&is_published=eq.true&order=event_date.asc",
  testimonials: "testimonials?select=id,client_name,organization,quote&is_published=eq.true&order=created_at.desc",
  sponsors: "sponsors?select=id,name,website_url,logo_url&is_published=eq.true&order=created_at.desc",
};

module.exports = async (request, response) => {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    respond(response, 405, { error: "Method not allowed." });
    return;
  }

  const type = new URL(request.url || "/", "http://localhost").searchParams.get("type");
  const table = contentTables[type];
  if (!table) {
    respond(response, 400, { error: "Choose a supported content type." });
    return;
  }

  try {
    const content = await supabaseRequest(table);
    response.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    respond(response, 200, Array.isArray(content) ? content : []);
  } catch (error) {
    respond(response, 503, {
      error: error instanceof Error ? error.message : "The content service is unavailable.",
    });
  }
};
