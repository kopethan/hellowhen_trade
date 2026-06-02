# Hellowhen Trade SEO and Google Search Console Checklist

This checklist is for the first public Hellowhen Trade web launch.

The goal is to make Google understand the current product as:

> Hellowhen Trade helps adults exchange skills, services, needs, and offers without money.

It also helps prevent old hidden Plans pages from appearing as the main Hellowhen product in search results.

## 1. Confirm production SEO before submitting to Google

After deploying production, open these URLs in a private browser window:

- `https://www.hellowhen.com/`
- `https://www.hellowhen.com/trades`
- `https://www.hellowhen.com/needs`
- `https://www.hellowhen.com/offers`
- `https://www.hellowhen.com/sitemap.xml`
- `https://www.hellowhen.com/robots.txt`

Check that the public pages describe **Hellowhen Trade**, not the old Plans product.

Expected homepage positioning:

- Product name: `Hellowhen Trade`
- Main idea: `Exchange skills, services, needs, and offers without money`
- First-launch scope: `18+ beta`, `service-for-service`, `no wallet`, `no payouts`, `no real-money trades`

## 2. Confirm old Plans URLs are not public SEO targets

Plans are hidden for the first launch, so they should not be submitted to Google.

Check:

- `https://www.hellowhen.com/plans`
- `https://www.hellowhen.com/plans/example`

Expected behavior while Plans are hidden:

- redirect to `/trades`, or
- return a noindex response if a direct route still exists for admin/dev testing

Also confirm that `/plans` and `/plans/*` are not present in `sitemap.xml`.

## 3. Verify canonical domain behavior

Choose one canonical public domain:

```txt
https://www.hellowhen.com
```

Check that other host variants do not create duplicate indexable versions:

- `http://hellowhen.com`
- `http://www.hellowhen.com`
- `https://hellowhen.com`
- `https://www.hellowhen.com`

Expected result:

- all non-canonical variants redirect to the canonical production domain, or
- all public pages include canonical metadata pointing to the canonical domain

## 4. Set up Google Search Console

Use a Google account owned by Hellowhen, not a temporary personal-only account.

Recommended property type:

```txt
Domain property: hellowhen.com
```

This covers:

- `hellowhen.com`
- `www.hellowhen.com`
- `http` and `https` variants
- subdomains if added later

Verification method:

```txt
DNS TXT record
```

Keep the DNS verification record permanently. Do not remove it after verification.

Optional fallback:

```txt
URL-prefix property: https://www.hellowhen.com/
```

Use this only if DNS domain verification is blocked or delayed.

## 5. Submit sitemap

In Google Search Console:

1. Open the `hellowhen.com` property.
2. Go to **Sitemaps**.
3. Submit:

```txt
https://www.hellowhen.com/sitemap.xml
```

Expected sitemap contents for first launch:

- `/`
- `/trades`
- `/needs`
- `/offers`
- `/support`
- `/terms`
- `/privacy`
- `/community-guidelines`

Do not include:

- `/admin`
- `/account`
- `/auth`
- `/settings`
- `/wallet`
- `/credits`
- `/plans` while hidden
- private proposal or message URLs
- reset-password URLs

## 6. Request indexing for key pages

Use Search Console URL Inspection for these pages:

- `https://www.hellowhen.com/`
- `https://www.hellowhen.com/trades`
- `https://www.hellowhen.com/needs`
- `https://www.hellowhen.com/offers`
- `https://www.hellowhen.com/support`

For each page:

1. Inspect URL.
2. Confirm Google can fetch it.
3. Confirm it is indexable.
4. Request indexing.

Do not request indexing for hidden Plans, admin, account, auth, reset-password, or private app routes.

## 7. Check old Google result cleanup

Search Google for:

```txt
hellowhen
site:hellowhen.com hellowhen
site:hellowhen.com plans
site:hellowhen.com trade
```

Expected direction over time:

- official result title moves from old Plans wording to Hellowhen Trade wording
- `/trades` becomes visible as an important page
- old `/plans` links disappear or redirect to `/trades`
- private/admin/account pages do not appear

Google may take days or weeks to refresh titles and snippets after deployment.

## 8. Search result wording target

Preferred search title:

```txt
Hellowhen Trade — Exchange skills, services, needs, and offers
```

Preferred search description:

```txt
Hellowhen Trade helps adults exchange skills, services, small help, creative work, needs, and offers without money.
```

If Google shows a different snippet, check the visible homepage text first. Google may choose text from the page body instead of the meta description.

## 9. Monitor Search Console after launch

Check Search Console weekly during beta.

Important reports:

- **Performance**: queries, clicks, impressions, click-through rate
- **Pages / Indexing**: indexed pages, excluded pages, crawl issues
- **Sitemaps**: sitemap discovered URLs and errors
- **Removals**: only use for urgent temporary removals
- **Security & Manual Actions**: check for any warnings

Useful early queries to monitor:

- `hellowhen`
- `hellowhen trade`
- `skill exchange app`
- `service exchange platform`
- `needs and offers exchange`
- `freelancer skill exchange`

## 10. When posting in communities

Before sharing Hellowhen in Facebook groups, Reddit, or startup/freelancer communities, confirm:

- homepage is public and explains the beta clearly
- support page works
- privacy/terms/community-guidelines pages are reachable
- Plans wording is not visible as the main product
- Search Console has the sitemap submitted
- homepage and `/trades` have indexing requested

Recommended public wording:

```txt
Hellowhen Trade is an 18+ beta platform for exchanging skills, services, needs, and offers without money.
```

Avoid wording that suggests:

- payments
- wallet
- payouts
- teen accounts
- paid gigs
- dating/meetup-first positioning
- public Plans as the main product

## 11. If Google still shows old Plans text

Use this checklist:

1. Confirm production homepage metadata is updated.
2. Confirm visible homepage copy says Hellowhen Trade.
3. Confirm `/plans` redirects or returns noindex.
4. Confirm `/plans` is not in the sitemap.
5. Inspect `https://www.hellowhen.com/` in Search Console.
6. Request indexing for the homepage.
7. Wait and recheck after a few days.

Do not repeatedly change titles every day. Let Google recrawl stable copy.

## 12. Maintenance rule

Whenever public routes change, update:

- `sitemap.xml`
- `robots.txt`
- page metadata
- this checklist if launch behavior changes

Keep hidden or private product areas out of Google until they are ready for public launch.
