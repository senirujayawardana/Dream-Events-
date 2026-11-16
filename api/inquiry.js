const {
  insertInquiry,
  isValidDate,
  isValidEmail,
  readBody,
  respond,
  sendEmail,
  verifyTurnstile,
} = require("./_lib");

const cleanText = (value, maximum) =>
  typeof value === "string" ? value.trim().slice(0, maximum) : "";

module.exports = async (request, response) => {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    respond(response, 405, { error: "Method not allowed." });
    return;
  }

  const form = readBody(request);
  if (!form) {
    respond(response, 400, { error: "Enter valid inquiry details." });
    return;
  }

  const kind = form.kind;
  const name = cleanText(form.name, 120);
  const email = cleanText(form.email, 254);
  const phone = cleanText(form.phone, 32);
  const eventType = cleanText(form.event_type, 80);
  const preferredDate = cleanText(form.preferred_date, 10);
  const venue = cleanText(form.venue, 160);
  const organization = cleanText(form.organization, 160);
  const message = cleanText(form.message, 2000);

  if (
    !["event", "sponsor"].includes(kind) ||
    !name ||
    !isValidEmail(email) ||
    (phone && !/^[0-9\s+()-]{7,32}$/.test(phone)) ||
    (preferredDate && !isValidDate(preferredDate)) ||
    (kind === "event" && (!eventType || !message)) ||
    (kind === "sponsor" && (!organization || !message))
  ) {
    respond(response, 400, { error: "Check the required fields and try again." });
    return;
  }

  try {
    if (!(await verifyTurnstile(form.turnstile_token, "inquiry", request.headers.host))) {
      respond(response, 403, { error: "Complete the anti-spam check and try again." });
      return;
    }
  } catch (error) {
    respond(response, 503, {
      error: error instanceof Error ? error.message : "Bot protection is unavailable.",
    });
    return;
  }

  const inquiry = {
    kind,
    name,
    email,
    phone: phone || null,
    event_type: kind === "event" ? eventType : null,
    preferred_date: preferredDate || null,
    venue: venue || null,
    organization: kind === "sponsor" ? organization : null,
    message,
    status: "new",
  };

  try {
    await insertInquiry(inquiry);
  } catch (error) {
    respond(response, 503, {
      error: error instanceof Error ? error.message : "Your inquiry could not be saved. Please try again.",
    });
    return;
  }

  const label = kind === "sponsor" ? "Sponsor / partnership inquiry" : "Event inquiry";
  const details = [
    label,
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Phone: ${phone || "Not provided"}`,
    ...(kind === "sponsor"
      ? [`Organization: ${organization}`]
      : [`Event type: ${eventType}`, `Preferred date: ${preferredDate || "Not provided"}`, `Venue: ${venue || "Not provided"}`]),
    "",
    `Message: ${message}`,
  ].join("\n");
  let notificationsSent = true;
  try {
    await sendEmail({
      to: process.env.RESERVATION_EMAIL_TO || "dreammakerofc@gmail.com",
      subject: `${label} from ${name}`,
      text: details,
      replyTo: email,
    });
    await sendEmail({
      to: email,
      subject: "We received your message — Dream Events",
      text: `Hi ${name},\n\nThank you for reaching out to Dream Events. We’ve received your ${kind === "sponsor" ? "partnership" : "event"} inquiry and our team will be in touch.\n\nDream Events`,
    });
  } catch (error) {
    notificationsSent = false;
    console.error("An inquiry was saved, but email notification failed:", error.message);
  }

  respond(response, notificationsSent ? 201 : 202, {
    status: notificationsSent ? "received" : "saved_notification_failed",
    message: notificationsSent
      ? "Your message has been received. We’ll be in touch soon."
      : "Your message was saved, but email confirmation is temporarily unavailable. Please contact dreammakerofc@gmail.com if your inquiry is urgent.",
  });
};
