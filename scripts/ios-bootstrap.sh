#!/usr/bin/env bash
# Bootstrap the iOS Capacitor shell. Run once, on a release/ios-* branch.
#
# This script is intentionally noisy and idempotent. It WILL modify
# package.json and create the ios/App/ Xcode project. Do NOT run on main.

set -euo pipefail

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

if [[ "$CURRENT_BRANCH" == "main" || "$CURRENT_BRANCH" == "master" ]]; then
  echo "Refusing to bootstrap iOS on $CURRENT_BRANCH."
  echo "Create a release/ios-bootstrap branch first:"
  echo "  git checkout -b release/ios-bootstrap"
  exit 1
fi

if [[ ! -f capacitor.config.ts ]]; then
  echo "capacitor.config.ts is missing at the repo root. Aborting."
  exit 1
fi

echo "==> Installing Capacitor packages"
npm install --save @capacitor/core @capacitor/ios
npm install --save-dev @capacitor/cli

echo "==> Adding iOS native project"
if [[ -d ios/App ]]; then
  echo "ios/App already exists, skipping cap add ios."
else
  npx cap add ios
fi

echo "==> Syncing iOS"
npx cap sync ios

echo
echo "Bootstrap complete."
echo "Open the workspace with:  npx cap open ios"
echo "Tag this commit when ready: git tag -a ios-v0.1.0-bootstrap -m 'iOS bootstrap'"
