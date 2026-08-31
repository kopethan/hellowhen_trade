import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { InventoryTemplateDto } from '@hellowhen/contracts';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/errors';
import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import {
  DetailBottomActionBar,
  DetailEmptyState,
  DetailHero,
  DetailImageGrid,
  DetailInfoList,
  DetailMetadataChips,
  DetailSection,
} from '../../components/detail';
import { useAuth } from '../../providers/AuthProvider';
import { useThemeTokens } from '../../providers/ThemeProvider';
import { useTranslation } from '../../providers/MobileI18nProvider';
import {
  availabilityPresetLabel,
  categoryLabel,
  durationPresetLabel,
  itemTypeLabel,
  modeLabel,
} from '../trade/components/InventoryFormFields';
import { resolveMediaVariantUrl } from '../trade/mediaUrls';

type InventoryIdeaKind = 'need' | 'offer';
type TemplateResponse = InventoryTemplateDto | { template?: InventoryTemplateDto };
type CloneTemplateResponse = { need?: { id?: string }; offer?: { id?: string } };
type ExploreInventoryAction = 'add' | 'trade' | null;
type TFunction = (key: string, values?: Record<string, string | number | boolean | null | undefined>) => string;

function unwrapTemplate(response: TemplateResponse): InventoryTemplateDto | null {
  if ('template' in response) return response.template ?? null;
  return response;
}

function sourceLabel(template: InventoryTemplateDto, t: TFunction) {
  if (template.businessProfile?.displayName) {
    return t('inventory.sourceLabels.fromBusiness', { name: template.businessProfile.displayName });
  }
  if (template.sourceType === 'brand') return t('inventory.sourceLabels.brandLibrary');
  if (template.sourceType === 'business') return t('inventory.sourceLabels.companyLibrary');
  if (template.sourceType === 'partner') return t('inventory.sourceLabels.partnerLibrary');
  return t('inventory.sourceLabels.hellowhenLibrary');
}

function templateImages(template: InventoryTemplateDto | null) {
  return (template?.media ?? [])
    .filter((media) => media.status === undefined || media.status === 'active')
    .map((media, index) => ({
      id: media.id,
      uri: resolveMediaVariantUrl(media, 'full'),
      accessibilityLabel: `${template?.title ?? ''} ${index + 1}`.trim(),
    }))
    .filter((image) => Boolean(image.uri));
}

function ExploreInventoryIdeaDetailScreen({
  kind,
  templateId,
  fallbackTitle,
}: {
  kind: InventoryIdeaKind;
  templateId: string;
  fallbackTitle?: string;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useThemeTokens();
  const auth = useAuth();
  const { t } = useTranslation();
  const [template, setTemplate] = useState<InventoryTemplateDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const [action, setAction] = useState<ExploreInventoryAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const label = kind === 'need' ? t('inventory.labels.need') : t('inventory.labels.offer');
  const headerTitle = `${t('common.librarySegments.explore')} · ${label}`;

  const loadTemplate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.inventoryTemplates.get(templateId) as TemplateResponse;
      const nextTemplate = unwrapTemplate(response);
      if (!nextTemplate || nextTemplate.kind !== kind || nextTemplate.status !== 'active') {
        throw new Error(t('inventory.errors.apiMissingItem', { item: label }));
      }
      setTemplate(nextTemplate);
    } catch (caughtError) {
      setTemplate(null);
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [kind, label, t, templateId]);

  useEffect(() => {
    void loadTemplate();
  }, [loadTemplate]);

  useEffect(() => {
    setCopiedItemId(null);
    setActionError(null);
  }, [kind, templateId]);

  const ensureUserCopy = useCallback(async () => {
    if (copiedItemId) return copiedItemId;
    if (!template) throw new Error(t('inventory.errors.starterLibraryCouldNotLoad'));

    const response = await api.inventoryTemplates.clone(template.id, { status: 'active' }) as CloneTemplateResponse;
    const nextId = kind === 'need' ? response.need?.id : response.offer?.id;
    if (!nextId) throw new Error(t('inventory.errors.apiMissingItem', { item: label }));
    setCopiedItemId(nextId);
    return nextId;
  }, [copiedItemId, kind, label, t, template]);

  const requireSignedIn = useCallback(() => {
    if (auth.isAuthenticated) return true;
    navigation.navigate('Login');
    return false;
  }, [auth.isAuthenticated, navigation]);

  const addToMine = useCallback(async () => {
    if (!requireSignedIn() || copiedItemId || action) return;
    setAction('add');
    setActionError(null);
    try {
      await ensureUserCopy();
    } catch (caughtError) {
      setActionError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setAction(null);
    }
  }, [action, copiedItemId, ensureUserCopy, requireSignedIn]);

  const startTrade = useCallback(async () => {
    if (!requireSignedIn() || action) return;
    setAction('trade');
    setActionError(null);
    try {
      const itemId = await ensureUserCopy();
      navigation.navigate('CreateTrade', kind === 'need'
        ? { initialPostType: 'need_offer', initialNeedSelection: { side: 'need', kind: 'need', id: itemId } }
        : { initialPostType: 'need_offer', initialOfferSelection: { side: 'offer', kind: 'offer', id: itemId } });
    } catch (caughtError) {
      setActionError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setAction(null);
    }
  }, [action, ensureUserCopy, kind, navigation, requireSignedIn]);

  const images = useMemo(() => templateImages(template), [template]);
  const detailChips = useMemo(() => {
    if (!template) return [];
    return [
      itemTypeLabel(template.itemType ?? 'service', t),
      categoryLabel(template.category, t),
      template.mode ? modeLabel(template.mode, t) : '',
    ].filter(Boolean);
  }, [t, template]);
  const timing = template
    ? (kind === 'need' ? template.timing : template.availability)
    : null;
  const availability = template ? availabilityPresetLabel(template.availabilityPreset, t) : '';
  const duration = template ? durationPresetLabel(template.durationPreset, t) : '';

  return (
    <AppFixedHeaderScreen
      header={<AppHeader title={headerTitle} onBack={() => navigation.goBack()} />}
      bodyStyle={styles.body}
    >
      {loading ? (
        <View style={styles.centered} accessibilityRole="progressbar">
          <ActivityIndicator color={theme.color.text} />
          <AppText style={[styles.loadingText, { color: theme.color.muted }]}>{t('common.states.loading')}</AppText>
        </View>
      ) : error || !template ? (
        <View style={styles.stateWrap}>
          <DetailEmptyState
            icon={kind === 'need' ? 'need' : 'offer'}
            title={t('inventory.errors.unavailable', { item: label })}
            body={error ?? t('inventory.errors.starterLibraryCouldNotLoad')}
            actionLabel={t('common.actions.tryAgain')}
            onAction={() => { void loadTemplate(); }}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <DetailHero
            eyebrow={`${t('common.librarySegments.explore')} · ${label}`}
            title={template.title || fallbackTitle || label}
            subtitle={template.description}
            meta={sourceLabel(template, t)}
          >
            <DetailMetadataChips chips={detailChips} compact />
          </DetailHero>

          <DetailSection title={t('inventory.labels.details')}>
            <DetailInfoList
              rows={[
                {
                  label: kind === 'need' ? t('inventory.labels.timing') : t('inventory.labels.availability'),
                  value: timing || availability,
                },
                ...(timing && availability ? [{ label: t('inventory.libraryFilters.availability'), value: availability }] : []),
                { label: t('inventory.libraryFilters.duration'), value: duration },
                { label: t('inventory.labels.location'), value: template.locationLabel },
              ]}
            />
          </DetailSection>

          {template.tags?.length ? (
            <DetailSection title={t('inventory.labels.tags')}>
              <DetailMetadataChips chips={template.tags} compact />
            </DetailSection>
          ) : null}

          {kind === 'offer' && template.includes?.length ? (
            <DetailSection title={t('inventory.labels.includes')}>
              <View style={styles.list}>
                {template.includes.map((item, index) => (
                  <AppText key={`${template.id}-include-${index}`} style={styles.listItem}>• {item}</AppText>
                ))}
              </View>
            </DetailSection>
          ) : null}

          {images.length ? (
            <DetailSection title={t('inventory.labels.images')}>
              <DetailImageGrid images={images} maxVisible={5} />
            </DetailSection>
          ) : null}

          <DetailBottomActionBar
            layout="primaryBelow"
            helper={actionError ?? (copiedItemId ? t('common.exploreActions.addedHelper') : t('common.exploreActions.helper'))}
            secondary={[{
              label: copiedItemId
                ? t(kind === 'need' ? 'common.exploreActions.addedNeed' : 'common.exploreActions.addedOffer')
                : action === 'add'
                  ? t('common.states.saving')
                  : t(kind === 'need' ? 'common.exploreActions.addNeed' : 'common.exploreActions.addOffer'),
              disabled: Boolean(copiedItemId || action),
              onPress: () => { void addToMine(); },
            }]}
            primary={{
              label: t('common.exploreActions.startTrade'),
              loading: action === 'trade',
              disabled: Boolean(action === 'add'),
              onPress: () => { void startTrade(); },
            }}
          />
        </ScrollView>
      )}
    </AppFixedHeaderScreen>
  );
}

export function ExploreNeedIdeaDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'NeedIdeaDetail'>>();
  return <ExploreInventoryIdeaDetailScreen kind="need" templateId={route.params.templateId} fallbackTitle={route.params.title} />;
}

export function ExploreOfferIdeaDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'OfferIdeaDetail'>>();
  return <ExploreInventoryIdeaDetailScreen kind="offer" templateId={route.params.templateId} fallbackTitle={route.params.title} />;
}

const styles = StyleSheet.create({
  body: { minHeight: 0 },
  content: { paddingBottom: 36 },
  centered: { flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontSize: 14, fontWeight: '700' },
  stateWrap: { flex: 1, justifyContent: 'center', paddingVertical: 24 },
  list: { gap: 8 },
  listItem: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
});
