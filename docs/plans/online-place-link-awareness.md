# Online Place link awareness

Online Places are intentionally separate from Google address search. They do not need Google Places or Address Validation data, but they must still use safe, valid links.

## Current behavior

Reusable Places and Plan stops with `mode = remote` must include a valid `http://` or `https://` `onlineUrl`.

The shared helper in `packages/shared/src/onlinePlaceLinks.ts` centralizes:

- URL normalization
- protocol validation
- provider detection by hostname
- provider display labels

Known provider labels:

```txt
Zoom
Google Meet
Microsoft Teams
Discord
Eventbrite
YouTube
Website
Generic link
```

Backend create/update paths use the same helper before saving Online Place links, so web, native, and API behavior can stay aligned.

Web and native Create Place / Create Plan flows show the same hostname-only provider label next to Online URL inputs. The label is informational only; it does not mean the app opened or verified the remote page.

## Provider detection rules

Provider detection is hostname-only. It does not fetch the remote page.

Examples:

```txt
https://meet.google.com/...      -> Google Meet
https://teams.microsoft.com/...  -> Microsoft Teams
https://discord.gg/...           -> Discord
https://youtu.be/...             -> YouTube
https://example.com/...          -> Website
```

The API may return computed `onlineProvider` metadata for online Places/Plan stops. This metadata is not stored in the database and can be recomputed from `onlineUrl`.

## Safety rules

Do not add remote preview fetching in the basic online-link flow.

Avoid these until a dedicated safe preview design exists:

```txt
server-side URL fetching
Open Graph scraping
HTML parsing
image proxying
redirect following
favicon fetching
```

Those features can create SSRF and abuse risks if they are added without allowlists, timeouts, response size limits, redirect limits, DNS/IP protections, caching rules, and moderation.

For now, the app should show clean provider labels and let the user open the link directly.

## Future safe preview implementation

A later preview system should be planned separately and should include:

- explicit feature flag
- HTTP/HTTPS only
- DNS rebinding protection
- private/internal IP blocking
- redirect limit
- short timeout
- small response byte limit
- content-type checks
- no credential forwarding
- cache with moderation/remove path
- admin/provider blocklist

Until that exists, Online Places should remain link-aware, not preview-fetching.
