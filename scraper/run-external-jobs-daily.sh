#!/usr/bin/env bash
# Cron entry point for the VPS - pulls the latest code, then scrapes CVbankas, CV.lt and
# Uzimtumo tarnyba using the snap-installed Chromium (see external-jobs-scraper.js for why
# this can't use the full playwright package's bundled browser on this ARM64 box).
#
# Runs on the VPS instead of GitHub Actions because CVbankas intermittently blocks GitHub
# Actions' shared IP range (confirmed: same code found 24 matches on some runs, 0 on
# others, over the same day) - the VPS's IP is not blocked. Scheduled to run before the
# GitHub Actions daily pipeline (22:00 UTC) so cv-builder/generate.js picks up today's
# fresh external-jobs data instead of yesterday's.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
node --env-file=.env scraper/external-jobs-scraper.js
