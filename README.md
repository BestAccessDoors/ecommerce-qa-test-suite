# Automated Testing for the Best Access Doors Stores

This project automatically checks that the customer-facing forms and key pages on the Best Access Doors family of stores are working correctly. It acts like a robot customer: it opens the website, fills out forms, clicks submit, and verifies that everything behaves as expected — all without a human having to do it by hand.

One shared set of tests runs against any of the stores. Each store has its own small configuration file in the `stores/` folder; the tests adapt automatically.

## Supported Stores

| Code | Store | Status |
|------|-------|--------|
| `bestus` | [bestaccessdoors.com](https://www.bestaccessdoors.com) | Fully configured (default) |
| `bestca` | [bestaccessdoors.ca](https://www.bestaccessdoors.ca) | Fully configured |
| `adap` | [accessdoorsandpanels.com](https://www.accessdoorsandpanels.com) | Fully configured |
| `adc` | [accessdoorscanada.ca](https://accessdoorscanada.ca) | Fully configured |
| `aap` | [acudoraccesspanels.com](https://www.acudoraccesspanels.com) | Fully configured |
| `fse` | [firesafetyequipment.com](https://firesafetyequipment.com) | Fully configured |
| `brh` | [bestroofhatches.com](https://bestroofhatches.com) | Fully configured |
| `cad` | [californiaaccessdoors.com](https://californiaaccessdoors.com) | Fully configured |
| `pda` | [puertasdeacceso.com.mx](https://puertasdeacceso.com.mx) | Fully configured (Spanish, MX) |

All nine stores are fully configured and run the complete suite. Tests still show up as **skipped** ("pending") on a store wherever its config marks a feature absent (a `null` section or selector) — for example a store whose theme has no Pro Club form or no related-products carousel. Skips are always deliberate and self-documenting; see "Skipped tests and how to enable them" below.

---

## Why This Exists

When a form breaks on the website — say, the "Request a Quote" button stops working — real customers can't reach the sales team. These tests catch those problems early, before anyone notices, so they can be fixed quickly.

Running the tests takes a few minutes instead of an hour of manual clicking. And because they run the same way every time, nothing gets accidentally skipped.

---

## What Gets Tested

### Forms

| Form | Where to find it | What it does |
|------|-----------------|--------------|
| **Product Information** | On individual product pages | Lets customers ask a question about a specific product |
| **Contact Us** | `/contact-us/` | General inquiries, supports optional file attachment |
| **Request a Quote** | `/request-a-quote/` | Customers request pricing for a product |
| **Pro Club Application** | `/pro-club-application/` | Contractors and resellers apply for trade pricing |
| **Architects & Spec Writers** | `/architects/` | Architects and spec writers request product info (ADC, CAD and ADAP) |
| **Become a Vendor** | `/bvl1/` | Suppliers apply to become a vendor (ADAP only) |

For each form, the tests verify:
- The form submits successfully when filled out correctly
- The right information is actually sent when the form is submitted
- Error messages appear when required fields are left blank
- Error messages appear when an email address is typed in the wrong format

### Pages

| Page | What's checked |
|------|---------------|
| **Homepage** | Header/footer links work (no broken links), phone number is consistent, no browser errors |
| **Homepage (mobile)** | Layout looks correct on 3 phone sizes and 1 tablet size, nothing overflows, touch targets are large enough to tap |
| **Product Listing Page (PLP)** | Product grid loads, cards have images/titles/prices/links, pagination works, sidebar categories link correctly |
| **PLP (mobile)** | Same device range as homepage mobile — grid, cards, and sidebar all present |
| **Product Detail Page (PDP)** | Breadcrumbs, title, price, images, qty input, Add to Cart, PDF spec links, description, video, related products carousel, Yotpo reviews widget, product info form, SKU, lead time |
| **PDP (mobile)** | Same 3 phones + 1 tablet device matrix; title, price, images, qty, Add to Cart, description, carousel, form, SKU, lead time, mobile nav, no horizontal overflow, touch targets, no console errors; landscape pass for phones |
| **Product Discovery** | Site search returns relevant products and shows a no-results message for nonsense terms, category/refinement pages render, sort by price low-to-high actually orders products, pagination moves to page 2, and a result opens its product page |
| **Discovery (mobile)** | Same 3 phones + 1 tablet device matrix — category and search-results pages render with no horizontal overflow and no console errors |

---

## Requirements

You need **Node.js**. Node.js is a tool that lets you run JavaScript programs outside of a web browser — it's what powers the test runner.

**On Windows you don't have to install it yourself** — double-click `First Time Setup.bat` and it will download and set up a supported Node.js for you (see [Setup](#setup) below).

**To check what you already have,** open a terminal (on Windows: press `Win + R`, type `cmd`, press Enter) and run:

```
node --version
```

Supported versions are **22.x or 24.x**. Anything else — Node 20 and older, the odd-numbered non-LTS releases, and Node 26+ — is rejected on purpose; `First Time Setup.bat` installs a supported version (**24.19.0**) alongside the tests instead of using it. That is stricter than the range Cypress declares in its own `engines` field (and mirrored in this project's `package.json`), at both ends:

> **Node 20 is excluded** because it reached end of life on April 30 2026 and no longer receives security patches.
>
> **Node 26 is excluded** because it has not been verified. Under the suite's previous Cypress (15.15.0) its unzip step (`extract-zip` → `yauzl 2.10.0`) failed on Node 26: it printed "Unzipping Cypress" and stopped, *reporting success* while leaving no browser behind. The suite moved to Cypress 15.21.1 on Oct 15 2026 (verified on Node 24.19.0 and 22.23.2), which replaced that unzip stack; Node 26 itself still needs the check in `MAINTENANCE.md` before it is accepted.

If you maintain this project's versions, see **[MAINTENANCE.md](MAINTENANCE.md)** — it has the support-end dates, what triggers an upgrade, the log of which Node/Cypress combinations have been verified, and the exact procedure for checking a new one.

You also need **Google Chrome** installed, since the tests run in Chrome by default. Most computers already have it; if not, get it at [google.com/chrome](https://www.google.com/chrome).

---

## Setup

**Do this once** after downloading the project.

**On Windows, just double-click `First Time Setup.bat`** — it checks (and if needed installs) Node.js, installs dependencies, and downloads the Cypress browser binary. Skip the manual steps below.

**Optional, one extra step for the checkout test:** `checkout.cy.js` signs in as a real test customer, so it needs credentials that are deliberately not in this repo. Copy `credentials.example.json` to `credentials.json` (gitignored) and fill it in, or set `CHECKOUT_EMAIL_<CODE>` / `CHECKOUT_PASSWORD_<CODE>`. Without it that one test shows as skipped — not failed — and everything else runs normally. See `MAINTENANCE.md` §8.

**Ordinary runs never place an order.** `checkout.cy.js` stops at the payment step, and the order guard in `cypress/support/e2e.js` blocks BigCommerce's order endpoints outright. A separate, skipped-by-default suite inside the same spec *does* place a real order paid from the QA account's store credit — it needs `npm run test:checkout-order:store -- <store> --spec "cypress/e2e/checkout.cy.js"` (two env flags read from the parent process environment) **and** a committed `checkout.placeOrder` in the store's config, and the Test Dashboard strips those flags so it can never be started from the UI. Orders it creates must be cancelled by hand; see `MAINTENANCE.md` §8b.

Manually, from a terminal:

1. Navigate to the folder where you downloaded this project:
   ```
   cd "path/to/ecommerce-qa-test-suite"
   ```

2. Install the project's dependencies:
   ```
   npm install
   ```

3. Download the Cypress browser binary:
   ```
   npx cypress install
   npx cypress verify
   ```

   **Step 3 is not optional.** Recent npm versions skip install scripts, so Cypress's own `postinstall` never runs and `npm install` alone leaves no test browser — every test run then fails. `First Time Setup.bat` does this for you.

   Together these take a few minutes (the browser binary is ~200 MB). You only need to do it once (or again if the project's dependencies change).

---

## Running the Tests

> **All tests run in Google Chrome by default.** Every command and launcher below uses Chrome automatically — you don't have to pass `--browser`. (Advanced users can still override with `--browser firefox`; `lighthouse.cy.js` skips itself outside Chrome.)

### Easiest way — the Test Dashboard (a friendly page in your browser)

If you're not comfortable with a terminal, you don't need one. **Double-click `Test Dashboard.bat`** — a small engine window opens and your web browser pops up at `http://localhost:8420` with a point-and-click dashboard:

- Tick the store(s) you want (or **Select all**) and click **Run selected**.
- Watch **color-coded cards** fill in live as each store finishes — green = all good; grey = a few failures (80%+ passed); orange/red = more broke.
- Click a failed card to see the failing tests, **open the screenshot**, or **play the video** of what happened — no digging through folders.
- The **History** tab lists every past run.
- **Re-run failed** re-runs only the specs that failed.
- A **Light/Dark** toggle (top-right) switches themes; your choice is remembered.

Leave the small engine window open while you work — closing it stops the dashboard. See **`READ ME FIRST.txt`** for the picture version. (Terminal equivalent: `npm run dashboard`.)

The dashboard is **stub-only** — it can never submit real forms or create CRM leads; live mode stays terminal-only (Option 6).

### Also available — double-click launchers (no browser)

Three more Windows launchers work if you'd rather watch a plain black window (four with `Test Dashboard.bat` above):

| Double-click this file | What it does |
|---|---|
| **`First Time Setup.bat`** | Run **once**. Installs Node.js if needed, then everything else the tests need. |
| **`Run All Tests.bat`** | Tests **every store** in Chrome, then shows a PASS/FAIL summary. |
| **`Run One Store.bat`** | Shows a numbered menu — pick one store to test in Chrome. |

The two run launchers check that setup ran (and run it for you if not), keep their window open at the end so you can read the results, and points you to `results\test-results.log`. All four call `scripts\ensure-node.bat` first, so Node.js is installed or corrected automatically — you only need **Google Chrome** installed yourself.

The `npm` commands below do the exact same things and are for anyone who prefers a terminal.

> **Note:** The `npm` shortcuts below are configured in `package.json`. You can also call `npx cypress` directly if you prefer.

### Option 1 — Run every store (all tests, all stores)

```
npm run test:all
npm run test:all -- --stores bestus,bestca
```

This is the full run — every test against every store. Stores run one after another (each gets its own browser session), failures don't stop the loop, and a pass/fail summary table prints at the end. Screenshots and videos are saved per store (`cypress/videos/bestca/`, etc.). Use `--stores` to limit to a comma-separated subset.

Best for: a complete health check across all nine stores. (Double-click equivalent: **`Run All Tests.bat`**.)

### Option 2 — Fast & Safe, default store only (recommended for daily use)

```
npm test
```

This runs all tests against the default store (BESTUS) in the background (no browser window opens). It does **not** submit real forms — it intercepts the form submissions and fakes a successful response so no leads are created in the CRM.

Best for: quickly checking that nothing is broken.

### Option 3 — Run a specific store

```
npm run test:store bestca
npm run test:store -- aap --spec "cypress/e2e/homepage.cy.js"
```

The first argument is the store code from the table above. Anything after it is passed straight to Cypress. To open the interactive app for another store:

```
npx cross-env STORE=bestca cypress open --browser chrome
```

(Bare `npx cypress …` defaults to Electron, so pass `--browser chrome` yourself here; the `npm` scripts already do.)

(Restart `cypress open` after editing a store's JSON file — the config is read once at launch.)

### Option 4 — Interactive (watch the tests run)

```
npm run test:open
```

This opens the Cypress app where you can pick which tests to run and watch them execute in a real browser window. Useful when you want to see exactly what's happening or when debugging a failing test.

### Option 5 — Run a single test file

```
npm test -- --spec "cypress/e2e/contact-form.cy.js"
```

### Option 6 — Live Submission (weekly smoke test only)

```
npm run test:live
```

This runs the tests and submits **real forms** to the CRM. Use this sparingly — it creates actual leads in Zoho. Both environment variables must be set at the same time as a double safety gate against accidental use.

---

## Reading the Results

After a run (`npm test`, `npm run test:store …`, or a launcher), you'll see a summary like this:

```
  5 passing (12s)
  1 failing

  1) Contact Form > shows error when email is blank
     AssertionError: expected element to be visible
```

- **passing** — tests that worked correctly
- **failing** — tests that found a problem (the name tells you which form/page and what failed)
- **pending** — tests skipped on purpose because the store's config doesn't include that feature yet; the test title says `[skipped: not configured for <STORE>]`

If any tests fail, Cypress automatically saves a **screenshot** of the browser at the moment of failure. You can find these in the `cypress/screenshots/<store>/` folder.

Video recordings of each test run are saved to `cypress/videos/<store>/`.

**Easier:** the **Test Dashboard** (above) shows all of this without folder-digging — color-coded per-store cards, the failing test names, and the failure screenshot + video inline. It reads the same results files (`results/.run-summary/<store>.json` and `results/test-results.log`) that the runs produce.

### Skipped tests and how to enable them

Skips are always deliberate and always visible — a skipped test means a config key in `stores/<code>.json` is `null`/`false`, never that coverage silently vanished. Flip the key and the test runs on the next execution, no code changes.

**Skips that apply to every store:**

| What's pending | Why | Enable by |
|---|---|---|
| All 3 Lighthouse audits | The spec self-skips outside Chrome | Already runs — every command and launcher defaults to Chrome. Only pending if you override with `--browser firefox`. |
| The checkout flow tests (desktop, mobile, console) | **Currently on every store:** BigCommerce checkout spam protection (reCAPTCHA) was switched on fleet-wide on Oct 12 2026, and the payment step never loads for an automated browser. Reads `[skipped: checkout spam protection (reCAPTCHA) is on …]` (`checkout.spamProtection: true`). Re-checked Oct 15 2026: still on. Separately, a machine with no checkout sign-in credentials skips them too. | When the store's checkout reports `shouldExecuteSpamCheck: false` again, delete that store's `spamProtection` line (see `CLAUDE.md`, Checkout Flow). For credentials: copy `credentials.example.json` to `credentials.json` and fill it in, or set `CHECKOUT_EMAIL_<CODE>` / `CHECKOUT_PASSWORD_<CODE>`. All nine stores are configured (ADC's first unblocked run is still an onboarding run — read its `_notes`). |
| `checkout.cy.js`'s console-error check | Besides the spam-protection skip above: `checkout.consoleIgnore` is `null` on **BESTUS** (PayPal noise plus a bare `console.error(undefined)` that cannot be ignored safely) and **ADC** (never triaged — no run has reached payment). The other seven are `[]` (console-clean). | Triage the errors on that store, then set `checkout.consoleIgnore` to the list worth ignoring. |
| `checkout.cy.js`'s order-placement test | Skipped by design on every ordinary run — it places a **real order**. Reads `[skipped: order placement not armed — CLI only, …]` | Run `npm run test:checkout-order:store -- <store> --spec "cypress/e2e/checkout.cy.js"` on a store whose config sets `checkout.placeOrder`. Cancel the resulting order by hand; see `MAINTENANCE.md` §8b. |

**ADAP's skips (June 2026), as a worked example:**

| Skipped test(s) | Config key (`stores/adap.json`) | Why | Enable by |
|---|---|---|---|
| Pro Club form (all 7) | `forms.proClub: null` | ADAP has no Pro Club page | Filling `{ path, submitUrlPattern }` if the store ever adds one |
| Homepage partner logos | `branding.partnerLinks: null` | No partner logos in ADAP's footer | Listing the partner URLs |
| Quote form: First Name validation | `forms.quoteRequest.optionalFields: ["Name_First"]` | ADAP's Zoho form genuinely doesn't require First Name (its `zf_MandArray` omits it) | Removing the entry if the Zoho form config changes |
| PLP subcategory boxes (desktop + 4 mobile devices) | `plp.selectors.subcategoryBox: null` | ADAP's theme has no subcategory box grid | Setting the selector if the theme gains one |
| PDP related-products carousel (desktop + 4 mobile devices) | `pdp.selectors.relatedCarousel: null` | ADAP PDPs have no related-products carousel (no `#tab-related` in the page, re-checked Oct 15 2026) | Setting the selector if added |

(Detailed PLP pagination also runs since July 2026 — `plp.selectors.pagination` is filled for ADAP's AngularJS pagination markup. Two more former ADAP skips now run, both enabled Sept 29 2026 once they were found live: the **Architects form** at `/architects/` (Zoho `ADAPArchitects2`, with `cityField: "SingleLine1"` / `regionField: null` because its City is a plain text field and it has no region), and the **Product JSON-LD** test, since the theme now emits a complete Product block.)

**BESTCA's skips (June 2026):** BESTCA runs a newer SearchSpring "Snap" theme + CAD pricing, so a few BESTUS-specific selectors/values are now config-driven (defaults unchanged). Its only intentional skips:

| Skipped test(s) | Config key (`stores/bestca.json`) | Why | Enable by |
|---|---|---|---|
| PDP mobile breadcrumb trail (3 phones) | `pdp.mobileBreadcrumbsHidden: true` | BESTCA's theme hides the PDP breadcrumb (`nav.Breadcrumb { display:none }`) at phone widths; the flag applies to phones only, so the desktop and tablet breadcrumb tests still run | Removing the flag if the theme shows breadcrumbs on mobile |
| Quote form: First Name validation | `forms.quoteRequest.optionalFields: ["Name_First"]` | BESTCA's Zoho quote form doesn't require First Name client-side (submits with it empty) | Removing the entry if the Zoho form config changes |
| *(removed Oct 15 2026)* Mobile header touch-target — **Electron only** | `branding.skipMobileTouchTarget` (gone) | BESTCA's header was unmeasurable under Electron's `:visible`; the touch-target check now measures layout (Oct 14 2026) and BESTCA passed in Electron without the flag | Nothing — the test runs in every browser |
| PDP quantity stepper buttons (desktop + 4 mobile devices) | `pdp.selectors.qtyIncrement` / `qtyDecrement: null` | BESTCA's theme has a bare quantity input with no +/− buttons | Setting the selectors if the theme gains them |

(BESTCA's Pro Club country dropdown has run since it was added live in July 2026 (`hasCountry: true`). BESTCA's Product JSON-LD, sidebar + category-link health (single-block `.page-sidebar`, `sidebarBlocksMin:1`), subcategory boxes, best-sellers tree, pagination, price-sort, and the SearchSpring "Customers Also Viewed" related carousel (`pdp.selectors.relatedCarousel: ".ss__recommendation--carousel"`) all run — its grid uses `plp.selectors.productCard: "ul.ss__results li.product"`, its pagination the `.ss__pagination__*` selectors, and its JSON-LD currency check `branding.currency: "CAD"`.)

**ADC's skips (June 2026):** ADC runs the SearchSpring "Snap" theme + CAD like BESTCA, but a distinct "footer-new" theme and a **mixed catalog** — priced "Best Access Doors" brand products and quote-only (price-less, no-cart) products are interleaved in the same grid — so config points `plp`/`products`/`pdp`/`discovery` at `/best-access-doors/` priced products. Onboarding it needed several BESTUS-specific assumptions to become config-driven (defaults unchanged for other stores). Its intentional skips:

| Skipped test(s) | Config key (`stores/adc.json`) | Why | Enable by |
|---|---|---|---|
| Pro Club form (all 7) | `forms.proClub: null` | `/pro-club-application/` is a 404 on ADC | Filling `{ path, submitUrlPattern }` if added |
| Homepage partner logos | `branding.partnerLinks: null` | ADC's footer has no partner/affiliate logos | Listing the partner URLs if added |
| Quote form: First Name validation | `forms.quoteRequest.optionalFields: ["Name_First"]` | ADC's quote form uses a single Full Name field | Removing the entry if the Zoho form config changes |
| PLP category sidebar + link health (desktop + 4 mobile devices) | `plp.selectors.sidebar: null` | ADC has no `.categories-left` multi-block sidebar; its category tree (`#treeView`) is covered by the best-sellers test instead | Setting the selector if the theme gains one |
| PDP mobile breadcrumb trail (3 phones) | `pdp.mobileBreadcrumbsHidden: true` | ADC hides the PDP breadcrumb (`display:none`) at phone widths; the desktop and tablet breadcrumb tests still run | Removing the flag if shown on phones |
| PDP recently-viewed SearchSpring script | `pdp.recentlyViewedProfile: null` | ADC ships no SearchSpring recommendations script | Setting the profile string if added |

ADC-specific config that lets the rest run: `plp.selectors.heading: "h1.container-header"` (its PLP h1 differs), `plp.selectors.cardPrice: null` (skips the per-card price check because priced and quote-only cards interleave — PDP/JSON-LD price checks still cover priced products), `discovery.search.resultsHaveHeading: false` (its search-results page has no `<h1>`), `plp.selectors.subcategoryBox/subcategoryTitle/subcategoryLink` (its `.subcategory-item` tiles), `plp.selectors.pagination` (`?p=2`), `branding.footer` (the "footer-new" theme), and `pdp.selectors.relatedCarousel: "#tab-related .productCarousel"` (BigCommerce's stock "You May Also Like" carousel, enabled Sept 29 2026 — PDA uses the same selector), `branding.currency: "CAD"` (the footer-new theme has real accessibility deficiencies, so the live a11y score floors in the high-60s/low-70s — absorbed by the fleet-wide Lighthouse `accessibility:60` floor rather than a per-store override). The **Architects & Spec Writers** form (`forms.architectInquiries`, `/architects/`) runs for ADC, CAD (Zoho `CADArchitects`) and ADAP (Zoho `ADAPArchitects2`) — every other store has no testable architects form, so it shows as skipped there.

**Fleet-wide: call-for-pricing SKUs inside priced catalogs.** Large/freight-class equipment (roof hatches, smoke vents, quad doors) can be "call for pricing" — no price, cart, qty, or lead-time widget — even on stores that are otherwise fully priced (confirmed on ADC). `pdp.cy.js`/`pdp.mobile.cy.js`/`seo.cy.js` detect this at runtime per random pick (Add to Cart button absence) and skip the price/cart/qty/lead-time and JSON-LD price checks for that run, rather than failing — see "PDP pick attribution" in `CLAUDE.md`.

**Known ADAP failures that are site bugs, not test issues (June 2026):**

- `images.cy.js` — the homepage "Drywall" tile references `for-drywall-finall-des.jpg` (typo); the correctly named `for-drywall-final-des.jpg` exists. Fix the tile in the BigCommerce admin.
- *(Resolved Sept 29 2026)* The theme now emits Product JSON-LD, so that test runs.

**The other stores (AAP, FSE, BRH, CAD, PDA) — now fully onboarded (June 2026):** each runs the complete suite; their remaining skips are deliberate theme/catalog gates, and a few tests are intentionally **left failing** to flag real site bugs (see "Site deficiency policy" in `CLAUDE.md`). Per store:

- **AAP** (`acudoraccesspanels.com`) — SearchSpring "Snap" theme. The subcategory suite runs (the taxonomy is not flat — `plp.subcategory` is set), and since Oct 15 2026 so does the breadcrumb Home-link check (`breadcrumbHome: "a.breadcrumb-label"`). Skips: mobile breadcrumbs on phones (`pdp.mobileBreadcrumbsHidden`), qty steppers (none in theme), and the **mobile header touch-target test** (`branding.skipTouchTarget`) — its hamburger (23px) and logo (12px) sit below the 44px standard; devs were notified with a CSS fix and the team chose to keep the header as-is (July 22 2026), so the test is now skipped rather than left failing. That skip, like FSE's, is `branding.skipTouchTarget: true` and applies in every browser.
- **FSE** (`firesafetyequipment.com`) — Snap theme, homepage at `/new-home/`. Skips: mobile breadcrumbs on phones, related carousel, recently-viewed, and the **mobile header touch-target test** (`branding.skipTouchTarget`) — its logo link is 42.98px, 1px under 44px; devs notified and the team chose to keep it as-is (July 22 2026). **No intentionally failing tests.** Both earlier failures were fixed site-side: the missing `/new-home/` meta description (verified Sept 28 2026) and the missing `alt` on `grid-box-icon-1.jpg` (verified Sept 29 2026).
- **BRH** (`bestroofhatches.com`) — standard BC theme, native search/sort, entirely quote-only catalog. Skips: no-results search (native search always returns results), prices/Add-to-Cart/qty/lead-time (`pdp.quoteOnly`), subcategory tiles (the subcategory-page suite itself runs against `/aluminum/babcock-davis/` since Sept 29 2026 — the taxonomy isn't flat after all), footer payment icons (theme has none), Pro Club / Become Vendor / Architects forms. **Intentionally failing:** BRH PDPs emit no Product JSON-LD block at all (only Organization JSON-LD; the product is described in microdata — re-checked Oct 15 2026) → Product JSON-LD test (`seo.cy.js`); the theme must emit BigCommerce's stock Product JSON-LD, with model-number SKUs on the products. (The homepage Lighthouse performance failure recorded in July 2026, score 42, is resolved — 56 on Oct 15 2026.) Also, 2 of 15 `pdp.popular` products have no spec-sheet PDF, so the `pdp.cy.js` "spec sheet links open PDFs" test fails ~13% of runs when the random PDP pick lands on one (same class as CAD, verified July 28 2026); BRH admin must upload the manufacturer spec sheets.
- **CAD** (`californiaaccessdoors.com`) — standard BC theme, native search/sort, priced catalog. Skips: no-results search, category sidebar (`sidebar: null`), Pro Club, Become Vendor. Runs the Architects form. **Intentionally failing (CAD admin notified July 22 2026):** 10 of 20 `pdp.popular` products have no spec-sheet PDF (11 until one was fixed; re-counted Sept 29 2026), so the `pdp.cy.js` "spec sheet links open PDFs" test (requires ≥1 PDF per PDP) fails whenever the random PDP pick lands on one (~50% of runs). Verified real — the same products carry the PDF on ADC; CAD admin must upload the manufacturer spec sheets.
- **PDA** (`puertasdeacceso.com.mx`) — Spanish/MX storefront, standard BC theme, currency MXN. Skips: subcategory boxes, product-info form (none on PDPs), footer phone links (none), Pro Club / Architects forms. **No intentionally failing tests.** The earlier site-side failures have all been resolved: placeholder catalog and Product JSON-LD `offers` (Sept 17 2026), and missing meta descriptions on the PLP and homepage (Sept 2026, homepage verified Sept 29 2026).

Every store's `stores/<code>.json` documents its specifics in a `_notes` key; the per-store theme drift is detailed in `CLAUDE.md`.

---

## Project Structure

```
├── Test Dashboard.bat             Double-click: opens the friendly browser dashboard
├── First Time Setup.bat           Double-click once: installs everything (non-technical users)
├── Run All Tests.bat              Double-click: tests every store in Chrome
├── Run One Store.bat              Double-click: pick one store from a menu
├── READ ME FIRST.txt              Plain-language quick start for the launchers above
├── MAINTENANCE.md                 For maintainers: Node/Cypress versions, checkout accounts, onboarding
├── credentials.example.json       Template for the gitignored credentials.json (checkout sign-in)
│
├── cypress.config.js              Configuration: loads the selected store's JSON, timeouts, etc.
│
├── stores/                        One JSON file per store — URLs, form paths, brand text
│   ├── bestus.json                Fully configured (the reference example)
│   └── bestca.json … pda.json     All nine stores fully configured
│
├── results/                       Run output (gitignored): test-results.log + .run-summary/*.json
│
├── scripts/
│   ├── run-store.js               Runs the suite for one store (npm run test:store <code>)
│   ├── run-all.js                 Runs every store sequentially with a summary table
│   ├── writeRunLog.js             after:run hook — writes the log + per-store JSON sidecars
│   ├── ensure-node.bat            Node.js bootstrap every launcher calls (pinned version, SHA256-checked)
│   ├── nodeGate.js                Warns when a terminal run uses an unverified Node version
│   ├── armingEnv.js               Strips live-lead / real-order switches from a child process env
│   ├── lighthouseAudit.js         Runs Lighthouse for cy.lighthouse() (Node side)
│   ├── resolveCheckoutCredentials.js  Finds the active store's checkout sign-in (env / credentials.json)
│   ├── siteBlocked.js             Explains a Cloudflare/403 "site blocked" run instead of a wall of red
│   └── dashboard/                 Local browser dashboard (npm run dashboard / Test Dashboard.bat)
│       ├── server.js              Node http server: serves the UI, spawns the runners, streams results
│       ├── storeNames.js          Friendly store display names
│       └── public/                index.html + app.js + styles.css (light/dark, brand palette)
│
├── cypress/
│   ├── e2e/                       The actual tests (shared by all stores)
│   │   ├── homepage.cy.js         Checks the homepage header and footer
│   │   ├── homepage.mobile.cy.js  Checks the homepage on phones and tablets
│   │   ├── plp.cy.js              Checks the product listing page
│   │   ├── plp.mobile.cy.js       Checks the product listing page on phones and tablets
│   │   ├── pdp.cy.js              Checks the product detail page
│   │   ├── pdp.mobile.cy.js       Checks the product detail page on phones and tablets
│   │   ├── discovery.cy.js        Checks search, categories, sorting, and pagination
│   │   ├── discovery.mobile.cy.js Checks discovery pages on phones and tablets
│   │   ├── seo.cy.js              Checks titles, meta descriptions, and product JSON-LD
│   │   ├── images.cy.js           Checks image alt text and broken images
│   │   ├── checkout.cy.js         Signs in and drives cart → checkout → payment step (never orders by default)
│   │   ├── lighthouse.cy.js       Performance/accessibility/SEO scores (Chrome only)
│   │   ├── product-form.cy.js     Tests the Product Information form
│   │   ├── contact-form.cy.js     Tests the Contact Us form
│   │   ├── quote-form.cy.js       Tests the Request a Quote form
│   │   ├── pro-club-form.cy.js    Tests the Pro Club Application form
│   │   ├── become-vendor-form.cy.js  Tests the Become a Vendor form (ADAP only)
│   │   └── architect-form.cy.js   Tests the Architects & Spec Writers form (ADC, CAD, ADAP)
│   │
│   ├── fixtures/                  Test data
│   │   ├── personas.json          Fake customer profiles used during testing
│   │   └── files/                 Sample files used to test file upload
│   │
│   └── support/                   Shared helper code (reused across tests)
│       ├── pages/                 Page Objects — one per form, handles form interactions
│       ├── utils/                 Utility functions (email generation, URL picking, etc.)
│       ├── store.js               Reads the active store's config; per-store skip helpers
│       ├── checks.js              Shared page assertions (search, grids, footers, etc.)
│       ├── commands.js            Custom test shortcuts
│       ├── lighthouse.js          The cy.lighthouse() command
│       └── e2e.js                 Global setup (runs before every test)
```

---

## Glossary

**End-to-end test** — A test that simulates a real user interacting with the actual website, from start to finish (as opposed to testing individual pieces of code in isolation).

**Headless** — Running a browser without a visible window. The tests work exactly the same but faster, since nothing needs to be drawn on screen.

**Fixture** — A file containing test data (like a fake customer's name and email) that tests use as input.

**Stub** — A fake response. When tests run in stub mode, form submissions are intercepted before reaching Zoho and replaced with a fake "success" response. This means no real data is sent anywhere.

**Page Object** — A reusable piece of code that knows how to interact with a specific form (find the fields, fill them in, click submit). Test files use these instead of repeating the same steps.

**CRM** — Customer Relationship Management system. Best Access Doors uses Zoho CRM to receive and manage form submissions from the website.

---

## Questions or Problems?

If a test fails unexpectedly or you're unsure what a result means, check the screenshot in `cypress/screenshots/` first — it usually shows exactly what the browser looked like when things went wrong.
