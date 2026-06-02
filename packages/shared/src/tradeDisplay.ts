export type GeneratedTradePostType = 'need_offer' | 'open_need' | 'open_offer';

export type GeneratedTradeSide = {
  title?: string | null;
  description?: string | null;
  moneyLabel?: string | null;
};

export type GeneratedTradeDisplayLabels = {
  openNeedPrefix: string;
  openOfferPrefix: string;
  separator: string;
  needLineLabel: string;
  offerLineLabel: string;
  openNeedPrompt: string;
  openOfferPrompt: string;
  missingNeedTitle: string;
  missingOfferTitle: string;
  missingNeedDescription: string;
  missingOfferDescription: string;
};

export type GeneratedTradeDisplayInput = {
  postType?: GeneratedTradePostType | null;
  need?: GeneratedTradeSide | null;
  offer?: GeneratedTradeSide | null;
  labels?: Partial<GeneratedTradeDisplayLabels>;
};

const defaultGeneratedTradeDisplayLabels: GeneratedTradeDisplayLabels = {
  openNeedPrefix: 'Open Need: ',
  openOfferPrefix: 'Open Offer: ',
  separator: ' ↔ ',
  needLineLabel: 'I need',
  offerLineLabel: 'I offer',
  openNeedPrompt: 'Others can propose offers.',
  openOfferPrompt: 'Others can propose needs.',
  missingNeedTitle: 'Choose what you need',
  missingOfferTitle: 'Choose what you offer',
  missingNeedDescription: 'Need details will appear here.',
  missingOfferDescription: 'Offer details will appear here.',
};

function cleanTitleText(value?: string | null) {
  const text = value?.trim();
  return text ? text.replace(/\s+/g, ' ') : '';
}

function cleanBodyText(value?: string | null) {
  return value?.trim() ?? '';
}

function labelsFor(input?: Partial<GeneratedTradeDisplayLabels>) {
  return { ...defaultGeneratedTradeDisplayLabels, ...input };
}

function sideTitle(side: GeneratedTradeSide | null | undefined, fallback: string) {
  return cleanTitleText(side?.moneyLabel) || cleanTitleText(side?.title) || fallback;
}

function sideDescription(side: GeneratedTradeSide | null | undefined, fallback: string) {
  return cleanBodyText(side?.moneyLabel) || cleanBodyText(side?.description) || cleanBodyText(side?.title) || fallback;
}

export function buildGeneratedTradeTitle(input: GeneratedTradeDisplayInput) {
  const postType = input.postType ?? 'need_offer';
  const labels = labelsFor(input.labels);
  const needTitle = sideTitle(input.need, labels.missingNeedTitle);
  const offerTitle = sideTitle(input.offer, labels.missingOfferTitle);

  if (postType === 'open_need') return `${labels.openNeedPrefix}${needTitle}`;
  if (postType === 'open_offer') return `${labels.openOfferPrefix}${offerTitle}`;
  return `${needTitle}${labels.separator}${offerTitle}`;
}

export function buildGeneratedTradeDescription(input: GeneratedTradeDisplayInput) {
  const postType = input.postType ?? 'need_offer';
  const labels = labelsFor(input.labels);
  const needDescription = sideDescription(input.need, labels.missingNeedDescription);
  const offerDescription = sideDescription(input.offer, labels.missingOfferDescription);

  if (postType === 'open_need') return `${labels.needLineLabel}: ${needDescription}\n\n${labels.openNeedPrompt}`;
  if (postType === 'open_offer') return `${labels.offerLineLabel}: ${offerDescription}\n\n${labels.openOfferPrompt}`;
  return `${labels.needLineLabel}: ${needDescription}\n\n${labels.offerLineLabel}: ${offerDescription}`;
}

export function buildGeneratedTradeDisplay(input: GeneratedTradeDisplayInput) {
  return {
    title: buildGeneratedTradeTitle(input),
    description: buildGeneratedTradeDescription(input),
  };
}
