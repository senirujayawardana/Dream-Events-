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
  ]);
  assert.match(robots, /User-agent: \*\s+Allow: \//);
  assert.match(robots, /Disallow: \/admin\.html/);
  assert.match(robots, new RegExp(`Sitemap: ${siteOrigin.replaceAll(".", "\\.")}/sitemap\\.xml`));
  assert.doesNotMatch(sitemap, /admin\.html|reservation\.html|reservation-success\.html/);
});

test("private and transactional pages are marked noindex", () => {
  ["admin.html", "reservation.html", "reservation-success.html"].forEach((file) => {
    assert.match(readFrontend(file), /<meta name="robots" content="noindex/);
  });
});
