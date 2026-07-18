// apps/mobile/src/features/trade/CreateTradeScreen.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CASH_PROMISE_ACKNOWLEDGEMENT_TEXT, type CashPromiseInput, type InventoryTemplateDto, type TradeExchangeMode, type TradePostType } from '@hellowhen/contracts';
import { buildGeneratedTradeDisplay, formatMoney, getNextWizardStepId, getPreviousWizardStepId, type GeneratedTradeDisplayLabels, type WizardStepDefinition } from '@hellowhen/shared';
import type { ThemeTokens } from '@hellowhen/theme';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { betaFeatures } from '../../lib/betaFeatures';
import { useUnsavedChangesWarning } from '../../hooks/useUnsavedChangesWarning';
import { AppActionSheet, type AppActionSheetAction } from '../../components/AppActionSheet';
import { AppCard } from '../../components/AppCard';
import { AppConfirmSheet } from '../../components/AppConfirmSheet';
import { AppText } from '../../components/AppText';
import { MobileIcon } from '../../components/MobileIcon';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { useAuth } from '../../providers/AuthProvider';
import { categoryLabel, itemTypeLabel, modeLabel } from './components/InventoryFormFields';
import { TradeSquareDeck } from './components/TradeSquareDeck';
import { buildTradeSquareDeckCards } from './components/TradeSquareDeckCards';
import { buildMobileWizardDraftKey, useMobileWizardDraft, WizardFooter, WizardShell } from './create';
import { feedTradeIdeaHasNeed, feedTradeIdeaHasOffer, feedTradeIdeas, getFeedTradeIdeaPostType, getLocalizedTemplateKeyCandidates, parseFeedTradeIdeaKey, type FeedTradeIdeaKey } from './tradeFeedIdeas';
import { useLocalizedInventoryItems } from './inventoryDisplay';
import type { NeedItem, OfferItem, TradeDeckItem } from './types';

export type TradeCreateSide = 'need' | 'offer';
export type TradeCreateSideSelection =
  | { side: 'need'; kind: 'need'; id: string }
  | { side: 'need'; kind: 'money'; amountCents: number; currency: string }
  | { side: 'need'; kind: 'cash_promise'; amountCents: number; currency: string; note?: string | null; acknowledgementAccepted: true; acknowledgementText?: string }
  | { side: 'offer'; kind: 'offer'; id: string }
  | { side: 'offer'; kind: 'money'; amountCents: number; currency: string }
  | { side: 'offer'; kind: 'cash_promise'; amountCents: number; currency: string; note?: string | null; acknowledgementAccepted: true; acknowledgementText?: string };
export type TradeSidePickerParams = {
  side: TradeCreateSide;
  selection?: TradeCreateSideSelection | null;
  postType?: TradePostType;
  returnTo?: 'createTrade' | 'createTradeFull' | 'tradeProposal' | 'proposalDetail';
  tradeId?: string;
  tradeTitle?: string;
  proposalId?: string;
  proposalNeedId?: string;
  proposalOfferId?: string;
  initialSourceMode?: InlineSourceMode;
};
export type TradeCreateReturnParams = { selectedTradeSide?: TradeCreateSideSelection; initialPostType?: TradePostType | null; initialNeedSelection?: TradeCreateSideSelection | null; initialOfferSelection?: TradeCreateSideSelection | null; initialExpiryDays?: number | null; initialIdeaKey?: FeedTradeIdeaKey | null } | undefined;

type Props = NativeStackScreenProps<RootStackParamList, 'CreateTrade'>;
type NeedsResponse = { needs: NeedItem[] };
type OffersResponse = { offers: OfferItem[] };
type CreateTradeResponse = { trade: TradeDeckItem };
type CreateNeedResponse = { need: NeedItem };
type CreateOfferResponse = { offer: OfferItem };

type InventoryTemplatesResponse = { templates?: InventoryTemplateDto[] };
type CloneInventoryTemplateResponse = { need?: NeedItem; offer?: OfferItem };

function normalizeTemplateResponse(value: unknown): InventoryTemplateDto[] {
  if (!value || typeof value !== 'object') return [];
  const templates = (value as InventoryTemplatesResponse).templates;
  return Array.isArray(templates) ? templates : [];
}

function clonedNeedFromResponse(value: unknown): NeedItem | null {
  if (!value || typeof value !== 'object') return null;
  const need = (value as CloneInventoryTemplateResponse).need;
  return need && typeof need.id === 'string' ? need : null;
}

function clonedOfferFromResponse(value: unknown): OfferItem | null {
  if (!value || typeof value !== 'object') return null;
  const offer = (value as CloneInventoryTemplateResponse).offer;
  return offer && typeof offer.id === 'string' ? offer : null;
}

function firstMetaPart(value: string) {
  return value.split('·')[0]?.trim() || undefined;
}

function modeFromMeta(value: string): TradeExchangeMode | undefined {
  const lower = value.toLowerCase();
  if (lower.includes('hybrid')) return 'hybrid';
  if (lower.includes('local') || lower.includes('paris')) return 'local';
  if (lower.includes('remote')) return 'remote';
  return undefined;
}


type PostTypeOption = { value: TradePostType; labelKey: string; badgeKey: string; titleKey: string; bodyKey: string; icon: 'trade' | 'need' | 'offer'; tone: 'trade' | 'need' | 'offer' };
type TradeWizardStepId = 'type' | 'exchange' | 'details' | 'review';
type InlineSourceMode = 'mine' | 'starter' | 'cashPromise';
type TradeCreateWizardPersistedDraft = {
  activeStepId: TradeWizardStepId | 'need' | 'offer';
  postType: TradePostType | null;
  needSelection: TradeCreateSideSelection | null;
  offerSelection: TradeCreateSideSelection | null;
  expiryDays: number | null;
};

const expiryOptions = [{ labelKey: 'trade.create.expiry7Days', days: 7 }, { labelKey: 'trade.create.expiry14Days', days: 14 }, { labelKey: 'trade.create.expiry30Days', days: 30 }, { labelKey: 'trade.expiry.noExpiry', days: null }] as const;
const postTypeOptions: PostTypeOption[] = [
  { value: 'need_offer', labelKey: 'trade.postTypes.needOffer', badgeKey: 'trade.create.completeTrade', titleKey: 'trade.create.knowBothSides', bodyKey: 'trade.create.needOfferBody', icon: 'trade', tone: 'trade' },
  { value: 'open_need', labelKey: 'trade.postTypes.openNeed', badgeKey: 'trade.create.othersProposeOffers', titleKey: 'trade.create.onlyPostNeed', bodyKey: 'trade.create.openNeedBody', icon: 'need', tone: 'need' },
  { value: 'open_offer', labelKey: 'trade.postTypes.openOffer', badgeKey: 'trade.create.othersProposeNeeds', titleKey: 'trade.create.onlyPostOffer', bodyKey: 'trade.create.openOfferBody', icon: 'offer', tone: 'offer' },
];

function isNeedAvailable(need: NeedItem) { return !['fulfilled', 'closed', 'expired'].includes(need.status); }
function isOfferAvailable(offer: OfferItem) { return !['accepted', 'closed', 'expired'].includes(offer.status); }
type TFunction = (key: string, values?: Record<string, string | number | boolean | null | undefined>) => string;
function optionalModeLabel(mode: TradeExchangeMode | null | undefined, t: TFunction) { return mode ? modeLabel(mode, t) : undefined; }
function needMeta(need: NeedItem | null | undefined, t: TFunction) { return need ? [itemTypeLabel(need.itemType ?? 'service', t), categoryLabel(need.category, t), need.timing, optionalModeLabel(need.mode, t), need.locationLabel].filter(Boolean).join(' · ') : ''; }
function offerMeta(offer: OfferItem | null | undefined, t: TFunction) { return offer ? [itemTypeLabel(offer.itemType ?? 'service', t), categoryLabel(offer.category, t), offer.availability, optionalModeLabel(offer.mode, t), offer.locationLabel].filter(Boolean).join(' · ') : ''; }
function buildExpiresAt(days: number | null) { if (!days) return undefined; const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + days); return expiresAt.toISOString(); }
function initialExpiryDaysFromRoute(params: TradeCreateReturnParams) {
  return params && Object.prototype.hasOwnProperty.call(params, 'initialExpiryDays') ? params.initialExpiryDays ?? null : 14;
}
function cashPromiseSelection(needSelection: TradeCreateSideSelection | null, offerSelection: TradeCreateSideSelection | null) {
  if (needSelection?.kind === 'cash_promise') return needSelection;
  if (offerSelection?.kind === 'cash_promise') return offerSelection;
  return null;
}
function hasTwoCashPromises(needSelection: TradeCreateSideSelection | null, offerSelection: TradeCreateSideSelection | null) { return needSelection?.kind === 'cash_promise' && offerSelection?.kind === 'cash_promise'; }
function amountFor(needSelection: TradeCreateSideSelection | null, offerSelection: TradeCreateSideSelection | null) { return cashPromiseSelection(needSelection, offerSelection)?.amountCents ?? 0; }
function currencyFor(needSelection: TradeCreateSideSelection | null, offerSelection: TradeCreateSideSelection | null) { return cashPromiseSelection(needSelection, offerSelection)?.currency ?? 'eur'; }
function cashPromiseLabel(selection: TradeCreateSideSelection | null, t: TFunction) {
  if (selection?.kind !== 'cash_promise') return '';
  return `${t('trade.cashPromise.title')} · ${formatMoney(selection.amountCents, selection.currency)}`;
}
function postTypeLabel(postType: TradePostType | null, t: TFunction) { const option = postTypeOptions.find((item) => item.value === postType); return option ? t(option.labelKey) : t('trade.create.choosePublishType'); }
function tradeDisplayLabels(t: TFunction): Partial<GeneratedTradeDisplayLabels> {
  return {
    openNeedPrefix: `${t('trade.labels.openNeed')}: `,
    openOfferPrefix: `${t('trade.labels.openOffer')}: `,
    needLineLabel: t('trade.labels.iNeed'),
    offerLineLabel: t('trade.labels.iOffer'),
    openNeedPrompt: t('trade.labels.othersCanProposeOffers'),
    openOfferPrompt: t('trade.labels.othersCanProposeNeeds'),
    missingNeedTitle: t('trade.create.chooseWhatYouNeed'),
    missingOfferTitle: t('trade.create.chooseWhatYouOffer'),
    missingNeedDescription: t('trade.create.savedNeedFallback'),
    missingOfferDescription: t('trade.create.savedOfferFallback'),
  };
}

function buildPreviewTrade({ postType, needSelection, offerSelection, need, offer, amountCents: _amountCents, currency, expiryDays, t }: { postType: TradePostType | null; needSelection: TradeCreateSideSelection | null; offerSelection: TradeCreateSideSelection | null; need: NeedItem | null; offer: OfferItem | null; amountCents: number; currency: string; expiryDays: number | null; t: TFunction }): TradeDeckItem {
  const resolvedPostType = postType ?? 'need_offer';
  const selectedCashPromise = cashPromiseSelection(needSelection, offerSelection);
  const { title, description } = buildGeneratedTradeDisplay({
    postType: resolvedPostType,
    need: needSelection?.kind === 'cash_promise' ? { moneyLabel: cashPromiseLabel(needSelection, t) } : need,
    offer: offerSelection?.kind === 'cash_promise' ? { moneyLabel: cashPromiseLabel(offerSelection, t) } : offer,
    labels: tradeDisplayLabels(t),
  });
  const createdAt = new Date(0).toISOString();

  return {
    id: 'draft-trade-preview',
    ownerId: 'preview',
    providerId: null,
    needId: resolvedPostType === 'open_offer' || needSelection?.kind === 'cash_promise' ? null : need?.id ?? null,
    offerId: resolvedPostType === 'open_need' || offerSelection?.kind === 'cash_promise' ? null : offer?.id ?? null,
    title,
    description,
    creditAmount: 0,
    amountCents: 0,
    currency,
    postType: resolvedPostType,
    previewTheme: 'default',
    status: 'active',
    isPublic: true,
    createdAt,
    updatedAt: createdAt,
    expiresAt: buildExpiresAt(expiryDays) ?? null,
    closedAt: null,
    deliverySubmittedById: null,
    deliverySubmittedAt: null,
    confirmedById: null,
    confirmedAt: null,
    disputedById: null,
    disputedAt: null,
    disputeTicketId: null,
    need: resolvedPostType === 'open_offer' || needSelection?.kind === 'cash_promise' ? null : need,
    offer: resolvedPostType === 'open_need' || offerSelection?.kind === 'cash_promise' ? null : offer,
    cashPromise: selectedCashPromise ? { id: 'preview-cash-promise', tradeId: 'draft-trade-preview', proposalId: null, side: selectedCashPromise.side, amountCents: selectedCashPromise.amountCents, currency: selectedCashPromise.currency, note: selectedCashPromise.note ?? null, acknowledgementText: selectedCashPromise.acknowledgementText ?? CASH_PROMISE_ACKNOWLEDGEMENT_TEXT, acknowledgedById: 'preview', acknowledgedAt: createdAt, createdAt, updatedAt: createdAt } : null,
    media: [],
  };
}


export function CreateTradeScreen({ route, navigation }: Props) {
  const theme = useThemeTokens();
  const { t, language } = useTranslation();
  const auth = useAuth();
  const [activeStepId, setActiveStepId] = useState<TradeWizardStepId>('type');
  const [postType, setPostType] = useState<TradePostType | null>(route.params?.initialPostType ?? null);
  const [needs, setNeeds] = useState<NeedItem[]>([]);
  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [needSelection, setNeedSelection] = useState<TradeCreateSideSelection | null>(route.params?.initialNeedSelection ?? null);
  const [offerSelection, setOfferSelection] = useState<TradeCreateSideSelection | null>(route.params?.initialOfferSelection ?? null);
  const [expiryDays, setExpiryDays] = useState<number | null>(() => initialExpiryDaysFromRoute(route.params));
  const [loading, setLoading] = useState(false);
  const [resourcesLoaded, setResourcesLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuSheetVisible, setMenuSheetVisible] = useState(false);
  const [helpSheetVisible, setHelpSheetVisible] = useState(false);
  const [sourceSheetSide, setSourceSheetSide] = useState<TradeCreateSide | null>(null);
  const [applyingIdea, setApplyingIdea] = useState<FeedTradeIdeaKey | null>(null);
  const [appliedIdeaKey, setAppliedIdeaKey] = useState<FeedTradeIdeaKey | null>(null);
  const [autoApplyAttemptedIdeaKey, setAutoApplyAttemptedIdeaKey] = useState<FeedTradeIdeaKey | null>(null);
  const processedSelectionRef = useRef<TradeCreateSideSelection | null>(null);

  const usableNeeds = useMemo(() => needs.filter(isNeedAvailable), [needs]);
  const usableOffers = useMemo(() => offers.filter(isOfferAvailable), [offers]);
  const displayNeeds = useLocalizedInventoryItems(usableNeeds);
  const displayOffers = useLocalizedInventoryItems(usableOffers);
  const selectedNeed = useMemo(() => needSelection?.kind === 'need' ? displayNeeds.find((need) => need.id === needSelection.id) ?? null : null, [displayNeeds, needSelection]);
  const selectedOffer = useMemo(() => offerSelection?.kind === 'offer' ? displayOffers.find((offer) => offer.id === offerSelection.id) ?? null : null, [displayOffers, offerSelection]);
  const amountCents = amountFor(needSelection, offerSelection);
  const currency = currencyFor(needSelection, offerSelection);
  const previewTrade = useMemo(() => buildPreviewTrade({ postType, needSelection, offerSelection, need: selectedNeed, offer: selectedOffer, amountCents, currency, expiryDays, t }), [amountCents, currency, expiryDays, needSelection, offerSelection, postType, selectedNeed, selectedOffer, t]);
  const previewCardCount = useMemo(() => buildTradeSquareDeckCards(previewTrade).length, [previewTrade]);
  const hasDraft = Boolean(postType || needSelection || offerSelection || expiryDays !== 14);
  const needsNeedSide = postType !== null && postType !== 'open_offer';
  const needsOfferSide = postType !== null && postType !== 'open_need';
  const persistedDraft = useMemo<TradeCreateWizardPersistedDraft>(() => ({
    activeStepId,
    postType,
    needSelection,
    offerSelection,
    expiryDays,
  }), [activeStepId, expiryDays, needSelection, offerSelection, postType]);
  const draftStorageKey = useMemo(() => buildMobileWizardDraftKey('create-trade', auth.user?.id), [auth.user?.id]);
  const shouldRestoreStoredDraft = !route.params?.selectedTradeSide
    && !route.params?.initialPostType
    && !route.params?.initialNeedSelection
    && !route.params?.initialOfferSelection
    && route.params?.initialExpiryDays === undefined
    && !route.params?.initialIdeaKey;
  const restoreDraft = useCallback((savedDraft: TradeCreateWizardPersistedDraft) => {
    if (!shouldRestoreStoredDraft) return;
    setPostType(savedDraft.postType ?? null);
    setNeedSelection(savedDraft.needSelection ?? null);
    setOfferSelection(savedDraft.offerSelection ?? null);
    setExpiryDays(typeof savedDraft.expiryDays === 'number' || savedDraft.expiryDays === null ? savedDraft.expiryDays : 14);
    const savedStep = savedDraft.activeStepId === 'need' || savedDraft.activeStepId === 'offer' ? 'exchange' : savedDraft.activeStepId;
    setActiveStepId(['type', 'exchange', 'details', 'review'].includes(savedStep) ? savedStep as TradeWizardStepId : 'type');
  }, [shouldRestoreStoredDraft]);
  const tradeWizardDraft = useMobileWizardDraft({
    storageKey: draftStorageKey,
    draft: persistedDraft,
    enabled: !submitting,
    hasContent: (candidate) => Boolean(candidate && typeof candidate === 'object' && (candidate.postType || candidate.needSelection || candidate.offerSelection || candidate.expiryDays !== 14)),
    onRestore: restoreDraft,
  });
  const needStepComplete = !needsNeedSide || Boolean(needSelection);
  const offerStepComplete = !needsOfferSide || Boolean(offerSelection);
  const publishButtonLabel = postType === 'open_need' ? t('trade.create.publishOpenNeed') : postType === 'open_offer' ? t('trade.create.publishOpenOffer') : t('trade.create.publishTrade');
  const routeIdeaKey = parseFeedTradeIdeaKey(route.params?.initialIdeaKey);
  const selectedFeedIdea = routeIdeaKey ? feedTradeIdeas[routeIdeaKey] : null;
  const showFeedIdeaPanel = Boolean(routeIdeaKey && selectedFeedIdea && appliedIdeaKey !== routeIdeaKey);

  const steps = useMemo<WizardStepDefinition<TradeWizardStepId>[]>(() => [
    {
      id: 'type',
      title: t('trade.create.publishQuestion'),
      completed: Boolean(postType),
    },
    {
      id: 'exchange',
      title: postType === 'open_need' ? t('trade.create.chooseNeedTitle') : postType === 'open_offer' ? t('trade.create.chooseOfferTitle') : t('trade.create.exchangeTitle'),
      completed: Boolean(postType && needStepComplete && offerStepComplete),
    },
    {
      id: 'details',
      title: t('trade.create.detailsTitle'),
      completed: true,
    },
    {
      id: 'review',
      title: t('trade.create.previewTitle'),
      completed: Boolean(postType && needStepComplete && offerStepComplete),
    },
  ], [needStepComplete, offerStepComplete, postType, t]);

  const isFirstStep = steps[0]?.id === activeStepId;
  const isReviewStep = activeStepId === 'review';

  const unsavedChangesConfirm = useUnsavedChangesWarning({
    navigation,
    enabled: hasDraft && !submitting,
    title: t('inventory.form.unsavedTitle'),
    body: t('inventory.form.unsavedBody'),
    stayLabel: t('common.actions.cancel'),
    discardLabel: t('inventory.form.discardDraft'),
  });

  useEffect(() => {
    if (!steps.some((step) => step.id === activeStepId)) {
      setActiveStepId(steps[0]?.id ?? 'type');
    }
  }, [activeStepId, steps]);

  useEffect(() => {
    const selection = route.params?.selectedTradeSide;
    if (!selection || processedSelectionRef.current === selection) return;
    processedSelectionRef.current = selection;
    if (selection.kind === 'money') {
      setError(t('trade.create.validationSavedSidesOnly'));
      return;
    }
    if (selection.kind === 'cash_promise' && (!betaFeatures.cashPromiseEnabled || !betaFeatures.cashPromiseVisible)) {
      setError(t('trade.cashPromise.hidden'));
      return;
    }
    if (selection.side === 'need') {
      setNeedSelection(selection);
      setActiveStepId(postType === 'open_need' || offerSelection ? 'details' : 'exchange');
    } else {
      setOfferSelection(selection);
      setActiveStepId(postType === 'open_offer' || needSelection ? 'details' : 'exchange');
    }
  }, [postType, route.params?.selectedTradeSide, t]);

  const loadResources = useCallback(async () => {
    setLoading(true);
    setResourcesLoaded(false);
    setError(null);
    try {
      const [needsResult, offersResult] = await Promise.all([
        api.needs.mine() as Promise<NeedsResponse>,
        api.offers.mine() as Promise<OffersResponse>,
      ]);
      setNeeds(Array.isArray(needsResult.needs) ? needsResult.needs : []);
      setOffers(Array.isArray(offersResult.offers) ? offersResult.offers : []);
    } catch (caughtError) {
      setNeeds([]);
      setOffers([]);
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setResourcesLoaded(true);
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadResources(); }, [loadResources]));

  useEffect(() => {
    if (!auth.hydrated || !auth.isAuthenticated || !resourcesLoaded || !routeIdeaKey || !selectedFeedIdea || appliedIdeaKey === routeIdeaKey || autoApplyAttemptedIdeaKey === routeIdeaKey || applyingIdea) return;
    setAutoApplyAttemptedIdeaKey(routeIdeaKey);
    void applyFeedIdeaToDraft(routeIdeaKey);
  }, [appliedIdeaKey, applyingIdea, auth.hydrated, auth.isAuthenticated, autoApplyAttemptedIdeaKey, resourcesLoaded, routeIdeaKey, selectedFeedIdea]);

  async function loadStarterTemplate(kind: 'need' | 'offer', templateKey: string) {
    const templatesResponse = await api.inventoryTemplates.list({ sourceType: 'hellowhen', kind, language, take: 100 });
    const templateKeys = getLocalizedTemplateKeyCandidates(templateKey);
    return normalizeTemplateResponse(templatesResponse).find((template) => template.kind === kind && templateKeys.includes(template.key)) ?? null;
  }

  async function createFallbackNeedFromFeedIdea(ideaKey: FeedTradeIdeaKey) {
    const needMetaText = t(`trade.feedIdeas.items.${ideaKey}.needMeta`);
    const response = await api.needs.create({
      title: t(`trade.feedIdeas.items.${ideaKey}.need`),
      description: t(`trade.feedIdeas.items.${ideaKey}.body`),
      defaultLanguage: language,
      translations: [],
      itemType: 'service',
      category: firstMetaPart(needMetaText),
      mode: modeFromMeta(needMetaText),
      tags: [],
      previewTheme: 'default',
      status: 'active',
    }) as CreateNeedResponse;
    return response.need;
  }

  async function createFallbackOfferFromFeedIdea(ideaKey: FeedTradeIdeaKey) {
    const offerMetaText = t(`trade.feedIdeas.items.${ideaKey}.offerMeta`);
    const response = await api.offers.create({
      title: t(`trade.feedIdeas.items.${ideaKey}.offer`),
      description: t(`trade.feedIdeas.items.${ideaKey}.body`),
      defaultLanguage: language,
      translations: [],
      itemType: 'service',
      category: firstMetaPart(offerMetaText),
      mode: modeFromMeta(offerMetaText),
      includes: [],
      tags: [],
      previewTheme: 'default',
      status: 'active',
    }) as CreateOfferResponse;
    return response.offer;
  }

  async function cloneOrCreateStarterNeed(ideaKey: FeedTradeIdeaKey, templateKey: string) {
    const template = await loadStarterTemplate('need', templateKey);
    if (template) {
      const response = await api.inventoryTemplates.clone(template.id, { status: 'active' });
      const clonedNeed = clonedNeedFromResponse(response);
      if (clonedNeed) return clonedNeed;
    }
    return createFallbackNeedFromFeedIdea(ideaKey);
  }

  async function cloneOrCreateStarterOffer(ideaKey: FeedTradeIdeaKey, templateKey: string) {
    const template = await loadStarterTemplate('offer', templateKey);
    if (template) {
      const response = await api.inventoryTemplates.clone(template.id, { status: 'active' });
      const clonedOffer = clonedOfferFromResponse(response);
      if (clonedOffer) return clonedOffer;
    }
    return createFallbackOfferFromFeedIdea(ideaKey);
  }

  async function applyFeedIdeaToDraft(ideaKey: FeedTradeIdeaKey) {
    const idea = feedTradeIdeas[ideaKey];
    if (!auth.isAuthenticated) {
      setError(t('trade.create.validationSignedOut'));
      return;
    }
    setApplyingIdea(ideaKey);
    setError(null);
    try {
      const [clonedNeed, clonedOffer] = await Promise.all([
        feedTradeIdeaHasNeed(idea) ? cloneOrCreateStarterNeed(ideaKey, idea.needTemplateKey) : Promise.resolve(null),
        feedTradeIdeaHasOffer(idea) ? cloneOrCreateStarterOffer(ideaKey, idea.offerTemplateKey) : Promise.resolve(null),
      ]);
      const nextPostType = getFeedTradeIdeaPostType(idea);

      if (clonedNeed) setNeeds((current) => [clonedNeed, ...current.filter((need) => need.id !== clonedNeed.id)]);
      if (clonedOffer) setOffers((current) => [clonedOffer, ...current.filter((offer) => offer.id !== clonedOffer.id)]);
      setPostType(nextPostType);
      setNeedSelection(clonedNeed ? { side: 'need', kind: 'need', id: clonedNeed.id } : null);
      setOfferSelection(clonedOffer ? { side: 'offer', kind: 'offer', id: clonedOffer.id } : null);
      setActiveStepId('review');
      setAppliedIdeaKey(ideaKey);
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setApplyingIdea(null);
    }
  }

  function choosePostType(nextPostType: TradePostType) {
    setPostType(nextPostType);
    setError(null);
    if (nextPostType === 'open_need') setOfferSelection(null);
    if (nextPostType === 'open_offer') setNeedSelection(null);
  }

  function openSidePicker(side: TradeCreateSide, initialSourceMode?: InlineSourceMode) {
    navigation.navigate('TradeSidePicker', { side, selection: side === 'need' ? needSelection : offerSelection, postType: postType ?? undefined, returnTo: 'createTrade', initialSourceMode });
  }

  function openSourceSheet(side: TradeCreateSide) {
    setSourceSheetSide(side);
  }

  function closeSourceSheet() {
    setSourceSheetSide(null);
  }

  function chooseSourceFromSheet(side: TradeCreateSide, sourceMode: InlineSourceMode | 'new') {
    closeSourceSheet();
    if (sourceMode === 'new') {
      createNewSide(side);
      return;
    }
    openSidePicker(side, sourceMode);
  }

  function createNewSide(side: TradeCreateSide) {
    const params = { returnTo: 'createTrade' as const };
    if (side === 'need') {
      navigation.navigate('CreateNeed', params);
      return;
    }
    navigation.navigate('CreateOffer', params);
  }

  function navigateToFullForm() {
    navigation.navigate('CreateTradeFull', {
      initialPostType: postType,
      initialNeedSelection: needSelection,
      initialOfferSelection: offerSelection,
      initialExpiryDays: expiryDays,
    });
  }

  function validateStep(stepId: TradeWizardStepId) {
    if (stepId === 'type' && !postType) return t('trade.create.validationNativeKind');
    if (stepId === 'exchange') {
      if (postType !== 'open_offer' && !needSelection) return postType === 'open_need' ? t('trade.create.validationNativeOpenNeed') : t('trade.create.validationNativeNeed');
      if (postType !== 'open_need' && !offerSelection) return postType === 'open_offer' ? t('trade.create.validationNativeOpenOffer') : t('trade.create.validationNativeOffer');
    }
    return null;
  }

  function validateBeforePublish() {
    if (!postType) return t('trade.create.validationNativeKind');
    const selectedCashPromise = cashPromiseSelection(needSelection, offerSelection);
    if (selectedCashPromise && (!betaFeatures.cashPromiseEnabled || !betaFeatures.cashPromiseVisible)) return t('trade.cashPromise.hidden');
    if (selectedCashPromise && postType !== 'need_offer') return t('trade.cashPromise.fullTradeOnly');
    if (hasTwoCashPromises(needSelection, offerSelection)) return t('trade.cashPromise.oneSideOnly');
    if (postType !== 'open_offer' && !needSelection) return postType === 'open_need' ? t('trade.create.validationNativeOpenNeed') : t('trade.create.validationNativeNeed');
    if (postType !== 'open_need' && !offerSelection) return postType === 'open_offer' ? t('trade.create.validationNativeOpenOffer') : t('trade.create.validationNativeOffer');
    if (postType !== 'open_offer' && needSelection?.kind !== 'need' && needSelection?.kind !== 'cash_promise') return t('trade.create.validationNativeSavedNeed');
    if (postType !== 'open_need' && offerSelection?.kind !== 'offer' && offerSelection?.kind !== 'cash_promise') return t('trade.create.validationNativeSavedOffer');
    return null;
  }

  async function handleNext() {
    if (showFeedIdeaPanel && routeIdeaKey && !applyingIdea) {
      await applyFeedIdeaToDraft(routeIdeaKey);
      return;
    }

    const validationError = validateStep(activeStepId);
    if (validationError) {
      setError(validationError);
      return;
    }
    const nextStepId = getNextWizardStepId(steps, activeStepId);
    if (!nextStepId || nextStepId === activeStepId) return;
    setError(null);
    setActiveStepId(nextStepId);
  }

  function handlePrevious() {
    const previousStepId = getPreviousWizardStepId(steps, activeStepId);
    if (!previousStepId || previousStepId === activeStepId) return;
    setError(null);
    setActiveStepId(previousStepId);
  }

  async function handlePublish() {
    if (submitting) return;
    const validationError = validateBeforePublish();
    if (validationError) {
      setError(validationError);
      if (!postType) setActiveStepId('type');
      else if ((postType !== 'open_offer' && !needSelection) || (postType !== 'open_need' && !offerSelection)) setActiveStepId('exchange');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const selectedCashPromise = cashPromiseSelection(needSelection, offerSelection);
      const cashPromise = selectedCashPromise ? { side: selectedCashPromise.side, amountCents: selectedCashPromise.amountCents, currency: selectedCashPromise.currency, note: selectedCashPromise.note ?? undefined, acknowledgementAccepted: true, acknowledgementText: selectedCashPromise.acknowledgementText ?? CASH_PROMISE_ACKNOWLEDGEMENT_TEXT } satisfies CashPromiseInput : undefined;
      const result = await api.trades.create({
        postType: postType!,
        needKind: 'need',
        offerKind: 'offer',
        previewTheme: 'default',
        ...(postType !== 'open_offer' && needSelection?.kind === 'need' ? { needId: needSelection.id } : {}),
        ...(postType !== 'open_need' && offerSelection?.kind === 'offer' ? { offerId: offerSelection.id } : {}),
        ...(cashPromise ? { cashPromise } : {}),
        creditAmount: 0,
        amountCents: 0,
        currency,
        expiresAt: buildExpiresAt(expiryDays),
      }) as CreateTradeResponse;
      await tradeWizardDraft.clearDraft();
      setPostType(null);
      setNeedSelection(null);
      setOfferSelection(null);
      setExpiryDays(14);
      setActiveStepId('type');
      navigation.replace('TradeDetail', { tradeId: result.trade.id, title: result.trade.title, description: result.trade.description, amountCents: result.trade.amountCents ?? 0, currency: result.trade.currency ?? 'eur', creditAmount: result.trade.creditAmount ?? 0, status: result.trade.status, expiresAt: result.trade.expiresAt ?? null });
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSubmitting(false);
    }
  }

  const footerHelperText = loading ? t('trade.create.loadingSavedInventory') : undefined;

  async function resetWizardDraft() {
    setMenuSheetVisible(false);
    setError(null);
    setPostType(null);
    setNeedSelection(null);
    setOfferSelection(null);
    setExpiryDays(14);
    setActiveStepId('type');
    await tradeWizardDraft.clearDraft();
  }

  const menuActions: AppActionSheetAction[] = [
    {
      key: 'full-form',
      label: t('inventory.wizard.openFullForm'),
      icon: 'edit',
      onPress: () => {
        setMenuSheetVisible(false);
        navigateToFullForm();
      },
    },
    {
      key: 'reset-draft',
      label: t('trade.create.resetDraft'),
      icon: 'refresh',
      tone: 'danger',
      disabled: submitting || !hasDraft,
      onPress: () => { void resetWizardDraft(); },
    },
    {
      key: 'help',
      label: t('trade.create.wizardHelpTitle'),
      icon: 'help',
      onPress: () => {
        setMenuSheetVisible(false);
        setHelpSheetVisible(true);
      },
    },
  ];

  const sourceSheetItem = sourceSheetSide === 'offer' ? t('inventory.labels.offer').toLowerCase() : t('inventory.labels.need').toLowerCase();
  const sourceSheetItems = sourceSheetSide === 'offer' ? t('inventory.labels.offers').toLowerCase() : t('inventory.labels.needs').toLowerCase();
  const sourceSheetCashAllowed = Boolean(sourceSheetSide && postType === 'need_offer' && betaFeatures.cashPromiseEnabled && betaFeatures.cashPromiseVisible);
  const sourceSheetActions: AppActionSheetAction[] = sourceSheetSide ? [
    {
      key: 'mine',
      label: t('trade.sidePicker.useMine'),
      helper: t('trade.sidePicker.useMineBody', { items: sourceSheetItems }),
      icon: sourceSheetSide,
      tone: 'primary',
      onPress: () => chooseSourceFromSheet(sourceSheetSide, 'mine'),
    },
    {
      key: 'starter',
      label: t('trade.sidePicker.useStarter'),
      helper: t('trade.sidePicker.useStarterBody'),
      icon: 'search',
      onPress: () => chooseSourceFromSheet(sourceSheetSide, 'starter'),
    },
    {
      key: 'new',
      label: t('trade.sidePicker.createNew', { item: sourceSheetItem }),
      helper: t('trade.sidePicker.createNewBody', { item: sourceSheetItem }),
      icon: 'add',
      onPress: () => chooseSourceFromSheet(sourceSheetSide, 'new'),
    },
    ...(sourceSheetCashAllowed ? [{
      key: 'cash-promise',
      label: t('trade.sidePicker.useCashPromise'),
      helper: t('trade.sidePicker.useCashPromiseBody', { item: sourceSheetItem }),
      icon: 'warning' as const,
      onPress: () => chooseSourceFromSheet(sourceSheetSide, 'cashPromise'),
    }] : []),
  ] : [];

  const headerMenuButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('trade.create.wizardMenuTitle')}
      disabled={submitting}
      onPress={() => setMenuSheetVisible(true)}
      hitSlop={10}
      style={({ pressed }) => [styles.headerMenuButton, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }, pressed && styles.pressed, submitting && styles.disabled]}
    >
      <MobileIcon name="more" size={19} color={theme.color.muted} />
    </Pressable>
  );

  return (
    <WizardShell
      title={t('trade.create.title')}
      onBack={() => navigation.goBack()}
      rightSlot={headerMenuButton}
      steps={steps}
      activeStepId={activeStepId}
      stepLabel={t('inventory.wizard.stepLabel')}
      ofLabel={t('inventory.wizard.ofLabel')}
      footer={(
        <WizardFooter
          primaryLabel={isReviewStep ? publishButtonLabel : t('common.actions.continue')}
          primaryLoading={submitting || Boolean(applyingIdea)}
          primaryLoadingLabel={applyingIdea ? t('trade.feedIdeas.applySaving') : t('trade.create.publishing')}
          primaryDisabled={loading || Boolean(applyingIdea)}
          onPrimary={isReviewStep ? handlePublish : handleNext}
          secondaryLabel={isFirstStep ? undefined : t('common.actions.back')}
          onSecondary={isFirstStep ? undefined : handlePrevious}
          secondaryDisabled={submitting}
          helperText={footerHelperText}
        />
      )}
    >
      {tradeWizardDraft.restored && shouldRestoreStoredDraft ? <InfoNotice tone="info" title={t('inventory.wizard.draftRestoredTitle')} body={t('inventory.wizard.draftRestoredBody')} /> : null}
      {showFeedIdeaPanel && routeIdeaKey && selectedFeedIdea ? (
        <AppCard style={[styles.feedIdeaPrefillCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
          <View style={styles.feedIdeaPrefillHeader}>
            <SemanticBadge label={t('trade.feedIdeas.badge')} tone="instruction" />
            <AppText style={styles.feedIdeaPrefillTitle}>{t('trade.feedIdeas.createFromIdeaTitle')}</AppText>
            <AppText style={[styles.feedIdeaPrefillBody, { color: theme.color.muted }]}>{t(selectedFeedIdea.type === 'open_need' ? 'trade.feedIdeas.createFromIdeaBodyOpenNeed' : selectedFeedIdea.type === 'open_offer' ? 'trade.feedIdeas.createFromIdeaBodyOpenOffer' : 'trade.feedIdeas.createFromIdeaBody')}</AppText>
          </View>
          <View style={styles.feedIdeaPrefillSides} accessibilityLabel={t('trade.feedIdeas.sidesLabel')}>
            {feedTradeIdeaHasNeed(selectedFeedIdea) ? (
              <View style={[styles.feedIdeaPrefillSide, { borderColor: theme.semantic.need.border }]}>
                <AppText style={[styles.feedIdeaPrefillSideLabel, { color: theme.color.muted }]}>{t('trade.labels.iNeed')}</AppText>
                <AppText style={styles.feedIdeaPrefillSideTitle}>{t(`trade.feedIdeas.items.${routeIdeaKey}.need`)}</AppText>
              </View>
            ) : null}
            {feedTradeIdeaHasOffer(selectedFeedIdea) ? (
              <View style={[styles.feedIdeaPrefillSide, { borderColor: theme.semantic.offer.border }]}>
                <AppText style={[styles.feedIdeaPrefillSideLabel, { color: theme.color.muted }]}>{t('trade.labels.iOffer')}</AppText>
                <AppText style={styles.feedIdeaPrefillSideTitle}>{t(`trade.feedIdeas.items.${routeIdeaKey}.offer`)}</AppText>
              </View>
            ) : null}
          </View>
          <Pressable accessibilityRole="button" disabled={Boolean(applyingIdea)} onPress={() => void applyFeedIdeaToDraft(routeIdeaKey)} style={({ pressed }) => [styles.feedIdeaPrefillAction, { backgroundColor: theme.semantic.trade.bg }, pressed && styles.pressed, applyingIdea && styles.disabled]}>
            <AppText style={[styles.feedIdeaPrefillActionText, { color: theme.color.inverseText }]}>{applyingIdea === routeIdeaKey ? t('trade.feedIdeas.applySaving') : t('trade.feedIdeas.applyAction')}</AppText>
          </Pressable>
        </AppCard>
      ) : null}
      {error ? <InfoNotice tone="danger" title={t('trade.create.couldNotPublish')} body={error} /> : null}
      {activeStepId === 'type' ? (
        <PostTypeStep theme={theme} postType={postType} onChoose={choosePostType} />
      ) : activeStepId === 'exchange' ? (
        <ExchangeStep
          theme={theme}
          postType={postType}
          needSelection={needSelection}
          offerSelection={offerSelection}
          selectedNeed={selectedNeed}
          selectedOffer={selectedOffer}
          onOpenNeedSourceSheet={() => openSourceSheet('need')}
          onOpenOfferSourceSheet={() => openSourceSheet('offer')}
        />
      ) : activeStepId === 'details' ? (
        <DetailsStep theme={theme} expiryDays={expiryDays} onExpiryChange={setExpiryDays} />
      ) : (
        <PreviewStep
          theme={theme}
          postType={postType}
          expiryDays={expiryDays}
          previewTrade={previewTrade}
          previewCardCount={previewCardCount}
        />
      )}
      <AppConfirmSheet {...unsavedChangesConfirm} />
      <AppActionSheet
        visible={menuSheetVisible}
        title={t('trade.create.wizardMenuTitle')}
        body={t('trade.create.wizardMenuBody')}
        actions={menuActions}
        cancelLabel={t('common.actions.cancel')}
        onClose={() => setMenuSheetVisible(false)}
      />
      <AppActionSheet
        visible={Boolean(sourceSheetSide)}
        title={t('trade.sidePicker.chooseSourceTitle', { item: sourceSheetItem })}
        actions={sourceSheetActions}
        cancelLabel={t('common.actions.cancel')}
        onClose={closeSourceSheet}
      />
      <AppActionSheet
        visible={helpSheetVisible}
        title={t('trade.create.wizardHelpTitle')}
        body={t('trade.create.wizardHelpBody')}
        actions={[]}
        cancelLabel={t('common.actions.close')}
        onClose={() => setHelpSheetVisible(false)}
      />
    </WizardShell>
  );
}

function PostTypeStep({ theme, postType, onChoose }: { theme: ThemeTokens; postType: TradePostType | null; onChoose: (postType: TradePostType) => void }) {
  return (
    <View style={styles.postTypeList}>
      {postTypeOptions.map((option) => <PostTypeCard key={option.value} option={option} selected={postType === option.value} theme={theme} onPress={() => onChoose(option.value)} />)}
    </View>
  );
}

function ExchangeStep({
  theme,
  postType,
  needSelection,
  offerSelection,
  selectedNeed,
  selectedOffer,
  onOpenNeedSourceSheet,
  onOpenOfferSourceSheet,
}: {
  theme: ThemeTokens;
  postType: TradePostType | null;
  needSelection: TradeCreateSideSelection | null;
  offerSelection: TradeCreateSideSelection | null;
  selectedNeed: NeedItem | null;
  selectedOffer: OfferItem | null;
  onOpenNeedSourceSheet: () => void;
  onOpenOfferSourceSheet: () => void;
}) {
  const { t } = useTranslation();
  const isFullTrade = postType === 'need_offer';
  const showNeed = postType !== 'open_offer';
  const showOffer = postType !== 'open_need';
  return (
    <View style={styles.exchangeStack}>
      {showNeed ? (
        <ExchangeSideBlock
          theme={theme}
          side="need"
          stepPrefix={isFullTrade ? '2.1' : undefined}
          title={t('trade.labels.iNeed')}
          emptyTitle={t('trade.create.selectedNeedEmptyTitle')}
          selection={needSelection}
          need={selectedNeed}
          offer={null}
          onOpenSourceSheet={onOpenNeedSourceSheet}
        />
      ) : null}
      {showOffer ? (
        <ExchangeSideBlock
          theme={theme}
          side="offer"
          stepPrefix={isFullTrade ? '2.2' : undefined}
          title={t('trade.labels.iOffer')}
          emptyTitle={t('trade.create.selectedOfferEmptyTitle')}
          selection={offerSelection}
          need={null}
          offer={selectedOffer}
          onOpenSourceSheet={onOpenOfferSourceSheet}
        />
      ) : null}
    </View>
  );
}

function ExchangeSideBlock({ theme, side, stepPrefix, title, emptyTitle, selection, need, offer, onOpenSourceSheet }: { theme: ThemeTokens; side: TradeCreateSide; stepPrefix?: string; title: string; emptyTitle: string; selection: TradeCreateSideSelection | null; need: NeedItem | null; offer: OfferItem | null; onOpenSourceSheet: () => void }) {
  const { t } = useTranslation();
  const item = need ?? offer;
  const meta = need ? needMeta(need, t) : offer ? offerMeta(offer, t) : '';
  const isCashPromise = selection?.kind === 'cash_promise';
  const selected = isCashPromise || Boolean(item);
  const tone = side === 'need' ? 'need' : 'offer';
  const launcherLabel = selected ? t('trade.sidePicker.changeSource') : emptyTitle;

  return (
    <AppCard style={styles.exchangeSideCard}>
      <View style={styles.exchangeSideHeader}>
        <SemanticBadge label={stepPrefix ? `${stepPrefix} · ${title}` : title} tone={tone} size="sm" />
        {selected ? <AppText style={[styles.exchangeSelectedFlag, { color: theme.semantic[tone].text }]}>{t('inventory.labels.selected')}</AppText> : null}
      </View>
      {selected ? (
        <SelectedExchangeSide
          theme={theme}
          tone={tone}
          emptyTitle={emptyTitle}
          selection={selection}
          item={item}
          meta={meta}
        />
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={onOpenSourceSheet}
                      style={({ pressed }) => [styles.sourceLauncherButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}
      >
        <View style={[styles.sourceLauncherIcon, { backgroundColor: theme.semantic[tone].softBg, borderColor: theme.semantic[tone].border }]}>
          <MobileIcon name={side} size={17} color={theme.semantic[tone].text} />
        </View>
        <AppText style={styles.sourceLauncherTitle} numberOfLines={1}>{launcherLabel}</AppText>
        <MobileIcon name="chevron-right" size={15} color={theme.color.muted} />
      </Pressable>
    </AppCard>
  );
}

function SelectedExchangeSide({ theme, tone, emptyTitle, selection, item, meta }: { theme: ThemeTokens; tone: 'need' | 'offer'; emptyTitle: string; selection: TradeCreateSideSelection | null; item: NeedItem | OfferItem | null; meta: string }) {
  const { t } = useTranslation();
  const isCashPromise = selection?.kind === 'cash_promise';

  return (
    <View style={[styles.exchangeSelectedBox, { backgroundColor: theme.color.surface, borderColor: theme.semantic[tone].border }]}>
      {isCashPromise ? (
        <View style={styles.exchangeSelectionCopy}>
          <AppText style={styles.exchangeSelectionTitle} numberOfLines={1}>{t('trade.cashPromise.title')}</AppText>
          <AppText style={[styles.exchangeSelectionMeta, { color: theme.semantic.warning.text }]} numberOfLines={1}>{formatMoney(selection.amountCents, selection.currency)} · {t('trade.cashPromise.notProcessed')}</AppText>
        </View>
      ) : item ? (
        <View style={styles.exchangeSelectionCopy}>
          <AppText style={styles.exchangeSelectionTitle} numberOfLines={1}>{item.title}</AppText>
          {meta ? <AppText style={[styles.exchangeSelectionMeta, { color: theme.color.muted }]} numberOfLines={1}>{meta}</AppText> : null}
        </View>
      ) : (
        <View style={styles.exchangeSelectionCopy}>
          <AppText style={styles.exchangeSelectionTitle} numberOfLines={1}>{emptyTitle}</AppText>
        </View>
      )}
      <MobileIcon name="proposal-accepted" size={17} color={theme.semantic[tone].text} />
    </View>
  );
}

function DetailsStep({ theme, expiryDays, onExpiryChange }: { theme: ThemeTokens; expiryDays: number | null; onExpiryChange: (days: number | null) => void }) {
  const { t } = useTranslation();
  const [expiryExpanded, setExpiryExpanded] = useState(false);
  const selectedExpiryLabel = t(expiryOptions.find((option) => option.days === expiryDays)?.labelKey ?? 'trade.expiry.noExpiry');

  return (
    <View style={styles.detailsStack}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setExpiryExpanded((expanded) => !expanded)}
                      style={({ pressed }) => [styles.detailsCompactRow, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}
      >
        <View style={styles.detailsCompactCopy}>
          <AppText style={styles.detailsCompactLabel}>{t('trade.create.expiryTitle')}</AppText>
          <AppText style={[styles.detailsCompactValue, { color: theme.color.muted }]}>{selectedExpiryLabel}</AppText>
        </View>
        <MobileIcon name="chevron-right" size={17} color={theme.color.muted} style={expiryExpanded ? styles.chevronExpanded : undefined} />
      </Pressable>

      {expiryExpanded ? (
        <View style={styles.expiryOptionList}>{expiryOptions.map((option) => {
          const selected = expiryDays === option.days;
          return (
            <Pressable
              key={option.labelKey}
              accessibilityRole="button"
              onPress={() => {
                onExpiryChange(option.days);
                setExpiryExpanded(false);
              }}
              style={({ pressed }) => [
                styles.expiryOptionRow,
                { backgroundColor: selected ? theme.semantic.proposal.softBg : theme.color.surface, borderColor: selected ? theme.semantic.proposal.border : theme.color.border },
                pressed && styles.pressed,
              ]}
            >
              <AppText style={[styles.expiryOptionText, { color: selected ? theme.semantic.proposal.text : theme.color.text }]}>{t(option.labelKey)}</AppText>
              {selected ? <MobileIcon name="proposal-accepted" size={17} color={theme.semantic.proposal.text} /> : null}
            </Pressable>
          );
        })}</View>
      ) : null}
    </View>
  );
}

function PreviewStep({ theme, postType, expiryDays, previewTrade, previewCardCount }: { theme: ThemeTokens; postType: TradePostType | null; expiryDays: number | null; previewTrade: TradeDeckItem; previewCardCount: number }) {
  const { t } = useTranslation();
  const expirySummary = expiryDays ? t('trade.create.expiryDaysSummary', { days: expiryDays }) : t('trade.expiry.noExpiry');
  const postTypeSummary = postType ? postTypeLabel(postType, t) : t('trade.labels.trade');
  const previewCountSummary = previewCardCount > 1 ? t('trade.create.previewCards', { count: previewCardCount }) : null;
  const tone = postType === 'open_need' ? 'need' : postType === 'open_offer' ? 'offer' : 'trade';

  return (
    <View style={styles.previewWrap}>
      <View style={styles.previewDeckStage}>
        <TradeSquareDeck trade={previewTrade} />
      </View>
      <View style={[styles.previewSummaryBar, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
        <SemanticBadge label={postTypeSummary} tone={tone} size="sm" />
        <AppText style={[styles.previewSummaryText, { color: theme.color.muted }]} numberOfLines={1}>{expirySummary}</AppText>
        {previewCountSummary ? <AppText style={[styles.previewSummaryText, { color: theme.color.muted }]} numberOfLines={1}>{previewCountSummary}</AppText> : null}
      </View>
    </View>
  );
}

function PostTypeCard({ option, selected, theme, onPress }: { option: PostTypeOption; selected: boolean; theme: ThemeTokens; onPress: () => void }) {
  const { t } = useTranslation();
  const semantic = theme.semantic[option.tone];
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.postTypeCard, { backgroundColor: selected ? semantic.softBg : theme.color.surface, borderColor: selected ? semantic.border : theme.color.border }, pressed && styles.pressed]}><View style={[styles.postTypeIcon, { backgroundColor: semantic.softBg, borderColor: semantic.border }]}><MobileIcon name={option.icon} size={19} color={semantic.text} /></View><View style={styles.postTypeCopy}><AppText style={styles.postTypeTitle}>{t(option.titleKey)}</AppText><AppText style={[styles.postTypeBody, { color: selected ? semantic.text : theme.color.muted }]} numberOfLines={1}>{t(option.labelKey)}</AppText></View>{selected ? <MobileIcon name="proposal-accepted" size={19} color={semantic.text} /> : null}</Pressable>;
}

const styles = StyleSheet.create({
  headerMenuButton: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  postTypeList: { gap: 10 },
  postTypeCard: { borderRadius: 20, borderWidth: 1, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  postTypeIcon: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  postTypeCopy: { flex: 1, gap: 3, minWidth: 0 },
  postTypeTitle: { fontSize: 17, fontWeight: '900', letterSpacing: -0.2 },
  postTypeBody: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
  exchangeStack: { gap: 12 },
  exchangeSideCard: { gap: 10 },
  exchangeSideHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  exchangeSelectedFlag: { fontSize: 11, fontWeight: '900', letterSpacing: 0.45, textTransform: 'uppercase' },
  exchangeSelectedBox: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  exchangeSelectionCopy: { flex: 1, minWidth: 0, gap: 3 },
  exchangeSelectionTitle: { fontSize: 16, fontWeight: '900' },
  exchangeSelectionMeta: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  sourceLauncherButton: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  sourceLauncherIcon: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sourceLauncherTitle: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: '900' },
  detailsStack: { gap: 9 },
  detailsCompactRow: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailsCompactCopy: { flex: 1, minWidth: 0, gap: 3 },
  detailsCompactLabel: { fontSize: 15, fontWeight: '900' },
  detailsCompactValue: { fontSize: 12, fontWeight: '800' },
  expiryOptionList: { gap: 7 },
  expiryOptionRow: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  expiryOptionText: { fontSize: 13, fontWeight: '900' },
  chevronExpanded: { transform: [{ rotate: '90deg' }] },
  previewWrap: { gap: 9 },
  previewDeckStage: { alignItems: 'center', justifyContent: 'center', marginHorizontal: -8 },
  previewSummaryBar: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
  previewSummaryText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.2 },
  feedIdeaPrefillCard: { gap: 14 },
  feedIdeaPrefillHeader: { gap: 6 },
  feedIdeaPrefillTitle: { fontSize: 17, fontWeight: '900', letterSpacing: -0.15 },
  feedIdeaPrefillBody: { fontSize: 13, lineHeight: 19, fontWeight: '700' },
  feedIdeaPrefillSides: { gap: 8 },
  feedIdeaPrefillSide: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  feedIdeaPrefillSideLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  feedIdeaPrefillSideTitle: { fontSize: 13, lineHeight: 18, fontWeight: '900' },
  feedIdeaPrefillAction: { borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 14 },
  feedIdeaPrefillActionText: { fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.78 },
});
