'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CASH_PROMISE_ACKNOWLEDGEMENT_TEXT, type CreateNeedRequest, type CreateOfferRequest, type CreateTradeRequest, type InventoryTemplateDto, type NeedDto, type OfferDto, type TradeDto, type TradeExchangeMode, type TradeNeedSideKind, type TradeOfferSideKind, type TradePostType, type WalletLimitsDto } from '@hellowhen/contracts';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildGeneratedTradeDisplay, getNextWizardStepId, getPreviousWizardStepId, type GeneratedTradeDisplayLabels, type WizardStepDefinition } from '@hellowhen/shared';
import { buildWebWizardDraftKey, useWebWizardDraft, WizardFooter, WizardShell } from '../wizard';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { formatWebMoney, formatWebShortDate } from '../../lib/webFormat';
import { isSupportedCurrency, type SupportedCurrency } from '../../lib/webMoneyPreferences';
import { isWebDemoDataEnabled } from '../../lib/demoMode';
import { mockNeeds, mockOffers, mockTrades } from '../../lib/mockData';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { normalizeInventoryList, toIsoDate } from '../inventory/inventoryPresentation';
import { TradeSidePicker } from './TradeSidePicker';
import { TradeStackDeck } from './TradeStackDeck';
import { feedTradeIdeaHasNeed, feedTradeIdeaHasOffer, feedTradeIdeas, getFeedTradeIdeaPostType, getLocalizedTemplateKeyCandidates, parseFeedTradeIdeaKey, type FeedTradeIdeaKey } from './tradeFeedIdeas';

type CreateTradeResponse = { trade?: unknown; id?: unknown };
type DuplicateTradeSummary = Pick<TradeDto, 'id' | 'status' | 'title'> & { postType?: TradePostType };
type DuplicateTradeConflict = DuplicateTradeSummary & { message: string };
type InventoryLoadState = 'idle' | 'loading' | 'live' | 'demo';

type SideMode = 'saved' | 'money' | 'cash_promise';
type PublishMode = TradePostType | '';
type TradeWizardStepId = 'type' | 'exchange' | 'details' | 'review';

type TradeCreateValues = {
  postType: PublishMode;
  needMode: SideMode;
  offerMode: SideMode;
  needId: string;
  offerId: string;
  amount: string;
  currency: SupportedCurrency;
  cashPromiseAmount: string;
  cashPromiseCurrency: SupportedCurrency;
  cashPromiseNote: string;
  cashPromiseAcknowledged: boolean;
  expiresAt: string;
};

type TradeCreateWizardPersistedDraft = {
  activeStepId: TradeWizardStepId;
  values: TradeCreateValues;
};

function normalizeCreatedTradeId(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const response = value as CreateTradeResponse;
  if (typeof response.id === 'string') return response.id;
  if (response.trade && typeof response.trade === 'object' && typeof (response.trade as { id?: unknown }).id === 'string') return (response.trade as { id: string }).id;
  return null;
}

function normalizeTemplateResponse(value: unknown): InventoryTemplateDto[] {
  if (!value || typeof value !== 'object') return [];
  const templates = (value as { templates?: unknown }).templates;
  return Array.isArray(templates) ? templates as InventoryTemplateDto[] : [];
}

function clonedNeedFromResponse(value: unknown): NeedDto | null {
  if (!value || typeof value !== 'object') return null;
  const need = (value as { need?: unknown }).need;
  return need && typeof need === 'object' && typeof (need as { id?: unknown }).id === 'string' ? need as NeedDto : null;
}

function clonedOfferFromResponse(value: unknown): OfferDto | null {
  if (!value || typeof value !== 'object') return null;
  const offer = (value as { offer?: unknown }).offer;
  return offer && typeof offer === 'object' && typeof (offer as { id?: unknown }).id === 'string' ? offer as OfferDto : null;
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


function parseMoneyToCents(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return 0;
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return Number.NaN;
  return Math.round(amount * 100);
}

function moneyInputFromCents(cents: number, currency: SupportedCurrency) {
  return formatWebMoney(cents, currency).replace(/[A-Z]{3}/i, '').trim();
}

function getPreferredCurrency(value?: string | null): SupportedCurrency {
  return value && isSupportedCurrency(value) ? value : 'eur';
}


const TRADE_POST_TYPE_OPTIONS: Array<{
  value: TradePostType;
  labelKey: string;
  badgeKey: string;
  titleKey: string;
  bodyKey: string;
}> = [
  {
    value: 'need_offer',
    labelKey: 'trade.postTypes.needOffer',
    badgeKey: 'trade.create.completeTrade',
    titleKey: 'trade.create.knowBothSides',
    bodyKey: 'trade.create.needOfferBody',
  },
  {
    value: 'open_need',
    labelKey: 'trade.postTypes.openNeed',
    badgeKey: 'trade.create.othersProposeOffers',
    titleKey: 'trade.create.onlyPostNeed',
    bodyKey: 'trade.create.openNeedBody',
  },
  {
    value: 'open_offer',
    labelKey: 'trade.postTypes.openOffer',
    badgeKey: 'trade.create.othersProposeNeeds',
    titleKey: 'trade.create.onlyPostOffer',
    bodyKey: 'trade.create.openOfferBody',
  },
];

type Translator = (key: string, values?: Record<string, string | number | boolean | null | undefined>) => string;

function parseTradePostType(value?: string | null): PublishMode {
  return value === 'need_offer' || value === 'open_need' || value === 'open_offer' ? value : '';
}

function parseIdeaExpiryDaysParam(value?: string | null): number | null | undefined {
  if (!value || value === 'default') return undefined;
  if (value === 'none') return null;
  const days = Number(value);
  return [1, 3, 7, 14].includes(days) ? days : undefined;
}

function buildDateInputFromExpiryDays(days: number | null | undefined) {
  if (days === undefined || days === null) return '';
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function postTypeLabel(postType: PublishMode, t: Translator) {
  const option = TRADE_POST_TYPE_OPTIONS.find((item) => item.value === postType);
  return option ? t(option.labelKey) : t('trade.create.choosePublishType');
}

function getInitialWizardStep(postType: PublishMode, needId: string, offerId: string): TradeWizardStepId {
  if (!postType) return 'type';
  if (postType === 'open_need') return needId ? 'details' : 'exchange';
  if (postType === 'open_offer') return offerId ? 'details' : 'exchange';
  return needId && offerId ? 'details' : 'exchange';
}

function normalizeTradeWizardStepId(value: unknown): TradeWizardStepId {
  if (value === 'type' || value === 'exchange' || value === 'details' || value === 'review') return value;
  if (value === 'need' || value === 'offer') return 'exchange';
  return 'type';
}

function createTradeHrefWithPostType(next: { postType?: PublishMode; needId?: string; offerId?: string }) {
  const params = new URLSearchParams();
  const postType = next.postType;
  if (postType) params.set('postType', postType);
  if (next.needId && postType !== 'open_offer') params.set('needId', next.needId);
  if (next.offerId && postType !== 'open_need') params.set('offerId', next.offerId);
  const query = params.toString();
  return `/trades/create${query ? `?${query}` : ''}`;
}

function createTradeFullHrefWithPostType(next: { postType?: PublishMode; needId?: string; offerId?: string }) {
  const params = new URLSearchParams();
  const postType = next.postType;
  if (postType) params.set('postType', postType);
  if (next.needId && postType !== 'open_offer') params.set('needId', next.needId);
  if (next.offerId && postType !== 'open_need') params.set('offerId', next.offerId);
  const query = params.toString();
  return `/trades/create/full${query ? `?${query}` : ''}`;
}

function findNeed(needs: NeedDto[], needId: string) {
  return needs.find((need) => need.id === needId) ?? null;
}

function findOffer(offers: OfferDto[], offerId: string) {
  return offers.find((offer) => offer.id === offerId) ?? null;
}

function createSideChooseHref(side: 'need' | 'offer', values: TradeCreateValues) {
  const params = new URLSearchParams();
  if (values.postType) params.set('postType', values.postType);
  if (values.needId && values.postType !== 'open_offer') params.set('needId', values.needId);
  if (values.offerId && values.postType !== 'open_need') params.set('offerId', values.offerId);
  const query = params.toString();
  return `/trades/create/choose-${side}${query ? `?${query}` : ''}`;
}

function createSideSourceHref(side: 'need' | 'offer', values: TradeCreateValues) {
  const params = new URLSearchParams();
  if (values.postType) params.set('postType', values.postType);
  if (values.needId && values.postType !== 'open_offer') params.set('needId', values.needId);
  if (values.offerId && values.postType !== 'open_need') params.set('offerId', values.offerId);
  const query = params.toString();
  return `/trades/create/choose-${side}-source${query ? `?${query}` : ''}`;
}

function createSideNewHref(side: 'need' | 'offer', values: TradeCreateValues) {
  const params = new URLSearchParams();
  if (values.postType) params.set('postType', values.postType);
  if (values.needId && values.postType !== 'open_offer') params.set('needId', values.needId);
  if (values.offerId && values.postType !== 'open_need') params.set('offerId', values.offerId);
  const query = params.toString();
  return `/trades/create/choose-${side}/new${query ? `?${query}` : ''}`;
}


function tradeDisplayLabels(t: Translator): Partial<GeneratedTradeDisplayLabels> {
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

function moneySideLabel(amountCents: number, currency: SupportedCurrency) {
  return formatWebMoney(amountCents, currency);
}

function cashPromiseSideLabel(amountCents: number, currency: SupportedCurrency, t: Translator) {
  return `${t('trade.cashPromise.title')} · ${formatWebMoney(amountCents, currency)}`;
}

function buildWebGeneratedTradeDisplay(values: TradeCreateValues, needs: NeedDto[], offers: OfferDto[], amountCents: number, cashPromiseAmountCents: number, t: Translator) {
  const need = findNeed(needs, values.needId);
  const offer = findOffer(offers, values.offerId);
  const moneyLabel = moneySideLabel(Number.isFinite(amountCents) ? amountCents : 0, values.currency);
  const cashLabel = cashPromiseSideLabel(Number.isFinite(cashPromiseAmountCents) ? cashPromiseAmountCents : 0, values.cashPromiseCurrency, t);

  return buildGeneratedTradeDisplay({
    postType: values.postType || 'need_offer',
    need: values.needMode === 'cash_promise' ? { moneyLabel: cashLabel } : values.needMode === 'money' ? { moneyLabel } : need,
    offer: values.offerMode === 'cash_promise' ? { moneyLabel: cashLabel } : values.offerMode === 'money' ? { moneyLabel } : offer,
    labels: tradeDisplayLabels(t),
  });
}


function isActiveNeed(need: NeedDto) {
  return need.status === 'active' || need.status === 'draft';
}

function isActiveOffer(offer: OfferDto) {
  return offer.status === 'active' || offer.status === 'draft';
}

function normalizeTradeList(value: unknown): TradeDto[] {
  if (Array.isArray(value)) return value as TradeDto[];
  if (value && typeof value === 'object') {
    const maybeTrades = (value as { trades?: unknown }).trades;
    if (Array.isArray(maybeTrades)) return maybeTrades as TradeDto[];
  }
  return [];
}

const duplicateBlockingTradeStatuses = ['draft', 'active', 'funded', 'in_progress', 'submitted', 'disputed'] as const;

function isDuplicateBlockingTradeStatus(status: TradeDto['status']) {
  return (duplicateBlockingTradeStatuses as readonly string[]).includes(status);
}

function tradeNeedId(trade: TradeDto) {
  return trade.needId ?? trade.need?.id ?? null;
}

function tradeOfferId(trade: TradeDto) {
  return trade.offerId ?? trade.offer?.id ?? null;
}

function findDuplicateTradePair(trades: TradeDto[], needId?: string | null, offerId?: string | null) {
  if (!needId || !offerId) return null;
  return trades.find((trade) => (trade.postType ?? 'need_offer') === 'need_offer' && tradeNeedId(trade) === needId && tradeOfferId(trade) === offerId && isDuplicateBlockingTradeStatus(trade.status)) ?? null;
}

function findDuplicateOpenNeed(trades: TradeDto[], needId?: string | null) {
  if (!needId) return null;
  return trades.find((trade) => trade.postType === 'open_need' && tradeNeedId(trade) === needId && isDuplicateBlockingTradeStatus(trade.status)) ?? null;
}

function findDuplicateOpenOffer(trades: TradeDto[], offerId?: string | null) {
  if (!offerId) return null;
  return trades.find((trade) => trade.postType === 'open_offer' && tradeOfferId(trade) === offerId && isDuplicateBlockingTradeStatus(trade.status)) ?? null;
}

function duplicateTradeMessage(trade: DuplicateTradeSummary, t: Translator) {
  const status = t(`trade.statuses.${trade.status}`);
  if (trade.postType === 'open_need') {
    return trade.status === 'active'
      ? t('trade.create.duplicateActiveOpenNeed')
      : t('trade.create.duplicateExistingOpenNeed', { status });
  }
  if (trade.postType === 'open_offer') {
    return trade.status === 'active'
      ? t('trade.create.duplicateActiveOpenOffer')
      : t('trade.create.duplicateExistingOpenOffer', { status });
  }
  return trade.status === 'active'
    ? t('trade.create.duplicateActiveTrade')
    : t('trade.create.duplicateExistingTrade', { status });
}

function getDuplicateTradeConflict(error: unknown): DuplicateTradeConflict | null {
  if (!error || typeof error !== 'object') return null;
  const body = (error as { body?: unknown }).body;
  if (!body || typeof body !== 'object') return null;
  const payload = body as { error?: unknown; message?: unknown; tradeId?: unknown; tradeStatus?: unknown; tradeTitle?: unknown };
  const errorCode = typeof payload.error === 'string' ? payload.error : '';
  if (!['duplicate_trade_pair', 'duplicate_open_need', 'duplicate_open_offer'].includes(errorCode) || typeof payload.tradeId !== 'string') return null;
  const postType: TradePostType = errorCode === 'duplicate_open_need' ? 'open_need' : errorCode === 'duplicate_open_offer' ? 'open_offer' : 'need_offer';
  return {
    id: payload.tradeId,
    status: typeof payload.tradeStatus === 'string' ? payload.tradeStatus as TradeDto['status'] : 'active',
    title: typeof payload.tradeTitle === 'string' ? payload.tradeTitle : 'Existing trade',
    postType,
    message: typeof payload.message === 'string' ? payload.message : ''
  };
}

function buildPreviewTrade(input: {
  ownerId?: string | null;
  postType: TradePostType;
  title: string;
  description: string;
  need: NeedDto | null;
  offer: OfferDto | null;
  amountCents: number;
  currency: SupportedCurrency;
  cashPromise?: { side: 'need' | 'offer'; amountCents: number; currency: string; note?: string | null } | null;
  expiresAt: string | null;
}): TradeDto {
  const now = new Date().toISOString();
  return {
    id: 'preview-trade',
    ownerId: input.ownerId ?? 'preview-owner',
    providerId: null,
    needId: input.need?.id ?? null,
    offerId: input.offer?.id ?? null,
    postType: input.postType,
    previewTheme: 'default',
    title: input.title,
    description: input.description,
    creditAmount: 0,
    amountCents: input.amountCents,
    currency: input.currency,
    cashPromise: input.cashPromise ? { id: 'preview-cash-promise', tradeId: 'preview-trade', proposalId: null, side: input.cashPromise.side, amountCents: input.cashPromise.amountCents, currency: input.cashPromise.currency, note: input.cashPromise.note ?? null, acknowledgementText: CASH_PROMISE_ACKNOWLEDGEMENT_TEXT, acknowledgedById: input.ownerId ?? 'preview-owner', acknowledgedAt: now, createdAt: now, updatedAt: now } : null,
    status: 'active',
    isPublic: true,
    createdAt: now,
    updatedAt: now,
    expiresAt: input.expiresAt,
    closedAt: null,
    need: input.need,
    offer: input.offer,
    media: [],
  };
}

export function TradeCreateClient({ initialNeedId = '', initialOfferId = '', initialPostType = '', initialIdea = '' }: { initialNeedId?: string; initialOfferId?: string; initialPostType?: string; initialIdea?: string }) {
  const auth = useWebAuth();
  const { t, language } = useWebTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeNeedId = searchParams.get('needId') ?? initialNeedId;
  const routeOfferId = searchParams.get('offerId') ?? initialOfferId;
  const routeIdeaKey = parseFeedTradeIdeaKey(searchParams.get('idea') ?? initialIdea);
  const routeSelectedFeedIdea = routeIdeaKey ? feedTradeIdeas[routeIdeaKey] : null;
  const routeIdeaPostType = routeSelectedFeedIdea ? getFeedTradeIdeaPostType(routeSelectedFeedIdea) : '';
  const routeExpiryDays = parseIdeaExpiryDaysParam(searchParams.get('expiryDays'));
  const routeExpiryDateInput = buildDateInputFromExpiryDays(routeExpiryDays);
  const routePostType = parseTradePostType(searchParams.get('postType') ?? initialPostType) || routeIdeaPostType || (routeNeedId || routeOfferId ? 'need_offer' : '');
  const preferredCurrency = getPreferredCurrency(auth.user?.profile?.preferredCurrency);
  const demoDataEnabled = isWebDemoDataEnabled();
  const [needs, setNeeds] = useState<NeedDto[]>(() => demoDataEnabled ? mockNeeds : []);
  const [offers, setOffers] = useState<OfferDto[]>(() => demoDataEnabled ? mockOffers : []);
  const [trades, setTrades] = useState<TradeDto[]>(() => demoDataEnabled ? mockTrades : []);
  const [loadState, setLoadState] = useState<InventoryLoadState>('idle');
  const [values, setValues] = useState<TradeCreateValues>(() => ({
    postType: routePostType,
    needMode: 'saved',
    offerMode: 'saved',
    needId: routeNeedId,
    offerId: routeOfferId,
    amount: '',
    currency: preferredCurrency,
    cashPromiseAmount: '',
    cashPromiseCurrency: preferredCurrency,
    cashPromiseNote: '',
    cashPromiseAcknowledged: false,
    expiresAt: routeExpiryDateInput,
  }));
  const [activeStepId, setActiveStepId] = useState<TradeWizardStepId>(() => getInitialWizardStep(routePostType, routeNeedId, routeOfferId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [duplicateConflict, setDuplicateConflict] = useState<DuplicateTradeConflict | null>(null);
  const [limits, setLimits] = useState<WalletLimitsDto | null>(null);
  const [expiryHelpOpen, setExpiryHelpOpen] = useState(false);
  const [wizardMenuOpen, setWizardMenuOpen] = useState(false);
  const [wizardHelpOpen, setWizardHelpOpen] = useState(false);
  const [applyingIdea, setApplyingIdea] = useState<FeedTradeIdeaKey | null>(null);
  const [appliedIdeaKey, setAppliedIdeaKey] = useState<FeedTradeIdeaKey | null>(null);
  const [autoApplyAttemptedIdeaKey, setAutoApplyAttemptedIdeaKey] = useState<FeedTradeIdeaKey | null>(null);

  const persistedDraft = useMemo<TradeCreateWizardPersistedDraft>(() => ({
    activeStepId,
    values,
  }), [activeStepId, values]);
  const draftStorageKey = useMemo(() => buildWebWizardDraftKey('create-trade', auth.user?.id), [auth.user?.id]);
  const shouldRestoreStoredDraft = !routePostType && !routeNeedId && !routeOfferId && !routeIdeaKey && routeExpiryDays === undefined;
  const restoreDraft = useCallback((savedDraft: TradeCreateWizardPersistedDraft) => {
    if (!shouldRestoreStoredDraft) return;
    setValues((current) => ({
      ...current,
      ...(savedDraft.values ?? {}),
      currency: getPreferredCurrency(savedDraft.values?.currency),
      cashPromiseCurrency: getPreferredCurrency(savedDraft.values?.cashPromiseCurrency),
    }));
    setActiveStepId(normalizeTradeWizardStepId(savedDraft.activeStepId));
  }, [shouldRestoreStoredDraft]);
  const tradeWizardDraft = useWebWizardDraft({
    storageKey: draftStorageKey,
    draft: persistedDraft,
    enabled: !saving,
    hasContent: (candidate) => {
      const candidateValues = candidate.values;
      return Boolean(
        candidateValues?.postType
        || candidateValues?.needId
        || candidateValues?.offerId
        || candidateValues?.amount?.trim()
        || candidateValues?.cashPromiseAmount?.trim()
        || candidateValues?.cashPromiseNote?.trim()
        || candidateValues?.cashPromiseAcknowledged
        || candidateValues?.expiresAt?.trim(),
      );
    },
    onRestore: restoreDraft,
  });


  useEffect(() => {
    setValues((current) => {
      const moneyUnavailable = !betaFeatures.moneyTradesEnabled && (current.needMode === 'money' || current.offerMode === 'money');
      const cashPromiseUnavailable = (!betaFeatures.cashPromiseEnabled || !betaFeatures.cashPromiseVisible) && (current.needMode === 'cash_promise' || current.offerMode === 'cash_promise');
      if (!moneyUnavailable && !cashPromiseUnavailable) return current;
      return {
        ...current,
        needMode: current.needMode === 'money' || current.needMode === 'cash_promise' ? 'saved' : current.needMode,
        offerMode: current.offerMode === 'money' || current.offerMode === 'cash_promise' ? 'saved' : current.offerMode,
        amount: moneyUnavailable ? '' : current.amount,
        cashPromiseAmount: cashPromiseUnavailable ? '' : current.cashPromiseAmount,
        cashPromiseNote: cashPromiseUnavailable ? '' : current.cashPromiseNote,
        cashPromiseAcknowledged: cashPromiseUnavailable ? false : current.cashPromiseAcknowledged,
      };
    });
  }, []);

  useEffect(() => {
    if (!routePostType && !routeNeedId && !routeOfferId && routeExpiryDays === undefined) return;
    setValues((current) => {
      const nextPostType = routePostType;
      const nextNeedId = routePostType === 'open_offer' ? '' : routeNeedId || '';
      const nextOfferId = routePostType === 'open_need' ? '' : routeOfferId || '';
      const nextCurrency = current.currency || preferredCurrency;
      const nextExpiresAt = routeExpiryDays === undefined ? current.expiresAt : routeExpiryDateInput;
      if (current.currency === nextCurrency && current.postType === nextPostType && current.needId === nextNeedId && current.offerId === nextOfferId && current.expiresAt === nextExpiresAt) {
        return current;
      }
      return {
        ...current,
        postType: nextPostType,
        currency: nextCurrency,
        needMode: nextPostType === 'need_offer' ? current.needMode : 'saved',
        offerMode: nextPostType === 'need_offer' ? current.offerMode : 'saved',
        amount: nextPostType === 'need_offer' ? current.amount : '',
        cashPromiseAmount: nextPostType === 'need_offer' ? current.cashPromiseAmount : '',
        cashPromiseNote: nextPostType === 'need_offer' ? current.cashPromiseNote : '',
        cashPromiseAcknowledged: nextPostType === 'need_offer' ? current.cashPromiseAcknowledged : false,
        needId: nextNeedId,
        offerId: nextOfferId,
        expiresAt: nextExpiresAt,
      };
    });
  }, [preferredCurrency, routeExpiryDateInput, routeExpiryDays, routeNeedId, routeOfferId, routePostType]);

  useEffect(() => {
    setDuplicateConflict(null);
  }, [values.needId, values.offerId, values.postType]);

  useEffect(() => {
    if (!routePostType) return;
    setActiveStepId(getInitialWizardStep(routePostType, routeNeedId, routeOfferId));
  }, [routeNeedId, routeOfferId, routePostType]);


  useEffect(() => {
    if (!auth.hydrated) return;
    let mounted = true;
    async function loadInventory() {
      setLoadState('loading');
      if (!auth.isAuthenticated) {
        setNeeds(demoDataEnabled ? mockNeeds : []);
        setOffers(demoDataEnabled ? mockOffers : []);
        setTrades(demoDataEnabled ? mockTrades : []);
        setLoadState(demoDataEnabled ? 'demo' : 'idle');
        return;
      }
      try {
        const [needsResponse, offersResponse, limitsResponse, tradesResponse] = await Promise.all([
          api.needs.mine(),
          api.offers.mine(),
          betaFeatures.moneyFeaturesVisible ? api.wallet.limits() : Promise.resolve({ limits: null }),
          api.trades.mine().catch(() => ({ trades: [] })),
        ]);
        if (!mounted) return;
        const liveNeeds = normalizeInventoryList(needsResponse, 'need') as NeedDto[];
        const liveOffers = normalizeInventoryList(offersResponse, 'offer') as OfferDto[];
        setNeeds(liveNeeds.length ? liveNeeds : []);
        setOffers(liveOffers.length ? liveOffers : []);
        setTrades(normalizeTradeList(tradesResponse));
        setLimits((limitsResponse as { limits?: WalletLimitsDto }).limits ?? null);
        setLoadState('live');
      } catch {
        if (!mounted) return;
        setNeeds(demoDataEnabled ? mockNeeds : []);
        setOffers(demoDataEnabled ? mockOffers : []);
        setTrades(demoDataEnabled ? mockTrades : []);
        setLoadState(demoDataEnabled ? 'demo' : 'idle');
        setNotice(demoDataEnabled ? t('trade.create.loadingInventoryNoticeDemo') : t('trade.create.loadingInventoryNoticeLive'));
      }
    }
    void loadInventory();
    return () => { mounted = false; };
  }, [auth.hydrated, auth.isAuthenticated, demoDataEnabled]);

  const selectableNeeds = useMemo(() => needs.filter(isActiveNeed), [needs]);
  const selectableOffers = useMemo(() => offers.filter(isActiveOffer), [offers]);
  const selectedNeed = values.needMode === 'saved' ? findNeed(selectableNeeds, values.needId) : null;
  const selectedOffer = values.offerMode === 'saved' ? findOffer(selectableOffers, values.offerId) : null;
  const amountCents = parseMoneyToCents(values.amount);
  const cashPromiseAmountCents = parseMoneyToCents(values.cashPromiseAmount);
  const duplicateTrade = values.postType === 'need_offer' && values.needMode === 'saved' && values.offerMode === 'saved'
    ? findDuplicateTradePair(trades, selectedNeed?.id, selectedOffer?.id)
    : values.postType === 'open_need'
      ? findDuplicateOpenNeed(trades, selectedNeed?.id)
      : values.postType === 'open_offer'
        ? findDuplicateOpenOffer(trades, selectedOffer?.id)
        : null;
  const visibleDuplicateTrade: DuplicateTradeConflict | DuplicateTradeSummary | null = duplicateTrade ?? duplicateConflict;
  const usesMoney = values.postType === 'need_offer' && (values.needMode === 'money' || values.offerMode === 'money');
  const usesCashPromise = values.postType === 'need_offer' && (values.needMode === 'cash_promise' || values.offerMode === 'cash_promise');
  const blocksMoneyMoney = values.postType === 'need_offer' && values.needMode === 'money' && values.offerMode === 'money';
  const blocksCashPromiseBothSides = values.postType === 'need_offer' && values.needMode === 'cash_promise' && values.offerMode === 'cash_promise';
  const generatedDisplay = values.postType && Number.isFinite(amountCents) && Number.isFinite(cashPromiseAmountCents) ? buildWebGeneratedTradeDisplay(values, selectableNeeds, selectableOffers, amountCents || 0, cashPromiseAmountCents || 0, t) : { title: '', description: '' };
  const autoTitle = generatedDisplay.title;
  const autoDescription = generatedDisplay.description;

  useEffect(() => {
    const inventoryReady = loadState === 'live' || loadState === 'demo';
    if (!inventoryReady) return;
    setValues((current) => {
      const currentNeedExists = !current.needId || selectableNeeds.some((need) => need.id === current.needId);
      const currentOfferExists = !current.offerId || selectableOffers.some((offer) => offer.id === current.offerId);
      const nextNeedId = currentNeedExists ? current.needId : '';
      const nextOfferId = currentOfferExists ? current.offerId : '';
      if (nextNeedId === current.needId && nextOfferId === current.offerId) return current;
      return { ...current, needId: nextNeedId, offerId: nextOfferId };
    });
  }, [loadState, selectableNeeds, selectableOffers]);

  function updateValue<Key extends keyof TradeCreateValues>(key: Key, value: TradeCreateValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
    setError('');
    setDuplicateConflict(null);
  }

  function validate() {
    if (!auth.hydrated) return t('trade.create.checkingSession');
    if (!auth.isAuthenticated) return t('trade.create.validationSignedOut');
    if (!values.postType) return t('trade.create.choosePublishType');
    if (usesMoney && !betaFeatures.moneyTradesEnabled) return t('trade.create.validationSavedSidesOnly');
    if (usesCashPromise && (!betaFeatures.cashPromiseEnabled || !betaFeatures.cashPromiseVisible)) return t('trade.cashPromise.hidden');
    if (blocksMoneyMoney) return t('trade.create.validationSavedSidesOnly');
    if (blocksCashPromiseBothSides) return t('trade.cashPromise.oneSideOnly');
    if ((values.postType === 'need_offer' || values.postType === 'open_need') && values.needMode === 'saved' && !selectedNeed) return values.postType === 'open_need' ? t('trade.create.validationOpenNeed') : t('trade.create.validationNeed');
    if ((values.postType === 'need_offer' || values.postType === 'open_offer') && values.offerMode === 'saved' && !selectedOffer) return values.postType === 'open_offer' ? t('trade.create.validationOpenOffer') : t('trade.create.validationOffer');
    if (usesCashPromise && (!Number.isFinite(cashPromiseAmountCents) || cashPromiseAmountCents < 100)) return t('trade.cashPromise.validationAmount');
    if (usesCashPromise && !values.cashPromiseAcknowledged) return t('trade.cashPromise.validationAcknowledgement');
    if (visibleDuplicateTrade) return `${duplicateTradeMessage(visibleDuplicateTrade, t)} ${t('trade.create.duplicateResolution')}`;
    if (usesMoney && (!Number.isFinite(amountCents) || amountCents < 100)) return t('trade.create.validationMoneyMinimum');
    if (usesMoney && limits && !limits.moneyTradesEnabled) return t('trade.create.validationMoneyDisabled');
    if (usesMoney && limits && amountCents > limits.perTradeMoneyCapCents) return t('trade.create.validationMoneyLimit', { amount: formatWebMoney(limits.perTradeMoneyCapCents, values.currency) });
    return '';
  }

  async function handlePublish() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const postType = values.postType || 'need_offer';
    const payload: CreateTradeRequest = {
      postType,
      needKind: (postType === 'need_offer' && betaFeatures.moneyTradesEnabled && values.needMode === 'money' ? 'money' : 'need') as TradeNeedSideKind,
      offerKind: (postType === 'need_offer' && betaFeatures.moneyTradesEnabled && values.offerMode === 'money' ? 'money' : 'offer') as TradeOfferSideKind,
      previewTheme: 'default',
      needId: postType !== 'open_offer' && values.needMode === 'saved' ? selectedNeed?.id : undefined,
      offerId: postType !== 'open_need' && values.offerMode === 'saved' ? selectedOffer?.id : undefined,
      creditAmount: 0,
      amountCents: postType === 'need_offer' && betaFeatures.moneyTradesEnabled && usesMoney ? amountCents : 0,
      currency: values.currency,
      ...(usesCashPromise ? { cashPromise: { side: values.needMode === 'cash_promise' ? 'need' as const : 'offer' as const, amountCents: cashPromiseAmountCents, currency: values.cashPromiseCurrency, note: values.cashPromiseNote.trim() || undefined, acknowledgementAccepted: true as const, acknowledgementText: CASH_PROMISE_ACKNOWLEDGEMENT_TEXT } } : {}),
      expiresAt: toIsoDate(values.expiresAt),
    };

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await api.trades.create(payload);
      const tradeId = normalizeCreatedTradeId(response);
      tradeWizardDraft.clearDraft();
      setValues({
        postType: '',
        needMode: 'saved',
        offerMode: 'saved',
        needId: '',
        offerId: '',
        amount: '',
        currency: preferredCurrency,
        cashPromiseAmount: '',
        cashPromiseCurrency: preferredCurrency,
        cashPromiseNote: '',
        cashPromiseAcknowledged: false,
        expiresAt: '',
      });
      setActiveStepId('type');
      router.push(tradeId ? `/trades/${tradeId}` : '/trades');
      router.refresh();
    } catch (cause) {
      const duplicate = getDuplicateTradeConflict(cause);
      if (duplicate) {
        setDuplicateConflict(duplicate);
        setError(duplicate.message);
      } else {
        setError(getFriendlyApiErrorMessage(cause));
      }
    } finally {
      setSaving(false);
    }
  }

  const selectedFeedIdea = routeSelectedFeedIdea;
  const showFeedIdeaPanel = Boolean(routeIdeaKey && selectedFeedIdea && appliedIdeaKey !== routeIdeaKey);

  async function loadStarterTemplate(kind: 'need' | 'offer', templateKey: string) {
    const templatesResponse = await api.inventoryTemplates.list({ sourceType: 'hellowhen', kind, language, take: 100 });
    const templateKeys = getLocalizedTemplateKeyCandidates(templateKey);
    return normalizeTemplateResponse(templatesResponse).find((template) => template.kind === kind && templateKeys.includes(template.key)) ?? null;
  }

  async function createFallbackNeedFromFeedIdea(ideaKey: FeedTradeIdeaKey) {
    const needMetaText = t(`trade.feedIdeas.items.${ideaKey}.needMeta`);
    const payload: CreateNeedRequest = {
      title: t(`trade.feedIdeas.items.${ideaKey}.need`),
      description: t(`trade.feedIdeas.items.${ideaKey}.body`),
      defaultLanguage: language,
      translations: [],
      status: 'active',
      itemType: 'service',
      category: firstMetaPart(needMetaText),
      mode: modeFromMeta(needMetaText),
      tags: [],
      previewTheme: 'default',
    };
    const response = await api.needs.create(payload);
    const createdNeed = clonedNeedFromResponse(response);
    if (!createdNeed) throw new Error(t('trade.feedIdeas.applyError'));
    return createdNeed;
  }

  async function createFallbackOfferFromFeedIdea(ideaKey: FeedTradeIdeaKey) {
    const offerMetaText = t(`trade.feedIdeas.items.${ideaKey}.offerMeta`);
    const payload: CreateOfferRequest = {
      title: t(`trade.feedIdeas.items.${ideaKey}.offer`),
      description: t(`trade.feedIdeas.items.${ideaKey}.body`),
      defaultLanguage: language,
      translations: [],
      status: 'active',
      itemType: 'service',
      category: firstMetaPart(offerMetaText),
      mode: modeFromMeta(offerMetaText),
      includes: [],
      tags: [],
      previewTheme: 'default',
    };
    const response = await api.offers.create(payload);
    const createdOffer = clonedOfferFromResponse(response);
    if (!createdOffer) throw new Error(t('trade.feedIdeas.applyError'));
    return createdOffer;
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
    setError('');
    setNotice('');
    try {
      const [clonedNeed, clonedOffer] = await Promise.all([
        feedTradeIdeaHasNeed(idea) ? cloneOrCreateStarterNeed(ideaKey, idea.needTemplateKey) : Promise.resolve(null),
        feedTradeIdeaHasOffer(idea) ? cloneOrCreateStarterOffer(ideaKey, idea.offerTemplateKey) : Promise.resolve(null),
      ]);
      const nextPostType = getFeedTradeIdeaPostType(idea);

      if (clonedNeed) setNeeds((current) => [clonedNeed, ...current.filter((need) => need.id !== clonedNeed.id)]);
      if (clonedOffer) setOffers((current) => [clonedOffer, ...current.filter((offer) => offer.id !== clonedOffer.id)]);
      setValues((current) => ({
        ...current,
        postType: nextPostType,
        needMode: 'saved',
        offerMode: 'saved',
        needId: clonedNeed?.id ?? '',
        offerId: clonedOffer?.id ?? '',
        amount: '',
        cashPromiseAmount: '',
        cashPromiseNote: '',
        cashPromiseAcknowledged: false,
        expiresAt: routeExpiryDays === undefined ? current.expiresAt : routeExpiryDateInput,
      }));
      setActiveStepId('review');
      setAppliedIdeaKey(ideaKey);
      setNotice(t(nextPostType === 'open_need' ? 'trade.feedIdeas.applySuccessOpenNeed' : nextPostType === 'open_offer' ? 'trade.feedIdeas.applySuccessOpenOffer' : 'trade.feedIdeas.applySuccess'));
      router.replace('/trades/create', { scroll: false });
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError, t('trade.feedIdeas.applyError')));
    } finally {
      setApplyingIdea(null);
    }
  }

  useEffect(() => {
    if (!auth.hydrated || !auth.isAuthenticated || (loadState !== 'live' && loadState !== 'demo') || !routeIdeaKey || !selectedFeedIdea || appliedIdeaKey === routeIdeaKey || autoApplyAttemptedIdeaKey === routeIdeaKey || applyingIdea) return;
    setAutoApplyAttemptedIdeaKey(routeIdeaKey);
    void applyFeedIdeaToDraft(routeIdeaKey);
  }, [appliedIdeaKey, applyingIdea, auth.hydrated, auth.isAuthenticated, autoApplyAttemptedIdeaKey, loadState, routeIdeaKey, selectedFeedIdea]);

  const amountPreview = usesMoney && Number.isFinite(amountCents) && amountCents > 0 ? formatWebMoney(amountCents, values.currency) : usesCashPromise && Number.isFinite(cashPromiseAmountCents) && cashPromiseAmountCents > 0 ? formatWebMoney(cashPromiseAmountCents, values.cashPromiseCurrency) : null;
  const hasRequiredSides = values.postType === 'need_offer'
    ? (values.needMode === 'money' || values.needMode === 'cash_promise' || Boolean(selectedNeed)) && (values.offerMode === 'money' || values.offerMode === 'cash_promise' || Boolean(selectedOffer))
    : values.postType === 'open_need'
      ? Boolean(selectedNeed)
      : values.postType === 'open_offer'
        ? Boolean(selectedOffer)
        : false;
  const selectedPairReady = values.postType === 'need_offer' && values.needMode === 'saved' && values.offerMode === 'saved' && Boolean(selectedNeed) && Boolean(selectedOffer);
  const selectedOpenNeedReady = values.postType === 'open_need' && Boolean(selectedNeed);
  const selectedOpenOfferReady = values.postType === 'open_offer' && Boolean(selectedOffer);
  const inventoryCheckingPair = (selectedPairReady || selectedOpenNeedReady || selectedOpenOfferReady) && loadState === 'loading';
  const canSubmit = auth.isAuthenticated && Boolean(values.postType) && hasRequiredSides && !visibleDuplicateTrade && !blocksMoneyMoney && !blocksCashPromiseBothSides && !(usesMoney && !betaFeatures.moneyTradesEnabled) && !(usesCashPromise && (!betaFeatures.cashPromiseEnabled || !betaFeatures.cashPromiseVisible));
  const previewTrade = useMemo(() => {
    if (!values.postType || !hasRequiredSides || blocksMoneyMoney || blocksCashPromiseBothSides || (usesMoney && !betaFeatures.moneyTradesEnabled) || (usesCashPromise && (!betaFeatures.cashPromiseEnabled || !betaFeatures.cashPromiseVisible))) return null;
    return buildPreviewTrade({
      ownerId: auth.user?.id,
      postType: values.postType,
      title: autoTitle,
      description: autoDescription || t('trade.create.previewNeedOffer'),
      need: values.postType !== 'open_offer' && (values.needMode === 'money' || values.needMode === 'cash_promise') ? null : values.postType === 'open_offer' ? null : selectedNeed,
      offer: values.postType !== 'open_need' && (values.offerMode === 'money' || values.offerMode === 'cash_promise') ? null : values.postType === 'open_need' ? null : selectedOffer,
      amountCents: values.postType === 'need_offer' && betaFeatures.moneyTradesEnabled && usesMoney && Number.isFinite(amountCents) ? amountCents : 0,
      currency: values.currency,
      cashPromise: usesCashPromise ? { side: values.needMode === 'cash_promise' ? 'need' : 'offer', amountCents: cashPromiseAmountCents, currency: values.cashPromiseCurrency, note: values.cashPromiseNote.trim() || null } : null,
      expiresAt: toIsoDate(values.expiresAt) ?? null,
    });
  }, [amountCents, cashPromiseAmountCents, auth.user?.id, autoDescription, autoTitle, blocksCashPromiseBothSides, blocksMoneyMoney, hasRequiredSides, selectedNeed, selectedOffer, usesCashPromise, usesMoney, values.cashPromiseCurrency, values.cashPromiseNote, values.currency, values.expiresAt, values.needMode, values.offerMode, values.postType]);

  const chooseNeedHref = createSideChooseHref('need', values);
  const chooseOfferHref = createSideChooseHref('offer', values);
  const needSourceHref = createSideSourceHref('need', values);
  const offerSourceHref = createSideSourceHref('offer', values);
  const newNeedHref = createSideNewHref('need', values);
  const newOfferHref = createSideNewHref('offer', values);
  const currentCreateHref = createTradeHrefWithPostType({ postType: values.postType, needId: values.needId, offerId: values.offerId });
  const fullCreateHref = createTradeFullHrefWithPostType({ postType: values.postType, needId: values.needId, offerId: values.offerId });
  const previewCardCount = previewTrade ? 1 + (previewTrade.need?.media?.length ?? 0) + (previewTrade.offer?.media?.length ?? 0) : 0;
  const previewExpiryLabel = previewTrade?.expiresAt
    ? formatWebShortDate(previewTrade.expiresAt, t('trade.expiry.noExpiry'), language)
    : t('trade.expiry.noExpiry');
  const previewSummaryItems = previewTrade
    ? [
      postTypeLabel(values.postType, t),
      previewExpiryLabel,
      t('trade.create.previewCards', { count: previewCardCount }),
    ]
    : [];

  const showNeedSide = values.postType !== 'open_offer';
  const showOfferSide = values.postType !== 'open_need';
  const needPickerLabel = values.postType === 'need_offer' ? `2.1 ${t('trade.labels.iNeed')}` : t('trade.create.chooseNeedTitle');
  const offerPickerLabel = values.postType === 'need_offer' ? `2.2 ${t('trade.labels.iOffer')}` : t('trade.create.chooseOfferTitle');
  const wizardSteps = useMemo<WizardStepDefinition<TradeWizardStepId>[]>(() => [
    { id: 'type', title: t('trade.create.publishQuestion') },
    { id: 'exchange', title: t('trade.create.exchangeTitle') },
    { id: 'details', title: t('trade.create.detailsTitle') },
    { id: 'review', title: t('trade.create.previewTitle') },
  ], [t]);

  useEffect(() => {
    if (!values.postType && activeStepId !== 'type') {
      setActiveStepId('type');
      return;
    }
    if (values.postType && (activeStepId === 'details' || activeStepId === 'review') && !hasRequiredSides) {
      setActiveStepId('exchange');
    }
  }, [activeStepId, hasRequiredSides, values.postType]);

  function choosePostType(postType: TradePostType) {
    setValues((current) => ({
      ...current,
      postType,
      needId: postType === 'open_offer' ? '' : current.needId,
      offerId: postType === 'open_need' ? '' : current.offerId,
      needMode: 'saved',
      offerMode: 'saved',
      amount: '',
      cashPromiseAmount: '',
      cashPromiseNote: '',
      cashPromiseAcknowledged: false,
    }));
    setError('');
    setDuplicateConflict(null);
    setActiveStepId('exchange');
  }

  function validateActiveStep() {
    if (!auth.hydrated) return t('trade.create.checkingSession');
    if (!auth.isAuthenticated) return t('trade.create.validationSignedOut');
    if (activeStepId === 'type' && !values.postType) return t('trade.create.choosePublishType');
    if (activeStepId === 'exchange') {
      if ((values.postType === 'need_offer' || values.postType === 'open_need') && values.needMode === 'saved' && !selectedNeed) {
        return values.postType === 'open_need' ? t('trade.create.validationOpenNeed') : t('trade.create.validationNeed');
      }
      if ((values.postType === 'need_offer' || values.postType === 'open_offer') && values.offerMode === 'saved' && !selectedOffer) {
        return values.postType === 'open_offer' ? t('trade.create.validationOpenOffer') : t('trade.create.validationOffer');
      }
      if (blocksMoneyMoney) return t('trade.create.validationSavedSidesOnly');
      if (blocksCashPromiseBothSides) return t('trade.cashPromise.oneSideOnly');
    }
    if (activeStepId === 'details') {
      if (usesMoney && (!Number.isFinite(amountCents) || amountCents < 100)) return t('trade.create.validationMoneyMinimum');
      if (usesMoney && limits && !limits.moneyTradesEnabled) return t('trade.create.validationMoneyDisabled');
      if (usesMoney && limits && amountCents > limits.perTradeMoneyCapCents) return t('trade.create.validationMoneyLimit', { amount: formatWebMoney(limits.perTradeMoneyCapCents, values.currency) });
      if (usesCashPromise && (!Number.isFinite(cashPromiseAmountCents) || cashPromiseAmountCents < 100)) return t('trade.cashPromise.validationAmount');
      if (usesCashPromise && !values.cashPromiseAcknowledged) return t('trade.cashPromise.validationAcknowledgement');
    }
    if (activeStepId === 'review') return validate();
    return '';
  }

  function goNext() {
    const validationError = validateActiveStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    const nextStep = getNextWizardStepId(wizardSteps, activeStepId);
    if (nextStep) {
      setError('');
      setActiveStepId(nextStep);
    }
  }

  function goBack() {
    const previousStep = getPreviousWizardStepId(wizardSteps, activeStepId);
    if (previousStep) {
      setError('');
      setActiveStepId(previousStep);
      return;
    }
    router.push('/trades');
  }

  const footerPrimaryLabel = activeStepId === 'review'
    ? visibleDuplicateTrade ? t('trade.create.duplicateResolution') : saving ? t('trade.create.publishing') : values.postType === 'open_need' ? t('trade.create.publishOpenNeed') : values.postType === 'open_offer' ? t('trade.create.publishOpenOffer') : t('trade.create.publishTrade')
    : t('common.actions.continue');
  const footerPrimaryDisabled = saving || Boolean(applyingIdea) || !auth.isAuthenticated || (activeStepId === 'review' && !canSubmit);

  function handlePrimaryAction() {
    if (activeStepId === 'review') {
      void handlePublish();
      return;
    }
    if (showFeedIdeaPanel && routeIdeaKey && !applyingIdea) {
      void applyFeedIdeaToDraft(routeIdeaKey);
      return;
    }
    goNext();
  }

  function resetWizardDraft() {
    tradeWizardDraft.clearDraft();
    setValues({
      postType: '',
      needMode: 'saved',
      offerMode: 'saved',
      needId: '',
      offerId: '',
      amount: '',
      currency: preferredCurrency,
      cashPromiseAmount: '',
      cashPromiseCurrency: preferredCurrency,
      cashPromiseNote: '',
      cashPromiseAcknowledged: false,
      expiresAt: '',
    });
    setActiveStepId('type');
    setError('');
    setNotice('');
    setDuplicateConflict(null);
    setExpiryHelpOpen(false);
    setWizardHelpOpen(false);
    setWizardMenuOpen(false);
    router.replace('/trades/create');
  }

  return (
    <WizardShell
      className="wizard-shell--trade-create web-app-page web-app-page--create web-app-page--trade app-create-shell app-create-shell--trade"
      title={t('trade.create.title')}
      backHref="/trades"
      backLabel={t('common.actions.back')}
      steps={wizardSteps}
      activeStepId={activeStepId}
      stepLabel={t('inventory.wizard.stepLabel')}
      ofLabel={t('inventory.wizard.ofLabel')}
      rightSlot={(
        <div className="trade-create-menu">
          <button
            type="button"
            className="trade-create-menu__trigger"
            aria-haspopup="menu"
            aria-expanded={wizardMenuOpen}
            aria-label={t('trade.create.wizardMenuTitle')}
            onClick={() => setWizardMenuOpen((open) => !open)}
          >
            <span className="trade-create-menu__trigger-dot" aria-hidden="true" />
          </button>
          {wizardMenuOpen ? (
            <div className="trade-create-menu__panel" role="menu" aria-label={t('trade.create.wizardMenuTitle')}>
              <Link role="menuitem" href={fullCreateHref} onClick={() => setWizardMenuOpen(false)}>{t('inventory.wizard.openFullForm')}</Link>
              <button role="menuitem" type="button" onClick={resetWizardDraft}>{t('trade.create.resetDraft')}</button>
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setWizardHelpOpen((open) => !open);
                  setWizardMenuOpen(false);
                }}
              >
                {wizardHelpOpen ? t('common.actions.hide') : t('trade.create.wizardHelpTitle')}
              </button>
            </div>
          ) : null}
        </div>
      )}
      footer={(
        <WizardFooter
          primaryLabel={footerPrimaryLabel}
          onPrimary={handlePrimaryAction}
          primaryDisabled={footerPrimaryDisabled}
          primaryLoading={saving || Boolean(applyingIdea)}
          primaryLoadingLabel={applyingIdea ? t('trade.feedIdeas.applySaving') : t('trade.create.publishing')}
          secondaryLabel={t('common.actions.back')}
          onSecondary={goBack}
        />
      )}
    >
      <div className="trade-create-page trade-create-wizard">
        {!auth.hydrated ? (
          <section className="mobile-card mobile-card--soft">
            <span className="semantic-badge instruction">{t('trade.create.sessionTitle')}</span>
            <h3>{t('trade.create.checkingAccount')}</h3>
            <p>{t('trade.create.sessionBody')}</p>
          </section>
        ) : !auth.isAuthenticated ? (
          <section className="mobile-card mobile-card--soft">
            <span className="semantic-badge instruction">{t('common.states.signedOut')}</span>
            <h3>{t('trade.create.signInCreate')}</h3>
            <p>{t('trade.create.sessionBody')}</p>
            <Link href={`/auth?next=${encodeURIComponent(currentCreateHref)}`} className="button">{t('auth.actions.signIn')}</Link>
          </section>
        ) : null}

        {tradeWizardDraft.restored && shouldRestoreStoredDraft ? <p className="form-message">{t('inventory.wizard.draftRestoredTitle')} · {t('inventory.wizard.draftRestoredBody')}</p> : null}

        {showFeedIdeaPanel && routeIdeaKey && selectedFeedIdea ? (
          <section className="mobile-card mobile-card--soft trade-create-idea-prefill">
            <div>
              <span className="semantic-badge instruction">{t('trade.feedIdeas.badge')}</span>
              <h3>{t('trade.feedIdeas.createFromIdeaTitle')}</h3>
              <p>{t(selectedFeedIdea.type === 'open_need' ? 'trade.feedIdeas.createFromIdeaBodyOpenNeed' : selectedFeedIdea.type === 'open_offer' ? 'trade.feedIdeas.createFromIdeaBodyOpenOffer' : 'trade.feedIdeas.createFromIdeaBody')}</p>
              <div className="trade-create-idea-prefill__sides" aria-label={t('trade.feedIdeas.sidesLabel')}>
                {feedTradeIdeaHasNeed(selectedFeedIdea) ? <span><strong>{t('trade.labels.iNeed')}</strong>{t(`trade.feedIdeas.items.${routeIdeaKey}.need`)}</span> : null}
                {feedTradeIdeaHasOffer(selectedFeedIdea) ? <span><strong>{t('trade.labels.iOffer')}</strong>{t(`trade.feedIdeas.items.${routeIdeaKey}.offer`)}</span> : null}
              </div>
            </div>
            <button type="button" className="button primary" disabled={Boolean(applyingIdea)} onClick={() => void applyFeedIdeaToDraft(routeIdeaKey)}>
              {applyingIdea === routeIdeaKey ? t('trade.feedIdeas.applySaving') : t('trade.feedIdeas.applyAction')}
            </button>
          </section>
        ) : null}

        <div className="trade-create-status-row">
          <span className="semantic-badge trade">{values.postType ? postTypeLabel(values.postType, t) : t('trade.create.choosePublishType')}</span>
          {amountPreview && (usesMoney || usesCashPromise) ? <span className="semantic-badge money">{amountPreview}</span> : <span className="semantic-badge instruction">{t('trade.create.beta')}</span>}
        </div>

        {wizardHelpOpen ? (
          <section className="mobile-card mobile-card--soft trade-create-help-panel" role="note">
            <div>
              <span className="semantic-badge instruction">{t('inventory.wizard.menuTitle')}</span>
              <h3>{t('trade.create.wizardHelpTitle')}</h3>
              <p>{t('trade.create.wizardHelpBody')}</p>
            </div>
            <Link href={fullCreateHref} className="button secondary compact">{t('inventory.wizard.openFullForm')}</Link>
          </section>
        ) : null}

        {activeStepId === 'type' ? (
          <section className="mobile-card trade-post-type-step">
            <div className="trade-post-type-grid">
              {TRADE_POST_TYPE_OPTIONS.map((option) => (
                <button key={option.value} type="button" className={`trade-post-type-card trade-post-type-card--button${values.postType === option.value ? ' is-active' : ''}`} onClick={() => choosePostType(option.value)}>
                  <span className="semantic-badge trade">{t(option.badgeKey)}</span>
                  <strong>{t(option.labelKey)}</strong>
                  <em>{t(option.titleKey)}</em>
                  <small>{t(option.bodyKey)}</small>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {activeStepId === 'exchange' && values.postType ? (
          <section className="trade-create-wizard__step-stack">
            <section className="trade-create-mode-summary">
              <div>
                <span className="semantic-badge trade">{postTypeLabel(values.postType, t)}</span>
                <strong>{values.postType === 'open_need' ? t('trade.create.openNeedBody') : values.postType === 'open_offer' ? t('trade.create.openOfferBody') : t('trade.create.needOfferBody')}</strong>
              </div>
              <button type="button" className="trade-side-source-back" onClick={() => setActiveStepId('type')}>{t('trade.create.changePublishType')}</button>
            </section>

            <div className={values.postType === 'need_offer' ? 'trade-create-side-grid' : 'trade-create-side-grid trade-create-side-grid--single'}>
              {showNeedSide ? (
                <TradeSidePicker
                  label={needPickerLabel}
                  side="need"
                  mode={values.needMode}
                  onModeChange={(mode) => updateValue('needMode', mode)}
                  items={selectableNeeds}
                  selectedId={values.needId}
                  chooseHref={chooseNeedHref}
                  sourceChoiceHref={needSourceHref}
                  newHref={newNeedHref}
                  emptyTitle={t('inventory.empty.createFirstNeed')}
                  emptyBody={t('inventory.empty.needBody')}
                  moneyEnabled={values.postType === 'need_offer' && betaFeatures.moneyTradesEnabled}
                  cashPromiseEnabled={values.postType === 'need_offer' && betaFeatures.cashPromiseEnabled && betaFeatures.cashPromiseVisible}
                />
              ) : null}
              {showOfferSide ? (
                <TradeSidePicker
                  label={offerPickerLabel}
                  side="offer"
                  mode={values.offerMode}
                  onModeChange={(mode) => updateValue('offerMode', mode)}
                  items={selectableOffers}
                  selectedId={values.offerId}
                  chooseHref={chooseOfferHref}
                  sourceChoiceHref={offerSourceHref}
                  newHref={newOfferHref}
                  emptyTitle={t('inventory.empty.createFirstOffer')}
                  emptyBody={t('inventory.empty.offerBody')}
                  moneyEnabled={values.postType === 'need_offer' && betaFeatures.moneyTradesEnabled}
                  cashPromiseEnabled={values.postType === 'need_offer' && betaFeatures.cashPromiseEnabled && betaFeatures.cashPromiseVisible}
                />
              ) : null}
            </div>

            {values.postType === 'open_need' ? (
              <section className="mobile-card mobile-card--soft trade-create-open-side-note">
                <span className="semantic-badge offer">{t('trade.create.missingSide')}</span>
                <h3>{t('trade.create.othersProposeOffers')}</h3>
                <p>{t('trade.proposals.inviteOpenNeedBody')}</p>
              </section>
            ) : null}
            {values.postType === 'open_offer' ? (
              <section className="mobile-card mobile-card--soft trade-create-open-side-note">
                <span className="semantic-badge need">{t('trade.create.missingSide')}</span>
                <h3>{t('trade.create.othersProposeNeeds')}</h3>
                <p>{t('trade.proposals.inviteOpenOfferBody')}</p>
              </section>
            ) : null}

            {blocksMoneyMoney ? <p className="form-message form-message--error">{t('trade.create.validationSavedSidesOnly')}</p> : null}
            {blocksCashPromiseBothSides ? <p className="form-message form-message--error">{t('trade.cashPromise.oneSideOnly')}</p> : null}
          </section>
        ) : null}

        {activeStepId === 'details' ? (
          <section className="trade-create-wizard__step-stack">
            <section className="mobile-card trade-create-details trade-create-details--compact">
              <div className="trade-create-details__summary" aria-live="polite">
                <div>
                  <p className="eyebrow">{t('trade.create.generatedFromSidesEyebrow')}</p>
                  <h3>{autoTitle}</h3>
                </div>
                <button type="button" className="trade-side-source-back" onClick={() => setActiveStepId('exchange')}>{t('common.actions.edit')}</button>
              </div>

              <div className="trade-create-expiry-panel">
                <div className="trade-create-expiry-panel__header">
                  <div>
                    <p className="eyebrow">{t('trade.create.detailsTitle')}</p>
                    <h3>{t('trade.labels.expires')}</h3>
                    <p>{t('inventory.labels.optional')}</p>
                  </div>
                  <button type="button" className="trade-side-source-back" onClick={() => setExpiryHelpOpen((open) => !open)}>
                    {expiryHelpOpen ? t('common.actions.hide') : t('common.actions.show')}
                  </button>
                </div>

                <label className="field-label trade-create-expiry-field">
                  <span>{t('trade.labels.expires')} · {t('inventory.labels.optional')}</span>
                  <input type="date" value={values.expiresAt} onChange={(event) => updateValue('expiresAt', event.target.value)} />
                </label>

                {expiryHelpOpen ? (
                  <div className="trade-expiry-callout trade-expiry-callout--compact" role="note">
                    <span className="trade-expiry-callout__icon" aria-hidden="true">!</span>
                    <span>{t('trade.create.expiryUrgencyBody')}</span>
                  </div>
                ) : null}
              </div>
            </section>

            {limits && betaFeatures.moneyFeaturesVisible ? (
              <section className="mobile-card mobile-card--soft">
                <p className="eyebrow">{t('account.wallet.launchLimits')}</p>
                <h3>{limits.effectiveTrustTier.replace(/_/g, ' ')}</h3>
                <p>Service trades: {limits.activeServiceTradeCount}/{limits.serviceActiveTradeLimit} active · money trades: {limits.activeMoneyTradeCount}/{limits.moneyActiveTradeLimit} active · money cap: {formatWebMoney(limits.perTradeMoneyCapCents, values.currency)}.</p>
              </section>
            ) : null}

            {usesMoney && betaFeatures.moneyTradesEnabled ? (
              <section className="mobile-card trade-money-panel">
                <div>
                  <p className="eyebrow">{t('account.walletMoney')}</p>
                  <h3>{values.needMode === 'money' ? t('trade.labels.iNeed') : t('trade.labels.iOffer')}</h3>
                  <p>{t('account.wallet.optionalWalletBody')}</p>
                </div>
                <div className="trade-money-panel__grid">
                  <label className="field-label">
                    {t('account.addMoney.amount')}
                    <input inputMode="decimal" value={values.amount} onChange={(event) => updateValue('amount', event.target.value)} placeholder={moneyInputFromCents(2500, values.currency)} />
                  </label>
                  <label className="field-label">
                    {t('account.addMoney.currency')}
                    <select value={values.currency} onChange={(event) => updateValue('currency', getPreferredCurrency(event.target.value))}>
                      <option value="eur">EUR</option>
                      <option value="usd">USD</option>
                      <option value="gbp">GBP</option>
                    </select>
                  </label>
                </div>
              </section>
            ) : null}

            {usesCashPromise && betaFeatures.cashPromiseEnabled && betaFeatures.cashPromiseVisible ? (
              <section className="mobile-card trade-money-panel trade-cash-promise-panel">
                <div>
                  <p className="eyebrow">{t('trade.cashPromise.title')}</p>
                  <h3>{values.needMode === 'cash_promise' ? t('trade.labels.iNeed') : t('trade.labels.iOffer')}</h3>
                  <p>{t('trade.cashPromise.outsideAppBody')}</p>
                </div>
                <div className="trade-money-panel__grid">
                  <label className="field-label">
                    {t('account.addMoney.amount')}
                    <input inputMode="decimal" value={values.cashPromiseAmount} onChange={(event) => updateValue('cashPromiseAmount', event.target.value)} placeholder={moneyInputFromCents(2500, values.cashPromiseCurrency)} />
                  </label>
                  <label className="field-label">
                    {t('account.addMoney.currency')}
                    <select value={values.cashPromiseCurrency} onChange={(event) => updateValue('cashPromiseCurrency', getPreferredCurrency(event.target.value))}>
                      <option value="eur">EUR</option>
                      <option value="usd">USD</option>
                      <option value="gbp">GBP</option>
                    </select>
                  </label>
                </div>
                <label className="field-label">
                  {t('trade.cashPromise.note')} · {t('inventory.labels.optional')}
                  <textarea value={values.cashPromiseNote} onChange={(event) => updateValue('cashPromiseNote', event.target.value)} maxLength={500} placeholder={t('trade.cashPromise.notePlaceholder')} />
                </label>
                <label className="trade-cash-promise-ack">
                  <input type="checkbox" checked={values.cashPromiseAcknowledged} onChange={(event) => updateValue('cashPromiseAcknowledged', event.target.checked)} />
                  <span>{CASH_PROMISE_ACKNOWLEDGEMENT_TEXT}</span>
                </label>
              </section>
            ) : null}
          </section>
        ) : null}

        {activeStepId === 'review' ? (
          <section className="trade-create-wizard__step-stack trade-create-wizard__step-stack--preview">
            {visibleDuplicateTrade ? (
              <section className="mobile-card mobile-card--soft trade-create-pair-status trade-create-pair-status--warning" role="alert">
                <span className="semantic-badge warning">{t('common.states.required')}</span>
                <h3>{duplicateTradeMessage(visibleDuplicateTrade, t)}</h3>
                <p>{t('trade.create.duplicateResolution')}</p>
                <Link href={`/trades/${visibleDuplicateTrade.id}`} className="button secondary">{t('common.actions.open')}</Link>
              </section>
            ) : inventoryCheckingPair ? (
              <section className="mobile-card mobile-card--soft trade-create-pair-status trade-create-pair-status--info">
                <span className="semantic-badge info">{t('common.states.working')}</span>
                <h3>{t('trade.create.checkingAccount')}</h3>
                <p>{t('trade.create.sessionBody')}</p>
              </section>
            ) : null}

            <section className="mobile-card trade-create-preview trade-create-preview--deck trade-create-preview--final">
              <div className="trade-create-preview__intro trade-create-preview__intro--final">
                <div>
                  <p className="eyebrow">{t('trade.create.deckPreview')}</p>
                  <h3>{previewTrade ? t('trade.create.previewReadyTitle') : values.postType ? t('trade.create.previewMissingSideTitle') : t('trade.create.previewMissingTypeTitle')}</h3>
                </div>
                {previewTrade ? (
                  <p className="trade-create-preview__summary">{previewSummaryItems.join(' · ')}</p>
                ) : null}
              </div>

              {previewTrade ? (
                <div className="trade-create-preview__deck" aria-label={t('trade.create.deckPreview')}>
                  <TradeStackDeck trade={previewTrade} preview className="trade-stack-deck--create-preview" />
                </div>
              ) : (
                <div className="trade-create-preview__empty">
                  <span className="semantic-badge instruction">{t('common.actions.preview')}</span>
                  <strong>{values.postType ? t('trade.create.previewMissingInventory') : t('trade.create.publishQuestion')}</strong>
                  <small>{values.postType === 'open_need' ? t('trade.create.previewOpenNeedBody') : values.postType === 'open_offer' ? t('trade.create.previewOpenOfferBody') : values.postType === 'need_offer' ? t('trade.create.previewNeedOfferBody') : t('trade.create.previewChooseTypeBody')}</small>
                </div>
              )}
            </section>
          </section>
        ) : null}

        {notice ? <p className="form-message form-message--success">{notice}</p> : null}
        {error ? <p className="form-message form-message--error">{error}</p> : null}
      </div>
    </WizardShell>
  );
}
