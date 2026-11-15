const loginView = document.querySelector("#admin-login");
const dashboard = document.querySelector("#admin-dashboard");
const loginForm = document.querySelector("#admin-login-form");
const loginFeedback = document.querySelector("#admin-login-feedback");
const sessionKey = "dream-events-admin-token";
const hash = new URLSearchParams(window.location.hash.slice(1));
const hashToken = hash.get("access_token");
if (hashToken) {
  sessionStorage.setItem(sessionKey, hashToken);
  history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}

let accessToken = sessionStorage.getItem(sessionKey);
const resourceLabels = {
  events: "No events have been added yet.",
  testimonials: "No client stories have been added yet.",
  sponsors: "No partner logos have been added yet.",
  inquiries: "No customer inquiries yet.",
};

const setFeedback = (element, message, isError = false) => {
  element.textContent = message;
  element.hidden = !message;
  element.classList.toggle("is-error", isError);
};

const apiRequest = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {}),
    },
  });
  let result;
  try {
    result = await response.json();
  } catch {
    result = null;
  }
  if (!response.ok) {
    if (response.status === 401) {
      signOut();
    }
    throw new Error(typeof result?.error === "string" ? result.error : `The request failed (HTTP ${response.status}).`);
  }
  return result;
};

const showDashboard = (isSignedIn) => {
  loginView.hidden = isSignedIn;
  dashboard.hidden = !isSignedIn;
};

const signOut = () => {
  sessionStorage.removeItem(sessionKey);
  accessToken = null;
  showDashboard(false);
  if (loginFeedback) setFeedback(loginFeedback, "You have been signed out.");
};

const renderText = (tag, text, className) => {
  const element = document.createElement(tag);
  element.textContent = text || "";
  if (className) element.className = className;
  return element;
};

const renderPublishedCard = (resource, record) => {
  const card = document.createElement("article");
  card.className = "admin-record-card";
  const detail = document.createElement("div");

  if (resource === "events") {
    detail.append(renderText("h3", record.title));
    detail.append(renderText("p", `${record.category} · ${record.event_date} · ${record.venue}`));
    detail.append(renderText("p", record.description));
  } else if (resource === "testimonials") {
    detail.append(renderText("h3", record.client_name));
    if (record.organization) detail.append(renderText("p", record.organization));
    detail.append(renderText("blockquote", `“${record.quote}”`));
  } else {
    detail.append(renderText("h3", record.name));
    detail.append(renderText("p", record.logo_url));
    if (record.website_url) detail.append(renderText("p", record.website_url));
  }
  card.append(detail);

  const actions = document.createElement("div");
  actions.className = "admin-record-actions";
  actions.append(renderText("span", record.is_published ? "Published" : "Draft", "admin-record-status"));
  const edit = renderText("button", "Edit");
  edit.type = "button";
  edit.dataset.editRecord = resource;
  edit.dataset.recordId = record.id;
  actions.append(edit);
  const remove = renderText("button", "Delete");
  remove.type = "button";
  remove.dataset.deleteRecord = resource;
  remove.dataset.recordId = record.id;
  actions.append(remove);
  card.append(actions);
  return card;
};

const renderInquiry = (record) => {
  const card = document.createElement("article");
  card.className = "admin-record-card admin-inquiry-card";
  const details = document.createElement("div");
  const kindLabel = record.kind === "reservation"
    ? `Package reservation: ${record.package_name || "Event package"}`
    : record.kind === "sponsor" ? "Sponsor / partnership inquiry" : "Event inquiry";
  details.append(renderText("h3", kindLabel));
  details.append(renderText("p", `${record.name} · ${record.email}${record.phone ? ` · ${record.phone}` : ""}`));
  if (record.kind === "reservation") {
    details.append(renderText("p", `Dates: ${record.event_start_date || "Not specified"} – ${record.event_end_date || "Not specified"}`));
  } else if (record.kind === "event") {
    details.append(renderText("p", `${record.event_type || "Event"} · ${record.preferred_date || "Date not specified"} · ${record.venue || "Location not specified"}`));
  } else if (record.organization) {
    details.append(renderText("p", `Organization: ${record.organization}`));
  }
  if (record.message) details.append(renderText("p", record.message));
  details.append(renderText("p", `Received ${new Date(record.created_at).toLocaleString()}`));
  card.append(details);

  const actions = document.createElement("div");
  actions.className = "admin-record-actions";
  const status = document.createElement("select");
  status.setAttribute("aria-label", `Inquiry status for ${record.name}`);
  ["new", "contacted", "closed"].forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value[0].toUpperCase() + value.slice(1);
    option.selected = value === record.status;
    status.append(option);
  });
  actions.append(status);
  const update = renderText("button", "Update status");
  update.type = "button";
  update.dataset.updateInquiry = record.id;
  update.dataset.status = status.value;
  status.addEventListener("change", () => { update.dataset.status = status.value; });
  actions.append(update);
  card.append(actions);
  return card;
};

const loadResource = async (resource) => {
  const feedback = document.querySelector(`[data-list-feedback="${resource}"]`);
  const list = document.querySelector(`[data-record-list="${resource}"]`);
  setFeedback(feedback, "Loading…");
  list.replaceChildren();
  try {
    const records = await apiRequest(`/api/admin?resource=${resource}`);
    if (!Array.isArray(records)) throw new Error("The dashboard returned an unexpected response.");
    setFeedback(feedback, records.length ? "" : resourceLabels[resource]);
    records.forEach((record) => {
      list.append(resource === "inquiries" ? renderInquiry(record) : renderPublishedCard(resource, record));
    });
  } catch (error) {
    setFeedback(feedback, error.message, true);
  }
};

const loadAllResources = () => ["events", "testimonials", "sponsors", "inquiries"].forEach(loadResource);

const submitAdminAuth = async (payload, button, mode) => {
  button.disabled = true;
  setFeedback(loginFeedback, mode === "password" ? "Signing you in…" : "Sending a secure sign-in link…");
  try {
    const response = await fetch("/api/admin-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let result;
    try {
      result = await response.json();
    } catch {
      result = null;
    }
    if (!response.ok) {
      throw new Error(typeof result?.error === "string"
        ? result.error
        : `Unable to sign in (HTTP ${response.status}).`);
    }
    if (mode === "password") {
      if (typeof result?.access_token !== "string" || !result.access_token) {
        throw new Error("The sign-in service returned an invalid response.");
      }
      accessToken = result.access_token;
      sessionStorage.setItem(sessionKey, accessToken);
      loginForm.reset();
      setFeedback(loginFeedback, "");
      showDashboard(true);
      loadAllResources();
    } else {
      setFeedback(loginFeedback, result?.message || "Check your email for the sign-in link.");
    }
  } catch (error) {
    setFeedback(loginFeedback, error instanceof Error ? error.message : "Unable to sign in.", true);
  } finally {
    button.disabled = false;
  }
};

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = loginForm.querySelector('button[type="submit"]');
    const formData = new FormData(loginForm);
    submitAdminAuth({
      mode: "password",
      email: formData.get("email"),
      password: formData.get("password"),
    }, button, "password");
  });

  document.querySelector("#admin-email-link")?.addEventListener("click", (event) => {
    const email = loginForm.elements.namedItem("email");
    if (!email.reportValidity()) return;
    submitAdminAuth({ mode: "magic_link", email: email.value }, event.currentTarget, "magic_link");
  });
}

document.querySelector("#admin-sign-out")?.addEventListener("click", signOut);

document.querySelectorAll("[data-admin-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("[data-admin-tab]").forEach((item) => {
      const selected = item === tab;
      item.setAttribute("aria-selected", String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    document.querySelectorAll("[data-admin-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.adminPanel !== tab.dataset.adminTab;
    });
  });
});

const resetRecordForm = (resource) => {
  const form = document.querySelector(`[data-record-form="${resource}"]`);
  form.reset();
  form.elements.id.value = "";
  form.hidden = true;
  const feedback = form.querySelector(".admin-feedback");
  if (feedback) setFeedback(feedback, "");
  const submit = form.querySelector('button[type="submit"]');
  submit.textContent = resource === "events" ? "Save event" : resource === "testimonials" ? "Save testimonial" : "Save partner";
};

document.querySelectorAll("[data-new-record]").forEach((button) => {
  button.addEventListener("click", () => {
    const form = document.querySelector(`[data-record-form="${button.dataset.newRecord}"]`);
    resetRecordForm(button.dataset.newRecord);
    form.hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    form.querySelector("input:not([type=hidden]), textarea")?.focus();
  });
});

document.querySelectorAll("[data-cancel-form]").forEach((button) => {
  button.addEventListener("click", () => resetRecordForm(button.dataset.cancelForm));
});

document.querySelectorAll("[data-record-form]").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const resource = form.dataset.recordForm;
    const feedback = form.querySelector(".admin-feedback");
    const submit = form.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(form));
    data.is_published = form.elements.is_published.checked;
    const id = data.id;
    delete data.id;
    submit.disabled = true;
    setFeedback(feedback, "Saving…");
    try {
      await apiRequest(`/api/admin?resource=${resource}`, {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(id ? { ...data, id } : data),
      });
      resetRecordForm(resource);
      await loadResource(resource);
    } catch (error) {
      setFeedback(feedback, error.message, true);
    } finally {
      submit.disabled = false;
    }
  });
});

document.addEventListener("click", async (event) => {
  const edit = event.target.closest("[data-edit-record]");
  if (edit) {
    const resource = edit.dataset.editRecord;
    const form = document.querySelector(`[data-record-form="${resource}"]`);
    try {
      const records = await apiRequest(`/api/admin?resource=${resource}`);
      const record = records.find((item) => item.id === edit.dataset.recordId);
      if (!record) throw new Error("This record is no longer available.");
      Object.entries(record).forEach(([key, value]) => {
        if (form.elements[key]) {
          if (form.elements[key].type === "checkbox") form.elements[key].checked = Boolean(value);
          else form.elements[key].value = value ?? "";
        }
      });
      form.hidden = false;
      form.querySelector('button[type="submit"]').textContent = `Update ${resource === "events" ? "event" : resource === "testimonials" ? "testimonial" : "partner"}`;
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setFeedback(document.querySelector(`[data-list-feedback="${resource}"]`), error.message, true);
    }
    return;
  }

  const remove = event.target.closest("[data-delete-record]");
  if (remove) {
    const resource = remove.dataset.deleteRecord;
    if (!window.confirm("Delete this record? This cannot be undone.")) return;
    remove.disabled = true;
    try {
      await apiRequest(`/api/admin?resource=${resource}`, {
        method: "DELETE",
        body: JSON.stringify({ id: remove.dataset.recordId }),
      });
      await loadResource(resource);
    } catch (error) {
      setFeedback(document.querySelector(`[data-list-feedback="${resource}"]`), error.message, true);
    } finally {
      remove.disabled = false;
    }
    return;
  }

  const update = event.target.closest("[data-update-inquiry]");
  if (update) {
    update.disabled = true;
    try {
      await apiRequest("/api/admin?resource=inquiries", {
        method: "PATCH",
        body: JSON.stringify({ id: update.dataset.updateInquiry, status: update.dataset.status }),
      });
      await loadResource("inquiries");
    } catch (error) {
      setFeedback(document.querySelector('[data-list-feedback="inquiries"]'), error.message, true);
    } finally {
      update.disabled = false;
    }
  }
});

showDashboard(Boolean(accessToken));
if (accessToken) loadAllResources();
