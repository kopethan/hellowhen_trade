import type { ModerationContentType, ModerationContentVisibility, ModerationProviderPayload, ModerationScanType } from '@hellowhen/contracts';
import { moderationProviderPayloadSchema } from '@hellowhen/contracts';

type BuildModerationPayloadInput = {
  contentId: string;
  contentType: ModerationContentType;
  visibility: ModerationContentVisibility;
  scanType: ModerationScanType;
  title?: string | null;
  description?: string | null;
  message?: string | null;
  locale?: 'en' | 'fr' | 'es';
  temporaryImageUrl?: string | null;
  mediaId?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  country?: string | null;
  appArea?: string | null;
  relatedTradeId?: string | null;
  relatedReportId?: string | null;
};

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function buildMinimalModerationPayload(input: BuildModerationPayloadInput): ModerationProviderPayload {
  const text = input.title || input.description || input.message ? {
    title: clean(input.title),
    description: clean(input.description),
    message: clean(input.message),
    locale: input.locale,
  } : undefined;

  const image = input.temporaryImageUrl || input.mediaId || input.mimeType || input.sizeBytes != null ? {
    temporaryUrl: clean(input.temporaryImageUrl),
    mediaId: clean(input.mediaId),
    mimeType: clean(input.mimeType),
    sizeBytes: input.sizeBytes ?? undefined,
  } : undefined;

  const context = input.country || input.appArea || input.relatedTradeId || input.relatedReportId ? {
    country: clean(input.country),
    appArea: clean(input.appArea),
    relatedTradeId: clean(input.relatedTradeId),
    relatedReportId: clean(input.relatedReportId),
  } : undefined;

  return moderationProviderPayloadSchema.parse({
    contentId: input.contentId,
    contentType: input.contentType,
    visibility: input.visibility,
    scanType: input.scanType,
    text,
    image,
    context,
  });
}
