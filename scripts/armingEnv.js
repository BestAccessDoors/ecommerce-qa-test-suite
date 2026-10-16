/**
 * Strip every environment variable that could arm a run to touch the real world (file a real
 * Zoho lead, or place a real BigCommerce order) from a child-process env.
 *
 * Why a regex and not four `delete`s: on Windows, process.env lookups are case-INsensitive, but
 * `{ ...process.env }` copies keys in their real case into a plain, case-SENSITIVE object. So
 * `delete env.PLACE_ORDER` leaves a `place_order` set by `setx place_order true` in place, and
 * the child's `process.env.PLACE_ORDER` still reads it. The CYPRESS_-prefixed spellings are
 * stripped too, as defence in depth: cypress.config.js re-asserts all four flags from the parent
 * process env in setupNodeEvents, so those can no longer arm a run on their own.
 *
 * Deliberately NOT stripped: CHECKOUT_* (the checkout spec is meant to run from the dashboard —
 * see server.js's header) and every other CYPRESS_* var (CYPRESS_CACHE_FOLDER is set by
 * scripts/ensure-node.bat and Cypress needs it to find its binary).
 */
const ARMING_VAR_RE =
  /^(cypress_)?(live_submit|i_know_this_is_live|place_order|i_know_this_places_orders)$/i;

function stripArmingEnv(env) {
  const out = { ...env };
  for (const key of Object.keys(out)) {
    if (ARMING_VAR_RE.test(key)) delete out[key];
  }
  return out;
}

module.exports = { stripArmingEnv, ARMING_VAR_RE };
