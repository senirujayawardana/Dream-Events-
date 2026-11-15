const menuToggle = document.querySelector(".menu-toggle");
const primaryNav = document.querySelector(".primary-nav");

if (menuToggle && primaryNav) {
  menuToggle.addEventListener("click", () => {
    const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isExpanded));
    primaryNav.classList.toggle("is-open", !isExpanded);
  });

  primaryNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menuToggle.setAttribute("aria-expanded", "false");
      primaryNav.classList.remove("is-open");
    });
  });
}

const year = document.querySelector("#year");
if (year) year.textContent = new Date().getFullYear();

const scrollProgress = document.createElement("div");
scrollProgress.className = "scroll-progress";
scrollProgress.setAttribute("aria-hidden", "true");
document.body.prepend(scrollProgress);

const parallaxImages = document.querySelectorAll(
  ".featured-image > img, .mihiraviye-photo img, .portfolio-photo img",
);
const activeSectionLinks = [...document.querySelectorAll(
  ".primary-nav a[href^='#'], .package-jump-links a[href^='#']",
)]
  .map((link) => ({ link, section: document.getElementById(link.hash.slice(1)) }))
  .filter(({ section }) => section);
let scrollUpdatePending = false;
const updateScrollProgress = () => {
  if (scrollUpdatePending) return;
  scrollUpdatePending = true;
  requestAnimationFrame(() => {
    const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;
    scrollProgress.style.transform = `scaleX(${Math.min(1, Math.max(0, progress))})`;

    const activeLine = window.innerHeight * 0.4;
    let activeSectionLink = null;
    activeSectionLinks.forEach(({ link, section }) => {
      const bounds = section.getBoundingClientRect();
      if (bounds.top <= activeLine && bounds.bottom > activeLine) {
        activeSectionLink = link;
      }
    });
    activeSectionLinks.forEach(({ link }) => {
      if (link === activeSectionLink) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    if (window.matchMedia("(min-width: 651px)").matches) {
      parallaxImages.forEach((image) => {
        const bounds = image.parentElement.getBoundingClientRect();
        const distanceFromCenter = (bounds.top + bounds.height / 2 - window.innerHeight / 2) / window.innerHeight;
        const drift = Math.max(-14, Math.min(14, -distanceFromCenter * 18));
        image.style.setProperty("--scroll-drift", `${drift.toFixed(1)}px`);
      });
    } else {
      parallaxImages.forEach((image) => image.style.removeProperty("--scroll-drift"));
    }

    scrollUpdatePending = false;
  });
};

window.addEventListener("scroll", updateScrollProgress, { passive: true });
window.addEventListener("resize", updateScrollProgress);
updateScrollProgress();
const countElements = document.querySelectorAll("[data-count-value]");
const formatNumber = new Intl.NumberFormat("en");
const animateCount = (element) => {
  const target = Number(element.dataset.countValue);
  if (!Number.isFinite(target)) return;
  const duration = 1100;
  const start = performance.now();
  const update = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - progress) ** 4;
    element.textContent = formatNumber.format(Math.round(target * eased));
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
};

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 },
  );
  document.querySelectorAll(".reveal").forEach((element, index) => {
    element.style.setProperty("--reveal-delay", `${(index % 4) * 70}ms`);
    revealObserver.observe(element);
  });

  document
    .querySelectorAll(".service-grid, .mihiraviye-photo-grid, .past-events-photo-grid, .package-grid")
    .forEach((grid) => {
      grid.querySelectorAll(".reveal").forEach((element, index) => {
        element.style.setProperty("--reveal-delay", `${(index % 4) * 85}ms`);
      });
    });

  const countObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.65 },
  );
  countElements.forEach((element) => countObserver.observe(element));

} else {
  document.querySelectorAll(".reveal").forEach((element) => element.classList.add("is-visible"));
  countElements.forEach(animateCount);
}

const reservationForm = document.querySelector("#reservation-form");
if (reservationForm) {
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
  const packageKey = new URLSearchParams(window.location.search).get("package");
  const selectedPackage = Object.prototype.hasOwnProperty.call(packageDetails, packageKey)
    ? packageDetails[packageKey]
    : null;
  const packageName = document.querySelector("#selected-package-name");
  const packageCategory = document.querySelector("#selected-package-category");
  const packageField = document.querySelector("#reservation-package");
  const categoryField = document.querySelector("#reservation-category");
  const submitButton = reservationForm.querySelector('button[type="submit"]');
  const status = document.querySelector("#reservation-status");
  const eventStartDate = reservationForm.querySelector('[name="event_start_date"]');
  const eventEndDate = reservationForm.querySelector('[name="event_end_date"]');
  const today = new Date().toISOString().slice(0, 10);
  eventStartDate.min = today;
  eventEndDate.min = today;

  const updateEventDateRange = () => {
    eventEndDate.min = eventStartDate.value;
    eventEndDate.setCustomValidity(
      eventEndDate.value && eventEndDate.value < eventStartDate.value
        ? "End date must be on or after the start date."
        : "",
    );
  };
  eventStartDate.addEventListener("input", updateEventDateRange);
  eventEndDate.addEventListener("input", updateEventDateRange);

  if (selectedPackage) {
    packageName.textContent = selectedPackage.name;
    packageCategory.textContent = selectedPackage.category;
    packageField.value = packageKey;
    categoryField.value = selectedPackage.category;
    submitButton.disabled = false;
  } else {
    packageName.textContent = "Choose a package from our packages page to continue.";
    submitButton.disabled = true;
  }

  reservationForm.addEventListener("submit", (event) => {
    event.preventDefault();
    submitButton.disabled = true;
    status.textContent = "Sending your reservation request…";
    status.hidden = false;

    fetch(reservationForm.action, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(Object.fromEntries(new FormData(reservationForm))),
    })
      .then(async (response) => {
        let result;
        try {
          result = await response.json();
        } catch {
          result = null;
        }

        if (!response.ok) {
          throw new Error(
            result && typeof result.error === "string"
              ? result.error
              : `Unable to send your request (HTTP ${response.status}). Please try again.`,
          );
        }
        if (!result || !["sent", "saved_notification_failed"].includes(result.status)) {
          throw new Error("The reservation service returned an unexpected response. Please try again.");
        }
        window.location.assign(
          result.status === "saved_notification_failed"
            ? "reservation-success.html?notification=unavailable"
            : "reservation-success.html",
        );
      })
      .catch((error) => {
        status.textContent =
          error instanceof Error
            ? error.message
            : "Unable to send your request. Please try again.";
        submitButton.disabled = false;
      });
  });
}

const notificationWarning = document.querySelector("#reservation-notification-warning");
if (notificationWarning && new URLSearchParams(window.location.search).get("notification") === "unavailable") {
  notificationWarning.textContent =
    "Your request was saved, but email confirmation is temporarily unavailable. Please contact dreammakerofc@gmail.com if your reservation is urgent.";
  notificationWarning.hidden = false;
}

document.querySelectorAll("#event-inquiry-form, #sponsor-inquiry-form").forEach((form) => {
  const status = form.querySelector(".inquiry-status");
  const submitButton = form.querySelector('button[type="submit"]');
  const preferredDate = form.querySelector('[name="preferred_date"]');
  if (preferredDate) preferredDate.min = new Date().toISOString().slice(0, 10);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submitButton.disabled = true;
    status.hidden = false;
    status.classList.remove("is-error");
    status.textContent = "Sending your inquiry…";
    try {
      const response = await fetch("/api/inquiry", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      let result;
      try {
        result = await response.json();
      } catch {
        result = null;
      }
      if (!response.ok || !result || !["received", "saved_notification_failed"].includes(result.status)) {
        throw new Error(
          typeof result?.error === "string"
            ? result.error
            : `Unable to send your inquiry (HTTP ${response.status}). Please try again.`,
        );
      }
      status.textContent = result.message;
      form.reset();
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : "Unable to send your inquiry. Please try again.";
      status.classList.add("is-error");
    } finally {
      submitButton.disabled = false;
    }
  });
});

const portfolioFilters = document.querySelectorAll("[data-portfolio-filter]");
const portfolioItems = document.querySelectorAll(".past-events-photo-grid [data-category]");
portfolioFilters.forEach((filter) => {
  filter.addEventListener("click", () => {
    const category = filter.dataset.portfolioFilter;
    portfolioFilters.forEach((button) => {
      button.setAttribute("aria-pressed", String(button === filter));
    });
    portfolioItems.forEach((item) => {
      item.hidden = category !== "all" && item.dataset.category !== category;
    });
  });
});

const eventCalendar = document.querySelector("#event-calendar");
if (eventCalendar) {
  const monthLabel = document.querySelector("#calendar-month");
  const eventStatus = document.querySelector("#calendar-status");
  const eventList = document.querySelector("#event-list");
  const previousMonth = document.querySelector("#calendar-previous");
  const nextMonth = document.querySelector("#calendar-next");
  const todayValue = new Date();
  const todayKey = `${todayValue.getFullYear()}-${String(todayValue.getMonth() + 1).padStart(2, "0")}-${String(todayValue.getDate()).padStart(2, "0")}`;
  let visibleMonth = new Date(todayValue.getFullYear(), todayValue.getMonth(), 1);
  let selectedDate = null;
  let upcomingEvents = [];

  const getEventDate = (event) => {
    const [yearValue, monthValue, dayValue] = event.event_date.split("-").map(Number);
    return new Date(yearValue, monthValue - 1, dayValue);
  };
  const formatEventDate = (date) =>
    new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(date);

  const renderEventList = () => {
    const visibleEvents = upcomingEvents.filter((event) => {
      const date = getEventDate(event);
      return date.getFullYear() === visibleMonth.getFullYear() &&
        date.getMonth() === visibleMonth.getMonth() &&
        (!selectedDate || event.event_date === selectedDate);
    });
    eventList.replaceChildren();
    if (!visibleEvents.length) {
      const empty = document.createElement("p");
      empty.className = "event-empty";
      empty.textContent = upcomingEvents.length
        ? selectedDate ? "No event is scheduled for this date." : "No published events this month."
        : "No upcoming events have been announced yet. Please check back soon.";
      eventList.append(empty);
      return;
    }

    visibleEvents.forEach((event) => {
      const card = document.createElement("article");
      card.className = "event-card";
      const date = getEventDate(event);
      const dateLabel = document.createElement("p");
      dateLabel.className = "event-card-date";
      dateLabel.textContent = formatEventDate(date);
      const heading = document.createElement("h3");
      heading.textContent = event.title;
      const details = document.createElement("p");
      details.textContent = `${event.category} · ${event.venue}`;
      const description = document.createElement("p");
      description.textContent = event.description;
      card.append(dateLabel, heading, details, description);
      if (event.image_url) {
        const image = document.createElement("img");
        image.src = event.image_url;
        image.alt = "";
        image.loading = "lazy";
        card.prepend(image);
      }
      if (event.ticket_url) {
        const link = document.createElement("a");
        link.href = event.ticket_url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Event details";
        card.append(link);
      }
      eventList.append(card);
    });
  };

  const renderCalendar = () => {
    const yearValue = visibleMonth.getFullYear();
    const monthValue = visibleMonth.getMonth();
    monthLabel.textContent = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(visibleMonth);
    eventCalendar.replaceChildren();
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((day) => {
      const weekday = document.createElement("span");
      weekday.className = "calendar-weekday";
      weekday.setAttribute("role", "columnheader");
      weekday.textContent = day;
      eventCalendar.append(weekday);
    });

    const firstWeekday = new Date(yearValue, monthValue, 1).getDay();
    const daysThisMonth = new Date(yearValue, monthValue + 1, 0).getDate();
    for (let blank = 0; blank < firstWeekday; blank += 1) {
      const spacer = document.createElement("span");
      spacer.className = "calendar-day calendar-day-empty";
      spacer.setAttribute("aria-hidden", "true");
      eventCalendar.append(spacer);
    }
    for (let day = 1; day <= daysThisMonth; day += 1) {
      const dateKey = `${yearValue}-${String(monthValue + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const eventCount = upcomingEvents.filter((event) => event.event_date === dateKey).length;
      const dayButton = document.createElement("button");
      dayButton.type = "button";
      dayButton.className = "calendar-day";
      dayButton.textContent = String(day);
      dayButton.setAttribute("role", "gridcell");
      dayButton.setAttribute("aria-label", `${formatEventDate(new Date(yearValue, monthValue, day))}${eventCount ? `, ${eventCount} event${eventCount > 1 ? "s" : ""}` : ""}`);
      if (dateKey === todayKey) dayButton.classList.add("is-today");
      if (dateKey === selectedDate) dayButton.classList.add("is-selected");
      if (eventCount) {
        dayButton.classList.add("has-event");
        dayButton.title = `${eventCount} upcoming event${eventCount > 1 ? "s" : ""}`;
      }
      dayButton.addEventListener("click", () => {
        selectedDate = selectedDate === dateKey ? null : dateKey;
        renderCalendar();
        renderEventList();
      });
      eventCalendar.append(dayButton);
    }
    previousMonth.disabled =
      visibleMonth.getFullYear() === todayValue.getFullYear() && visibleMonth.getMonth() === todayValue.getMonth();
    renderEventList();
  };

  previousMonth.addEventListener("click", () => {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
    selectedDate = null;
    renderCalendar();
  });
  nextMonth.addEventListener("click", () => {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
    selectedDate = null;
    renderCalendar();
  });
  renderCalendar();

  fetch("/api/content?type=events")
    .then(async (response) => {
      let result;
      try {
        result = await response.json();
      } catch {
        result = null;
      }
      if (!response.ok) throw new Error(result?.error || "Upcoming events are temporarily unavailable.");
      if (!Array.isArray(result)) throw new Error("The event calendar returned an unexpected response.");
      upcomingEvents = result.filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.event_date) && item.event_date >= todayKey);
      eventStatus.hidden = true;
      renderCalendar();
    })
    .catch((error) => {
      eventStatus.textContent = error instanceof Error ? error.message : "Upcoming events are temporarily unavailable.";
      eventStatus.classList.add("is-error");
      renderCalendar();
    });
}

const testimonialList = document.querySelector("#testimonial-list");
if (testimonialList) {
  const testimonialStatus = document.querySelector("#testimonial-status");
  const clientLogos = document.querySelector("#client-logos");
  fetch("/api/content?type=testimonials")
    .then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Client stories are temporarily unavailable.");
      if (!Array.isArray(result)) throw new Error("Client stories returned an unexpected response.");
      testimonialList.replaceChildren();
      if (!result.length) {
        testimonialStatus.textContent = "Approved client stories will appear here once they’re added.";
      } else {
        testimonialStatus.hidden = true;
        result.forEach((item) => {
          const article = document.createElement("article");
          article.className = "testimonial-card";
          const quote = document.createElement("blockquote");
          quote.textContent = `“${item.quote}”`;
          const author = document.createElement("p");
          author.className = "testimonial-author";
          author.textContent = item.client_name;
          article.append(quote, author);
          if (item.organization) {
            const organization = document.createElement("p");
            organization.className = "testimonial-organization";
            organization.textContent = item.organization;
            article.append(organization);
          }
          testimonialList.append(article);
        });
      }
    })
    .catch((error) => {
      testimonialStatus.textContent = error instanceof Error ? error.message : "Client stories are temporarily unavailable.";
      testimonialStatus.classList.add("is-error");
    });

  fetch("/api/content?type=sponsors")
    .then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Partner logos are temporarily unavailable.");
      if (!Array.isArray(result)) throw new Error("Partner logos returned an unexpected response.");
      clientLogos.replaceChildren();
      if (!result.length) {
        const empty = document.createElement("p");
        empty.textContent = "Approved partner logos will appear here.";
        clientLogos.append(empty);
        return;
      }
      result.forEach((partner) => {
        const wrapper = partner.website_url ? document.createElement("a") : document.createElement("span");
        if (partner.website_url) {
          wrapper.href = partner.website_url;
          wrapper.target = "_blank";
          wrapper.rel = "noopener noreferrer";
          wrapper.setAttribute("aria-label", partner.name);
        }
        const logo = document.createElement("img");
        logo.src = partner.logo_url;
        logo.alt = partner.name;
        logo.loading = "lazy";
        wrapper.append(logo);
        clientLogos.append(wrapper);
      });
    })
    .catch(() => {
      const empty = document.createElement("p");
      empty.textContent = "Partner logos are temporarily unavailable.";
      clientLogos.replaceChildren(empty);
    });
}
