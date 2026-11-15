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
        if (!result || result.status !== "sent") {
          throw new Error("The reservation service returned an unexpected response. Please try again.");
        }
        window.location.assign("reservation-success.html");
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
