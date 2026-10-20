#!/usr/bin/env node
/**
 * Report one store's result on the GitHub Actions run page (the scheduled cloud run).
 *
 *   node scripts/ciReport.js adap
 *
 * Runs as its own step after scripts/run-store.js, in .github/workflows/scheduled-tests.yml. It
 * reads the sidecar the after:run hook wrote (results/.run-summary/<store>.json) and produces:
 *   - a section in the run's Summary page ($GITHUB_STEP_SUMMARY; stdout when run locally),
 *     which GitHub stacks for all stores on one page;
 *   - one `::error` annotation per store that failed, shown at the top of the run page;
 *   - results/ci/<store>.json — the block verdict below, read by scripts/ciNotify.js. It lives
 *     outside .run-summary/ so the dashboard, which reads that folder, never sees it.
 *
 * WHY THE CLOUDFLARE PROBE: a blocked store (ADAP today — see stores/adap.json _notes) fails every
 * spec on its first cy.visit with a 403, and scripts/siteBlocked.js can only say "almost always
 * Cloudflare". GitHub's runners are never on ADAP's allowlist, so the operator wants the run page
 * to say plainly that THIS is why. Cloudflare marks its challenge responses with a
 * `cf-mitigated: challenge` header, so one plain request from the same runner (same IP) settles it.
 * The store is kept in the cloud run on purpose, so the day its protection lets cloud machines
 * through it starts running the full suite with no change here.
 *
 * CONTRACT (same as writeRunLog.js): never throws and never changes the exit code. The run-store.js
 * step has already set the job's red or green; this step only explains it.
 */
const fs = require('fs');
const path = require('path');
const { SUMMARY_DIR } = require('./writeRunLog');

const ROOT = path.join(__dirname, '..');
const CI_DIR = path.join(ROOT, 'results', 'ci');
const PROBE_TIMEOUT_MS = 15000;
// Matches the Windows-Chrome user agent cypress.config.js spoofs, so the probe looks like the test
// browser as far as a header can.
const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

const BLOCK_TEXT = {
  cloudflare: {
    title: 'blocked by Cloudflare',
    lines: [
      "Blocked by Cloudflare (confirmed): the site answered GitHub's cloud machine with a Cloudflare",
      "challenge, because that machine is not on the store's IP allowlist. No tests could run.",
      'This store stays in the cloud run on purpose: once its Cloudflare protection lets cloud',
      'machines through, the full suite runs here with no change.',
    ],
  },
  'bot-fight': {
    title: 'blocked (likely Cloudflare Bot Fight Mode)',
    lines: [
      'Blocked in the browser only: a plain request from this machine got through, but every page',
      'the test browser opened returned 403 Forbidden. That pattern is most likely Cloudflare Bot',
      'Fight Mode, which an IP allow rule cannot exempt. No tests could run.',
    ],
  },
  other: {
    title: 'blocked (403 from the site)',
    lines: [
      'Blocked: every page load returned 403 Forbidden, but the response was not identified as a',
      'Cloudflare challenge. Check whether the store has added new bot protection. No tests could run.',
    ],
  },
};

/** "cypress\e2e\seo.cy.js" (Windows) or "cypress/e2e/seo.cy.js" -> "seo.cy.js" */
function shortSpec(spec) {
  return String(spec).replace(/\\/g, '/').replace(/^cypress\/e2e\//, '');
}

// Workflow-command escaping: https://docs.github.com/actions/reference/workflow-commands
function escapeData(s) {
  return String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}
function escapeProperty(s) {
  return escapeData(s).replace(/:/g, '%3A').replace(/,/g, '%2C');
}
function annotate(title, message) {
  console.log(`::error title=${escapeProperty(title)}::${escapeData(message)}`);
}

function loadSidecar(store) {
  try {
    return JSON.parse(fs.readFileSync(path.join(SUMMARY_DIR, `${store}.json`), 'utf8'));
  } catch {
    return null; // Cypress stopped before after:run, or logging failed
  }
}

/** The homepage URL exactly as the specs visit it (store.js homePath() + storePath()). */
function homeUrl(store) {
  const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'stores', `${store}.json`), 'utf8'));
  const p = site.homePath || '/';
  const withQuery = site.visitQuery ? p + (p.includes('?') ? '&' : '?') + site.visitQuery : p;
  return site.baseUrl.replace(/\/$/, '') + withQuery;
}

/** @returns {Promise<'cloudflare'|'bot-fight'|'other'>} */
async function probeBlock(store) {
  try {
    const res = await fetch(homeUrl(store), {
      // An explicit text/html Accept: these storefronts answer 406 to a wildcard Accept.
      headers: { 'user-agent': CHROME_UA, accept: 'text/html,application/xhtml+xml' },
      redirect: 'manual',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (res.headers.get('cf-mitigated') === 'challenge') return 'cloudflare';
    const viaCloudflare = res.headers.has('cf-ray') || /cloudflare/i.test(res.headers.get('server') || '');
    if (viaCloudflare && res.status < 400) return 'bot-fight';
    return 'other';
  } catch {
    return 'other'; // timeout or network error: say what we know, nothing more
  }
}

function writeVerdict(store, blocked) {
  try {
    fs.mkdirSync(CI_DIR, { recursive: true });
    fs.writeFileSync(path.join(CI_DIR, `${store}.json`), JSON.stringify({ store, blocked }, null, 2), 'utf8');
  } catch (err) {
    console.error(`ciReport: failed to write results/ci/${store}.json — ${err.message}`);
  }
}

function writeSummary(markdown) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) {
    console.log(markdown); // local run: just show it
    return;
  }
  try {
    fs.appendFileSync(file, markdown + '\n', 'utf8');
  } catch (err) {
    console.error(`ciReport: failed to write the step summary — ${err.message}`);
  }
}

async function main() {
  const store = String(process.argv[2] || '').toLowerCase();
  if (!/^[a-z0-9-]+$/.test(store) || !fs.existsSync(path.join(ROOT, 'stores', `${store}.json`))) {
    console.error('Usage: node scripts/ciReport.js <store>');
    return;
  }
  const CODE = store.toUpperCase();
  const s = loadSidecar(store);

  if (!s) {
    writeVerdict(store, null);
    writeSummary(
      `### ✘ ${CODE}: no results\n\n` +
      'Cypress stopped before it could write its results. See the "Run tests" step log for why.\n'
    );
    annotate(`${CODE}: no results`, 'Cypress stopped before it could write its results. See the "Run tests" step log.');
    return;
  }

  const { totalFailed, totalTests } = s.totals;
  const head = `${totalFailed} failed of ${totalTests} (${s.duration})`;

  if (s.siteBlocked) {
    const verdict = await probeBlock(store);
    writeVerdict(store, verdict);
    const text = BLOCK_TEXT[verdict];
    // Failures beyond the 403s would be real ones; say so rather than letting the block hide them.
    const extra = totalFailed > s.siteBlocked.count
      ? `\n\n${totalFailed - s.siteBlocked.count} other failure(s) were not page-load 403s; see the step log.`
      : '';
    writeSummary(`### ✘ ${CODE}: ${text.title}\n\n${head}. ${text.lines.join(' ')}${extra}\n`);
    annotate(`${CODE}: ${text.title}`, text.lines.join(' '));
    return;
  }

  writeVerdict(store, null);
  if (totalFailed === 0) {
    writeSummary(`### ✔ ${CODE}: ${head}\n`);
    return;
  }

  const lines = [`### ✘ ${CODE}: ${head}`, ''];
  const names = [];
  for (const spec of s.failedSpecs) {
    lines.push(`- **${shortSpec(spec.spec)}** (${spec.failures})`);
    for (const t of spec.tests) {
      lines.push(`  - ${t.replace(/</g, '&lt;')}`); // keep "<lite-youtube>" visible, not an HTML tag
      names.push(`${shortSpec(spec.spec)} › ${t}`);
    }
  }
  writeSummary(lines.join('\n') + '\n');
  annotate(`${CODE}: ${totalFailed} test(s) failed`, names.join('\n'));
}

main().catch((err) => {
  console.error(`ciReport: ${err.message}`);
});
