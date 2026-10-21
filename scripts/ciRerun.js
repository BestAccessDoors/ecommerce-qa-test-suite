#!/usr/bin/env node
/**
 * Scheduled cloud run only: give the specs that failed ONE more attempt, and fold the result back
 * into the store's sidecar.
 *
 *   node scripts/ciRerun.js adc
 *
 * WHY: on GitHub's runners Chrome intermittently resets its CONNECT tunnels to Cypress's proxy
 * (cypress:https-proxy logs "received error on client browserSocket: read ECONNRESET"; diagnosed
 * Oct 21 2026 over four diagnostic runs). Every request in flight on a reset tunnel fails, which
 * surfaces as "Failed to fetch" console errors, a missing SearchSpring carousel or Yotpo widget, or
 * a page that never fires `load`. One reset of the api-cdn.yotpo.com tunnel kills all 13 of ADC's
 * homepage rating calls at once. It hit ~1 Windows job in 3 (fewer on Linux, never zero) and never
 * reproduced on the QA machine. Cypress's own `retries` cannot absorb it: most of these specs
 * load the page once in before(), and a retry re-runs the `it` against that same broken load.
 * A fresh process re-runs the whole spec file, including before().
 *
 * A failure that repeats is reported as usual, so a real site defect still turns the job red and
 * reaches the status issue. A test that passes on the second attempt is listed under
 * `rerun.recovered` in the sidecar, which scripts/ciReport.js shows on the run page; it is not in
 * failedSpecs, so scripts/ciNotify.js never sees it.
 *
 * Runs only when the run-store.js step failed. Exits 0 when nothing is left failing (this also
 * covers a run whose tests all passed but whose Cypress process then exited 1, as PDA's did on
 * Oct 20 2026 with "Failed to gracefully exit after 5000ms"), 1 otherwise. No re-run for a
 * blocked store (a 403 wall does not go away in two minutes) or a missing sidecar (nothing says
 * which specs to re-run).
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { SUMMARY_DIR } = require('./writeRunLog');

const ROOT = path.join(__dirname, '..');
const CI_DIR = path.join(ROOT, 'results', 'ci');

const testKey = (spec, title) => `${String(spec).replace(/\\/g, '/')} › ${title}`;

/**
 * Fold the second attempt into the first. All of attempt 1's failures live in the re-run specs,
 * and every other spec passed, so the second attempt's failedSpecs ARE the final failures.
 * Totals are adjusted rather than recomputed: the sidecar keeps no per-spec pass counts, and a
 * random PDP pick can shift pending counts slightly between attempts.
 */
function mergeAttempts(first, second) {
  const firstFailed = first.failedSpecs.flatMap((s) => s.tests.map((t) => testKey(s.spec, t)));
  const stillFailed = new Set(second.failedSpecs.flatMap((s) => s.tests.map((t) => testKey(s.spec, t))));
  const totalFailed = second.totals.totalFailed;
  return {
    ...first,
    outcome: totalFailed === 0 ? 'PASS' : 'FAIL',
    totals: {
      ...first.totals,
      totalFailed,
      totalPassed: first.totals.totalPassed + (first.totals.totalFailed - totalFailed),
    },
    siteBlocked: second.siteBlocked,
    failedSpecs: second.failedSpecs,
    rerun: {
      specs: first.failedSpecs.map((s) => s.spec),
      recovered: firstFailed.filter((k) => !stillFailed.has(k)),
      durationMs: second.durationMs,
    },
  };
}

function readSidecar(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function main() {
  const store = String(process.argv[2] || '').toLowerCase();
  if (!/^[a-z0-9-]+$/.test(store) || !fs.existsSync(path.join(ROOT, 'stores', `${store}.json`))) {
    console.error('Usage: node scripts/ciRerun.js <store>');
    return 1;
  }
  const sidecarFile = path.join(SUMMARY_DIR, `${store}.json`);
  const first = readSidecar(sidecarFile);

  if (!first) {
    console.log(`[ciRerun] ${store}: no results file; Cypress stopped before writing it. Not re-running.`);
    return 1;
  }
  if (first.totals.totalFailed === 0) {
    console.log(`[ciRerun] ${store}: every test passed; the failing exit code came from Cypress itself. Nothing to re-run.`);
    return 0;
  }
  if (first.siteBlocked) {
    console.log(`[ciRerun] ${store}: the site blocked this machine (403). Not re-running.`);
    return 1;
  }

  const specs = first.failedSpecs.map((s) => String(s.spec).replace(/\\/g, '/'));
  fs.mkdirSync(CI_DIR, { recursive: true });
  fs.writeFileSync(path.join(CI_DIR, `${store}.attempt1.json`), JSON.stringify(first, null, 2));
  // Removed so that a missing file afterwards can only mean the re-run crashed before after:run.
  fs.rmSync(sidecarFile);
  console.log(`[ciRerun] ${store}: ${first.totals.totalFailed} failed; re-running ${specs.length} spec file(s): ${specs.join(', ')}`);

  spawnSync(process.execPath, [path.join(__dirname, 'run-store.js'), store, '--spec', specs.join(',')], {
    stdio: 'inherit',
    env: process.env,
  });

  const second = readSidecar(sidecarFile);
  if (!second) {
    fs.writeFileSync(sidecarFile, JSON.stringify(first, null, 2));
    console.log(`[ciRerun] ${store}: the re-run wrote no results; keeping the first attempt.`);
    return 1;
  }
  const merged = mergeAttempts(first, second);
  fs.writeFileSync(sidecarFile, JSON.stringify(merged, null, 2));
  console.log(
    `[ciRerun] ${store}: ${merged.rerun.recovered.length} passed on re-run, ` +
    `${merged.totals.totalFailed} still failing.`
  );
  return merged.totals.totalFailed === 0 ? 0 : 1;
}

if (require.main === module) process.exit(main());

module.exports = { mergeAttempts };
