/**
 * The double gate for real submissions. Both env vars must be true — see CLAUDE.md.
 * Exported so the per-spec intercept (commands.js) and the stub-mode catch-all (e2e.js)
 * can never drift apart on what counts as "live".
 * @returns {boolean}
 */
export function isLiveSubmit() {
  return Cypress.env('LIVE_SUBMIT') === true && Cypress.env('I_KNOW_THIS_IS_LIVE') === true;
}

/**
 * Intercepts a Zoho form POST.
 * Default (stub) mode: returns a fake 200 with a thank-you body so no real lead is created.
 * Live mode: passes the request through when liveSubmit is true.
 * @param {string} alias
 * @param {string} urlPattern — glob matching the Zoho submit endpoint
 * @param {boolean} liveSubmit — pass Cypress.env('LIVE_SUBMIT') && Cypress.env('I_KNOW_THIS_IS_LIVE')
 */
export function setupZohoIntercept(alias, urlPattern, liveSubmit) {
  if (liveSubmit) {
    cy.intercept('POST', urlPattern).as(alias);
  } else {
    cy.intercept('POST', urlPattern, {
      statusCode: 200,
      body: '<html><body>Thank you for contacting us. We have received your message.</body></html>',
      headers: { 'content-type': 'text/html' }
    }).as(alias);
  }
}

/**
 * Detects Zoho's server-side rejection page in a submit response body. Returns the page's
 * text after the "Error Occurred!" heading (e.g. "Phone Select a country code."), or null
 * if the body is not a rejection.
 *
 * Why this exists: the browser-side zf_ValidateAndSubmit() runs against the page's embedded
 * copy of the form, and Zoho re-validates against the form's CURRENT builder config. When the
 * two drift (BESTUS Pro Club, Oct 2026: the builder started requiring a phone country code the
 * embed has no input for), the POST goes out normally and Zoho answers with this page instead
 * of the redirect, as a 2xx. A status-code check alone calls that a success. The stub body never
 * contains the marker, so this only ever fires in live mode, where Zoho really answered.
 * @param {*} body — interception.response.body
 * @returns {string|null}
 */
export function zohoRejection(body) {
  if (typeof body !== 'string') return null;
  const text = body
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
  const i = text.search(/Error Occurred/i);
  if (i === -1) return null;
  return text.slice(i).replace(/^Error Occurred!?\s*/i, '').replace(/\s*Back\b[\s\S]*$/, '').trim().slice(0, 200);
}
