#!/usr/bin/env bash
# Codespace bring-up for ReceiptSnap Mobile.
#
# mobile/ is the EAS-configured project (it carries extra.eas.projectId and
# updates.url), so prefer it. Only fall back to reconstructing from the
# installer if it is somehow missing — a reconstructed project is NOT linked to
# the EAS project, and running credential commands there would target the wrong
# thing.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -d "$REPO_ROOT/mobile" ]; then
  echo "==> Using the committed EAS-configured project at mobile/"
  cd "$REPO_ROOT/mobile"
  npm install --no-audit --no-fund
else
  echo "==> mobile/ missing - reconstructing with setup-receiptsnap-mobile.sh"
  bash "$REPO_ROOT/setup-receiptsnap-mobile.sh"
  echo "WARNING: the reconstructed project at ~/receiptsnap-mobile is not linked"
  echo "to the EAS project. Run 'eas init' before any credentials work."
  exit 0
fi

echo
echo "============================================================"
echo " ReceiptSnap Mobile ready at: $REPO_ROOT/mobile"
echo " Project: @tylerthornbrue/receiptsnap"
echo
echo " Next: Terminal -> Run Task, in order:"
echo "   1 - Verify install"
echo "   2 - Sign in to Expo"
echo "   3 - Apple sign-in + create iOS credentials"
echo
echo " The build itself runs in GitHub Actions, not here."
echo "============================================================"
