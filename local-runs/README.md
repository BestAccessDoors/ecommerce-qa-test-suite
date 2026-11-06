# Local run summaries

One JSON file per scheduled run on the QA laptop (weekdays 10:00 and 15:00
Toronto), uploaded by `scripts/publishLocalRun.js` and named by its UTC start
time. The weekday Claude review reads them into the BEST QA Test Suite Runs
dashboard as *Local* runs.

This branch is never merged. Each file holds only store, outcome, test counts,
whether the site blocked the run, and failing spec/test titles. See
`MAINTENANCE.md` section 9 on the main branch.
