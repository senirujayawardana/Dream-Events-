const {
  insertInquiry,
  isValidDate,
  isValidEmail,
  readBody,
  respond,
  sendEmail,
  verifyTurnstile,
} = require("./_lib");

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

module.exports = async (request, response) => {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    respond(response, 405, { error: "Method not allowed." });
    return;
  }

  const form = readBody(request);
  if (!form) {
    respond(response, 400, { error: "Enter valid reservation details." });
    return;
  }
  const customerName = typeof form.customer_name === "string" ? form.customer_name.trim() : "";
  const mobileNumber = typeof form.mobile_number === "string" ? form.mobile_number.trim() : "";
  const email = typeof form.email === "string" ? form.email.trim() : "";
  const eventStartDate = typeof form.event_start_date === "string" ? form.event_start_date : "";
  const eventEndDate = typeof form.event_end_date === "string" ? form.event_end_date : "";
  const locationProvided = form.venue !== undefined && form.venue !== null;
  const venue = typeof form.venue === "string" ? form.venue.trim() : "";
  const guestCountProvided = form.guest_count !== undefined && form.guest_count !== null && form.guest_count !== "";
  const guestCountInput = typeof form.guest_count === "number"
    ? form.guest_count
    : typeof form.guest_count === "string" && form.guest_count.trim()
      ? Number(form.guest_count)
      : null;
  const validGuestCount =
    !guestCountProvided ||
    ((typeof form.guest_count === "string" || typeof form.guest_count === "number") &&
      Number.isSafeInteger(guestCountInput) &&
      guestCountInput > 0 &&
      guestCountInput <= 2147483647);
  const guestCount = guestCountProvided ? guestCountInput : null;
  const customerComments =
    typeof form.customer_comments === "string" ? form.customer_comments.trim() : "";
  const packageKey = typeof form.package === "string" ? form.package : "";
  const selectedPackage = packageDetails[packageKey];

  if (
    !selectedPackage ||
    customerName.length < 1 ||
    customerName.length > 120 ||
    !/^[0-9\s+()-]{7,20}$/.test(mobileNumber) ||
    !isValidEmail(email) ||
    !isValidDate(eventStartDate) ||
    !isValidDate(eventEndDate) ||
    eventEndDate < eventStartDate ||
    (locationProvided && typeof form.venue !== "string") ||
    venue.length > 160 ||
    !validGuestCount ||
    customerComments.length > 2000
  ) {
    respond(response, 400, {
      error: "Check your contact details, event dates, guest count, preferred location, and selected package.",
    });
    return;
  }

  try {
    if (!(await verifyTurnstile(form.turnstile_token, "reservation", request.headers.host))) {
      respond(response, 403, { error: "Complete the anti-spam check and try again." });
      return;
    }
  } catch (error) {
    respond(response, 503, {
      error: error instanceof Error ? error.message : "Bot protection is unavailable.",
    });
    return;
  }

  try {
    await insertInquiry({
      kind: "reservation",
      name: customerName,
      email,
      phone: mobileNumber,
      package_name: selectedPackage.name,
      event_start_date: eventStartDate,
      event_end_date: eventEndDate,
      venue: venue || null,
      guest_count: guestCount,
      message: customerComments,
      status: "new",
    });
  } catch (error) {
    respond(response, 503, {
      error: error instanceof Error ? error.message : "Your request could not be saved. Please try again.",
    });
    return;
  }

  const details = [
    "A new package enquiry was submitted.",
    "",
    `Package: ${selectedPackage.name}`,
    `Category: ${selectedPackage.category}`,
    `Event period: ${eventStartDate} to ${eventEndDate}`,
    `Guest count: ${guestCount ?? "Not specified"}`,
    `Preferred location: ${venue || "Not specified"}`,
    `Name: ${customerName}`,
    `Mobile number: ${mobileNumber}`,
    `Email: ${email}`,
    `Customer comments: ${customerComments || "None"}`,
  ].join("\n");
  let notificationsSent = true;
  try {
    await sendEmail({
      to: process.env.RESERVATION_EMAIL_TO || "dreammakerofc@gmail.com",
      subject: `Package enquiry: ${selectedPackage.name}`,
      text: details,
      replyTo: email,
    });
    await sendEmail({
      to: email,
      subject: "We received your package enquiry — Dream Events",
      text: `Hi ${customerName},\n\nThank you for your interest in ${selectedPackage.name}. We’ve received your details and our team will be in touch to discuss availability and next steps. This enquiry is not a confirmed booking.\n\nDream Events`,
    });
  } catch (error) {
    notificationsSent = false;
    console.error("A reservation was saved, but email notification failed:", error.message);
  }

  if ((request.headers.accept || "").includes("application/json")) {
    respond(response, notificationsSent ? 200 : 202, {
      status: notificationsSent ? "sent" : "saved_notification_failed",
      message: notificationsSent
        ? "Your enquiry has been received. We’ll be in touch soon."
        : "Your enquiry was saved, but email confirmation is temporarily unavailable. Please contact dreammakerofc@gmail.com if your enquiry is urgent.",
    });
    return;
  }

  response.statusCode = 303;
  response.setHeader(
    "Location",
    notificationsSent
      ? "/reservation-success.html"
      : "/reservation-success.html?notification=unavailable",
  );
  response.end();
};
