# Lightsail deploy menu

`deploy/lightsail/deploy-menu.sh` is an interactive helper for the first Hellowhen Trade beta server on AWS Lightsail.

It is designed for the production layout used by the beta instance:

```txt
/opt/hellowhen_trade/app              Git checkout, deployed from main
/opt/hellowhen_trade/shared/.env      Production secrets, not committed
/opt/hellowhen_trade/shared/uploads   Local beta upload storage
/opt/hellowhen_trade/ecosystem.config.cjs  PM2 app config
```

## Install on the Lightsail instance

From the repo checkout on Lightsail:

```bash
cd /opt/hellowhen_trade/app
chmod +x deploy/lightsail/deploy-menu.sh
```

Run directly:

```bash
./deploy/lightsail/deploy-menu.sh
```

Or install a stable shortcut outside the repo:

```bash
ln -sfn /opt/hellowhen_trade/app/deploy/lightsail/deploy-menu.sh /opt/hellowhen_trade/deploy-menu.sh
/opt/hellowhen_trade/deploy-menu.sh
```

## Default configuration

The script uses these defaults:

```bash
HELLOWHEN_APP_DIR=/opt/hellowhen_trade/app
HELLOWHEN_ENV_FILE=/opt/hellowhen_trade/shared/.env
HELLOWHEN_ECOSYSTEM_FILE=/opt/hellowhen_trade/ecosystem.config.cjs
HELLOWHEN_BRANCH=main
HELLOWHEN_WEB_URL=https://hellowhen.com
HELLOWHEN_API_URL=https://api.hellowhen.com
HELLOWHEN_UPLOAD_DIR=/opt/hellowhen_trade/shared/uploads
HELLOWHEN_BACKUP_DIR=/opt/hellowhen_trade/shared/backups
```

Override any value only for the current command if needed:

```bash
HELLOWHEN_BRANCH=main ./deploy/lightsail/deploy-menu.sh
```

## Recommended deploy option

Use menu option **15** for a normal production redeploy:

```txt
Full deploy: pull + install + prisma + build + reload + smoke test
```

It runs, in order:

```txt
git pull --ff-only origin main
npm ci
npm run prisma:generate
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
npm run build with /opt/hellowhen_trade/shared/.env loaded
pm2 startOrReload /opt/hellowhen_trade/ecosystem.config.cjs --update-env
pm2 save
HTTP smoke tests
```

The script refuses to pull if the working tree is dirty, and checks that `package-lock.json` does not contain the internal OpenAI npm registry URL. If generated files on the server block a checkout, use option **16** and then run the full deploy again.

## Useful quick options

```txt
1   Status
8   Reload PM2 apps
10  Smoke test
11  Logs
12  Backup uploads
14  Certbot renewal dry run
16  Clean generated server files, useful when Next/TypeScript generated tracked files block checkout
```

## Production branch rule

The Lightsail server should deploy only from `main`.

Use this workflow:

```txt
local dev branch -> validate locally -> merge to main -> push main -> Lightsail full deploy
```

Do not keep production-only secrets in the repo. They stay in `/opt/hellowhen_trade/shared/.env`.
