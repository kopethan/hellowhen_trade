# PLACE-ADDR2B — Invalid offline place cleanup

This script audits and optionally cleans up old offline Places/Plan stops that were saved before strict provider-selected address validation.

It is intentionally separate from migrations and API validation. Run it before `PLACE-ADDR3`, then again after web/native enforcement as a smoke check.

## Invalid offline rule

A `local` Place or PlanPlace is invalid when it is missing any of the provider-selected offline address fields:

- `googlePlaceId`
- `formattedAddress`
- `latitude`
- `longitude`
- `locationSource = google_places`
- `addressValidationStatus = confirmed`

Manual `addressPublicText` or starter prompt text is not enough.

## Commands

Audit only. This is the default safe mode and never writes to the database:

```bash
npm run places:address-audit
```

Dry-run the intended cleanup actions:

```bash
npm run places:address-cleanup -- --dry-run --convert-online-when-url --archive-places --mark-plan-stops-unsupported
```

Apply the safe cleanup actions:

```bash
npm run places:address-cleanup -- --apply --convert-online-when-url --archive-places --mark-plan-stops-unsupported
```

Optional JSON report:

```bash
npm run places:address-cleanup -- --dry-run --json
```

Optional limit for review:

```bash
npm run places:address-cleanup -- --dry-run --limit 50
```

## Cleanup actions

`--convert-online-when-url`

: Converts invalid `local` rows to `remote` only when they already have a usable `http://` or `https://` `onlineUrl`. The script clears map/static-map fields so the row is no longer treated as an offline map/address candidate.

`--archive-places`

: Archives invalid reusable `Place` rows that cannot be fixed automatically. This does not delete the row, so owners can still be guided to recreate or edit it later.

`--mark-plan-stops-unsupported`

: Marks invalid `PlanPlace` rows with `addressValidationStatus = unsupported` and clears static-map fields. It does not delete plan stops, because deleting stops can damage existing plans.

`--delete-test-only`

: Dangerous cleanup for obvious smoke/test/demo/seed reusable `Place` rows only. It does not delete `PlanPlace` rows. Use it only with `--apply` after reviewing the dry-run sample.

## Safety behavior

- Dry-run is the default.
- Mutations require `--apply` plus at least one explicit action flag.
- Real user `PlanPlace` rows are never deleted by this script.
- Existing invalid rows remain readable until later UI/API patches require users to select a provider address before saving them as offline places again.


## Post-cleanup smoke

After the cleanup dry-run/apply step, run the address policy smoke command:

```bash
npm run places:address-provider-smoke
```

For staging with real Google provider checks enabled:

```bash
EXPECT_PLANS_ENABLED=true \
EXPECT_GOOGLE_PLACES_ENABLED=true \
GOOGLE_PLACE_SMOKE_QUERY="Eiffel Tower" \
GOOGLE_PLACE_SMOKE_COUNTRY=FR \
npm run places:address-provider-smoke
```

On Windows PowerShell, set the environment variables first:

```powershell
$env:EXPECT_PLANS_ENABLED="true"
$env:EXPECT_GOOGLE_PLACES_ENABLED="true"
$env:GOOGLE_PLACE_SMOKE_QUERY="Eiffel Tower"
$env:GOOGLE_PLACE_SMOKE_COUNTRY="FR"
npm run places:address-provider-smoke
```

The smoke verifies that invalid manual offline creates remain blocked while online destinations and provider-backed offline destinations continue to work.
