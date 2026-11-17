const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const siteOrigin = "https://www.dreamevents.com.lk";
const readFrontend = (file) => fs.readFileSync(path.join(root, "frontend", file), "utf8");

test("public pages declare unique titles, descriptions, canonicals, and large social images", () => {
  const pages = [
    ["index.html", `${siteOrigin}/`],
    ["packages.html", `${siteOrigin}/packages.html`],
    ["story.html", `${siteOrigin}/story.html`],
    ["investor-relations.html", `${siteOrigin}/investor-relations.html`],
  ];
  const titles = new Set();

  pages.forEach(([file, canonical]) => {
    const html = readFrontend(file);
    const title = html.match(/<title>(.*?)<\/title>/)?.[1];
    assert.ok(title, `${file} should have a title`);
    assert.ok(title.length <= 60, `${file} title should fit a search result title`);
    assert.ok(!titles.has(title), `${file} should have a unique title`);
    titles.add(title);
    assert.match(html, /<meta\s+name="description"\s+content="[^"]{70,170}"/);
    assert.ok(html.includes(`<link rel="canonical" href="${canonical}" />`), `${file} should use its canonical URL`);
    assert.match(html, /<meta property="og:image" content="https:\/\/www\.dreamevents\.com\.lk\/assets\/[^"]+"/);
    assert.match(html, /<meta name="twitter:card" content="summary_large_image"/);
  });
});

test("legal pages have unique titles, descriptions, and canonical URLs", () => {
  [
    ["privacy.html", `${siteOrigin}/privacy.html`],
    ["booking-terms.html", `${siteOrigin}/booking-terms.html`],
  ].forEach(([file, canonical]) => {
    const html = readFrontend(file);
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.match(html, /<meta\s+name="description"\s+content="[^"]{70,170}"/);
    assert.ok(html.includes(`<link rel="canonical" href="${canonical}" />`));
  });
});

test("homepage structured data identifies the site and organization at the canonical origin", () => {
  const html = readFrontend("index.html");
  const schemas = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((match) => JSON.parse(match[1]));
  const organization = schemas.find((schema) => schema["@type"] === "Organization");
  const website = schemas.find((schema) => schema["@type"] === "WebSite");

  assert.ok(organization);
  assert.equal(organization.url, `${siteOrigin}/`);
  assert.equal(organization.name, "Dream Events");
  assert.ok(organization.sameAs.includes("https://www.instagram.com/dream_events.lk/"));
  assert.ok(website);
  assert.equal(website.publisher["@id"], organization["@id"]);
});

test("sitemap lists indexable pages and robots excludes the admin page", () => {
  const sitemap = readFrontend("sitemap.xml");
  const robots = readFrontend("robots.txt");
  const listedPages = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);

  assert.deepEqual(listedPages, [
    `${siteOrigin}/`,
    `${siteOrigin}/packages.html`,
    `${siteOrigin}/story.html`,
    `${siteOrigin}/investor-relations.html`,
    `${siteOrigin}/privacy.html`,
    `${siteOrigin}/booking-terms.html`,
  ]);
  assert.match(robots, /User-agent: \*\s+Allow: \//);
  assert.match(robots, /Disallow: \/admin\.html/);
  assert.match(robots, new RegExp(`Sitemap: ${siteOrigin.replaceAll(".", "\\.")}/sitemap\\.xml`));
  assert.doesNotMatch(sitemap, /admin\.html|reservation\.html|reservation-success\.html/);
});

test("public pages link to legal pages without exposing the admin sign-in URL", () => {
  [
    "index.html",
    "packages.html",
    "story.html",
    "investor-relations.html",
    "reservation.html",
    "reservation-success.html",
    "privacy.html",
    "booking-terms.html",
  ].forEach((file) => {
    const html = readFrontend(file);
    assert.doesNotMatch(html, /href="admin\.html"/, `${file} should not expose the admin sign-in link`);
    assert.match(html, /href="privacy\.html"/, `${file} should link to the privacy policy`);
    assert.match(html, /href="booking-terms\.html"/, `${file} should link to the booking terms`);
  });
});

test("public inquiry forms link to the privacy policy and booking terms", () => {
  [
    ["index.html", "event-inquiry-form"],
    ["investor-relations.html", "sponsor-inquiry-form"],
    ["reservation.html", "reservation-form"],
  ].forEach(([file, id]) => {
    const html = readFrontend(file);
    const form = html.match(new RegExp(`<form[^>]*id="${id}"[\\s\\S]*?</form>`))?.[0];
    assert.ok(form, `${id} should exist`);
    assert.match(form, /href="privacy\.html"/);
    assert.match(form, /href="booking-terms\.html"/);
  });
});

test("package pricing and reservation language describe enquiries rather than confirmed bookings", () => {
  const packages = readFrontend("packages.html");
  const reservation = readFrontend("reservation.html");
  const success = readFrontend("reservation-success.html");
  const normalizedPackages = packages.replace(/\s+/g, " ");

  assert.match(normalizedPackages, /<strong>From LKR 900,000<\/strong>/);
  assert.match(normalizedPackages, /<strong>Planning fee only:<\/strong> LKR 200,000/);
  assert.doesNotMatch(packages, /Reserve this package/);
  assert.match(reservation, /name="guest_count"/);
  assert.match(reservation, /name="venue"/);
  assert.match(success, /not a confirmed booking/i);
});

test("private and transactional pages are marked noindex", () => {
  ["admin.html", "reservation.html", "reservation-success.html"].forEach((file) => {
    assert.match(readFrontend(file), /<meta name="robots" content="noindex/);
  });
});
