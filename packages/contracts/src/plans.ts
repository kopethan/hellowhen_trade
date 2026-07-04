import { z } from "zod";
import { mediaAssetSchema } from "./media.js";
import {
  discoveryLanguageSchema,
  inventoryDisplayLanguageSchema,
  inventoryTranslationSchema,
  tradeExchangeModeSchema,
} from "./trade.js";

export const planStatusSchema = z.enum([
  "draft",
  "open",
  "full",
  "started",
  "completed",
  "cancelled",
  "expired",
  "hidden",
]);
export const planPublicStatusSchema = z.enum([
  "open",
  "full",
  "started",
  "cancelled",
]);
export const planJoinApprovalModeSchema = z.enum([
  "owner_approval",
  "automatic",
]);
export const planParticipantStatusSchema = z.enum([
  "pending",
  "accepted",
  "declined",
  "cancelled",
  "left",
  "removed",
]);
export const planPlaceModeSchema = z.enum(["local", "remote"]);
export const placeSourceSchema = z.enum(["user", "hellowhen_library"]);
export const placeStatusSchema = z.enum([
  "draft",
  "active",
  "archived",
  "hidden",
]);
export const placeVisibilitySchema = z.enum(["private", "public", "library"]);
export const planPlaceSourceSchema = z.enum([
  "custom",
  "my_place",
  "hellowhen_library",
]);

export const placeLocationSourceSchema = z.enum(["manual", "google_places"]);
export const placeAddressValidationStatusSchema = z.enum([
  "confirmed",
  "needs_review",
  "unsupported",
]);
export const placePresenceVerificationSourceSchema = z.enum(["device_gps"]);
export const placePresenceVerificationStatusSchema = z.enum([
  "verified",
  "rejected",
]);
export const PLACE_STATIC_MAP_TEMPLATE_FAMILIES = [
  "clean_local",
  "night_social",
  "soft_pastel",
  "minimal_address",
  "city_grid",
  "green_outdoor",
  "warm_travel",
  "premium_mono",
] as const;
export const placeStaticMapTemplateFamilySchema = z.enum(
  PLACE_STATIC_MAP_TEMPLATE_FAMILIES,
);
export const placeStaticMapSourceSchema = z.enum(["coordinates", "address"]);
export const placeStaticMapSurfaceSchema = z.enum(["detail", "list", "preview"]);
export const placeStaticMapUnavailableReasonSchema = z.enum([
  "disabled",
  "anonymous_blocked",
  "soft_limit",
  "hard_limit",
  "unavailable",
]);
export const placeStaticMapStatusSchema = z
  .object({
    state: z.enum(["available", "unavailable"]),
    reason: placeStaticMapUnavailableReasonSchema.optional(),
    surface: placeStaticMapSurfaceSchema.optional(),
    message: z.string().optional(),
  })
  .passthrough();
export const placeStaticMapSchema = z
  .object({
    provider: z.literal("google_static_maps"),
    templateFamily: placeStaticMapTemplateFamilySchema,
    source: placeStaticMapSourceSchema,
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    scale: z.number().int().min(1).max(4),
    zoom: z.number().int().min(1).max(22),
    lightUrl: z.string().url(),
    darkUrl: z.string().url(),
  })
  .passthrough();

export const googlePlaceValidationStatusSchema = z.enum([
  "confirmed",
  "needs_review",
  "unsupported",
]);
export const googlePlaceAddressComponentSchema = z
  .object({
    longText: z.string().nullable().optional(),
    shortText: z.string().nullable().optional(),
    types: z.array(z.string()).optional(),
    languageCode: z.string().nullable().optional(),
  })
  .passthrough();
export const googlePlaceViewportSchema = z
  .object({
    low: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
    high: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
  })
  .passthrough();
export const googlePlacePredictionSchema = z.object({
  placeId: z.string(),
  description: z.string(),
  mainText: z.string(),
  secondaryText: z.string().nullable().optional(),
  types: z.array(z.string()).optional(),
});
export const googleResolvedPlaceSchema = z
  .object({
    source: z.literal("google_places"),
    placeId: z.string(),
    name: z.string().nullable().optional(),
    formattedAddress: z.string().nullable().optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    googleMapsUri: z.string().nullable().optional(),
    types: z.array(z.string()).optional(),
    addressComponents: z.array(googlePlaceAddressComponentSchema).optional(),
    viewport: googlePlaceViewportSchema.nullable().optional(),
    validationStatus: googlePlaceValidationStatusSchema,
  })
  .passthrough();
export const GOOGLE_PLACE_SEARCH_MIN_QUERY_LENGTH = 3;

export const googlePlaceSearchQuerySchema = z.object({
  q: z.string().trim().min(GOOGLE_PLACE_SEARCH_MIN_QUERY_LENGTH).max(160),
  languageCode: z.string().trim().min(2).max(12).optional(),
  sessionToken: z.string().trim().min(8).max(120).optional(),
  country: z.string().trim().min(2).max(2).optional(),
  take: z.coerce.number().int().min(1).max(8).optional(),
});
export const googlePlaceDetailsQuerySchema = z.object({
  placeId: z.string().trim().min(3).max(240),
  languageCode: z.string().trim().min(2).max(12).optional(),
  sessionToken: z.string().trim().min(8).max(120).optional(),
});
export const googleAddressValidationRequestSchema = z.object({
  address: z.string().trim().min(3).max(300),
  regionCode: z.string().trim().min(2).max(2).optional(),
  languageCode: z.string().trim().min(2).max(12).optional(),
});
export const googlePlaceSearchResponseSchema = z.object({
  predictions: z.array(googlePlacePredictionSchema),
});
export const googlePlaceDetailsResponseSchema = z.object({
  place: googleResolvedPlaceSchema,
});
export const googleAddressValidationResponseSchema = z.object({
  place: googleResolvedPlaceSchema.nullable(),
  validationStatus: googlePlaceValidationStatusSchema,
});

const confirmedGooglePlaceAddressInputShape = {
  googlePlaceId: z.string().trim().min(3).max(240),
  googlePlaceName: z.string().trim().min(1).max(160).optional(),
  formattedAddress: z.string().trim().min(1).max(300),
  googleMapsUri: z.string().trim().url().max(500).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  locationSource: z.literal("google_places"),
  addressValidationStatus: z.literal("confirmed"),
} as const;

export const confirmedGooglePlaceAddressInputSchema = z
  .object(confirmedGooglePlaceAddressInputShape)
  .passthrough();
export const offlinePlaceProviderAddressInputSchema = z
  .object({
    mode: z.literal("local").optional(),
    ...confirmedGooglePlaceAddressInputShape,
  })
  .passthrough();
export const onlinePlaceDestinationInputSchema = z
  .object({
    onlineLabel: z.string().trim().min(1).max(120).optional(),
    onlineUrl: z.string().trim().url().max(500),
  })
  .passthrough();
export const remotePlaceDestinationInputSchema = z
  .object({
    mode: z.literal("remote"),
    onlineLabel: z.string().trim().min(1).max(120).optional(),
    onlineUrl: z.string().trim().url().max(500),
  })
  .passthrough();

export const PLAN_PLACE_MEDIA_LIMITS = {
  free: 1,
  plus: 5,
  adminLibrary: 6,
} as const;

export const planOwnerParticipantActionSchema = z.enum([
  "accepted",
  "declined",
  "removed",
]);
export const planSelfParticipantActionSchema = z.enum(["cancelled", "left"]);

const planTagSchema = z
  .array(z.string().trim().min(1).max(32))
  .max(8)
  .optional();
const placeTagSchema = z
  .array(z.string().trim().min(1).max(32))
  .max(8)
  .optional();
const placeMediaIdsSchema = z
  .array(z.string())
  .max(PLAN_PLACE_MEDIA_LIMITS.adminLibrary)
  .optional();
const placeTranslationInputSchema = z.object({
  languageCode: discoveryLanguageSchema,
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(1).max(2000),
});
const placeTranslationsInputSchema = z
  .array(placeTranslationInputSchema)
  .max(4)
  .optional();
const planPlaceMediaIdsSchema = z
  .array(z.string())
  .max(PLAN_PLACE_MEDIA_LIMITS.plus)
  .optional();

const reusablePlaceInputBaseSchema = z.object({
  mode: planPlaceModeSchema.optional(),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(1).max(2000).optional(),
  defaultLanguage: discoveryLanguageSchema.optional(),
  translations: placeTranslationsInputSchema,
  category: z.string().trim().min(1).max(80).optional(),
  tags: placeTagSchema,
  areaLabel: z.string().trim().min(1).max(160).optional(),
  addressPublicText: z.string().trim().min(1).max(240).optional(),
  addressPrivateText: z.string().trim().min(1).max(240).optional(),
  googlePlaceId: z.string().trim().min(3).max(240).optional(),
  googlePlaceName: z.string().trim().min(1).max(160).optional(),
  formattedAddress: z.string().trim().min(1).max(300).optional(),
  googleMapsUri: z.string().trim().url().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  locationSource: placeLocationSourceSchema.optional(),
  addressValidationStatus: placeAddressValidationStatusSchema.optional(),
  staticMapTemplateFamily: placeStaticMapTemplateFamilySchema
    .nullable()
    .optional(),
  onlineLabel: z.string().trim().min(1).max(120).optional(),
  onlineUrl: z.string().trim().url().max(500).optional(),
  defaultDurationMinutes: z
    .number()
    .int()
    .min(5)
    .max(24 * 60)
    .optional(),
  defaultNote: z.string().trim().min(1).max(1000).optional(),
  defaultMeetingInstructions: z.string().trim().min(1).max(1000).optional(),
  mediaIds: placeMediaIdsSchema,
});

export const createPlaceRequestSchema = reusablePlaceInputBaseSchema.extend({
  source: placeSourceSchema.optional(),
  visibility: placeVisibilitySchema.optional(),
  status: z.enum(["draft", "active"]).optional(),
});

export const updatePlaceRequestSchema = reusablePlaceInputBaseSchema
  .partial()
  .extend({
    status: z.enum(["draft", "active", "archived"]).optional(),
    visibility: placeVisibilitySchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Update at least one place field.",
  });

export const listPlacesQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  source: placeSourceSchema.optional(),
  status: placeStatusSchema.optional(),
  mode: planPlaceModeSchema.optional(),
  category: z.string().trim().min(1).max(80).optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
});

const planPlaceInputBaseSchema = z.object({
  placeId: z.string().trim().min(1).max(120).optional(),
  mode: planPlaceModeSchema.optional(),
  title: z.string().trim().min(3).max(120).optional(),
  note: z.string().trim().min(1).max(1000).optional(),
  addressPublicText: z.string().trim().min(1).max(240).optional(),
  addressPrivateText: z.string().trim().min(1).max(240).optional(),
  googlePlaceId: z.string().trim().min(3).max(240).optional(),
  googlePlaceName: z.string().trim().min(1).max(160).optional(),
  formattedAddress: z.string().trim().min(1).max(300).optional(),
  googleMapsUri: z.string().trim().url().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  locationSource: placeLocationSourceSchema.optional(),
  addressValidationStatus: placeAddressValidationStatusSchema.optional(),
  onlineLabel: z.string().trim().min(1).max(120).optional(),
  onlineUrl: z.string().trim().url().max(500).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  order: z.number().int().min(0).max(50).optional(),
  mediaIds: planPlaceMediaIdsSchema,
});

function hasPlaceIdOrTitle(value: { placeId?: string; title?: string }) {
  return Boolean(value.placeId || value.title);
}

export const planPlaceInputSchema = planPlaceInputBaseSchema
  .refine(hasPlaceIdOrTitle, {
    message: "Choose a saved place or enter a place title.",
    path: ["title"],
  })
  .refine(
    (value) => {
      if (!value.startsAt || !value.endsAt) return true;
      return (
        new Date(value.endsAt).getTime() >= new Date(value.startsAt).getTime()
      );
    },
    {
      message: "Place end time must be after the start time.",
      path: ["endsAt"],
    },
  );

export const createPlanRequestSchema = z
  .object({
    title: z.string().trim().min(3).max(120).optional(),
    description: z.string().trim().min(10).max(2000).optional(),
    category: z.string().trim().min(1).max(80).optional(),
    tags: planTagSchema,
    mode: tradeExchangeModeSchema.optional(),
    locationLabel: z.string().trim().min(1).max(160).optional(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().optional(),
    maxParticipants: z.number().int().min(1).max(100).optional(),
    joinApprovalMode: planJoinApprovalModeSchema
      .optional()
      .default("automatic"),
    status: z.enum(["draft", "open"]).optional().default("open"),
    mediaIds: z.array(z.string()).max(5).optional(),
    places: z.array(planPlaceInputSchema).max(12).optional(),
  })
  .refine(
    (value) => {
      if (!value.endsAt) return true;
      return (
        new Date(value.endsAt).getTime() >= new Date(value.startsAt).getTime()
      );
    },
    {
      message: "Plan end time must be after the start time.",
      path: ["endsAt"],
    },
  );

export const updatePlanRequestSchema = z
  .object({
    title: z.string().trim().min(3).max(120).optional(),
    description: z.string().trim().min(10).max(2000).optional(),
    category: z.string().trim().min(1).max(80).nullable().optional(),
    tags: planTagSchema,
    mode: tradeExchangeModeSchema.nullable().optional(),
    locationLabel: z.string().trim().min(1).max(160).nullable().optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().nullable().optional(),
    maxParticipants: z.number().int().min(1).max(100).nullable().optional(),
    joinApprovalMode: planJoinApprovalModeSchema.optional(),
    status: z.enum(["draft", "open", "cancelled"]).optional(),
    mediaIds: z.array(z.string()).max(5).optional(),
  })
  .refine(
    (value) => {
      if (
        !value.startsAt ||
        value.endsAt === undefined ||
        value.endsAt === null
      )
        return true;
      return (
        new Date(value.endsAt).getTime() >= new Date(value.startsAt).getTime()
      );
    },
    {
      message: "Plan end time must be after the start time.",
      path: ["endsAt"],
    },
  );

export const createPlanPlaceRequestSchema = planPlaceInputSchema;
export const updatePlanPlaceRequestSchema = planPlaceInputBaseSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Update at least one place field.",
  })
  .refine(
    (value) => {
      if (value.placeId === undefined && value.title === undefined) return true;
      return hasPlaceIdOrTitle(value);
    },
    {
      message: "Choose a saved place or enter a place title.",
      path: ["title"],
    },
  )
  .refine(
    (value) => {
      if (!value.startsAt || !value.endsAt) return true;
      return (
        new Date(value.endsAt).getTime() >= new Date(value.startsAt).getTime()
      );
    },
    {
      message: "Place end time must be after the start time.",
      path: ["endsAt"],
    },
  );

export const listPlansQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  mode: tradeExchangeModeSchema.optional(),
  status: planPublicStatusSchema.optional(),
  city: z.string().trim().min(1).max(120).optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
});

export const adminPlanStatusFilterSchema = z
  .union([z.literal("all"), planStatusSchema])
  .optional()
  .default("all");
export const adminListPlansQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  status: adminPlanStatusFilterSchema,
  mode: tradeExchangeModeSchema.optional(),
  ownerId: z.string().trim().min(1).max(120).optional(),
  take: z.coerce.number().int().min(1).max(100).optional().default(100),
});
export const adminPlanActionSchema = z.enum([
  "hide",
  "restore",
  "cancel",
  "mark_reviewed",
]);
export const adminPlanActionRequestSchema = z.object({
  action: adminPlanActionSchema,
  note: z.string().trim().min(3).max(1200).optional(),
});
export const adminListPlanPublicMessagesQuerySchema = z.object({
  status: z
    .enum(["all", "visible", "hidden", "deleted"])
    .optional()
    .default("all"),
  take: z.coerce.number().int().min(1).max(200).optional().default(100),
});
export const adminPlanPublicMessageActionSchema = z.enum([
  "hide",
  "restore",
  "mark_reviewed",
]);
export const adminPlanPublicMessageActionRequestSchema = z.object({
  action: adminPlanPublicMessageActionSchema,
  note: z.string().trim().min(3).max(1200).optional(),
});

export const adminPlaceStatusFilterSchema = z
  .union([z.literal("all"), placeStatusSchema])
  .optional()
  .default("all");
export const adminPlaceSourceFilterSchema = z
  .union([z.literal("all"), placeSourceSchema])
  .optional()
  .default("all");
export const adminPlaceVisibilityFilterSchema = z
  .union([z.literal("all"), placeVisibilitySchema])
  .optional()
  .default("all");
export const adminListPlacesQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  status: adminPlaceStatusFilterSchema,
  source: adminPlaceSourceFilterSchema,
  visibility: adminPlaceVisibilityFilterSchema,
  mode: planPlaceModeSchema.optional(),
  ownerId: z.string().trim().min(1).max(120).optional(),
  take: z.coerce.number().int().min(1).max(100).optional().default(100),
});
export const adminPlaceActionSchema = z.enum([
  "hide",
  "restore",
  "remove_media",
  "mark_reviewed",
]);
export const adminPlaceActionRequestSchema = z.object({
  action: adminPlaceActionSchema,
  mediaId: z.string().trim().min(1).max(120).optional(),
  note: z.string().trim().min(3).max(1200).optional(),
});

export const createPlanJoinRequestSchema = z.object({
  message: z.string().trim().min(3).max(1000).optional(),
});

export const updatePlanParticipantRequestSchema = z.object({
  status: planOwnerParticipantActionSchema,
});

export const updateMyPlanParticipantRequestSchema = z.object({
  status: planSelfParticipantActionSchema,
});

export const createPlanPublicMessageRequestSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});
export const updatePlanPublicMessageRequestSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});
export const listPlanPublicMessagesQuerySchema = z.object({
  take: z.coerce.number().int().min(1).max(100).optional().default(50),
  before: z.string().datetime().optional(),
});

export const createPlacePresenceVerificationRequestSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().positive().max(10_000).optional(),
  locationCapturedAt: z.string().datetime().optional(),
  isMockedLocation: z.boolean().optional(),
  platform: z
    .enum(["web", "mobile_web", "ios", "android", "unknown"])
    .optional(),
});

export const placePresenceVerificationListStatusFilterSchema = z
  .enum(["all", "verified", "rejected"])
  .optional()
  .default("all");

export const listMyPlacePresenceVerificationsQuerySchema = z.object({
  status: placePresenceVerificationListStatusFilterSchema,
  take: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export const adminListPlacePresenceVerificationsQuerySchema = z.object({
  status: placePresenceVerificationListStatusFilterSchema,
  userId: z.string().trim().min(1).max(120).optional(),
  planId: z.string().trim().min(1).max(120).optional(),
  planPlaceId: z.string().trim().min(1).max(120).optional(),
  rejectionReason: z.string().trim().min(1).max(120).optional(),
  take: z.coerce.number().int().min(1).max(200).optional().default(100),
});

export const adminPlacePresenceVerificationActionSchema = z.enum([
  "mark_reviewed",
]);
export const adminPlacePresenceVerificationActionRequestSchema = z.object({
  action: adminPlacePresenceVerificationActionSchema,
  note: z.string().trim().min(3).max(1200).optional(),
});

const publicUserSummarySchema = z
  .object({
    id: z.string(),
    profile: z
      .object({
        displayName: z.string().nullable().optional(),
        handle: z.string().nullable().optional(),
        avatarUrl: z.string().nullable().optional(),
        countryCode: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

export const placeSchema = z
  .object({
    id: z.string(),
    ownerId: z.string().nullable().optional(),
    source: placeSourceSchema,
    status: placeStatusSchema,
    visibility: placeVisibilitySchema,
    mode: planPlaceModeSchema.default("local"),
    title: z.string(),
    description: z.string().nullable().optional(),
    defaultLanguage: discoveryLanguageSchema.optional().default("en"),
    translations: z.array(inventoryTranslationSchema).optional(),
    category: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    areaLabel: z.string().nullable().optional(),
    addressPublicText: z.string().nullable().optional(),
    addressPrivateText: z.string().nullable().optional(),
    googlePlaceId: z.string().nullable().optional(),
    googlePlaceName: z.string().nullable().optional(),
    formattedAddress: z.string().nullable().optional(),
    googleMapsUri: z.string().nullable().optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    locationSource: placeLocationSourceSchema.nullable().optional(),
    addressValidationStatus: placeAddressValidationStatusSchema
      .nullable()
      .optional(),
    onlineLabel: z.string().nullable().optional(),
    onlineUrl: z.string().nullable().optional(),
    defaultDurationMinutes: z.number().int().nullable().optional(),
    defaultNote: z.string().nullable().optional(),
    defaultMeetingInstructions: z.string().nullable().optional(),
    staticMapTemplateFamily: placeStaticMapTemplateFamilySchema
      .nullable()
      .optional(),
    staticMapTemplateSeed: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    archivedAt: z.string().nullable().optional(),
    usedInPlansCount: z.number().int().nonnegative().optional(),
    owner: publicUserSummarySchema.nullable().optional(),
    media: z.array(mediaAssetSchema).optional(),
    staticMap: placeStaticMapSchema.nullable().optional(),
    staticMapStatus: placeStaticMapStatusSchema.optional(),
    displayLanguage: inventoryDisplayLanguageSchema.optional(),
  })
  .passthrough();

export const planPlaceSchema = z
  .object({
    id: z.string(),
    planId: z.string(),
    placeId: z.string().nullable().optional(),
    source: planPlaceSourceSchema.optional(),
    order: z.number().int(),
    mode: planPlaceModeSchema.default("local"),
    title: z.string(),
    note: z.string().nullable().optional(),
    addressPublicText: z.string().nullable().optional(),
    addressPrivateText: z.string().nullable().optional(),
    googlePlaceId: z.string().nullable().optional(),
    googlePlaceName: z.string().nullable().optional(),
    formattedAddress: z.string().nullable().optional(),
    googleMapsUri: z.string().nullable().optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    locationSource: placeLocationSourceSchema.nullable().optional(),
    addressValidationStatus: placeAddressValidationStatusSchema
      .nullable()
      .optional(),
    onlineLabel: z.string().nullable().optional(),
    onlineUrl: z.string().nullable().optional(),
    staticMapTemplateFamily: placeStaticMapTemplateFamilySchema
      .nullable()
      .optional(),
    staticMapTemplateSeed: z.string().nullable().optional(),
    startsAt: z.string().nullable().optional(),
    endsAt: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    sourcePlace: placeSchema.nullable().optional(),
    media: z.array(mediaAssetSchema).optional(),
    staticMap: placeStaticMapSchema.nullable().optional(),
    staticMapStatus: placeStaticMapStatusSchema.optional(),
    displayLanguage: inventoryDisplayLanguageSchema.optional(),
  })
  .passthrough();

export const planParticipantSchema = z
  .object({
    id: z.string(),
    planId: z.string(),
    userId: z.string(),
    message: z.string().nullable().optional(),
    status: planParticipantStatusSchema,
    decidedAt: z.string().nullable().optional(),
    decidedById: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    user: publicUserSummarySchema.nullable().optional(),
  })
  .passthrough();

export const planPublicMessageStatusSchema = z.enum([
  "visible",
  "hidden",
  "deleted",
]);
export const planPublicMessageSchema = z
  .object({
    id: z.string(),
    planId: z.string(),
    authorId: z.string(),
    body: z.string(),
    status: planPublicMessageStatusSchema.optional().default("visible"),
    createdAt: z.string(),
    updatedAt: z.string().optional(),
    editedAt: z.string().nullable().optional(),
    editCount: z.number().int().optional().default(0),
    deletedAt: z.string().nullable().optional(),
    hiddenAt: z.string().nullable().optional(),
    author: publicUserSummarySchema.optional(),
  })
  .passthrough();

export const placePresenceVerificationSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    planId: z.string(),
    planPlaceId: z.string(),
    sourcePlaceId: z.string().nullable().optional(),
    source: placePresenceVerificationSourceSchema,
    status: placePresenceVerificationStatusSchema,
    latitudeRounded: z.number().nullable().optional(),
    longitudeRounded: z.number().nullable().optional(),
    accuracyMeters: z.number().nullable().optional(),
    distanceMeters: z.number().nullable().optional(),
    maxDistanceMeters: z.number().nullable().optional(),
    rejectionReason: z.string().nullable().optional(),
    verifiedAt: z.string().nullable().optional(),
    createdAt: z.string(),
  })
  .passthrough();

export const placePresenceVerificationResponseSchema = z.object({
  verification: placePresenceVerificationSchema,
  accepted: z.boolean(),
  alreadyVerified: z.boolean().optional(),
  distanceMeters: z.number().nullable().optional(),
  maxDistanceMeters: z.number().optional(),
});

const placePresenceVerificationHistoryPlanSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    status: planStatusSchema,
    startsAt: z.string().nullable().optional(),
  })
  .passthrough();

const placePresenceVerificationHistoryPlaceSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    mode: planPlaceModeSchema.default("local"),
    addressPublicText: z.string().nullable().optional(),
    formattedAddress: z.string().nullable().optional(),
    onlineLabel: z.string().nullable().optional(),
  })
  .passthrough();

export const placePresenceVerificationHistoryItemSchema =
  placePresenceVerificationSchema
    .omit({
      latitudeRounded: true,
      longitudeRounded: true,
      accuracyMeters: true,
    })
    .extend({
      plan: placePresenceVerificationHistoryPlanSchema.nullable().optional(),
      planPlace: placePresenceVerificationHistoryPlaceSchema
        .nullable()
        .optional(),
    });

export const placePresenceVerificationHistoryResponseSchema = z.object({
  verifications: z.array(placePresenceVerificationHistoryItemSchema),
});

export const adminPlacePresenceVerificationSchema =
  placePresenceVerificationSchema
    .extend({
      user: publicUserSummarySchema.nullable().optional(),
      plan: placePresenceVerificationHistoryPlanSchema
        .extend({ owner: publicUserSummarySchema.nullable().optional() })
        .nullable()
        .optional(),
      planPlace: placePresenceVerificationHistoryPlaceSchema
        .nullable()
        .optional(),
      sourcePlace: placeSchema.nullable().optional(),
    })
    .passthrough();

export const adminPlacePresenceVerificationsResponseSchema = z.object({
  verifications: z.array(adminPlacePresenceVerificationSchema),
});

export const adminPlacePresenceVerificationResponseSchema = z.object({
  verification: adminPlacePresenceVerificationSchema,
});

export const placePresenceVerificationSummaryResponseSchema = z.object({
  summary: z.object({
    verifiedPlacesCount: z.number().int().nonnegative(),
    verifiedPlansCount: z.number().int().nonnegative(),
    totalVerifiedCheckIns: z.number().int().nonnegative(),
    lastVerifiedAt: z.string().nullable().optional(),
  }),
});

export const planPublicMessagesResponseSchema = z.object({
  messages: z.array(planPublicMessageSchema),
});
export const planPublicMessageResponseSchema = z.object({
  message: planPublicMessageSchema,
});

export const planSchema = z
  .object({
    id: z.string(),
    ownerId: z.string(),
    title: z.string(),
    description: z.string(),
    category: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    mode: tradeExchangeModeSchema.nullable().optional(),
    locationLabel: z.string().nullable().optional(),
    startsAt: z.string(),
    endsAt: z.string().nullable().optional(),
    maxParticipants: z.number().int().nullable().optional(),
    joinApprovalMode: planJoinApprovalModeSchema,
    status: planStatusSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
    cancelledAt: z.string().nullable().optional(),
    owner: publicUserSummarySchema.nullable().optional(),
    places: z.array(planPlaceSchema).optional(),
    media: z.array(mediaAssetSchema).optional(),
    participants: z.array(planParticipantSchema).optional(),
    participantCount: z.number().int().optional(),
    pendingRequestCount: z.number().int().optional(),
    myParticipantStatus: planParticipantStatusSchema.nullable().optional(),
    canSeePrivatePlaceDetails: z.boolean().optional(),
  })
  .passthrough();

export const placesResponseSchema = z.object({ places: z.array(placeSchema) });
export const placeResponseSchema = z.object({ place: placeSchema });
export const plansResponseSchema = z.object({ plans: z.array(planSchema) });
export const planResponseSchema = z.object({ plan: planSchema });
export const planParticipantResponseSchema = z.object({
  participant: planParticipantSchema,
});
export const planParticipantsResponseSchema = z.object({
  participants: z.array(planParticipantSchema),
});

export type PlanStatus = z.infer<typeof planStatusSchema>;
export type PlanJoinApprovalMode = z.infer<typeof planJoinApprovalModeSchema>;
export type PlanParticipantStatus = z.infer<typeof planParticipantStatusSchema>;
export type PlanPlaceMode = z.infer<typeof planPlaceModeSchema>;
export type PlaceSource = z.infer<typeof placeSourceSchema>;
export type PlaceStatus = z.infer<typeof placeStatusSchema>;
export type PlaceVisibility = z.infer<typeof placeVisibilitySchema>;
export type PlanPlaceSource = z.infer<typeof planPlaceSourceSchema>;
export type PlaceLocationSource = z.infer<typeof placeLocationSourceSchema>;
export type PlaceAddressValidationStatus = z.infer<
  typeof placeAddressValidationStatusSchema
>;
export type PlacePresenceVerificationSource = z.infer<
  typeof placePresenceVerificationSourceSchema
>;
export type PlacePresenceVerificationStatus = z.infer<
  typeof placePresenceVerificationStatusSchema
>;
export type PlaceStaticMapTemplateFamily = z.infer<
  typeof placeStaticMapTemplateFamilySchema
>;
export type PlaceStaticMapSource = z.infer<typeof placeStaticMapSourceSchema>;
export type PlaceStaticMapDto = z.infer<typeof placeStaticMapSchema>;
export type PlaceStaticMapSurface = z.infer<typeof placeStaticMapSurfaceSchema>;
export type PlaceStaticMapStatusDto = z.infer<typeof placeStaticMapStatusSchema>;
export type GooglePlaceValidationStatus = z.infer<
  typeof googlePlaceValidationStatusSchema
>;
export type GooglePlacePrediction = z.infer<typeof googlePlacePredictionSchema>;
export type GoogleResolvedPlace = z.infer<typeof googleResolvedPlaceSchema>;
export type GooglePlaceSearchQuery = z.infer<
  typeof googlePlaceSearchQuerySchema
>;
export type GooglePlaceDetailsQuery = z.infer<
  typeof googlePlaceDetailsQuerySchema
>;
export type GoogleAddressValidationRequest = z.infer<
  typeof googleAddressValidationRequestSchema
>;
export type GooglePlaceSearchResponse = z.infer<
  typeof googlePlaceSearchResponseSchema
>;
export type GooglePlaceDetailsResponse = z.infer<
  typeof googlePlaceDetailsResponseSchema
>;
export type GoogleAddressValidationResponse = z.infer<
  typeof googleAddressValidationResponseSchema
>;
export type ConfirmedGooglePlaceAddressInput = z.infer<
  typeof confirmedGooglePlaceAddressInputSchema
>;
export type OfflinePlaceProviderAddressInput = z.infer<
  typeof offlinePlaceProviderAddressInputSchema
>;
export type OnlinePlaceDestinationInput = z.infer<
  typeof onlinePlaceDestinationInputSchema
>;
export type RemotePlaceDestinationInput = z.infer<
  typeof remotePlaceDestinationInputSchema
>;
export type CreatePlaceRequest = z.infer<typeof createPlaceRequestSchema>;
export type UpdatePlaceRequest = z.infer<typeof updatePlaceRequestSchema>;
export type ListPlacesQuery = z.infer<typeof listPlacesQuerySchema>;
export type CreatePlanRequest = z.infer<typeof createPlanRequestSchema>;
export type UpdatePlanRequest = z.infer<typeof updatePlanRequestSchema>;
export type CreatePlanPlaceRequest = z.infer<
  typeof createPlanPlaceRequestSchema
>;
export type UpdatePlanPlaceRequest = z.infer<
  typeof updatePlanPlaceRequestSchema
>;
export type ListPlansQuery = z.infer<typeof listPlansQuerySchema>;
export type AdminListPlansQuery = z.infer<typeof adminListPlansQuerySchema>;
export type AdminPlanAction = z.infer<typeof adminPlanActionSchema>;
export type AdminPlanActionRequest = z.infer<
  typeof adminPlanActionRequestSchema
>;
export type AdminListPlanPublicMessagesQuery = z.infer<
  typeof adminListPlanPublicMessagesQuerySchema
>;
export type AdminListPlacePresenceVerificationsQuery = z.infer<
  typeof adminListPlacePresenceVerificationsQuerySchema
>;
export type AdminPlacePresenceVerificationAction = z.infer<
  typeof adminPlacePresenceVerificationActionSchema
>;
export type AdminPlacePresenceVerificationActionRequest = z.infer<
  typeof adminPlacePresenceVerificationActionRequestSchema
>;
export type AdminPlanPublicMessageAction = z.infer<
  typeof adminPlanPublicMessageActionSchema
>;
export type AdminPlanPublicMessageActionRequest = z.infer<
  typeof adminPlanPublicMessageActionRequestSchema
>;
export type AdminListPlacesQuery = z.infer<typeof adminListPlacesQuerySchema>;
export type AdminPlaceAction = z.infer<typeof adminPlaceActionSchema>;
export type AdminPlaceActionRequest = z.infer<
  typeof adminPlaceActionRequestSchema
>;
export type CreatePlanJoinRequest = z.infer<typeof createPlanJoinRequestSchema>;
export type UpdatePlanParticipantRequest = z.infer<
  typeof updatePlanParticipantRequestSchema
>;
export type UpdateMyPlanParticipantRequest = z.infer<
  typeof updateMyPlanParticipantRequestSchema
>;
export type CreatePlanPublicMessageRequest = z.infer<
  typeof createPlanPublicMessageRequestSchema
>;
export type UpdatePlanPublicMessageRequest = z.infer<
  typeof updatePlanPublicMessageRequestSchema
>;
export type ListPlanPublicMessagesQuery = z.infer<
  typeof listPlanPublicMessagesQuerySchema
>;
export type CreatePlacePresenceVerificationRequest = z.infer<
  typeof createPlacePresenceVerificationRequestSchema
>;
export type ListMyPlacePresenceVerificationsQuery = z.infer<
  typeof listMyPlacePresenceVerificationsQuerySchema
>;
export type PlaceDto = z.infer<typeof placeSchema>;
export type PlanDto = z.infer<typeof planSchema>;
export type PlanPlaceDto = z.infer<typeof planPlaceSchema>;
export type PlanParticipantDto = z.infer<typeof planParticipantSchema>;
export type PlanPublicMessageStatus = z.infer<
  typeof planPublicMessageStatusSchema
>;
export type PlanPublicMessageDto = z.infer<typeof planPublicMessageSchema>;
export type PlacePresenceVerificationDto = z.infer<
  typeof placePresenceVerificationSchema
>;
export type PlacePresenceVerificationHistoryItem = z.infer<
  typeof placePresenceVerificationHistoryItemSchema
>;
export type PlacePresenceVerificationHistoryResponse = z.infer<
  typeof placePresenceVerificationHistoryResponseSchema
>;
export type AdminPlacePresenceVerificationDto = z.infer<
  typeof adminPlacePresenceVerificationSchema
>;
export type AdminPlacePresenceVerificationsResponse = z.infer<
  typeof adminPlacePresenceVerificationsResponseSchema
>;
export type AdminPlacePresenceVerificationResponse = z.infer<
  typeof adminPlacePresenceVerificationResponseSchema
>;
export type PlaceResponse = z.infer<typeof placeResponseSchema>;
export type PlacesResponse = z.infer<typeof placesResponseSchema>;
export type PlanResponse = z.infer<typeof planResponseSchema>;
export type PlansResponse = z.infer<typeof plansResponseSchema>;
export type PlanParticipantResponse = z.infer<
  typeof planParticipantResponseSchema
>;
export type PlanParticipantsResponse = z.infer<
  typeof planParticipantsResponseSchema
>;
export type PlanPublicMessagesResponse = z.infer<
  typeof planPublicMessagesResponseSchema
>;
export type PlanPublicMessageResponse = z.infer<
  typeof planPublicMessageResponseSchema
>;
export type PlacePresenceVerificationResponse = z.infer<
  typeof placePresenceVerificationResponseSchema
>;
export type PlacePresenceVerificationSummaryResponse = z.infer<
  typeof placePresenceVerificationSummaryResponseSchema
>;
