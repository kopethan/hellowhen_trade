import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';
import { MobileIcon } from '../../components/MobileIcon';
import { InfoNotice, SemanticBadge } from '../../components/SemanticUI';
import { useAuth } from '../../providers/AuthProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { feedTradeIdeaHasNeed, feedTradeIdeaHasOffer, feedTradeIdeaKeys, feedTradeIdeas, getFeedTradeIdeaPostType, parseFeedTradeIdeaKey, type FeedTradeIdeaKey } from './tradeFeedIdeas';

type Props = NativeStackScreenProps<RootStackParamList, 'TradeIdeaDetail'>;
type IdeaExpirySelection = 'default' | 'none' | '1' | '3' | '7' | '14';

const maxRelatedIdeas = 3;

const expiryOptions: Array<{ value: IdeaExpirySelection; labelKey: string; helperKey?: string }> = [
  { value: 'default', labelKey: 'trade.ideaDetail.expiryDefault', helperKey: 'trade.ideaDetail.expiryDefaultHelper' },
  { value: 'none', labelKey: 'trade.expiry.noExpiry' },
  { value: '1', labelKey: 'trade.ideaDetail.expiry1Day' },
  { value: '3', labelKey: 'trade.ideaDetail.expiry3Days' },
  { value: '7', labelKey: 'trade.create.expiry7Days' },
  { value: '14', labelKey: 'trade.create.expiry14Days' },
];

function selectedExpiryDays(expiry: IdeaExpirySelection): number | null | undefined {
  if (expiry === 'default') return undefined;
  if (expiry === 'none') return null;
  return Number(expiry);
}

function ideaTitle(t: ReturnType<typeof useTranslation>['t'], ideaKey: FeedTradeIdeaKey) {
  const idea = feedTradeIdeas[ideaKey];
  if (idea.type === 'open_need') return t(`trade.feedIdeas.items.${ideaKey}.need`);
  if (idea.type === 'open_offer') return t(`trade.feedIdeas.items.${ideaKey}.offer`);
  return `${t(`trade.feedIdeas.items.${ideaKey}.need`)} ↔ ${t(`trade.feedIdeas.items.${ideaKey}.offer`)}`;
}

function getRelatedIdeaKeys(ideaKey: FeedTradeIdeaKey) {
  return feedTradeIdeaKeys.filter((candidate) => candidate !== ideaKey).slice(0, maxRelatedIdeas);
}

function getIdeaTypeLabelKey(ideaKey: FeedTradeIdeaKey) {
  const idea = feedTradeIdeas[ideaKey];
  return idea.type === 'open_need' ? 'trade.feedIdeas.typeLabels.openNeed' : idea.type === 'open_offer' ? 'trade.feedIdeas.typeLabels.openOffer' : 'trade.feedIdeas.typeLabels.trade';
}

function getIdeaActionKey(ideaKey: FeedTradeIdeaKey) {
  const idea = feedTradeIdeas[ideaKey];
  return idea.type === 'open_need' ? 'trade.feedIdeas.actionOpenNeed' : idea.type === 'open_offer' ? 'trade.feedIdeas.actionOpenOffer' : 'trade.feedIdeas.action';
}

function IdeaSide({ kind, ideaKey }: { kind: 'need' | 'offer'; ideaKey: FeedTradeIdeaKey }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const semantic = kind === 'need' ? theme.semantic.need : theme.semantic.offer;
  const label = kind === 'need' ? t('trade.labels.iNeed') : t('trade.labels.iOffer');
  const title = t(`trade.feedIdeas.items.${ideaKey}.${kind}`);
  const meta = t(`trade.feedIdeas.items.${ideaKey}.${kind}Meta`);

  return (
    <View style={[styles.sideCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
      <View style={styles.sideHeader}>
        <View style={styles.sideCopy}>
          <AppText style={[styles.sideEyebrow, { color: theme.color.muted }]}>{label}</AppText>
          <AppText style={[styles.sideTitle, { color: theme.color.text }]}>{title}</AppText>
        </View>
        <View style={[styles.sideBadge, { backgroundColor: semantic.softBg, borderColor: semantic.border }]}>
          <MobileIcon name={kind} size={15} color={semantic.text} />
          <AppText style={[styles.sideBadgeText, { color: semantic.text }]}>{label}</AppText>
        </View>
      </View>
      <AppText style={[styles.sideBody, { color: theme.color.text }]}>{title}</AppText>
      <AppText style={[styles.sideMeta, { color: theme.color.muted }]}>{meta}</AppText>
    </View>
  );
}

function NextStepsCard() {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  return (
    <View style={[styles.nextCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
      <View style={styles.expiryHeader}>
        <View style={styles.expiryCopy}>
          <AppText style={[styles.sideEyebrow, { color: theme.color.muted }]}>{t('trade.ideaDetail.nextEyebrow')}</AppText>
          <AppText style={[styles.expiryTitle, { color: theme.color.text }]}>{t('trade.ideaDetail.nextTitle')}</AppText>
        </View>
        <SemanticBadge label={t('trade.ideaDetail.noAutoPublishBadge')} tone="instruction" size="sm" />
      </View>
      <View style={styles.nextList}>
        {[t('trade.ideaDetail.nextReview'), t('trade.ideaDetail.nextCustomize'), t('trade.ideaDetail.nextPublish')].map((item, index) => (
          <View key={item} style={styles.nextItem}>
            <View style={[styles.nextNumber, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }]}>
              <AppText style={[styles.nextNumberText, { color: theme.color.text }]}>{index + 1}</AppText>
            </View>
            <AppText style={[styles.nextText, { color: theme.color.text }]}>{item}</AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

function MoreIdeasCard({ ideaKey, onOpenIdea }: { ideaKey: FeedTradeIdeaKey; onOpenIdea: (nextIdeaKey: FeedTradeIdeaKey) => void }) {
  const theme = useThemeTokens();
  const { t } = useTranslation();
  const ideas = getRelatedIdeaKeys(ideaKey);
  if (ideas.length === 0) return null;

  return (
    <View style={[styles.moreCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
      <AppText style={[styles.sideEyebrow, { color: theme.color.muted }]}>{t('trade.ideaDetail.moreEyebrow')}</AppText>
      <AppText style={[styles.moreTitle, { color: theme.color.text }]}>{t('trade.ideaDetail.moreTitle')}</AppText>
      <View style={styles.moreList}>
        {ideas.map((candidate) => (
          <Pressable key={candidate} accessibilityRole="button" onPress={() => onOpenIdea(candidate)} style={({ pressed }) => [styles.moreIdeaButton, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }, pressed && styles.pressed]}>
            <View style={styles.moreIdeaCopy}>
              <AppText style={[styles.moreIdeaPack, { color: theme.color.muted }]}>{t(`trade.feedIdeas.items.${candidate}.pack`)}</AppText>
              <AppText numberOfLines={2} style={[styles.moreIdeaTitle, { color: theme.color.text }]}>{ideaTitle(t, candidate)}</AppText>
            </View>
            <AppText style={[styles.moreIdeaAction, { color: theme.color.muted }]}>{t('trade.ideaDetail.openIdea')}</AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function TradeIdeaDetailScreen({ route, navigation }: Props) {
  const theme = useThemeTokens();
  const auth = useAuth();
  const { t } = useTranslation();
  const ideaKey = parseFeedTradeIdeaKey(route.params.ideaId);
  const [expiry, setExpiry] = useState<IdeaExpirySelection>('default');
  const title = useMemo(() => ideaKey ? ideaTitle(t, ideaKey) : '', [ideaKey, t]);

  function openCreate(fullForm: boolean) {
    if (!ideaKey) return;
    if (!auth.isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    const expiryDays = selectedExpiryDays(expiry);
    const params = {
      initialIdeaKey: ideaKey,
      initialPostType: getFeedTradeIdeaPostType(feedTradeIdeas[ideaKey]),
      ...(expiryDays !== undefined ? { initialExpiryDays: expiryDays } : {}),
    };
    if (fullForm) {
      navigation.navigate('CreateTradeFull', params);
      return;
    }
    navigation.navigate('CreateTrade', params);
  }

  if (!ideaKey) {
    return (
      <AppScreen>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.actions.back')} onPress={() => navigation.goBack()} hitSlop={10} style={({ pressed }) => [styles.backButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
            <MobileIcon name="back" size={20} color={theme.color.text} />
          </Pressable>
          <AppText style={[styles.headerTitle, { color: theme.color.text }]}>{t('trade.ideaDetail.header')}</AppText>
        </View>
        <View style={styles.notFoundContent}>
          <InfoNotice tone="warning" title={t('trade.ideaDetail.notFoundTitle')} body={t('trade.ideaDetail.notFoundBody')} />
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('TradeTabs')} style={({ pressed }) => [styles.notFoundButton, { backgroundColor: theme.color.text }, pressed && styles.pressed]}>
            <AppText style={[styles.primaryButtonText, { color: theme.color.background }]}>{t('trade.ideaDetail.backToFeed')}</AppText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('CreateTrade')} style={({ pressed }) => [styles.notFoundButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
            <AppText style={[styles.secondaryButtonText, { color: theme.color.text }]}>{t('trade.ideaDetail.createFromScratch')}</AppText>
          </Pressable>
        </View>
      </AppScreen>
    );
  }

  const pack = t(`trade.feedIdeas.items.${ideaKey}.pack`);

  return (
    <AppScreen>
      <View style={styles.headerRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.actions.back')} onPress={() => navigation.goBack()} hitSlop={10} style={({ pressed }) => [styles.backButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
          <MobileIcon name="back" size={20} color={theme.color.text} />
        </Pressable>
        <AppText style={[styles.headerTitle, { color: theme.color.text }]}>{t('trade.ideaDetail.header')}</AppText>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={styles.content}
      >
        <View style={[styles.heroCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
          <SemanticBadge label={`${t(getIdeaTypeLabelKey(ideaKey))} · ${pack}`} tone="instruction" />
          <AppText style={[styles.heroTitle, { color: theme.color.text }]}>{title}</AppText>
          <AppText style={[styles.heroBody, { color: theme.color.muted }]}>{t(feedTradeIdeas[ideaKey].type === 'open_need' ? 'trade.ideaDetail.bodyOpenNeed' : feedTradeIdeas[ideaKey].type === 'open_offer' ? 'trade.ideaDetail.bodyOpenOffer' : 'trade.ideaDetail.body')}</AppText>
        </View>

        <NextStepsCard />

        {feedTradeIdeaHasNeed(feedTradeIdeas[ideaKey]) ? <IdeaSide kind="need" ideaKey={ideaKey} /> : null}

        {feedTradeIdeas[ideaKey].type === 'trade' ? (
          <View style={styles.exchangeRow} accessibilityLabel={t('trade.feedIdeas.sidesLabel')}>
            <View style={[styles.exchangeLine, { backgroundColor: theme.color.border }]} />
            <MobileIcon name="trade" size={18} color={theme.color.muted} />
            <View style={[styles.exchangeLine, { backgroundColor: theme.color.border }]} />
          </View>
        ) : null}

        {feedTradeIdeaHasOffer(feedTradeIdeas[ideaKey]) ? <IdeaSide kind="offer" ideaKey={ideaKey} /> : null}

        <View style={[styles.expiryCard, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
          <View style={styles.expiryHeader}>
            <View style={styles.expiryCopy}>
              <AppText style={[styles.sideEyebrow, { color: theme.color.muted }]}>{t('trade.ideaDetail.expiryEyebrow')}</AppText>
              <AppText style={[styles.expiryTitle, { color: theme.color.text }]}>{t('trade.ideaDetail.expiryTitle')}</AppText>
            </View>
            <SemanticBadge label={t('inventory.labels.optional')} tone="instruction" size="sm" />
          </View>
          <AppText style={[styles.expiryBody, { color: theme.color.muted }]}>{t('trade.ideaDetail.expiryBody')}</AppText>
          <View style={styles.expiryGrid}>
            {expiryOptions.map((option) => {
              const selected = expiry === option.value;
              return (
                <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setExpiry(option.value)} style={({ pressed }) => [styles.expiryOption, { backgroundColor: selected ? theme.semantic.proposal.softBg : theme.color.subtleSurface, borderColor: selected ? theme.semantic.proposal.border : theme.color.border }, pressed && styles.pressed]}>
                  <AppText style={[styles.expiryOptionText, { color: selected ? theme.semantic.proposal.text : theme.color.text }]}>{t(option.labelKey)}</AppText>
                  {option.helperKey ? <AppText style={[styles.expiryOptionHelper, { color: theme.color.muted }]}>{t(option.helperKey)}</AppText> : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <MoreIdeasCard ideaKey={ideaKey} onOpenIdea={(nextIdeaKey) => navigation.push('TradeIdeaDetail', { ideaId: nextIdeaKey })} />
      </ScrollView>

      <View style={[styles.actionBar, { backgroundColor: theme.color.background, borderTopColor: theme.color.border }]}>
        <Pressable accessibilityRole="button" onPress={() => navigation.navigate('TradeTabs')} style={({ pressed }) => [styles.tertiaryButton, { backgroundColor: theme.color.subtleSurface, borderColor: theme.color.border }, pressed && styles.pressed]}>
          <AppText style={[styles.tertiaryButtonText, { color: theme.color.text }]}>{t('trade.ideaDetail.backToFeed')}</AppText>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => openCreate(true)} style={({ pressed }) => [styles.secondaryButton, { backgroundColor: theme.color.surface, borderColor: theme.color.border }, pressed && styles.pressed]}>
          <AppText style={[styles.secondaryButtonText, { color: theme.color.text }]}>{t('trade.ideaDetail.editInFullForm')}</AppText>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => openCreate(false)} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.color.text }, pressed && styles.pressed]}>
          <AppText style={[styles.primaryButtonText, { color: theme.color.background }]}>{t(getIdeaActionKey(ideaKey))}</AppText>
        </Pressable>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 42, marginBottom: 10 },
  backButton: { width: 40, height: 40, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 16, lineHeight: 20, fontWeight: '900' },
  content: { gap: 14, paddingBottom: 132 },
  notFoundContent: { gap: 12, paddingTop: 8 },
  notFoundButton: { minHeight: 50, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  heroCard: { borderWidth: 1, borderRadius: 28, padding: 18, gap: 12 },
  heroTitle: { fontSize: 31, lineHeight: 32, fontWeight: '900', letterSpacing: -1.25 },
  heroBody: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  sideCard: { borderWidth: 1, borderRadius: 26, padding: 16, gap: 12 },
  sideHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  sideCopy: { flex: 1, minWidth: 0, gap: 4 },
  sideEyebrow: { fontSize: 11, lineHeight: 14, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  sideTitle: { fontSize: 22, lineHeight: 25, fontWeight: '900', letterSpacing: -0.75 },
  sideBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  sideBadgeText: { fontSize: 10, lineHeight: 12, fontWeight: '900' },
  sideBody: { fontSize: 15, lineHeight: 21, fontWeight: '800' },
  sideMeta: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
  exchangeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  exchangeLine: { flex: 1, height: StyleSheet.hairlineWidth },
  nextCard: { borderWidth: 1, borderRadius: 24, padding: 15, gap: 12 },
  nextList: { gap: 9 },
  nextItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  nextNumber: { width: 25, height: 25, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  nextNumberText: { fontSize: 12, lineHeight: 15, fontWeight: '900' },
  nextText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '800' },
  expiryCard: { borderWidth: 1, borderRadius: 26, padding: 16, gap: 12 },
  expiryHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  expiryCopy: { flex: 1, minWidth: 0, gap: 4 },
  expiryTitle: { fontSize: 21, lineHeight: 24, fontWeight: '900', letterSpacing: -0.6 },
  expiryBody: { fontSize: 13, lineHeight: 19, fontWeight: '700' },
  expiryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  expiryOption: { minWidth: '30%', flexGrow: 1, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, gap: 3 },
  expiryOptionText: { fontSize: 12, lineHeight: 15, fontWeight: '900' },
  expiryOptionHelper: { fontSize: 10, lineHeight: 13, fontWeight: '800' },
  moreCard: { borderWidth: 1, borderRadius: 24, padding: 15, gap: 10 },
  moreTitle: { fontSize: 20, lineHeight: 23, fontWeight: '900', letterSpacing: -0.55 },
  moreList: { gap: 8 },
  moreIdeaButton: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 7 },
  moreIdeaCopy: { gap: 4 },
  moreIdeaPack: { fontSize: 10, lineHeight: 12, fontWeight: '900', letterSpacing: 0.55, textTransform: 'uppercase' },
  moreIdeaTitle: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
  moreIdeaAction: { fontSize: 11, lineHeight: 14, fontWeight: '900' },
  actionBar: { position: 'absolute', left: -18, right: -18, bottom: 0, flexDirection: 'row', flexWrap: 'wrap', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 16 },
  tertiaryButton: { width: '100%', minHeight: 42, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  tertiaryButtonText: { textAlign: 'center', fontSize: 12, lineHeight: 15, fontWeight: '900' },
  secondaryButton: { flex: 1, minHeight: 50, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  secondaryButtonText: { textAlign: 'center', fontSize: 13, lineHeight: 16, fontWeight: '900' },
  primaryButton: { flex: 1, minHeight: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  primaryButtonText: { textAlign: 'center', fontSize: 13, lineHeight: 16, fontWeight: '900' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
