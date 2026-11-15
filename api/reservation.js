const packageDetails = {
  executive: { name: "The Executive", category: "Corporate events" },
  "corporate-pinnacle": { name: "The Corporate Pinnacle", category: "Corporate events" },
  "enterprise-elite": { name: "The Enterprise Elite", category: "Corporate events" },
  "intimate-romance": { name: "The Intimate Romance", category: "Weddings" },
  "classic-elegance": { name: "The Classic Elegance", category: "Weddings" },
  "royal-dream": { name: "The Royal Dream", category: "Weddings" },
  "indie-showcase-stage": { name: "The Indie Showcase Stage", category: "Concerts & festivals" },
  "concert-horizon": { name: "The Concert Horizon", category: "Concerts & festivals" },
  "mega-arena-production": { name: "The Mega Arena Production", category: "Concerts & festivals" },
};

const respond = (response, statusCode, payload) => {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
};

const getFormData = (request) => {
  if (typeof request.body === "string") {
    if (request.headers["content-type"]?.includes("application/json")) {
      return JSON.parse(request.body);
    }
    return Object.fromEntries(new URLSearchParams(request.body));
  }
  return request.body;
};

module.exports = async (request, response) => {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    respond(response, 405, { error: "Method not allowed." });
    return;
  }

  let form;
  try {
    form = getFormData(request);
  } catch {
    respond(response, 400, { error: "Invalid reservation request." });
    return;
  }

  if (!form || typeof form !== "object" || Array.isArray(form)) {
    respond(response, 400, { error: "Invalid reservation request." });
    return;
  }

  const customerName = typeof form.customer_name === "string" ? form.customer_name.trim() : "";
  const mobileNumber = typeof form.mobile_number === "string" ? form.mobile_number.trim() : "";
  const email = typeof form.email === "string" ? form.email.trim() : "";
  const selectedPackage =
    typeof form.package === "string" ? packageDetails[form.package] : undefined;

  if (
    !selectedPackage ||
    customerName.length < 1 ||
    customerName.length > 120 ||
    !/^[0-9\s+()-]{7,20}$/.test(mobileNumber) ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    respond(response, 400, { error: "Check your details and select a valid package." });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    respond(response, 503, {
      error: "Reservation email is not configured. Please contact Dream Events directly.",
    });
    return;
  }

  const message = [
    "A new package reservation request was submitted.",
    "",
    `Package: ${selectedPackage.name}`,
    `Category: ${selectedPackage.category}`,
    `Name: ${customerName}`,
    `Mobile number: ${mobileNumber}`,
    `Email: ${email}`,
  ].join("\n");

  let emailResponse;
  try {
    emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [process.env.RESERVATION_EMAIL_TO || "dreammakerofc@gmail.com"],
        reply_to: email,
        subject: `Reservation request: ${selectedPackage.name}`,
        text: message,
      }),
    });
  } catch (error) {
    console.error("Unable to reach the reservation email provider:", error);
    respond(response, 502, { error: "The email service is temporarily unavailable. Please try again." });
    return;
  }

  if (!emailResponse.ok) {
    const providerError = await emailResponse.text();
    console.error("Reservation email provider rejected the request:", providerError);
    respond(response, 502, { error: "The email service could not send your request. Please try again." });
    return;
  }

  if ((request.headers.accept || "").includes("application/json")) {
    respond(response, 200, { status: "sent" });
    return;
  }

  response.statusCode = 303;
  response.setHeader("Location", "/reservation-success.html");
  response.end();
};
