#!/usr/bin/env bash
set -uo pipefail

APP_DIR="${HELLOWHEN_APP_DIR:-/opt/hellowhen_trade/app}"
ENV_FILE="${HELLOWHEN_ENV_FILE:-/opt/hellowhen_trade/shared/.env}"
ECOSYSTEM_FILE="${HELLOWHEN_ECOSYSTEM_FILE:-/opt/hellowhen_trade/ecosystem.config.cjs}"
BRANCH="${HELLOWHEN_BRANCH:-main}"
WEB_URL="${HELLOWHEN_WEB_URL:-https://hellowhen.com}"
API_URL="${HELLOWHEN_API_URL:-https://api.hellowhen.com}"
UPLOAD_DIR="${HELLOWHEN_UPLOAD_DIR:-/opt/hellowhen_trade/shared/uploads}"
BACKUP_DIR="${HELLOWHEN_BACKUP_DIR:-/opt/hellowhen_trade/shared/backups}"

print_header() {
  printf '\n\033[1;36mHellowhen Trade Lightsail deploy menu\033[0m\n'
  printf 'App:        %s\n' "$APP_DIR"
  printf 'Branch:     %s\n' "$BRANCH"
  printf 'Env file:   %s\n' "$ENV_FILE"
  printf 'PM2 file:   %s\n' "$ECOSYSTEM_FILE"
  printf 'Web URL:    %s\n' "$WEB_URL"
  printf 'API URL:    %s\n\n' "$API_URL"
}

run_step() {
  local label="$1"
  shift
  printf '\n\033[1;34m==> %s\033[0m\n' "$label"
  "$@"
}

ensure_app_dir() {
  if [[ ! -d "$APP_DIR/.git" ]]; then
    printf '\033[1;31mERROR:\033[0m %s is not a Git checkout.\n' "$APP_DIR" >&2
    return 1
  fi
}

ensure_env_file() {
  if [[ ! -f "$ENV_FILE" ]]; then
    printf '\033[1;31mERROR:\033[0m missing env file: %s\n' "$ENV_FILE" >&2
    return 1
  fi
}

cd_app() {
  ensure_app_dir || return 1
  cd "$APP_DIR" || return 1
}

show_status() {
  cd_app || return 1
  printf '\nGit branch/status:\n'
  git branch --show-current
  git status -sb
  printf '\nRecent commit:\n'
  git --no-pager log -1 --oneline
  printf '\nPM2 status:\n'
  pm2 status || true
  printf '\nDisk usage:\n'
  df -h / "$APP_DIR" 2>/dev/null || df -h /
}

check_clean_worktree() {
  cd_app || return 1
  if [[ -n "$(git status --porcelain)" ]]; then
    printf '\033[1;31mERROR:\033[0m working tree is not clean.\n' >&2
    git status -sb >&2
    printf '\nResolve or discard local changes before pulling production code.\n' >&2
    return 1
  fi
}

check_lock_registry() {
  cd_app || return 1
  printf 'Checking package-lock and npm files for internal registry URLs...\n'
  local matches
  matches=$(grep -R "applied-caas-gateway\|internal.api.openai" -n package-lock.json package.json .npmrc */.npmrc */*/.npmrc 2>/dev/null || true)
  if [[ -n "$matches" ]]; then
    printf '\033[1;31mERROR:\033[0m internal npm registry references found:\n%s\n' "$matches" >&2
    return 1
  fi
  printf 'OK: no internal npm registry references found.\n'
}

clean_generated_server_files() {
  cd_app || return 1
  printf 'This discards known generated/server-local files only.\n'
  printf 'Continue? Type yes: '
  read -r confirm
  if [[ "$confirm" != "yes" ]]; then
    printf 'Cancelled.\n'
    return 0
  fi
  git restore apps/web/next-env.d.ts apps/web/tsconfig.tsbuildinfo package-lock.json 2>/dev/null || true
  rm -f package-lock.json.before-registry-fix
  git status -sb
}

pull_latest() {
  cd_app || return 1
  check_clean_worktree || return 1
  run_step "Fetch origin" git fetch origin
  local current_branch
  current_branch=$(git branch --show-current)
  if [[ "$current_branch" != "$BRANCH" ]]; then
    run_step "Checkout $BRANCH" git checkout "$BRANCH"
  fi
  run_step "Pull origin/$BRANCH" git pull --ff-only origin "$BRANCH"
  git status -sb
}

install_deps() {
  cd_app || return 1
  check_lock_registry || return 1
  run_step "Install dependencies" npm ci
}

prisma_generate() {
  cd_app || return 1
  ensure_env_file || return 1
  run_step "Generate Prisma client" npm run prisma:generate
}

prisma_migrate() {
  cd_app || return 1
  ensure_env_file || return 1
  run_step "Deploy Prisma migrations" npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
}

build_with_env() {
  cd_app || return 1
  ensure_env_file || return 1
  if [[ "$#" -eq 0 ]]; then
    set -- build
  fi
  run_step "Build target: npm run $*" node - "$ENV_FILE" "$@" <<'NODE'
const { spawnSync } = require('child_process');
const envFile = process.argv[2];
const npmArgs = process.argv.slice(3);

require('dotenv').config({ path: envFile });

if (!process.env.NEXT_PUBLIC_API_URL) {
  console.error('NEXT_PUBLIC_API_URL is missing. Check the production env file.');
  process.exit(1);
}

console.log('Building with NEXT_PUBLIC_API_URL=', process.env.NEXT_PUBLIC_API_URL);

const result = spawnSync('npm', ['run', ...npmArgs], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
NODE
}

build_full() {
  build_with_env build
}

build_packages() {
  build_with_env build:packages
}

build_api() {
  build_with_env build -w @hellowhen/api
}

build_web() {
  build_with_env build -w @hellowhen/web
}

pm2_reload() {
  ensure_env_file || return 1
  if [[ ! -f "$ECOSYSTEM_FILE" ]]; then
    printf '\033[1;31mERROR:\033[0m missing PM2 ecosystem file: %s\n' "$ECOSYSTEM_FILE" >&2
    return 1
  fi
  run_step "Reload PM2 apps" pm2 startOrReload "$ECOSYSTEM_FILE" --update-env
  run_step "Save PM2 process list" pm2 save
  pm2 status
}

pm2_restart_all() {
  run_step "Restart PM2 apps" pm2 restart hellowhen-api hellowhen-web --update-env
  run_step "Save PM2 process list" pm2 save
  pm2 status
}

pm2_restart_api() {
  run_step "Restart API" pm2 restart hellowhen-api --update-env
  pm2 status
}

pm2_restart_web() {
  run_step "Restart web" pm2 restart hellowhen-web --update-env
  pm2 status
}

smoke_test() {
  run_step "PM2 status" pm2 status
  run_step "Local API health" curl -i http://127.0.0.1:4000/health
  run_step "Local web auth" curl -I http://127.0.0.1:3000/auth
  run_step "Public auth" curl -I "$WEB_URL/auth"
  run_step "Public trades" curl -I "$WEB_URL/trades"
  run_step "Public account settings" curl -I "$WEB_URL/account/settings"
  run_step "Public admin" curl -I "$WEB_URL/admin"
  run_step "Public API health" curl -i "$API_URL/health"
}

full_deploy() {
  cd_app || return 1
  pull_latest || return 1
  install_deps || return 1
  prisma_generate || return 1
  prisma_migrate || return 1
  build_full || return 1
  pm2_reload || return 1
  smoke_test || return 1
}

show_logs() {
  printf '\n1) API logs\n2) Web logs\n3) All PM2 logs\n4) Nginx error log\n5) Nginx access log\nChoose: '
  read -r choice
  case "$choice" in
    1) pm2 logs hellowhen-api --lines 160 --nostream ;;
    2) pm2 logs hellowhen-web --lines 160 --nostream ;;
    3) pm2 logs --lines 160 --nostream ;;
    4) sudo tail -n 160 /var/log/nginx/error.log ;;
    5) sudo tail -n 160 /var/log/nginx/access.log ;;
    *) printf 'Unknown choice.\n' ;;
  esac
}

backup_uploads() {
  if [[ ! -d "$UPLOAD_DIR" ]]; then
    printf '\033[1;31mERROR:\033[0m upload dir not found: %s\n' "$UPLOAD_DIR" >&2
    return 1
  fi
  mkdir -p "$BACKUP_DIR"
  local out="$BACKUP_DIR/uploads-$(date +%Y%m%d-%H%M%S).tar.gz"
  run_step "Backup uploads to $out" tar -czf "$out" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
  ls -lh "$out"
}

renew_cert_dry_run() {
  run_step "Certbot renewal dry run" sudo certbot renew --dry-run
}

show_menu() {
  print_header
  cat <<'MENU'
1) Status
2) Pull latest main
3) Install dependencies (npm ci)
4) Prisma generate + migrate deploy
5) Build full app with production env
6) Build API only
7) Build web only
8) Reload PM2 apps
9) Restart menu
10) Smoke test
11) Logs
12) Backup uploads
13) Check npm registry safety
14) Certbot renewal dry run
15) Full deploy: pull + install + prisma + build + reload + smoke test
16) Clean generated server files
0) Exit
MENU
}

restart_menu() {
  printf '\n1) Restart all\n2) Restart API only\n3) Restart web only\nChoose: '
  read -r choice
  case "$choice" in
    1) pm2_restart_all ;;
    2) pm2_restart_api ;;
    3) pm2_restart_web ;;
    *) printf 'Unknown choice.\n' ;;
  esac
}

main() {
  while true; do
    show_menu
    printf '\nChoose an option: '
    read -r choice
    case "$choice" in
      1) show_status ;;
      2) pull_latest ;;
      3) install_deps ;;
      4) prisma_generate && prisma_migrate ;;
      5) build_full ;;
      6) build_api ;;
      7) build_web ;;
      8) pm2_reload ;;
      9) restart_menu ;;
      10) smoke_test ;;
      11) show_logs ;;
      12) backup_uploads ;;
      13) check_lock_registry ;;
      14) renew_cert_dry_run ;;
      15) full_deploy ;;
      16) clean_generated_server_files ;;
      0) exit 0 ;;
      *) printf 'Unknown option.\n' ;;
    esac
    printf '\nPress Enter to continue...'
    read -r _
  done
}

main "$@"
