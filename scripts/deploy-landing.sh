#!/usr/bin/env bash
# Builds the static landing into apps/landing/dist and syncs it to S3, then invalidates CloudFront.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=apps/landing/dist
rm -rf "$OUT" && mkdir -p "$OUT"
cp -R apps/landing/public/. "$OUT/"
cp packages/ui/only-tools.css "$OUT/only-tools.css"
[ "${1:-}" = "--build-only" ] && { echo "built $OUT"; exit 0; }
BUCKET=$(terraform -chdir=infra/main output -raw web_bucket)
DIST=$(terraform -chdir=infra/main output -raw cloudfront_distribution_id)
aws s3 sync "$OUT" "s3://$BUCKET" --exclude "admin/*" --cache-control "public,max-age=300" --delete --profile yevhenii
aws s3 cp "$OUT/sw.js" "s3://$BUCKET/sw.js" --cache-control "no-cache" --profile yevhenii
aws cloudfront create-invalidation --distribution-id "$DIST" --paths "/*" --profile yevhenii >/dev/null
echo "deployed → $(terraform -chdir=infra/main output -raw site_url)"
