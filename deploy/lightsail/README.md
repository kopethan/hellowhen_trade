# Lightsail production beta notes

Use this folder for small deployment helpers that are safe to keep in the repository.
Do not commit production `.env` files, database passwords, API keys, or JWT/2FA secrets.

## Optional Nginx maintenance fallback

Copy `maintenance.html` to the server and wire it as the fallback for short PM2/API/web restarts:

```bash
sudo mkdir -p /var/www/hellowhen
sudo cp deploy/lightsail/maintenance.html /var/www/hellowhen/maintenance.html
```

Inside the `hellowhen.com` and `api.hellowhen.com` Nginx server blocks, this can be used during a controlled maintenance window:

```nginx
error_page 502 503 504 /maintenance.html;
location = /maintenance.html {
    root /var/www/hellowhen;
    internal;
}
```

For normal beta deploys, prefer a quick PM2 reload after a successful build. Enable the fallback when you want users to see a friendly temporary page instead of a raw Nginx 502.
