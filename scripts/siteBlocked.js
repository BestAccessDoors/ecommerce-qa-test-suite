/**
 * Recognise a run that was blocked by the store's bot protection, and explain it in plain words.
 *
 * WHY THIS EXISTS: since Oct 12 2026 ADAP sits behind a Cloudflare challenge that only lets this
 * suite through because of an IP allow rule (see stores/adap.json _notes). When the test machine's
 * IP changes, or a run happens from another network, every spec dies on its first cy.visit with
 * "403: Forbidden", and the result looks like 60+ broken tests rather than one blocked door. The
 * operator needs to be told that directly, in every place they might look: the run log, the
 * terminal / dashboard log pane, the run-all summary, the dashboard card, and the scheduled cloud
 * run's page (scripts/ciReport.js, which also checks whether the 403 is a Cloudflare challenge).
 *
 * Detection is on Cypress's own cy.visit failure wording plus the 403 status line, read from each
 * failed test's displayError in the after:run results. A 403 on a page load is what a bot
 * challenge looks like to cy.visit; a genuinely missing page is a 404 and is not matched.
 */

// Cypress writes the command name in backticks: "`cy.visit()` failed trying to load:".
const VISIT_FAILED = /cy\.visit\(\)`? failed trying to load/;
const FORBIDDEN = /403: Forbidden/;

/**
 * @param {Array} runs  results.runs from the Cypress after:run event
 * @returns {{ count: number }|null}  how many failed tests were a 403 page load, or null for none
 */
function detectSiteBlock(runs) {
  let count = 0;
  for (const run of runs || []) {
    for (const t of run.tests || []) {
      const msg = typeof t.displayError === 'string' ? t.displayError : '';
      if (t.state === 'failed' && VISIT_FAILED.test(msg) && FORBIDDEN.test(msg)) count++;
    }
  }
  return count ? { count } : null;
}

/** Plain-text explanation, one line per array entry. Written for a non-technical operator. */
function siteBlockedLines(store, count) {
  const head = [
    `SITE BLOCKED: ${count} test(s) on "${store}" failed because the website refused this computer`,
    `(403 Forbidden on page load). This is almost always the store's bot protection (Cloudflare)`,
    `blocking this computer's IP address, NOT a broken test or a broken site.`,
  ];
  // On a GitHub-hosted runner the steps below would be wrong advice: its IP changes every run and is
  // shared with everyone else on GitHub, so there is nothing to allowlist. The store stays in the
  // scheduled cloud run on purpose, so it is picked up the day its protection lets cloud machines in.
  if (process.env.GITHUB_ACTIONS === 'true') {
    return [
      ...head,
      `This run used one of GitHub's cloud machines. Their IP addresses change every run and are`,
      `shared with every GitHub user, so they cannot (and must not) be added to an allow rule.`,
      `The store stays in the cloud run on purpose: once its Cloudflare protection lets cloud`,
      `machines through, the full suite runs here with no change. Until then, its real results come`,
      `from the QA machine. Details: the "_notes" in stores/${store}.json.`,
    ];
  }
  return [
    ...head,
    `What to do:`,
    `  1. On this computer, run:  curl.exe -s https://www.cloudflare.com/cdn-cgi/trace | findstr ip=`,
    `  2. Send the ip= value to whoever manages the store's Cloudflare, and ask them to update the`,
    `     IP Access Rule (Allow) for it. Details: the "_notes" in stores/${store}.json.`,
    `  3. Re-run the store once the rule is updated.`,
  ];
}

module.exports = { detectSiteBlock, siteBlockedLines };
