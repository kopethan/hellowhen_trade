'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { FormEvent } from 'react';
import type { CreateTradeRequest, NeedDto, OfferDto, TradeDto, TradeNeedSideKind, TradeOfferSideKind, TradePostType, WalletLimitsDto } from '@hellowhen/contracts';
import { useEffect, useMemo, useState } from 'react';
import { MobilePage, PageIntro } from '../../components/MobilePage';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { formatWebMoney } from '../../lib/webFormat';
import { isSupportedCurrency, type SupportedCurrency } from '../../lib/webMoneyPreferences';
import { isWebDemoDataEnabled } from '../../lib/demoMode';
import { mockNeeds, mockOffers, mockTrades } from '../../lib/mockData';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { normalizeInventoryList, toIsoDate } from '../inventory/inventoryPresentation';
import { TradeSidePicker } from './TradeSidePicker';
import { TradeStackDeck } from './TradeStackDeck';

type CreateTradeResponse = { trade?: unknown; id?: unknown };
type DuplicateTradeSummary = Pick<TradeDto, 'id' | 'status' | 'title'> & { postType?: TradePostType };
type DuplicateTradeConflict = DuplicateTradeSummary & { message: string };
type InventoryLoadState = 'idle' | 'loading' | 'live' | 'demo';

type SideMode = 'saved' | 'money';
type PublishMode = TradePostType | '';

type TradeCreateValues = {
  postType: PublishMode;
  needMode: SideMode;
  offerMode: SideMode;
  needId: string;
  offerId: string;
  amount: string;
  currency: SupportedCurrency;
  expiresAt: string;
  title: string;
  description: string;
};

function normalizeCreatedTradeId(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const response = value as CreateTradeResponse;
  if (typeof response.id === 'string') return response.id;
  if (response.trade && typeof response.trade === 'object' && typeof (response.trade as { id?: unknown }).id === 'string') return (response.trade as { id: string }).id;
  return null;
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
  label: string;
  badge: string;
  title: string;
  body: string;
}> = [
  {
    value: 'need_offer',
    label: 'Need + Offer',
    badge: 'Complete trade',
    title: 'I know both sides',
    body: 'Publish what you need and what you can offer in exchange.',
  },
  {
    value: 'open_need',
    label: 'Open Need',
    badge: 'Others propose offers',
    title: 'I only want to post a need',
    body: 'Publish one Need and let other people propose Offers.',
  },
  {
    value: 'open_offer',
    label: 'Open Offer',
    badge: 'Others propose needs',
    title: 'I only want to post an offer',
    body: 'Publish one Offer and let other people propose Needs or requests.',
  },
];

function parseTradePostType(value?: string | null): PublishMode {
  return value === 'need_offer' || value === 'open_need' || value === 'open_offer' ? value : '';
}

function postTypeLabel(postType: PublishMode) {
  return TRADE_POST_TYPE_OPTIONS.find((option) => option.value === postType)?.label ?? 'Publish type';
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

function sideTitle(values: TradeCreateValues, needs: NeedDto[], offers: OfferDto[]) {
  const need = values.needMode === 'money' ? 'Wallet money' : (findNeed(needs, values.needId)?.title ?? 'Need');
  const offer = values.offerMode === 'money' ? 'Wallet money' : (findOffer(offers, values.offerId)?.title ?? 'Offer');
  if (values.postType === 'open_need') return `Open Need: ${need}`;
  if (values.postType === 'open_offer') return `Open Offer: ${offer}`;
  return `${need} ↔ ${offer}`;
}

function sideDescription(values: TradeCreateValues, needs: NeedDto[], offers: OfferDto[], amountCents: number) {
  const need = values.needMode === 'money'
    ? `${formatWebMoney(amountCents, values.currency)} wallet money`
    : (findNeed(needs, values.needId)?.title ?? 'a saved Need');
  const offer = values.offerMode === 'money'
    ? `${formatWebMoney(amountCents, values.currency)} wallet money`
    : (findOffer(offers, values.offerId)?.title ?? 'a saved Offer');
  if (values.postType === 'open_need') return `I need ${need}. Others can propose offers that match this need. Proposal messages stay private on the Trade Detail page.`;
  if (values.postType === 'open_offer') return `I offer ${offer}. Others can propose needs or requests for this offer. Proposal messages stay private on the Trade Detail page.`;
  return `I need ${need}. I offer ${offer}. Proposal messages stay private on the Trade Detail page.`;
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

function duplicateTradeMessage(trade: DuplicateTradeSummary) {
  if (trade.postType === 'open_need') {
    return trade.status === 'active'
      ? 'You already have an active Open Need using this Need.'
      : `You already have a ${trade.status.replace(/_/g, ' ')} Open Need using this Need.`;
  }
  if (trade.postType === 'open_offer') {
    return trade.status === 'active'
      ? 'You already have an active Open Offer using this Offer.'
      : `You already have a ${trade.status.replace(/_/g, ' ')} Open Offer using this Offer.`;
  }
  return trade.status === 'active'
    ? 'You already have an active trade using this exact Need and Offer.'
    : `You already have a ${trade.status.replace(/_/g, ' ')} trade using this exact Need and Offer.`;
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
    message: typeof payload.message === 'string' ? payload.message : duplicateTradeMessage({ id: payload.tradeId, status: 'active', title: 'Existing trade', postType })
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
    title: input.title,
    description: input.description,
    creditAmount: 0,
    amountCents: input.amountCents,
    currency: input.currency,
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

export function TradeCreateClient({ initialNeedId = '', initialOfferId = '', initialPostType = '' }: { initialNeedId?: string; initialOfferId?: string; initialPostType?: string }) {
  const auth = useWebAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeNeedId = searchParams.get('needId') ?? initialNeedId;
  const routeOfferId = searchParams.get('offerId') ?? initialOfferId;
  const routePostType = parseTradePostType(searchParams.get('postType') ?? initialPostType) || (routeNeedId || routeOfferId ? 'need_offer' : '');
  const preferredCurrency = getPreferredCurrency(auth.user?.profile?.preferredCurrency);
  const demoDataEnabled = isWebDemoDataEnabled();
  const [needs, setNeeds] = useState<NeedDto[]>(() => demoDataEnabled ? mockNeeds : []);
  const [offers, setOffers] = useState<OfferDto[]>(() => demoDataEnabled ? mockOffers : []);
  const [trades, setTrades] = useState<TradeDto[]>(() => demoDataEnabled ? mockTrades : []);
  const [loadState, setLoadState] = useState<InventoryLoadState>('idle');
  const [values, setValues] = useState<TradeCreateValues>({
    postType: routePostType,
    needMode: 'saved',
    offerMode: 'saved',
    needId: routeNeedId,
    offerId: routeOfferId,
    amount: '',
    currency: preferredCurrency,
    expiresAt: '',
    title: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [duplicateConflict, setDuplicateConflict] = useState<DuplicateTradeConflict | null>(null);
  const [limits, setLimits] = useState<WalletLimitsDto | null>(null);


  useEffect(() => {
    if (betaFeatures.moneyTradesEnabled) return;
    setValues((current) => current.needMode === 'saved' && current.offerMode === 'saved' ? current : { ...current, needMode: 'saved', offerMode: 'saved', amount: '' });
  }, []);

  useEffect(() => {
    setValues((current) => {
      const nextPostType = routePostType;
      const nextNeedId = routePostType === 'open_offer' ? '' : routeNeedId || '';
      const nextOfferId = routePostType === 'open_need' ? '' : routeOfferId || '';
      const nextCurrency = current.currency || preferredCurrency;
      if (current.currency === nextCurrency && current.postType === nextPostType && current.needId === nextNeedId && current.offerId === nextOfferId) {
        return current;
      }
      return {
        ...current,
        postType: nextPostType,
        currency: nextCurrency,
        needMode: nextPostType === 'need_offer' ? current.needMode : 'saved',
        offerMode: nextPostType === 'need_offer' ? current.offerMode : 'saved',
        amount: nextPostType === 'need_offer' ? current.amount : '',
        needId: nextNeedId,
        offerId: nextOfferId,
      };
    });
  }, [preferredCurrency, routeNeedId, routeOfferId, routePostType]);

  useEffect(() => {
    setDuplicateConflict(null);
  }, [values.needId, values.offerId, values.postType]);

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
        setNotice(demoDataEnabled ? 'Using demo inventory because your live Needs/Offers could not be loaded. Creating a live trade still needs the API session.' : 'Your saved Needs/Offers could not be loaded. Check your connection and try again.');
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
  const duplicateTrade = values.postType === 'need_offer' && values.needMode === 'saved' && values.offerMode === 'saved'
    ? findDuplicateTradePair(trades, selectedNeed?.id, selectedOffer?.id)
    : values.postType === 'open_need'
      ? findDuplicateOpenNeed(trades, selectedNeed?.id)
      : values.postType === 'open_offer'
        ? findDuplicateOpenOffer(trades, selectedOffer?.id)
        : null;
  const visibleDuplicateTrade: DuplicateTradeConflict | DuplicateTradeSummary | null = duplicateTrade ?? duplicateConflict;
  const usesMoney = values.postType === 'need_offer' && (values.needMode === 'money' || values.offerMode === 'money');
  const blocksMoneyMoney = values.postType === 'need_offer' && values.needMode === 'money' && values.offerMode === 'money';
  const autoTitle = sideTitle(values, selectableNeeds, selectableOffers);
  const autoDescription = Number.isFinite(amountCents) ? sideDescription(values, selectableNeeds, selectableOffers, amountCents || 0) : '';

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
    if (!auth.hydrated) return 'Checking your session. Try again in a moment.';
    if (!auth.isAuthenticated) return 'Sign in to create a live trade.';
    if (!values.postType) return 'Choose what you want to publish first.';
    if (usesMoney && !betaFeatures.moneyTradesEnabled) return 'Choose saved Needs and Offers for this beta.';
    if (blocksMoneyMoney) return 'Choose saved Needs and Offers for this beta.';
    if ((values.postType === 'need_offer' || values.postType === 'open_need') && values.needMode === 'saved' && !selectedNeed) return values.postType === 'open_need' ? 'Choose a saved Need to publish an Open Need.' : 'Choose a saved Need under I need.';
    if ((values.postType === 'need_offer' || values.postType === 'open_offer') && values.offerMode === 'saved' && !selectedOffer) return values.postType === 'open_offer' ? 'Choose a saved Offer to publish an Open Offer.' : 'Choose a saved Offer under I offer.';
    if (visibleDuplicateTrade) return `${duplicateTradeMessage(visibleDuplicateTrade)} Delete or close the existing post before creating it again.`;
    if (usesMoney && (!Number.isFinite(amountCents) || amountCents < 100)) return 'Enter a wallet money amount of at least 1.00.';
    if (usesMoney && limits && !limits.moneyTradesEnabled) return 'Money trades are disabled for your current launch trust tier.';
    if (usesMoney && limits && amountCents > limits.perTradeMoneyCapCents) return `Money trades are limited to ${formatWebMoney(limits.perTradeMoneyCapCents, values.currency)} for your current tier.`;
    if (values.title.trim() && values.title.trim().length < 3) return 'The custom title must be at least 3 characters.';
    if (values.description.trim() && values.description.trim().length < 10) return 'The custom description must be at least 10 characters.';
    return '';
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      needId: postType !== 'open_offer' && (values.needMode === 'saved' || !betaFeatures.moneyTradesEnabled) ? selectedNeed?.id : undefined,
      offerId: postType !== 'open_need' && (values.offerMode === 'saved' || !betaFeatures.moneyTradesEnabled) ? selectedOffer?.id : undefined,
      creditAmount: 0,
      amountCents: postType === 'need_offer' && betaFeatures.moneyTradesEnabled && usesMoney ? amountCents : 0,
      currency: values.currency,
      expiresAt: toIsoDate(values.expiresAt),
      title: values.title.trim() || autoTitle,
      description: values.description.trim() || autoDescription,
    };

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await api.trades.create(payload);
      const tradeId = normalizeCreatedTradeId(response);
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

  const amountPreview = usesMoney && Number.isFinite(amountCents) && amountCents > 0 ? formatWebMoney(amountCents, values.currency) : null;
  const hasRequiredSides = values.postType === 'need_offer'
    ? (values.needMode === 'money' || Boolean(selectedNeed)) && (values.offerMode === 'money' || Boolean(selectedOffer))
    : values.postType === 'open_need'
      ? Boolean(selectedNeed)
      : values.postType === 'open_offer'
        ? Boolean(selectedOffer)
        : false;
  const selectedPairReady = values.postType === 'need_offer' && values.needMode === 'saved' && values.offerMode === 'saved' && Boolean(selectedNeed) && Boolean(selectedOffer);
  const selectedOpenNeedReady = values.postType === 'open_need' && Boolean(selectedNeed);
  const selectedOpenOfferReady = values.postType === 'open_offer' && Boolean(selectedOffer);
  const inventoryCheckingPair = (selectedPairReady || selectedOpenNeedReady || selectedOpenOfferReady) && loadState === 'loading';
  const canSubmit = auth.isAuthenticated && Boolean(values.postType) && hasRequiredSides && !visibleDuplicateTrade && !blocksMoneyMoney && !(usesMoney && !betaFeatures.moneyTradesEnabled);
  const previewTrade = useMemo(() => {
    if (!values.postType || !hasRequiredSides || blocksMoneyMoney || (usesMoney && !betaFeatures.moneyTradesEnabled)) return null;
    return buildPreviewTrade({
      ownerId: auth.user?.id,
      postType: values.postType,
      title: values.title.trim() || autoTitle,
      description: values.description.trim() || autoDescription || 'Choose saved inventory to create this public post.',
      need: values.postType !== 'open_offer' && values.needMode === 'money' && betaFeatures.moneyTradesEnabled ? null : values.postType === 'open_offer' ? null : selectedNeed,
      offer: values.postType !== 'open_need' && values.offerMode === 'money' && betaFeatures.moneyTradesEnabled ? null : values.postType === 'open_need' ? null : selectedOffer,
      amountCents: values.postType === 'need_offer' && betaFeatures.moneyTradesEnabled && usesMoney && Number.isFinite(amountCents) ? amountCents : 0,
      currency: values.currency,
      expiresAt: toIsoDate(values.expiresAt) ?? null,
    });
  }, [amountCents, auth.user?.id, autoDescription, autoTitle, blocksMoneyMoney, hasRequiredSides, selectedNeed, selectedOffer, usesMoney, values.currency, values.description, values.expiresAt, values.needMode, values.offerMode, values.postType, values.title]);

  const chooseNeedHref = createSideChooseHref('need', values);
  const chooseOfferHref = createSideChooseHref('offer', values);
  const showPostTypeStep = !values.postType;
  const changePostTypeHref = createTradeHrefWithPostType({});
  const currentCreateHref = createTradeHrefWithPostType({ postType: values.postType, needId: values.needId, offerId: values.offerId });

  return (
    <MobilePage className="trade-create-page">
      <PageIntro
        eyebrow="Create trade"
        title={showPostTypeStep ? "Choose what you want to publish" : postTypeLabel(values.postType)}
        body={showPostTypeStep ? "Start with a complete Need + Offer trade, or publish only one side and let others propose the missing side." : values.postType === 'open_need' ? "Choose one saved Need. Other users will propose Offers on the Trade Detail page." : values.postType === 'open_offer' ? "Choose one saved Offer. Other users will propose Needs on the Trade Detail page." : betaFeatures.moneyTradesEnabled ? "Pick saved inventory or place wallet money under one side. Money is never a third extra field." : "Choose saved Needs and Offers to build a service or goods exchange."}
        action={<Link href="/trades" className="button secondary">Cancel</Link>}
      />

      {!auth.hydrated ? (
        <section className="mobile-card mobile-card--soft">
          <span className="semantic-badge instruction">Session</span>
          <h3>Checking your account...</h3>
          <p>We will load your saved Needs and Offers before creating a trade.</p>
        </section>
      ) : !auth.isAuthenticated ? (
        <section className="mobile-card mobile-card--soft">
          <span className="semantic-badge instruction">Signed out</span>
          <h3>Sign in to create a live trade</h3>
          <p>You can preview the form, but creating a trade needs your account so the selected Need and Offer belong to you.</p>
          <Link href={`/auth?next=${encodeURIComponent(currentCreateHref)}`} className="button">Sign in</Link>
        </section>
      ) : null}

      <form className="trade-create-form" onSubmit={handleSubmit}>
        <div className="trade-create-status-row">
          <span className="semantic-badge trade">{showPostTypeStep ? 'Publish type' : postTypeLabel(values.postType)}</span>
          {betaFeatures.moneyTradesEnabled && amountPreview ? <span className="semantic-badge money">{amountPreview}</span> : <span className="semantic-badge instruction">Beta</span>}
        </div>

        {showPostTypeStep ? (
          <section className="mobile-card trade-post-type-step">
            <div className="trade-post-type-step__header">
              <span className="semantic-badge instruction">Step 1 of 2</span>
              <h3>What do you want to publish?</h3>
              <p>Choose the shape of this post first. You can still use your private inventory or starter Needs/Offers in the next step.</p>
            </div>
            <div className="trade-post-type-grid">
              {TRADE_POST_TYPE_OPTIONS.map((option) => (
                <Link key={option.value} href={createTradeHrefWithPostType({ postType: option.value, needId: values.needId, offerId: values.offerId })} className="trade-post-type-card">
                  <span className="semantic-badge trade">{option.badge}</span>
                  <strong>{option.label}</strong>
                  <em>{option.title}</em>
                  <small>{option.body}</small>
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <>
            <section className="trade-create-mode-summary">
              <div>
                <span className="semantic-badge trade">{postTypeLabel(values.postType)}</span>
                <strong>{values.postType === 'open_need' ? 'Publish one Need. Others propose Offers.' : values.postType === 'open_offer' ? 'Publish one Offer. Others propose Needs.' : 'Publish a complete Need + Offer exchange.'}</strong>
              </div>
              <Link href={changePostTypeHref} className="trade-side-source-back">Change publish type</Link>
            </section>

            <div className={values.postType === 'need_offer' ? 'trade-create-side-grid' : 'trade-create-side-grid trade-create-side-grid--single'}>
              {values.postType !== 'open_offer' ? (
                <TradeSidePicker
                  label="I need"
                  side="need"
                  mode={values.needMode}
                  onModeChange={(mode) => updateValue('needMode', mode)}
                  items={selectableNeeds}
                  selectedId={values.needId}
                  chooseHref={chooseNeedHref}
                  emptyTitle="Create a Need first"
                  emptyBody="Saved Needs appear here after you create them."
                  moneyEnabled={values.postType === 'need_offer' && betaFeatures.moneyTradesEnabled}
                />
              ) : null}
              {values.postType !== 'open_need' ? (
                <TradeSidePicker
                  label="I offer"
                  side="offer"
                  mode={values.offerMode}
                  onModeChange={(mode) => updateValue('offerMode', mode)}
                  items={selectableOffers}
                  selectedId={values.offerId}
                  chooseHref={chooseOfferHref}
                  emptyTitle="Create an Offer first"
                  emptyBody="Saved Offers appear here after you create them."
                  moneyEnabled={values.postType === 'need_offer' && betaFeatures.moneyTradesEnabled}
                />
              ) : null}
              {values.postType === 'open_need' ? (
                <section className="mobile-card mobile-card--soft trade-create-open-side-note">
                  <span className="semantic-badge offer">Missing side</span>
                  <h3>Others will propose Offers</h3>
                  <p>You only publish your Need now. Applicants will choose or create an Offer when they propose.</p>
                </section>
              ) : values.postType === 'open_offer' ? (
                <section className="mobile-card mobile-card--soft trade-create-open-side-note">
                  <span className="semantic-badge need">Missing side</span>
                  <h3>Others will propose Needs</h3>
                  <p>You only publish your Offer now. Applicants will choose or create a Need when they propose.</p>
                </section>
              ) : null}
            </div>
          </>
        )}

        {blocksMoneyMoney ? (
          <p className="form-message form-message--error">Choose saved Needs and Offers for this beta.</p>
        ) : null}

        {visibleDuplicateTrade ? (
          <section className="mobile-card mobile-card--soft trade-create-pair-status trade-create-pair-status--warning" role="alert">
            <span className="semantic-badge warning">Already exists</span>
            <h3>{duplicateTradeMessage(visibleDuplicateTrade)}</h3>
            <p>Use the existing post, or delete/close it before publishing this same setup again.</p>
            <Link href={`/trades/${visibleDuplicateTrade.id}`} className="button secondary">View existing post</Link>
          </section>
        ) : inventoryCheckingPair ? (
          <section className="mobile-card mobile-card--soft trade-create-pair-status trade-create-pair-status--info">
            <span className="semantic-badge info">Checking</span>
            <h3>Checking this setup</h3>
            <p>We are checking whether you already published this same setup with these saved items.</p>
          </section>
        ) : selectedPairReady || selectedOpenNeedReady || selectedOpenOfferReady ? (
          <section className="mobile-card mobile-card--soft trade-create-pair-status trade-create-pair-status--success">
            <span className="semantic-badge success">Available</span>
            <h3>This setup is ready</h3>
            <p>No active post currently uses this same setup, so you can publish it.</p>
          </section>
        ) : null}

        {limits && betaFeatures.moneyFeaturesVisible ? (
          <section className="mobile-card mobile-card--soft">
            <p className="eyebrow">Launch limits</p>
            <h3>{limits.effectiveTrustTier.replace(/_/g, ' ')}</h3>
            <p>Service trades: {limits.activeServiceTradeCount}/{limits.serviceActiveTradeLimit} active · money trades: {limits.activeMoneyTradeCount}/{limits.moneyActiveTradeLimit} active · money cap: {formatWebMoney(limits.perTradeMoneyCapCents, values.currency)}.</p>
          </section>
        ) : null}

        {usesMoney && betaFeatures.moneyTradesEnabled ? (
          <section className="mobile-card trade-money-panel">
            <div>
              <p className="eyebrow">Wallet money</p>
              <h3>{values.needMode === 'money' ? 'I need money' : 'I offer money'}</h3>
              <p>Wallet money belongs to the selected side only. The other side must be a saved Need or Offer.</p>
            </div>
            <div className="trade-money-panel__grid">
              <label className="field-label">
                Amount
                <input inputMode="decimal" value={values.amount} onChange={(event) => updateValue('amount', event.target.value)} placeholder={moneyInputFromCents(2500, values.currency)} />
              </label>
              <label className="field-label">
                Currency
                <select value={values.currency} onChange={(event) => updateValue('currency', getPreferredCurrency(event.target.value))}>
                  <option value="eur">EUR</option>
                  <option value="usd">USD</option>
                  <option value="gbp">GBP</option>
                </select>
              </label>
            </div>
          </section>
        ) : null}

        <section className="mobile-card trade-create-preview trade-create-preview--deck">
          <div className="trade-create-preview__intro">
            <p className="eyebrow">Preview in feed</p>
            <h3>{previewTrade ? 'This is how your post will appear' : values.postType ? 'Choose the required side to preview the deck' : 'Choose a publish type to preview the deck'}</h3>
            <p>{previewTrade ? 'Swipe this preview like the live feed deck. Tapping is disabled until the post is created.' : values.postType === 'open_need' ? 'Pick one saved Need first, then the feed preview will appear here.' : values.postType === 'open_offer' ? 'Pick one saved Offer first, then the feed preview will appear here.' : values.postType === 'need_offer' ? 'Pick a saved Need and a saved Offer first, then the exact feed card and image pages will appear here.' : 'Choose Need + Offer, Open Need, or Open Offer first.'}</p>
          </div>
          {previewTrade ? (
            <div className="trade-create-preview__deck">
              <TradeStackDeck trade={previewTrade} preview className="trade-stack-deck--create-preview" />
            </div>
          ) : (
            <div className="trade-create-preview__empty">
              <span className="semantic-badge instruction">Feed preview</span>
              <strong>{values.postType ? 'Choose the required saved inventory.' : 'Choose what you want to publish.'}</strong>
              <small>The preview will reuse the same poster card, image cards, dots, and swipe behavior as the Trades feed.</small>
            </div>
          )}
        </section>

        <section className="mobile-card trade-create-details">
          <label className="field-label">
            Custom title optional
            <input value={values.title} onChange={(event) => updateValue('title', event.target.value)} placeholder={autoTitle} maxLength={120} />
          </label>
          <label className="field-label">
            Custom description optional
            <textarea value={values.description} onChange={(event) => updateValue('description', event.target.value)} placeholder={autoDescription} rows={4} maxLength={2000} />
          </label>
          <label className="field-label">
            Expires optional
            <input type="date" value={values.expiresAt} onChange={(event) => updateValue('expiresAt', event.target.value)} />
            <div className="trade-expiry-callout" role="note">
              <span className="trade-expiry-callout__icon" aria-hidden="true">!</span>
              <span>Sooner expiry may increase visibility because urgent trades are shown more often. No expiry is allowed, but it may get less priority over time.</span>
            </div>
          </label>
        </section>

        {notice ? <p className="form-message form-message--success">{notice}</p> : null}
        {error ? <p className="form-message form-message--error">{error}</p> : null}

        <div className="sticky-form-actions">
          <Link href="/trades" className="button secondary">Back</Link>
          <button type="submit" disabled={saving || !canSubmit}>{visibleDuplicateTrade ? 'Post already exists' : saving ? 'Publishing...' : values.postType === 'open_need' ? 'Publish Open Need' : values.postType === 'open_offer' ? 'Publish Open Offer' : 'Create Trade'}</button>
        </div>
      </form>
    </MobilePage>
  );
}
