# Lightsail deployment

Patch 1 includes a starter Dockerfile and compose file for the API + Postgres prototype.

Early prototype:

- one Lightsail Linux instance or simple container service
- API on Node 20
- Postgres local to prototype only
- move database to managed Postgres/RDS before real money or production scale

Do not enable real payments on a prototype database without backups, audit controls, and review.
