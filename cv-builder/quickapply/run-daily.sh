#!/usr/bin/env bash
# Cron entry point for the VPS - pulls the latest code (so it always runs whatever's on
# main, same as the GitHub Actions pipeline) then runs the CVbankas quick-apply script
# for every person with a captured session. Scheduled to start well after the daily
# scrape/generate pipeline (22:00 UTC on GitHub Actions, ~35-40min typical runtime) so
# freshly matched jobs are already in Firestore before this looks for candidates.
set -euo pipefail
cd "$(dirname "$0")/../.."
git pull --ff-only
node --env-file=.env cv-builder/quickapply/cvbankas.js
