/**
 * Node-side half of cy.lighthouse() — replaces the @cypress-audit/lighthouse plugin.
 *
 * Why in-repo: @cypress-audit/lighthouse 1.4.2 (its latest release) calls Lighthouse's
 * `legacyNavigation`, which Lighthouse 12 removed, so it pins the suite to Lighthouse 10 — and
 * Lighthouse 10's puppeteer-core / tar-fs / ws / proxy-agent tree carries a dozen high-severity
 * advisories (Oct 2026 audit). The plugin's whole job is ~60 lines: remember Cypress's Chrome
 * debugging port, point Lighthouse at it, and compare category scores with thresholds. This file
 * keeps that contract (same task name, same {errors, results} shape, same threshold semantics)
 * on Lighthouse 13's navigation API.
 *
 *   setupNodeEvents:  on('before:browser:launch', (b, o) => { prepareAudit(o); … })
 *                     on('task', { lighthouse: lighthouseTask() })
 *   spec:             cy.lighthouse(thresholds, opts)   (cypress/support/lighthouse.js)
 */

let debuggingPort = null;

// Lighthouse 13's categories (PWA was removed in 12).
const CATEGORY_IDS = ['performance', 'accessibility', 'best-practices', 'seo'];

/** Remember the --remote-debugging-port Cypress gives Chrome, so Lighthouse can attach to it. */
function prepareAudit(launchOptions) {
  const arg = launchOptions.args.find((a) => a.startsWith('--remote-debugging-port'));
  if (arg) debuggingPort = Number(arg.split('=')[1]);
}

/**
 * Category scores are compared as "score must be >= threshold" (0-100). Any other key is
 * treated as an audit id whose numericValue (usually ms) must be <= threshold — the plugin's
 * semantics, kept so existing threshold objects mean exactly what they did.
 */
function compareWithThresholds(lhr, thresholds) {
  const errors = [];
  const results = [];
  for (const [key, threshold] of Object.entries(thresholds)) {
    const category = lhr.categories[key];
    const audit = lhr.audits[key];
    if (category) {
      // score is null when Lighthouse could not compute the category (e.g. a runtime error) —
      // that must fail, never pass as "0 >= threshold is false" by accident of coercion.
      const score = category.score === null ? null : Math.round(category.score * 100);
      if (score === null || score < threshold) {
        errors.push(`${key} record is ${score} and is under the ${threshold} threshold`);
      } else {
        results.push(`${key} record is ${score} and threshold was ${threshold}`);
      }
    } else if (audit && typeof audit.numericValue === 'number') {
      if (audit.numericValue > threshold) {
        errors.push(`${key} record is ${audit.numericValue} and is over the ${threshold} threshold`);
      } else {
        results.push(`${key} record is ${audit.numericValue} and threshold was ${threshold}`);
      }
    } else {
      errors.push(`${key} is not a Lighthouse category or numeric audit in this report`);
    }
  }
  return { errors, results };
}

function lighthouseTask() {
  return async ({ url, thresholds, opts = {} }) => {
    if (!debuggingPort) {
      throw new Error(
        'cy.lighthouse: Chrome\'s remote debugging port is unknown — prepareAudit() must run in ' +
        'before:browser:launch, and the run must use a Chromium browser (--browser chrome).'
      );
    }
    // Lighthouse 13 is ESM; its .cjs entry is a thin async wrapper around the default export.
    const lighthouse = require('lighthouse/core/index.cjs');
    // Audit only the categories being gated (much faster), but Lighthouse 13 rejects any
    // non-category id in onlyCategories, so an audit-level threshold such as
    // 'largest-contentful-paint' instead pulls in the category that runs it — or, if unknown,
    // lifts the restriction altogether.
    const keys = Object.keys(thresholds);
    const categories = keys.filter((k) => CATEGORY_IDS.includes(k));
    const auditKeys = keys.filter((k) => !CATEGORY_IDS.includes(k));
    const onlyCategories = opts.onlyCategories ||
      (auditKeys.length ? undefined : categories);
    const flags = {
      ...opts,
      port: debuggingPort,
      onlyCategories,
      // Keep Cypress's cookies/storage: the plugin defaulted to this, and clearing storage
      // mid-run would sign the browser out of anything the spec set up.
      disableStorageReset: opts.disableStorageReset === undefined ? true : opts.disableStorageReset,
      logLevel: opts.logLevel || 'error',
    };
    const runnerResult = await lighthouse(url, flags);
    if (!runnerResult || !runnerResult.lhr) {
      throw new Error('cy.lighthouse: Lighthouse returned no report for ' + url);
    }
    if (runnerResult.lhr.runtimeError) {
      const { code, message } = runnerResult.lhr.runtimeError;
      throw new Error(`cy.lighthouse: Lighthouse runtime error ${code}: ${message}`);
    }
    return compareWithThresholds(runnerResult.lhr, thresholds);
  };
}

module.exports = { prepareAudit, lighthouseTask, compareWithThresholds };
