/*
 * Checks that every reviewable part listed in studio/js/catalog.js exists in each
 * prototype page, and that no prototype has reviewable parts missing from the catalog.
 *
 * Usage (with the site being served, e.g. `python3 -m http.server 8080` in this folder):
 *   node tools/check-catalog.cjs http://localhost:8080
 */
const { chromium } = require('playwright');

const base = (process.argv[2] || 'http://localhost:8080').replace(/\/$/, '');
const prototypes = ['p1', 'p2', 'p3'];
const pages = ['home', 'services', 'guide'];

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const problems = [];

  await page.goto(`${base}/index.html`);
  await page.waitForFunction(() => window.ShawnContent);
  const catalogs = await page.evaluate(async () => {
    const { catalogFor } = await import('/studio/js/catalog.js');
    const out = {};
    ['p1', 'p2', 'p3'].forEach((id) => { out[id] = catalogFor(id).map((i) => ({ id: i.id, page: i.page })); });
    return out;
  });

  for (const proto of prototypes) {
    const found = new Map(); // id -> count across all pages
    const excluded = new Set();
    for (const name of pages) {
      const view = await context.newPage();
      await view.goto(`${base}/prototypes/${proto}/index.html#${name}`);
      await view.waitForSelector('main > *');
      const ids = await view.$$eval('[data-review-id]', (nodes) => nodes.map((n) => n.getAttribute('data-review-id')));
      const seen = new Set();
      ids.forEach((id) => {
        if (seen.has(id)) problems.push(`${proto}/${name}: duplicate id ${id}`);
        seen.add(id);
        found.set(id, (found.get(id) || 0) + 1);
      });
      // Each page must contain its own parts plus all site-wide parts.
      catalogs[proto].filter((i) => i.page === name || i.page === 'site').forEach((i) => {
        if (!seen.has(i.id)) problems.push(`${proto}/${name}: missing ${i.id}`);
      });
      seen.forEach((id) => {
        if (!catalogs[proto].some((i) => i.id === id)) problems.push(`${proto}/${name}: ${id} is not in the catalog`);
        const entry = catalogs[proto].find((i) => i.id === id);
        if (entry && entry.page !== 'site' && entry.page !== name) problems.push(`${proto}/${name}: ${id} belongs to page ${entry.page}`);
      });
      (await view.$$eval('[data-review-excluded]', (n) => n.length)) || excluded.add(name);
      await view.close();
    }
  }

  await browser.close();
  if (problems.length) {
    console.log(`Found ${problems.length} problem(s):`);
    problems.forEach((p) => console.log(' - ' + p));
    process.exit(1);
  }
  console.log('Catalog check passed: every listed part exists on every page, with no extras or duplicates.');
})();
