# Media S3 migration

`MEDIA-S3-MIGRATE1` adds a safe utility for moving existing local upload records to S3/CloudFront after the S3 storage provider has been configured.

The migration is intentionally non-destructive:

- Dry-run is the default.
- `--apply` is required before any S3 upload or database update happens.
- Local files are not deleted.
- Removed media is skipped by default.
- Each `MediaAsset` row is updated only if its URL, storage key, and status have not changed since the script read it.
- Existing clients keep working because the script updates `MediaAsset.url` to the public CDN URL.

## Required backend environment

```env
AWS_REGION=eu-west-3
MEDIA_S3_BUCKET=hellowhen-media-prod
MEDIA_S3_PREFIX=uploads
MEDIA_PUBLIC_BASE_URL=https://your-cloudfront-domain.cloudfront.net
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

Do not put AWS credentials in `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*` variables.

`MEDIA_STORAGE_DRIVER=s3` is recommended for new uploads, but the migration script can inspect local files even before you switch the default upload driver.

## Dry-run first

```powershell
npm run media:s3-migrate
```

Optional smaller dry-run:

```powershell
npm run media:s3-migrate -- --limit=25 --batch-size=25
```

## Apply migration

```powershell
npm run media:s3-migrate -- --apply
```

Optional status-scoped migration:

```powershell
npm run media:s3-migrate -- --apply --status=active
```

## After migration

Keep the local uploads directory until you have verified production image rendering from CloudFront. Deleting old local files should happen only in a later cleanup process.


## S3 cleanup after user deletion

`MEDIA-S3-CLEANUP1` adds best-effort object cleanup for explicit user media deletion paths.

When a user deletes an uploaded media item, the API keeps the database row as `removed` for audit/history but deletes the matching S3 objects when the media URL belongs to `MEDIA_PUBLIC_BASE_URL`. This includes generated variant objects such as `thumb`, `card`, and `full`.

Local development files are not deleted by this cleanup path. Admin moderation status changes remain reversible and should not be treated as local disk cleanup.

Smoke check:

```powershell
npm run media:s3-cleanup-smoke
```
