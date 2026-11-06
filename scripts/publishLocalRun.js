#!/usr/bin/env node
/**
 * Scheduled LOCAL run: run every store on this machine, then publish a small summary of the
 * results to the `local-runs` branch on GitHub, where the weekday morning Claude review reads it
 * into the "BEST QA Test Suite Runs" dashboard next to the GitHub Actions (cloud) runs.
 *
 *   node scripts/publishLocalRun.js --run [run-all.js args]   run, then publish (what the
 *                                                             scheduled task does)
 *   node scripts/publishLocalRun.js --run --dry-run           run, write the summary, don't upload
 *   node scripts/publishLocalRun.js                           only retry pending uploads
 *
 * WHY LOCAL RUNS MATTER: this machine is on ADAP's Cloudflare allowlist (every cloud run is
 * blocked there), and it never sees the GitHub-runner connection resets behind the cloud-only
 * "Failed to fetch" flakes. A failure seen here AND in the cloud is real.
 *
 * WHAT IS PUBLISHED, AND WHY SO LITTLE: the repo is public, so the summary is built from an
 * explicit allowlist of fields — store, PASS/FAIL, test counts, whether the site blocked the run,
 * and the names of failing spec files and tests. Never error text, logs, screenshots, videos, the
 * machine's name or IP, or anything from credentials.json. Test titles are already public in the
 * repo's own spec files.
 *
 * TOKEN: a fine-grained GitHub token for this one repo with Contents: read and write. Read from
 * the GITHUB_LOCAL_RUNS_TOKEN env var, else %LOCALAPPDATA%\BestAccessDoorsTests\github-token.txt
 * (the same per-user folder as credentials.json — see resolveCheckoutCredentials.js). Never logged.
 *
 * EXIT CODE: run-all.js's exit code, unchanged. A failed upload never changes it; the summary
 * stays in results/local-runs/pending/ and is retried on the next run.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { SUMMARY_DIR } = require('./writeRunLog');
const { stripArmingEnv } = require('./armingEnv');

const REPO = 'BestAccessDoors/ecommerce-qa-test-suite';
const BRANCH = 'local-runs';
const REMOTE_DIR = 'local-runs';
const ROOT = path.join(__dirname, '..');
const PENDING_DIR = path.join(ROOT, 'results', 'local-runs', 'pending');
const SENT_DIR = path.join(ROOT, 'results', 'local-runs', 'sent');
const TOKEN_FILE = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
  'BestAccessDoorsTests',
  'github-token.txt'
);
const SCHEMA = 1;

function log(msg) {
  console.log(`[local-run] ${msg}`);
}

function availableStores() {
  return fs.readdirSync(path.join(ROOT, 'stores'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort();
}

/** The stores run-all.js will run for these args (same rule as run-all.js). */
function storesFor(args) {
  const i = args.indexOf('--stores');
  if (i === -1) return availableStores();
  return (args[i + 1] || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function readSidecar(store, since) {
  const file = path.join(SUMMARY_DIR, `${store}.json`);
  try {
    // run-all.js deletes these before it starts, but check the time anyway, so a stale file
    // from an earlier run can never be published as this run's result.
    if (fs.statSync(file).mtimeMs < since) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

const num = (v) => (Number.isFinite(v) ? v : 0);
const str = (v, max = 300) => String(v == null ? '' : v).slice(0, max);

/** Allowlist only. Add a field here deliberately, never by spreading the sidecar. */
function storeEntry(store, s) {
  if (!s) {
    return {
      store: store.toUpperCase(),
      outcome: 'NO RESULTS',
      siteBlocked: false,
      totals: null,
      failedSpecs: [],
    };
  }
  const t = s.totals || {};
  return {
    store: store.toUpperCase(),
    outcome: s.outcome === 'PASS' ? 'PASS' : 'FAIL',
    siteBlocked: Boolean(s.siteBlocked),
    durationMinutes: Math.round(num(s.durationMs) / 6000) / 10,
    totals: {
      tests: num(t.totalTests),
      passed: num(t.totalPassed),
      failed: num(t.totalFailed),
      pending: num(t.totalPending),
      skipped: num(t.totalSkipped),
    },
    failedSpecs: (Array.isArray(s.failedSpecs) ? s.failedSpecs : []).map((f) => ({
      spec: str(f.spec, 120),
      failures: num(f.failures),
      tests: (Array.isArray(f.tests) ? f.tests : []).map((x) => str(x)),
    })),
  };
}

function buildSummary({ started, finished, stores, exitCode }) {
  const entries = stores.map((st) => storeEntry(st, readSidecar(st, started)));
  return {
    schema: SCHEMA,
    source: 'Local',
    machine: str(process.env.LOCAL_RUN_LABEL || 'QA laptop', 40),
    started: new Date(started).toISOString(),
    finished: new Date(finished).toISOString(),
    minutes: Math.round((finished - started) / 60000),
    exitCode,
    storesFailed: entries.filter((e) => e.outcome !== 'PASS').length,
    storesPassed: entries.filter((e) => e.outcome === 'PASS').length,
    failingTests: entries.reduce((n, e) => n + e.failedSpecs.reduce((m, f) => m + f.tests.length, 0), 0),
    stores: entries,
  };
}

/** 2026-11-09T15-00Z.json — UTC, sortable, no characters Windows or GitHub dislike. */
function fileNameFor(iso) {
  return `${iso.slice(0, 13)}-${iso.slice(14, 16)}Z.json`;
}

function readToken() {
  const fromEnv = (process.env.GITHUB_LOCAL_RUNS_TOKEN || '').trim();
  if (fromEnv) return fromEnv;
  try {
    const t = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
    return t || null;
  } catch {
    return null;
  }
}

async function upload(file, token) {
  const name = path.basename(file);
  const url = `https://api.github.com/repos/${REPO}/contents/${REMOTE_DIR}/${name}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'bestaccessdoors-qa-local-run',
  };
  const body = {
    message: `local run ${name.replace(/\.json$/, '')}`,
    content: fs.readFileSync(file).toString('base64'),
    branch: BRANCH,
  };
  // A retry after a half-finished upload: the file is already there, so updating needs its sha.
  const existing = await fetch(`${url}?ref=${BRANCH}`, { headers });
  if (existing.ok) body.sha = (await existing.json()).sha;
  const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).message || ''; } catch { /* not JSON */ }
    const hint = {
      401: 'the token is wrong or has expired: create a new one (MAINTENANCE.md, "Scheduled local runs").',
      403: 'the token lacks Contents: read and write on this repo.',
      404: `the "${BRANCH}" branch is missing, or the token cannot see this repo.`,
    }[res.status] || '';
    throw new Error(`GitHub answered ${res.status} ${detail} ${hint}`.trim());
  }
}

async function flushPending({ dryRun }) {
  let files = [];
  try {
    files = fs.readdirSync(PENDING_DIR).filter((f) => f.endsWith('.json')).sort();
  } catch {
    return;
  }
  if (!files.length) return;
  if (dryRun) {
    log(`dry run: ${files.length} summary file(s) left unsent in ${PENDING_DIR}`);
    return;
  }
  const token = readToken();
  if (!token) {
    log(`NOT PUBLISHED: no GitHub token. Put it in ${TOKEN_FILE}`);
    log('or set GITHUB_LOCAL_RUNS_TOKEN. The summary waits in results\\local-runs\\pending and is sent next run.');
    return;
  }
  fs.mkdirSync(SENT_DIR, { recursive: true });
  for (const f of files) {
    const full = path.join(PENDING_DIR, f);
    try {
      await upload(full, token);
      fs.renameSync(full, path.join(SENT_DIR, f));
      log(`published ${f} to the ${BRANCH} branch`);
    } catch (err) {
      log(`NOT PUBLISHED ${f}: ${err.message}`);
      log('It stays in results\\local-runs\\pending and is retried next run.');
      return; // keep order: don't send a newer run ahead of an older one
    }
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const runIdx = argv.indexOf('--run');
  let exitCode = 0;

  if (runIdx !== -1) {
    const runArgs = argv.slice(runIdx + 1).filter((a) => a !== '--dry-run');
    const stores = storesFor(runArgs);
    const started = Date.now();
    const result = spawnSync(process.execPath, [path.join(__dirname, 'run-all.js'), ...runArgs], {
      stdio: 'inherit',
      // The scheduled run is stub-only, like the dashboard: never a real lead or order.
      env: stripArmingEnv(process.env),
    });
    exitCode = result.status == null ? 1 : result.status;
    const summary = buildSummary({ started, finished: Date.now(), stores, exitCode });
    fs.mkdirSync(PENDING_DIR, { recursive: true });
    const name = fileNameFor(summary.started);
    fs.writeFileSync(path.join(PENDING_DIR, name), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    log(`summary written: results\\local-runs\\pending\\${name} ` +
      `(${summary.storesPassed} passed, ${summary.storesFailed} failed, ${summary.failingTests} failing test(s))`);
  }

  try {
    await flushPending({ dryRun });
  } catch (err) {
    log(`publishing failed: ${err.message}`);
  }
  process.exit(exitCode);
}

if (require.main === module) main();

module.exports = { buildSummary, storeEntry, fileNameFor };
