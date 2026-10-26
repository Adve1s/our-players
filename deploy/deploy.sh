#!/usr/bin/env bash
# Builds the API image here, streams it to the host over ssh (no registry) and restarts the stack.
# Usage: deploy/deploy.sh <ssh-target> [--ship-only]. See docs/DEPLOY.md.
set -euo pipefail

usage() {
  echo "usage: deploy/deploy.sh <ssh-target> [--ship-only]   (e.g. root@<server-ip>)" >&2
  exit 2
}
[[ $# -ge 1 && $# -le 2 && $1 != -* ]] || usage
target=$1
ship_only=0
if [[ $# -eq 2 ]]; then
  [[ $2 == --ship-only ]] || usage
  ship_only=1
fi
remote_dir=/opt/our-players

cd "$(dirname "$0")/.."

# The tag names a commit, so the tree must be exactly that commit (untracked files would be built too).
if [[ -n $(git status --porcelain) ]]; then
  echo "refusing to deploy: the working tree has uncommitted or untracked changes (git status)" >&2
  exit 1
fi
branch=$(git rev-parse --abbrev-ref HEAD)
[[ $branch == main ]] || echo "warning: deploying from branch '$branch', not main" >&2
tag=$(git rev-parse --short HEAD)
image=localhost/our-players-api:$tag

# Fail before the slow build if the host isn't set up yet.
ssh "$target" "test -f $remote_dir/.env" || {
  echo "no $remote_dir/.env on $target: do the first-time setup in docs/DEPLOY.md first" >&2
  exit 1
}

if docker info >/dev/null 2>&1; then tool=docker; else tool=podman; fi
echo "building $image with $tool"
"$tool" build -t "$image" .

echo "shipping $image to $target"
"$tool" save "$image" | gzip | ssh "$target" 'gunzip | docker load'
scp deploy/compose.yaml deploy/Caddyfile "$target:$remote_dir/"
ssh "$target" "cd $remote_dir && if grep -q '^API_TAG=' .env; then sed -i 's/^API_TAG=.*/API_TAG=$tag/' .env; else echo 'API_TAG=$tag' >> .env; fi && grep '^API_TAG=' .env"

if [[ $ship_only -eq 1 ]]; then
  echo "shipped $tag (--ship-only: nothing restarted)"
  exit 0
fi

# --wait returns once db and api report healthy (or fails if one doesn't). Compose doesn't notice an
# edited Caddyfile (a bind mount), so Caddy reloads it; that's a no-op when it's unchanged.
ssh "$target" "cd $remote_dir && docker compose up -d --wait && docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile && docker compose ps && curl -fsS --retry 5 --retry-delay 3 --retry-all-errors \"https://\$(grep '^API_HOST=' .env | cut -d= -f2)/health\" && echo"
echo "deployed $tag"
