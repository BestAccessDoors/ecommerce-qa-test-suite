// Browser-side half of cy.lighthouse() — see scripts/lighthouseAudit.js for why this replaced
// the @cypress-audit/lighthouse plugin. Same call shape the plugin had:
//
//   cy.lighthouse(thresholds, opts)
//
// Audits the page the spec is currently on (cy.url()) and fails the test listing every
// threshold that was crossed. Chromium only; lighthouse.cy.js already skips other browsers.

Cypress.Commands.add('lighthouse', (thresholds, opts = {}) => {
  if (!thresholds || !Object.keys(thresholds).length) {
    throw new Error('cy.lighthouse: pass a thresholds object, e.g. { performance: 50 }');
  }
  return cy.url().then((url) =>
    // Lighthouse loads the page itself and can take well over the default task timeout.
    cy.task('lighthouse', { url, thresholds, opts }, { timeout: 180000 }).then(({ errors, results }) => {
      results.forEach((r) => cy.log(r));
      // Thrown from a chained .then so the passing lines above are logged before the failure.
      return cy.wrap(errors, { log: false }).then((errs) => {
        if (!errs.length) return;
        const label = errs.length === 1 ? 'A threshold has been crossed' : 'Some thresholds have been crossed';
        throw new Error(`cy.lighthouse - ${label}.\n\n${errs.join('\n')}`);
      });
    })
  );
});
