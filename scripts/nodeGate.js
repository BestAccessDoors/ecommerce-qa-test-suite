/**
 * Warn when the tests are being driven by a Node version they aren't pinned to.
 *
 * The .bat launchers can't be bypassed by accident — they all `call`
 * scripts/ensure-node.bat, which puts an accepted Node on PATH. But running
 * `npm run test:all` straight from a terminal skips that entirely and inherits
 * whatever Node happens to be on PATH, with no signal at all that it happened.
 *
 * The tell that this had been going unnoticed was a `DEP0205
 * DeprecationWarning: module.register()` line in a run's output: that warning
 * only exists on Node >= 26, so its presence proved the run was on a version
 * the bootstrap deliberately rejects.
 *
 * This is a WARNING, never a failure: `cypress run` was fine on Node 26 even
 * when `cypress install` was not (Cypress 15.15.0's unzip stack exited 0 there
 * while leaving no browser behind; 15.16+ replaced that stack, but Node 26 has
 * not been re-verified since). Blocking a run that would have succeeded would be
 * worse than the problem. We just make the situation visible.
 *
 * The accepted set below is a deliberate MIRROR of `:__en_gate` in
 * scripts/ensure-node.bat, which is the source of truth and carries the
 * evidence for each accept/reject. Change both together, and see
 * MAINTENANCE.md for the verification procedure.
 */

// Majors 24 and 22. Not 20 (EOL April 30 2026), not 26 (not yet verified — it
// was broken under Cypress 15.15.0; see :__en_gate and MAINTENANCE.md §2).
const ACCEPTED_MAJORS = [24, 22];

const fs = require('fs');
const path = require('path');

// The portable Node the launchers installed, if any — named from what is actually on disk, so
// the hint never points at a folder that a NODE_PIN bump has since replaced.
function portableNodeHint() {
  try {
    const tools = path.join(__dirname, '..', 'tools');
    const dir = fs.readdirSync(tools).find((d) => /^node-v\d+\.\d+\.\d+-win-x64$/.test(d));
    if (dir) return path.join('tools', dir, 'node.exe') + ' ' + path.join('scripts', 'run-all.js');
  } catch {
    /* no tools folder: First Time Setup has not installed a portable Node */
  }
  return null;
}

function isAcceptedNodeVersion(version) {
  const [major, minor] = String(version).split('.');
  // Reject anything that isn't a plain integer major.minor, matching the
  // batch gate's input validation rather than trusting a weird version string.
  if (!/^\d+$/.test(major) || !/^\d+$/.test(minor || '')) return false;
  return ACCEPTED_MAJORS.includes(Number(major));
}

/**
 * Print a warning to stderr if the running Node isn't one we've verified.
 * Always returns the answer rather than exiting, so callers stay in control.
 */
function warnIfUnsupportedNode(version = process.versions.node) {
  if (isAcceptedNodeVersion(version)) return true;

  // Built rather than hand-drawn so the borders can't drift out of
  // alignment when the wording is edited.
  const title = 'Node.js version not verified for this test suite';
  const pad = '─'.repeat(title.length + 4);
  const lines = [
    '',
    `  ┌${pad}┐`,
    `  │  ${title}  │`,
    `  └${pad}┘`,
    `  Running on Node v${version}. These tests are verified on Node 24 and 22.`,
    '',
    '  The run will continue — `cypress run` is usually fine. The riskier',
    '  step is `cypress install`, which has silently failed on an unverified',
    '  Node before (a DEP0205 module.register() warning in the output means',
    '  you are on Node 26 or newer).',
    '',
    '  To run on the pinned version instead, use one of the launchers',
    '  ("Run All Tests.bat" / "Run One Store.bat"), which put the right Node',
    '  on PATH for you.',
  ];
  const hint = portableNodeHint();
  if (hint) lines.push('  Or call the portable copy directly:', `      ${hint}`);
  lines.push('');
  console.error(lines.join('\n'));
  return false;
}

module.exports = { warnIfUnsupportedNode, isAcceptedNodeVersion, ACCEPTED_MAJORS };
