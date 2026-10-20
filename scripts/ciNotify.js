#!/usr/bin/env node
/**
 * Keep the "Scheduled test runs: current status" GitHub issue up to date after a cloud run, and
 * comment on it ONLY when the list of failures changes.
 *
 *   node scripts/ciNotify.js <artifactsDir>                         (in the workflow's notify job)
 *   node scripts/ciNotify.js <artifactsDir> --dry-run [--state-file f.json]       (local testing)
 *
 * WHY AN ISSUE: GitHub emails a scheduled run's failure only to whoever last edited the `cron`
 * line. Anyone can Subscribe to an issue, and a new comment emails every subscriber, so the issue
 * is the cheapest way to reach more people with no secrets and no admin setup. It can also be
 * linked to a Trello card with the GitHub Power-Up.
 *
 * WHY ONLY ON CHANGE: several failures are known site deficiencies left failing on purpose (see
 * CLAUDE.md), and ADAP is blocked by Cloudflare on every cloud run, so nearly every run is red. A
 * comment per run would teach people to ignore it. Instead:
 *   - the issue BODY is rewritten every run (body edits send no notification): last run, link, and
 *     the full list of what is failing right now;
 *   - a COMMENT is posted only when something started or stopped failing.
 *
 * STATE lives in the issue body itself, as a hidden comment (deflated + base64, so a whole-fleet
 * outage still fits GitHub's 65,536-character body limit). Closing the issue resets it: the next
 * run opens a fresh one with a baseline comment.
 *
 * Failure keys, one per line in the list:
 *   "BRH › seo.cy.js › SEO – PDP › has a JSON-LD Product block…"   one per failed test
 *   "ADAP: site blocked"                                           a blocked store counts ONCE,
 *                                                                  not once per test
 *   "PDA: no results"                                              Cypress crashed / never ran
 * Keys must stay stable from run to run, or the diff reports noise. That is why the block verdict
 * (Cloudflare or not) is shown next to the key rather than being part of it.
 *
 * Unlike ciReport.js this exits 1 on an API error: a broken notifier should turn the job red,
 * not fail silently.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const LABEL = 'scheduled-run-status';
const TITLE = 'Scheduled test runs: current status';
const MAX_LISTED = 100; // per list, in the body and in comments; the run page has the rest
const STATE_RE = /<!-- state:([A-Za-z0-9+/=]*) -->/;

const BLOCK_DETAIL = {
  cloudflare: 'Cloudflare challenge (confirmed); expected until its protection lets cloud machines in',
  'bot-fight': 'likely Cloudflare Bot Fight Mode',
  other: '403 on every page load, not identified as Cloudflare',
};

function availableStores() {
  return fs.readdirSync(path.join(ROOT, 'stores'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort();
}

/** Find `<anything>/<folder>/<store>.json` under dir. The artifact's root folder shifts depending
 *  on whether the store produced screenshots, so search instead of assuming a layout. */
function findFile(dir, folder, name) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isFile() && e.name === name && path.basename(dir) === folder) return full;
    if (e.isDirectory() && e.name !== 'screenshots') {
      const hit = findFile(full, folder, name);
      if (hit) return hit;
    }
  }
  return null;
}

function readJson(file) {
  try {
    return file ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  } catch {
    return null;
  }
}

function shortSpec(spec) {
  return String(spec).replace(/\\/g, '/').replace(/^cypress\/e2e\//, '');
}

/** @returns {{ keys: string[], detail: Map<string,string> }} */
function currentFailures(artifactsDir) {
  const keys = new Set();
  const detail = new Map();
  for (const store of availableStores()) {
    const CODE = store.toUpperCase();
    const own = path.join(artifactsDir, `store-${store}`);
    const s = readJson(findFile(own, '.run-summary', `${store}.json`));
    if (!s) {
      keys.add(`${CODE}: no results`);
      detail.set(`${CODE}: no results`, "Cypress crashed or the job didn't start; see the run");
      continue;
    }
    const failedTests = [];
    for (const spec of s.failedSpecs || []) {
      for (const t of spec.tests) failedTests.push(`${CODE} › ${shortSpec(spec.spec)} › ${t}`);
    }
    if (s.siteBlocked) {
      const key = `${CODE}: site blocked`;
      keys.add(key);
      const ci = readJson(findFile(own, 'ci', `${store}.json`));
      detail.set(key, BLOCK_DETAIL[ci && ci.blocked] || BLOCK_DETAIL.other);
      // Collapse the 403s into that one key. Only when there are failures beyond them (a partial
      // block, say) list the individual tests too, so a real failure is never hidden by the block.
      if (s.totals.totalFailed <= s.siteBlocked.count) continue;
    }
    for (const k of failedTests) keys.add(k);
  }
  return { keys: [...keys].sort(), detail };
}

function encodeState(keys) {
  return zlib.deflateRawSync(Buffer.from(JSON.stringify(keys), 'utf8')).toString('base64');
}
function decodeState(body) {
  const m = STATE_RE.exec(body || '');
  if (!m) return null;
  try {
    return JSON.parse(zlib.inflateRawSync(Buffer.from(m[1], 'base64')).toString('utf8'));
  } catch {
    return null;
  }
}

function runInfo() {
  const server = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const repo = process.env.GITHUB_REPOSITORY || 'local/dry-run';
  const id = process.env.GITHUB_RUN_ID || '0';
  const when = new Date().toLocaleString('en-CA', {
    timeZone: 'America/Toronto', dateStyle: 'medium', timeStyle: 'short',
  });
  return { url: `${server}/${repo}/actions/runs/${id}`, number: process.env.GITHUB_RUN_NUMBER || '?', when };
}

function bulletList(keys, detail) {
  // A title like "renders <lite-youtube>" would otherwise be swallowed as an HTML tag.
  const md = (s) => s.replace(/</g, '&lt;');
  const shown = keys.slice(0, MAX_LISTED).map((k) => (detail.has(k) ? `- ${md(k)} — ${detail.get(k)}` : `- ${md(k)}`));
  if (keys.length > MAX_LISTED) shown.push(`- …and ${keys.length - MAX_LISTED} more (see the run)`);
  return shown.join('\n');
}

/** Only @user or @org/team tokens, so a typo in the variable can't inject anything else. */
function mentions() {
  return String(process.env.NOTIFY_MENTIONS || '')
    .split(/[\s,]+/)
    .filter((m) => /^@[A-Za-z0-9-]+(\/[A-Za-z0-9_.-]+)?$/.test(m))
    .join(' ');
}

function renderBody(keys, detail, run) {
  return [
    '<!-- Managed by .github/workflows/scheduled-tests.yml (scripts/ciNotify.js). Edits are overwritten by the next run. -->',
    'This issue is updated automatically after every scheduled cloud test run. **Subscribe** to it to get an email whenever the list of failures changes. Closing it resets the tracking.',
    '',
    `**Last run:** ${run.when} (Toronto), [run #${run.number}](${run.url})`,
    '',
    keys.length ? `**Failing now (${keys.length}):**\n\n${bulletList(keys, detail)}` : '**Nothing is failing.**',
    '',
    `<!-- state:${encodeState(keys)} -->`,
  ].join('\n');
}

function renderChange(added, removed, keys, detail, run) {
  const parts = [];
  const who = mentions();
  if (who) parts.push(who);
  parts.push(`**The failure list changed** in [run #${run.number}](${run.url}), ${run.when} (Toronto).`);
  if (added.length) parts.push(`🔴 **Started failing (${added.length}):**\n\n${bulletList(added, detail)}`);
  if (removed.length) parts.push(`🟢 **Stopped failing (${removed.length}):**\n\n${bulletList(removed, new Map())}`);
  parts.push(`Failing now: **${keys.length}**. The full list is in the issue description.`);
  return parts.join('\n\n');
}

function renderBaseline(keys, run) {
  const who = mentions();
  return [
    who,
    `First tracked run: [run #${run.number}](${run.url}), ${run.when} (Toronto). **${keys.length}** failing; the list is in the issue description.`,
    'From now on this issue gets a comment only when that list changes.',
  ].filter(Boolean).join('\n\n');
}

async function api(method, route, body) {
  const res = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${route}`, {
    method,
    headers: {
      authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'ecommerce-qa-test-suite/ciNotify',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 404 && method === 'GET') return null;
  if (!res.ok) throw new Error(`${method} ${route} -> ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function findOrCreateIssue(initialBody) {
  const open = await api('GET', `/issues?labels=${LABEL}&state=open&sort=created&direction=asc&per_page=1`);
  if (open && open.length) return { issue: open[0], created: false };
  if (!(await api('GET', `/labels/${LABEL}`))) {
    await api('POST', '/labels', {
      name: LABEL, color: '498cbc', description: 'Updated automatically by the scheduled cloud test run',
    });
  }
  const issue = await api('POST', '/issues', { title: TITLE, body: initialBody, labels: [LABEL] });
  return { issue, created: true };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const stateFileIdx = args.indexOf('--state-file');
  const stateFile = stateFileIdx >= 0 ? args[stateFileIdx + 1] : null;
  const artifactsDir = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--state-file');
  if (!artifactsDir) {
    console.error('Usage: node scripts/ciNotify.js <artifactsDir> [--dry-run [--state-file f.json]]');
    process.exit(1);
  }

  const run = runInfo();
  const { keys, detail } = currentFailures(artifactsDir);
  const body = renderBody(keys, detail, run);

  if (dryRun) {
    const prev = stateFile && fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : null;
    console.log(`----- BODY -----\n${body}\n`);
    if (!prev) {
      console.log(`----- COMMENT (baseline) -----\n${renderBaseline(keys, run)}\n`);
    } else {
      const added = keys.filter((k) => !prev.includes(k));
      const removed = prev.filter((k) => !keys.includes(k));
      console.log(added.length || removed.length
        ? `----- COMMENT -----\n${renderChange(added, removed, keys, detail, run)}\n`
        : '----- no comment: failure list unchanged -----\n');
    }
    if (stateFile) fs.writeFileSync(stateFile, JSON.stringify(keys, null, 2));
    return;
  }

  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPOSITORY) {
    console.error('ciNotify: GITHUB_TOKEN and GITHUB_REPOSITORY are required (or pass --dry-run).');
    process.exit(1);
  }

  const { issue, created } = await findOrCreateIssue(body);
  if (created) {
    await api('POST', `/issues/${issue.number}/comments`, { body: renderBaseline(keys, run) });
    console.log(`Created issue #${issue.number} with ${keys.length} failing (baseline).`);
    return;
  }

  const prev = decodeState(issue.body);
  await api('PATCH', `/issues/${issue.number}`, { body });
  if (!prev) {
    // The hidden state was lost (someone edited the description): start again from here, quietly.
    console.log(`Issue #${issue.number}: no previous state found; stored ${keys.length} as the new baseline.`);
    return;
  }
  const added = keys.filter((k) => !prev.includes(k));
  const removed = prev.filter((k) => !keys.includes(k));
  if (!added.length && !removed.length) {
    console.log(`Issue #${issue.number}: failure list unchanged (${keys.length}); description updated, no comment.`);
    return;
  }
  await api('POST', `/issues/${issue.number}/comments`, { body: renderChange(added, removed, keys, detail, run) });
  console.log(`Issue #${issue.number}: +${added.length} / -${removed.length}; comment posted.`);
}

main().catch((err) => {
  console.error(`ciNotify: ${err.message}`);
  process.exit(1);
});
