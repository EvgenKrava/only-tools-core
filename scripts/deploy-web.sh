#!/usr/bin/env bash
# Builds the static landing and the admin SPA into apps/landing/dist and syncs it to S3, then invalidates CloudFront.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=apps/landing/dist
rm -rf apps/landing/dist && mkdir -p "$OUT"
cp -R apps/landing/public/. "$OUT/"
cp packages/ui/only-tools.css "$OUT/only-tools.css"
node scripts/build-pages.mjs "$OUT"
if [ "${1:-}" = "--build-only" ]; then
  echo '{"domain":"auth.onlytools.click","clientId":"local"}' > "$OUT/config.json"; echo "built $OUT"; exit 0
fi
printf '{"domain":"%s","clientId":"%s"}\n' "$(terraform -chdir=infra/main output -raw auth_domain)" \
  "$(terraform -chdir=infra/main output -raw core_client_id)" > "$OUT/config.json"
BUCKET=$(terraform -chdir=infra/main output -raw web_bucket)
DIST=$(terraform -chdir=infra/main output -raw cloudfront_distribution_id)
aws s3 sync "$OUT" "s3://$BUCKET" --exclude "admin/*" --cache-control "public,max-age=300" --delete --profile yevhenii
pnpm --filter @onlytools/admin build >/dev/null
aws s3 sync apps/admin/dist/assets "s3://$BUCKET/admin/assets" --cache-control "public,max-age=31536000,immutable" --profile yevhenii
aws s3 cp apps/admin/dist/index.html "s3://$BUCKET/admin/index.html" --cache-control "no-cache" --profile yevhenii
for f in sw.js config.json; do
  aws s3 cp "$OUT/$f" "s3://$BUCKET/$f" --cache-control "no-cache" --profile yevhenii
done
aws cloudfront create-invalidation --distribution-id "$DIST" --paths "/*" --profile yevhenii >/dev/null
echo "deployed → $(terraform -chdir=infra/main output -raw site_url)"
