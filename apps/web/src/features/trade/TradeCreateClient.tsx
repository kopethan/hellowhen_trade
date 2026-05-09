'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import type { CreateTradeRequest, NeedDto, OfferDto, TradeNeedSideKind, TradeOfferSideKind, WalletLimitsDto } from '@hellowhen/contracts';
import { useEffect, useMemo, useState } from 'react';
import { MobilePage, PageIntro } from '../../components/MobilePage';
import { api } from '../../lib/api';
import { betaFeatures } from '../../lib/betaFeatures';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { formatWebMoney } from '../../lib/webFormat';
import { isSupportedCurrency, type SupportedCurrency } from '../../lib/webMoneyPreferences';
import { mockNeeds, mockOffers } from '../../lib/mockData';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { getInventoryMetadata, mediaSrc, normalizeInventoryList, toIsoDate } from '../inventory/inventoryPresentation';
import { TradeSidePicker } from './TradeSidePicker';

type CreateTradeResponse = { trade?: unknown; id?: unknown };
type InventoryLoadState = 'idle' | 'loading' | 'live' | 'demo';

type SideMode = 'saved' | 'money';

type TradeCreateValues = {
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

function findNeed(needs: NeedDto[], needId: string) {
  return needs.find((need) => need.id === needId) ?? null;
}

function findOffer(offers: OfferDto[], offerId: string) {
  return offers.find((offer) => offer.id === offerId) ?? null;
}

function sideTitle(values: TradeCreateValues, needs: NeedDto[], offers: OfferDto[]) {
  const need = values.needMode === 'money' ? 'Wallet money' : (findNeed(needs, values.needId)?.title ?? 'Need');
  const offer = values.offerMode === 'money' ? 'Wallet money' : (findOffer(offers, values.offerId)?.title ?? 'Offer');
  return `${need} ↔ ${offer}`;
}

function sideDescription(values: TradeCreateValues, needs: NeedDto[], offers: OfferDto[], amountCents: number) {
  const need = values.needMode === 'money'
    ? `${formatWebMoney(amountCents, values.currency)} wallet money`
    : (findNeed(needs, values.needId)?.title ?? 'a saved Need');
  const offer = values.offerMode === 'money'
    ? `${formatWebMoney(amountCents, values.currency)} wallet money`
    : (findOffer(offers, values.offerId)?.title ?? 'a saved Offer');
  return `I need ${need}. I offer ${offer}. Proposal messages stay private on the Trade Detail page.`;
}

function isActiveNeed(need: NeedDto) {
  return need.status === 'active' || need.status === 'draft';
}

function isActiveOffer(offer: OfferDto) {
  return offer.status === 'active' || offer.status === 'draft';
}

export function TradeCreateClient({ initialNeedId = '', initialOfferId = '' }: { initialNeedId?: string; initialOfferId?: string }) {
  const auth = useWebAuth();
  const router = useRouter();
  const preferredCurrency = getPreferredCurrency(auth.user?.profile?.preferredCurrency);
  const [needs, setNeeds] = useState<NeedDto[]>(mockNeeds);
  const [offers, setOffers] = useState<OfferDto[]>(mockOffers);
  const [loadState, setLoadState] = useState<InventoryLoadState>('idle');
  const [values, setValues] = useState<TradeCreateValues>({
    needMode: 'saved',
    offerMode: 'saved',
    needId: initialNeedId,
    offerId: initialOfferId,
    amount: '',
    currency: preferredCurrency,
    expiresAt: '',
    title: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [limits, setLimits] = useState<WalletLimitsDto | null>(null);


  useEffect(() => {
    if (betaFeatures.moneyTradesEnabled) return;
    setValues((current) => current.needMode === 'saved' && current.offerMode === 'saved' ? current : { ...current, needMode: 'saved', offerMode: 'saved', amount: '' });
  }, []);

  useEffect(() => {
    setValues((current) => ({
      ...current,
      currency: current.currency || preferredCurrency,
      needId: current.needId || initialNeedId,
      offerId: current.offerId || initialOfferId,
    }));
  }, [initialNeedId, initialOfferId, preferredCurrency]);

  useEffect(() => {
    if (!auth.hydrated) return;
    let mounted = true;
    async function loadInventory() {
      setLoadState('loading');
      if (!auth.isAuthenticated) {
        setNeeds(mockNeeds);
        setOffers(mockOffers);
        setLoadState('demo');
        return;
      }
      try {
        const [needsResponse, offersResponse, limitsResponse] = await Promise.all([
          api.needs.mine(),
          api.offers.mine(),
          betaFeatures.moneyFeaturesVisible ? api.wallet.limits() : Promise.resolve({ limits: null }),
        ]);
        if (!mounted) return;
        const liveNeeds = normalizeInventoryList(needsResponse, 'need') as NeedDto[];
        const liveOffers = normalizeInventoryList(offersResponse, 'offer') as OfferDto[];
        setNeeds(liveNeeds.length ? liveNeeds : []);
        setOffers(liveOffers.length ? liveOffers : []);
        setLimits((limitsResponse as { limits?: WalletLimitsDto }).limits ?? null);
        setLoadState('live');
      } catch {
        if (!mounted) return;
        setNeeds(mockNeeds);
        setOffers(mockOffers);
        setLoadState('demo');
        setNotice('Using demo inventory because your live Needs/Offers could not be loaded. Creating a live trade still needs the API session.');
      }
    }
    void loadInventory();
    return () => { mounted = false; };
  }, [auth.hydrated, auth.isAuthenticated]);

  const selectableNeeds = useMemo(() => needs.filter(isActiveNeed), [needs]);
  const selectableOffers = useMemo(() => offers.filter(isActiveOffer), [offers]);
  const selectedNeed = values.needMode === 'saved' ? findNeed(selectableNeeds, values.needId) : null;
  const selectedOffer = values.offerMode === 'saved' ? findOffer(selectableOffers, values.offerId) : null;
  const amountCents = parseMoneyToCents(values.amount);
  const usesMoney = values.needMode === 'money' || values.offerMode === 'money';
  const blocksMoneyMoney = values.needMode === 'money' && values.offerMode === 'money';
  const autoTitle = sideTitle(values, selectableNeeds, selectableOffers);
  const autoDescription = Number.isFinite(amountCents) ? sideDescription(values, selectableNeeds, selectableOffers, amountCents || 0) : '';

  useEffect(() => {
    setValues((current) => {
      const currentNeedExists = selectableNeeds.some((need) => need.id === current.needId);
      const currentOfferExists = selectableOffers.some((offer) => offer.id === current.offerId);
      const nextNeedId = current.needId && currentNeedExists ? current.needId : selectableNeeds[0]?.id || '';
      const nextOfferId = current.offerId && currentOfferExists ? current.offerId : selectableOffers[0]?.id || '';
      if (nextNeedId === current.needId && nextOfferId === current.offerId) return current;
      return { ...current, needId: nextNeedId, offerId: nextOfferId };
    });
  }, [selectableNeeds, selectableOffers]);

  function updateValue<Key extends keyof TradeCreateValues>(key: Key, value: TradeCreateValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
    setError('');
  }

  function validate() {
    if (!auth.hydrated) return 'Checking your session. Try again in a moment.';
    if (!auth.isAuthenticated) return 'Sign in to create a live trade.';
    if (usesMoney && !betaFeatures.moneyTradesEnabled) return 'Money trades are hidden for the beta launch. Choose saved Needs and Offers.';
    if (blocksMoneyMoney) return 'Choose wallet money on only one side. Money + money trades are blocked.';
    if (values.needMode === 'saved' && !selectedNeed) return 'Choose a saved Need or select wallet money under I need.';
    if (values.offerMode === 'saved' && !selectedOffer) return 'Choose a saved Offer or select wallet money under I offer.';
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

    const payload: CreateTradeRequest = {
      needKind: (betaFeatures.moneyTradesEnabled && values.needMode === 'money' ? 'money' : 'need') as TradeNeedSideKind,
      offerKind: (betaFeatures.moneyTradesEnabled && values.offerMode === 'money' ? 'money' : 'offer') as TradeOfferSideKind,
      needId: values.needMode === 'saved' || !betaFeatures.moneyTradesEnabled ? selectedNeed?.id : undefined,
      offerId: values.offerMode === 'saved' || !betaFeatures.moneyTradesEnabled ? selectedOffer?.id : undefined,
      creditAmount: 0,
      amountCents: betaFeatures.moneyTradesEnabled && usesMoney ? amountCents : 0,
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
      setError(getFriendlyApiErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  const amountPreview = usesMoney && Number.isFinite(amountCents) && amountCents > 0 ? formatWebMoney(amountCents, values.currency) : null;

  return (
    <MobilePage className="trade-create-page">
      <PageIntro
        eyebrow="Create trade"
        title="Choose what you need and what you offer"
        body={betaFeatures.moneyTradesEnabled ? 'Pick saved inventory or place wallet money under one side. Money is never a third extra field.' : 'Choose saved Needs and Offers to build a service or goods exchange.'}
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
          <Link href="/auth" className="button">Sign in</Link>
        </section>
      ) : null}

      <form className="trade-create-form" onSubmit={handleSubmit}>
        <div className="trade-create-status-row">
          <span className="semantic-badge trade">{loadState === 'loading' ? 'Loading inventory' : loadState === 'live' ? 'Live inventory' : loadState === 'demo' ? 'Demo inventory' : 'Inventory'}</span>
          {betaFeatures.moneyTradesEnabled && amountPreview ? <span className="semantic-badge money">{amountPreview}</span> : <span className="semantic-badge instruction">Beta</span>}
        </div>

        <div className="trade-create-side-grid">
          <TradeSidePicker
            label="I need"
            side="need"
            mode={values.needMode}
            onModeChange={(mode) => updateValue('needMode', mode)}
            items={selectableNeeds}
            selectedId={values.needId}
            onSelect={(needId) => updateValue('needId', needId)}
            emptyHref="/needs/new"
            emptyTitle="Create a Need first"
            emptyBody="Saved Needs appear here after you create them."
            moneyEnabled={betaFeatures.moneyTradesEnabled}
          />
          <TradeSidePicker
            label="I offer"
            side="offer"
            mode={values.offerMode}
            onModeChange={(mode) => updateValue('offerMode', mode)}
            items={selectableOffers}
            selectedId={values.offerId}
            onSelect={(offerId) => updateValue('offerId', offerId)}
            emptyHref="/offers/new"
            emptyTitle="Create an Offer first"
            emptyBody="Saved Offers appear here after you create them."
            moneyEnabled={betaFeatures.moneyTradesEnabled}
          />
        </div>

        {blocksMoneyMoney ? (
          <p className="form-message form-message--error">Money + money trades are blocked. Choose a saved Need or saved Offer on one side.</p>
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

        <section className="mobile-card trade-create-preview">
          <div>
            <p className="eyebrow">Preview</p>
            <h3>{values.title.trim() || autoTitle}</h3>
            <p>{values.description.trim() || autoDescription}</p>
          </div>
          <div className="trade-create-preview__sides">
            <div>
              <span className="semantic-badge need">I need</span>
              <strong>{values.needMode === 'money' && betaFeatures.moneyTradesEnabled ? 'Wallet money' : selectedNeed?.title ?? 'Choose a Need'}</strong>
              {selectedNeed ? <small>{getInventoryMetadata(selectedNeed)}</small> : null}
            </div>
            <div>
              <span className="semantic-badge offer">I offer</span>
              <strong>{values.offerMode === 'money' && betaFeatures.moneyTradesEnabled ? 'Wallet money' : selectedOffer?.title ?? 'Choose an Offer'}</strong>
              {selectedOffer ? <small>{getInventoryMetadata(selectedOffer)}</small> : null}
            </div>
          </div>
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
          </label>
        </section>

        {notice ? <p className="form-message form-message--success">{notice}</p> : null}
        {error ? <p className="form-message form-message--error">{error}</p> : null}

        <div className="sticky-form-actions">
          <Link href="/trades" className="button secondary">Back</Link>
          <button type="submit" disabled={saving || !auth.isAuthenticated || blocksMoneyMoney || (usesMoney && !betaFeatures.moneyTradesEnabled)}>{saving ? 'Creating...' : 'Create Trade'}</button>
        </div>
      </form>
    </MobilePage>
  );
}
